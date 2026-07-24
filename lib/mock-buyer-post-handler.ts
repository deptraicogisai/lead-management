import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { BUYER_API_KEY_HEADER } from "@/lib/buyer-lead-api";
import { BuyerModel } from "@/lib/models/buyer";
import {
  mergeMockBuyerPostOptionRecords,
  readMockBuyerPostHeaders,
  readMockBuyerPostOptionsFromBody,
  sleep,
} from "@/lib/mock-buyer-post";
import {
  buildCampaignTestMockBuyerResponse,
  buildCampaignTestMockPingBuyerResponse,
  buildMockBuyerResponseFromOptions,
  DEFAULT_CAMPAIGN_TEST_MOCK,
  DEFAULT_CAMPAIGN_TEST_PING_MOCK,
} from "@/lib/campaign-test-mock";

function buildControlledMockBuyerResponse(buyerPrice: number) {
  return buildMockBuyerResponseFromOptions({ buyerPrice, status: "Accept", statusText: "Accepted" });
}

function resolveMockBuyerResponse(
  mockOptions?: ReturnType<typeof readMockBuyerPostHeaders>,
  phase: "ping" | "post" = "post"
) {
  if (mockOptions?.response && Object.keys(mockOptions.response).length > 0) {
    return mockOptions.response;
  }

  if (mockOptions) {
    if (mockOptions.status || mockOptions.statusText || mockOptions.reason) {
      if (phase === "ping") {
        const normalized = (mockOptions.status || mockOptions.statusText || "").trim().toLowerCase();
        const isAccept = ["accept", "accepted", "1", "true", "yes"].includes(normalized);
        return buildCampaignTestMockPingBuyerResponse({
          ...DEFAULT_CAMPAIGN_TEST_PING_MOCK,
          status: isAccept ? "Accept" : "Reject",
          reasons: mockOptions.reason
            ? [mockOptions.reason]
            : [...DEFAULT_CAMPAIGN_TEST_PING_MOCK.reasons],
          timeoutSeconds: mockOptions.responseDelaySeconds ?? 0,
        });
      }
      return buildMockBuyerResponseFromOptions(mockOptions);
    }

    if (mockOptions.buyerPrice != null && phase !== "ping") {
      return buildControlledMockBuyerResponse(mockOptions.buyerPrice);
    }
  }

  if (phase === "ping") {
    return buildCampaignTestMockPingBuyerResponse(DEFAULT_CAMPAIGN_TEST_PING_MOCK);
  }

  return buildCampaignTestMockBuyerResponse(DEFAULT_CAMPAIGN_TEST_MOCK);
}

export async function handleMockBuyerLeadPost(
  req: Request,
  context?: { buyerId?: string; phase?: "ping" | "post" }
) {
  try {
    const buyerId = context?.buyerId?.trim();
    const headerApiKey = req.headers.get(BUYER_API_KEY_HEADER)?.trim() ?? "";

    let buyer:
      | {
          _id?: { toString(): string };
          company?: string | null;
          status?: string | null;
          apiKey?: string | null;
        }
      | null = null;

    if (buyerId) {
      if (!Types.ObjectId.isValid(buyerId)) {
        return NextResponse.json({ status: "Error", error_reason: "Invalid buyer id." }, { status: 400 });
      }

      buyer = await BuyerModel.findById(buyerId).select({ company: 1, status: 1, apiKey: 1 }).lean();
      if (!buyer) {
        return NextResponse.json({ status: "Error", error_reason: "Buyer not found." }, { status: 404 });
      }

      const expectedApiKey = buyer.apiKey?.trim() ?? "";
      if (expectedApiKey && headerApiKey && headerApiKey !== expectedApiKey) {
        return NextResponse.json({ status: "Error", error_reason: "Invalid API key." }, { status: 401 });
      }
    } else {
      if (!headerApiKey) {
        return NextResponse.json(
          { status: "Error", error_reason: "Invalid API key." },
          { status: 401 }
        );
      }

      buyer = await BuyerModel.findOne({ apiKey: headerApiKey })
        .select({ company: 1, status: 1, apiKey: 1 })
        .lean();

      if (!buyer) {
        return NextResponse.json({ status: "Error", error_reason: "Invalid API key." }, { status: 401 });
      }
    }

    if (buyer.status && buyer.status !== "Active") {
      return NextResponse.json(
        { status: "Error", error_reason: `Buyer is ${buyer.status}.` },
        { status: 403 }
      );
    }

    const requestBody = await req.json().catch(() => ({}));
    const mockOptions = mergeMockBuyerPostOptionRecords(
      readMockBuyerPostOptionsFromBody(requestBody),
      readMockBuyerPostHeaders(req)
    );

    if (mockOptions?.responseDelaySeconds && mockOptions.responseDelaySeconds > 0) {
      await sleep(mockOptions.responseDelaySeconds * 1000);
    }

    const phase = context?.phase === "ping" ? "ping" : "post";
    const response = resolveMockBuyerResponse(mockOptions, phase);

    return NextResponse.json(response);
  } catch {
    return NextResponse.json(
      { status: "Error", error_reason: "Mock buyer post failed unexpectedly." },
      { status: 500 }
    );
  }
}
