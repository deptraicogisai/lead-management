import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { ensureSellerCollectionMigrated, SellerModel } from "@/lib/models/seller";
import {
  sanitizeSellerPaymentSettings,
  toSellerPaymentResponse,
  validateSellerPaymentSettings,
} from "@/lib/seller-payment";

type Params = { params: Promise<{ id: string; paymentId: string }> };

type PaymentDoc = Parameters<typeof toSellerPaymentResponse>[0] & { _id?: { toString(): string } };

const PAYMENT_FIELD_KEYS = [
  "method",
  "paypalEmail",
  "payoneerEmail",
  "accountHolderName",
  "beneficiaryName",
  "bankName",
  "swiftBic",
  "accountNumberIban",
  "bankAddress",
  "achAccountType",
  "achRoutingNumber",
  "achAccountNumber",
  "cryptoNetwork",
  "cryptoWalletAddress",
] as const;

export async function PATCH(req: Request, context: Params) {
  try {
    const { id, paymentId } = await context.params;
    const body = await req.json();
    const settings = sanitizeSellerPaymentSettings(body);
    const validationError = validateSellerPaymentSettings(settings);
    if (validationError) {
      return NextResponse.json({ message: validationError }, { status: 400 });
    }

    await connectToDatabase();
    await ensureSellerCollectionMigrated();

    const updatePayload = Object.fromEntries(
      PAYMENT_FIELD_KEYS.map((key) => [`payments.$.${key}`, settings[key]])
    );

    const seller = await SellerModel.findOneAndUpdate(
      { _id: id, "payments._id": paymentId },
      { $set: updatePayload },
      { new: true }
    ).lean();

    if (!seller) {
      return NextResponse.json({ message: "Payment info not found." }, { status: 404 });
    }

    const payments = (Array.isArray(seller.payments) ? seller.payments : []) as PaymentDoc[];
    const index = payments.findIndex((item) => item._id?.toString() === paymentId);
    const payment = index >= 0 ? payments[index] : null;

    if (!payment) {
      return NextResponse.json({ message: "Payment info not found." }, { status: 404 });
    }

    return NextResponse.json(toSellerPaymentResponse(payment, index + 1));
  } catch {
    return NextResponse.json({ message: "Failed to update payment info." }, { status: 500 });
  }
}

export async function DELETE(_: Request, context: Params) {
  try {
    const { id, paymentId } = await context.params;

    await connectToDatabase();
    await ensureSellerCollectionMigrated();

    const seller = await SellerModel.findOneAndUpdate(
      { _id: id, "payments._id": paymentId },
      { $pull: { payments: { _id: paymentId } } },
      { new: true }
    ).lean();

    if (!seller) {
      return NextResponse.json({ message: "Payment info not found." }, { status: 404 });
    }

    return NextResponse.json({ message: "Payment info deleted." });
  } catch {
    return NextResponse.json({ message: "Failed to delete payment info." }, { status: 500 });
  }
}
