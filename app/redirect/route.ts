import { NextResponse } from "next/server";
import { parseRedirectLeadId } from "@/lib/publisher-redirect";
import { resolvePublisherRedirect } from "@/lib/publisher-redirect-server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const leadId = parseRedirectLeadId(searchParams.get("id") ?? searchParams.get("leadId"));

  if (!leadId) {
    return NextResponse.json({ message: "Missing lead id." }, { status: 400 });
  }

  const result = await resolvePublisherRedirect(leadId);
  if (!result.ok) {
    return NextResponse.json({ message: result.message }, { status: result.status });
  }

  return NextResponse.redirect(result.targetUrl, 302);
}
