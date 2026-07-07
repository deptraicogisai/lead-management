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
  buildMockBuyerResponseFromOptions,
  DEFAULT_CAMPAIGN_TEST_MOCK,
} from "@/lib/campaign-test-mock";

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

export async function handleMockBuyerLeadPost(req: Request, context?: { buyerId?: string }) {
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

    const response = resolveMockBuyerResponse(mockOptions);

    return NextResponse.json(response);
  } catch {
    return NextResponse.json(
      { status: "Error", error_reason: "Mock buyer post failed unexpectedly." },
      { status: 500 }
    );
  }
}
