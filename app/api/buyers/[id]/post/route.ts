import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { BuyerModel } from "@/lib/models/buyer";
import {
  mergeMockBuyerPostOptionRecords,
  readMockBuyerPostHeaders,
  readMockBuyerPostOptionsFromBody,
  sleep,
} from "@/lib/mock-buyer-post";
import {
  buildCampaignTestMockBuyerResponse,
  buildMockBuyerResponseFromOptions,
  DEFAULT_CAMPAIGN_TEST_MOCK,
} from "@/lib/campaign-test-mock";

type Params = { params: Promise<{ id: string }> };

function buildControlledMockBuyerResponse(buyerPrice: number) {
  return buildMockBuyerResponseFromOptions({ buyerPrice, status: "Accept", statusText: "Accepted" });
}

function resolveMockBuyerResponse(mockOptions?: ReturnType<typeof readMockBuyerPostHeaders>) {
  if (mockOptions?.response && Object.keys(mockOptions.response).length > 0) {
    return mockOptions.response;
  }

  if (mockOptions) {
    if (mockOptions.status || mockOptions.statusText || mockOptions.reason) {
      return buildMockBuyerResponseFromOptions(mockOptions);
    }

    if (mockOptions.buyerPrice != null) {
      return buildControlledMockBuyerResponse(mockOptions.buyerPrice);
    }
  }

  return buildCampaignTestMockBuyerResponse(DEFAULT_CAMPAIGN_TEST_MOCK);
}

export async function POST(req: Request, context: Params) {
  try {
    const { id } = await context.params;

    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ status: "Error", error_reason: "Invalid buyer id." }, { status: 400 });
    }

    await connectToDatabase();
    const buyer = await BuyerModel.findById(id).select({ company: 1, status: 1 }).lean();
    if (!buyer) {
      return NextResponse.json({ status: "Error", error_reason: "Buyer not found." }, { status: 404 });
    }

    const requestBody = await req.json().catch(() => ({}));
    const mockOptions = mergeMockBuyerPostOptionRecords(
      readMockBuyerPostOptionsFromBody(requestBody),
      readMockBuyerPostHeaders(req)
    );

    if (mockOptions?.responseDelaySeconds && mockOptions.responseDelaySeconds > 0) {
      await sleep(mockOptions.responseDelaySeconds * 1000);
    }

    const response = resolveMockBuyerResponse(mockOptions);

    return NextResponse.json({
      ...response,
      buyerId: id,
      buyerCompany: buyer.company ?? "",
      echo: requestBody,
      receivedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { status: "Error", error_reason: "Mock buyer post failed unexpectedly." },
      { status: 500 }
    );
  }
}
