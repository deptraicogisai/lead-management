import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { ensureSellerCollectionMigrated, SellerModel } from "@/lib/models/seller";
import {
  sanitizeSellerPaymentSettings,
  toSellerPaymentResponse,
  validateSellerPaymentSettings,
} from "@/lib/seller-payment";

type Params = { params: Promise<{ id: string }> };

type PaymentDoc = Parameters<typeof toSellerPaymentResponse>[0];

function buildPaymentDocument(body: unknown) {
  return sanitizeSellerPaymentSettings(body);
}

export async function GET(_: Request, context: Params) {
  try {
    const { id } = await context.params;
    await connectToDatabase();
    await ensureSellerCollectionMigrated();

    const seller = await SellerModel.findById(id).lean();
    if (!seller) {
      return NextResponse.json({ message: "Publisher not found." }, { status: 404 });
    }

    const payments = (Array.isArray(seller.payments) ? seller.payments : []) as PaymentDoc[];
    return NextResponse.json(payments.map((payment, index) => toSellerPaymentResponse(payment, index + 1)));
  } catch {
    return NextResponse.json({ message: "Failed to fetch payment info." }, { status: 500 });
  }
}

export async function POST(req: Request, context: Params) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const settings = buildPaymentDocument(body);
    const validationError = validateSellerPaymentSettings(settings);
    if (validationError) {
      return NextResponse.json({ message: validationError }, { status: 400 });
    }

    await connectToDatabase();
    await ensureSellerCollectionMigrated();

    const seller = await SellerModel.findById(id);
    if (!seller) {
      return NextResponse.json({ message: "Publisher not found." }, { status: 404 });
    }

    seller.payments.push(settings);
    await seller.save();

    const created = seller.payments[seller.payments.length - 1] as PaymentDoc;
    return NextResponse.json(toSellerPaymentResponse(created, seller.payments.length), { status: 201 });
  } catch {
    return NextResponse.json({ message: "Failed to create payment info." }, { status: 500 });
  }
}
