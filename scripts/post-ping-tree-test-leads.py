#!/usr/bin/env python3
"""
Post test leads to /api/lead for ping tree allocation testing.

Requires: pip install requests

Example:
  python scripts/post-ping-tree-test-leads.py
  python scripts/post-ping-tree-test-leads.py --base-url http://localhost:3000 --count 100
  python scripts/post-ping-tree-test-leads.py --verify-redirect
"""

from __future__ import annotations

import argparse
import json
import secrets
import sys
import time
from typing import Any

import requests

DEFAULT_BASE_URL = "http://localhost:3000"
DEFAULT_API_KEY = "F70CA7E0AC1E382ACB5EDD53F0C79935"
DEFAULT_COUNT = 100

LEAD_TEMPLATE: dict[str, Any] = {
    "fname": "Jim",
    "lname": "Vu2",
    "phone": "6235874587",
    "date_subscribed": "01/14/2021 12:33 pm",
    "address": "4599 E Jackson St.",
    "city": "Phoenix",
    "state": "AZ",
    "zip": "85245",
    "country": "US",
    "ip": "52.14.144.85",
    "gender": "M",
    "offer_url": "newofferurl.com/offer1.html",
    "date_of_birth": "02/05/1985",
    "notes": "",
    "subId": "Facebook",
}


def build_unique_email(index: int, run_tag: str) -> str:
    """Unique email per lead: timestamp run tag + index + random suffix."""
    random_part = secrets.token_hex(4)
    return f"lead.{run_tag}.{index:04d}.{random_part}@mailtest.local"


def build_payload(index: int, run_tag: str) -> dict[str, Any]:
    payload = dict(LEAD_TEMPLATE)
    payload["email"] = build_unique_email(index, run_tag)
    return payload


def extract_redirect_url(response: Any) -> str | None:
    if not isinstance(response, dict):
        return None
    redirect_url = response.get("redirect_url") or response.get("redirectUrl") or response.get("direct_url")
    if isinstance(redirect_url, str) and redirect_url.strip():
        return redirect_url.strip()
    return None


def extract_status(response: Any) -> str | None:
    if not isinstance(response, dict):
        return None
    status_text = response.get("status_text") or response.get("statusText")
    if isinstance(status_text, str) and status_text.strip():
        return status_text.strip()
    status = response.get("status")
    if status is not None:
        return str(status)
    return None


def post_lead(
    session: requests.Session, base_url: str, api_key: str, index: int, run_tag: str
) -> dict[str, Any]:
    url = f"{base_url.rstrip('/')}/api/lead"
    payload = build_payload(index, run_tag)
    headers = {
        "Content-Type": "application/json",
        "x-api-key": api_key,
    }

    started = time.perf_counter()
    response = session.post(url, headers=headers, json=payload, timeout=120)
    elapsed_ms = round((time.perf_counter() - started) * 1000, 1)

    try:
        body: Any = response.json()
    except ValueError:
        body = response.text

    redirect_url = extract_redirect_url(body)
    redirect_target: str | None = None
    redirect_status: int | None = None

    return {
        "index": index,
        "email": payload["email"],
        "status_code": response.status_code,
        "elapsed_ms": elapsed_ms,
        "response": body,
        "publisher_status": extract_status(body),
        "redirect_url": redirect_url,
        "redirect_target": redirect_target,
        "redirect_status": redirect_status,
    }


def verify_redirect(
    session: requests.Session, redirect_url: str
) -> tuple[str | None, int | None]:
    response = session.get(redirect_url, allow_redirects=False, timeout=30)
    location = response.headers.get("Location")
    return location, response.status_code


def print_result(result: dict[str, Any]) -> None:
    print("-" * 72)
    print(f"[{result['index']:03d}] {result['email']}")
    print(f"HTTP {result['status_code']} ({result['elapsed_ms']} ms)")
    if result.get("publisher_status"):
        print(f"Publisher status: {result['publisher_status']}")
    if result.get("redirect_url"):
        print(f"redirect_url: {result['redirect_url']}")
        if result.get("redirect_target"):
            print(
                f"Redirect verify: HTTP {result.get('redirect_status')} -> {result['redirect_target']}"
            )
    print(json.dumps(result["response"], indent=2, ensure_ascii=False))


def main() -> int:
    parser = argparse.ArgumentParser(description="Post test leads to /api/lead")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL, help="App base URL")
    parser.add_argument("--api-key", default=DEFAULT_API_KEY, help="Publisher channel x-api-key")
    parser.add_argument("--count", type=int, default=DEFAULT_COUNT, help="Number of leads to post")
    parser.add_argument("--start-index", type=int, default=1, help="First index for unique emails")
    parser.add_argument(
        "--delay-ms",
        type=int,
        default=100,
        help="Delay between requests in milliseconds (default: 100)",
    )
    parser.add_argument(
        "--summary-only",
        action="store_true",
        help="Print only a summary (no per-lead response body)",
    )
    parser.add_argument(
        "--verify-redirect",
        action="store_true",
        help="Follow redirect_url once per sold lead and print final Location header",
    )
    args = parser.parse_args()

    if args.count <= 0:
        print("count must be > 0", file=sys.stderr)
        return 1

    session = requests.Session()
    results: list[dict[str, Any]] = []
    run_tag = str(int(time.time() * 1000))

    print(f"Posting {args.count} lead(s) to {args.base_url.rstrip('/')}/api/lead")
    print(f"API key: {args.api_key[:8]}...")
    print(f"Email run tag: {run_tag}")

    for offset in range(args.count):
        index = args.start_index + offset
        try:
            result = post_lead(session, args.base_url, args.api_key, index, run_tag)
        except requests.RequestException as exc:
            print(f"[{index:03d}] REQUEST ERROR: {exc}", file=sys.stderr)
            results.append({"index": index, "status_code": 0, "response": str(exc)})
            continue

        if args.verify_redirect and result.get("redirect_url"):
            try:
                target, status = verify_redirect(session, result["redirect_url"])
                result["redirect_target"] = target
                result["redirect_status"] = status
            except requests.RequestException as exc:
                result["redirect_target"] = f"ERROR: {exc}"
                result["redirect_status"] = 0

        results.append(result)
        if not args.summary_only:
            print_result(result)

        if args.delay_ms > 0 and offset < args.count - 1:
            time.sleep(args.delay_ms / 1000)

    status_counts: dict[int, int] = {}
    sold_count = 0
    redirect_count = 0
    verified_tiktok_count = 0

    for item in results:
        code = int(item.get("status_code", 0))
        status_counts[code] = status_counts.get(code, 0) + 1

        publisher_status = str(item.get("publisher_status") or "").lower()
        if publisher_status in {"accepted", "sold", "1"}:
            sold_count += 1

        redirect_url = item.get("redirect_url")
        if isinstance(redirect_url, str) and redirect_url:
            redirect_count += 1

        redirect_target = item.get("redirect_target")
        if isinstance(redirect_target, str) and "tiktok.com" in redirect_target.lower():
            verified_tiktok_count += 1

    print("=" * 72)
    print("SUMMARY")
    print(f"Total sent: {len(results)}")
    for code in sorted(status_counts):
        print(f"  HTTP {code}: {status_counts[code]}")
    print(f"  Sold / Accepted: {sold_count}")
    print(f"  With redirect_url: {redirect_count}")
    if args.verify_redirect:
        print(f"  Redirect -> tiktok.com: {verified_tiktok_count}")

    return 0 if status_counts.get(0, 0) == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
