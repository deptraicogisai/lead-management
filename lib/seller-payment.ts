export const PAYMENT_METHODS = [
  { value: "paypal", label: "PayPal" },
  { value: "payoneer", label: "Payoneer" },
  { value: "wire", label: "Wire Transfer" },
  { value: "ach", label: "ACH" },
  { value: "crypto", label: "Crypto (USDT)" },
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]["value"];

export const ACH_ACCOUNT_TYPES = [
  { value: "checking", label: "Checking" },
  { value: "savings", label: "Savings" },
] as const;

export type AchAccountType = (typeof ACH_ACCOUNT_TYPES)[number]["value"];

export const CRYPTO_NETWORKS = [
  { value: "trc20", label: "USDT - TRC20 (Recommended)" },
  { value: "erc20", label: "USDT - ERC20" },
  { value: "bep20", label: "USDT - BEP20" },
] as const;

export type CryptoNetwork = (typeof CRYPTO_NETWORKS)[number]["value"];

export type SellerPaymentSettings = {
  method: PaymentMethod | "";
  paypalEmail: string;
  payoneerEmail: string;
  accountHolderName: string;
  beneficiaryName: string;
  bankName: string;
  swiftBic: string;
  accountNumberIban: string;
  bankAddress: string;
  achAccountType: AchAccountType | "";
  achRoutingNumber: string;
  achAccountNumber: string;
  cryptoNetwork: CryptoNetwork | "";
  cryptoWalletAddress: string;
};

export const emptySellerPaymentSettings = (): SellerPaymentSettings => ({
  method: "",
  paypalEmail: "",
  payoneerEmail: "",
  accountHolderName: "",
  beneficiaryName: "",
  bankName: "",
  swiftBic: "",
  accountNumberIban: "",
  bankAddress: "",
  achAccountType: "",
  achRoutingNumber: "",
  achAccountNumber: "",
  cryptoNetwork: "",
  cryptoWalletAddress: "",
});

function trim(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isPaymentMethod(value: string): value is PaymentMethod {
  return PAYMENT_METHODS.some((option) => option.value === value);
}

function isAchAccountType(value: string): value is AchAccountType {
  return ACH_ACCOUNT_TYPES.some((option) => option.value === value);
}

function isCryptoNetwork(value: string): value is CryptoNetwork {
  return CRYPTO_NETWORKS.some((option) => option.value === value);
}

export function sanitizeSellerPaymentSettings(input: unknown): SellerPaymentSettings {
  const body = input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
  const methodValue = trim(body.method);

  return {
    method: isPaymentMethod(methodValue) ? methodValue : "",
    paypalEmail: trim(body.paypalEmail),
    payoneerEmail: trim(body.payoneerEmail),
    accountHolderName: trim(body.accountHolderName),
    beneficiaryName: trim(body.beneficiaryName),
    bankName: trim(body.bankName),
    swiftBic: trim(body.swiftBic),
    accountNumberIban: trim(body.accountNumberIban),
    bankAddress: trim(body.bankAddress),
    achAccountType: isAchAccountType(trim(body.achAccountType)) ? trim(body.achAccountType) as AchAccountType : "",
    achRoutingNumber: trim(body.achRoutingNumber),
    achAccountNumber: trim(body.achAccountNumber),
    cryptoNetwork: isCryptoNetwork(trim(body.cryptoNetwork)) ? trim(body.cryptoNetwork) as CryptoNetwork : "",
    cryptoWalletAddress: trim(body.cryptoWalletAddress),
  };
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export type SellerPaymentFieldErrorKey =
  | "method"
  | "paypalEmail"
  | "payoneerEmail"
  | "accountHolderName"
  | "beneficiaryName"
  | "bankName"
  | "swiftBic"
  | "accountNumberIban"
  | "bankAddress"
  | "achAccountType"
  | "achRoutingNumber"
  | "achAccountNumber"
  | "cryptoNetwork"
  | "cryptoWalletAddress";

export type SellerPaymentFieldErrors = Partial<Record<SellerPaymentFieldErrorKey, string>>;

const REQUIRED_FIELDS_BY_METHOD: Record<PaymentMethod, SellerPaymentFieldErrorKey[]> = {
  paypal: ["paypalEmail"],
  payoneer: ["payoneerEmail", "accountHolderName"],
  wire: ["beneficiaryName", "bankName", "swiftBic", "accountNumberIban", "bankAddress"],
  ach: ["accountHolderName", "achAccountType", "achRoutingNumber", "achAccountNumber"],
  crypto: ["cryptoNetwork", "cryptoWalletAddress"],
};

export function isSellerPaymentFieldRequired(
  method: PaymentMethod | "",
  field: SellerPaymentFieldErrorKey
): boolean {
  if (field === "method") return true;
  if (!method) return false;
  return REQUIRED_FIELDS_BY_METHOD[method]?.includes(field) ?? false;
}

export function collectSellerPaymentFieldErrors(settings: SellerPaymentSettings): SellerPaymentFieldErrors {
  const errors: SellerPaymentFieldErrors = {};

  if (!settings.method) {
    errors.method = "Payment method is required.";
    return errors;
  }

  switch (settings.method) {
    case "paypal":
      if (!settings.paypalEmail.trim()) {
        errors.paypalEmail = "PayPal email address is required.";
      } else if (!isValidEmail(settings.paypalEmail)) {
        errors.paypalEmail = "PayPal email address is invalid.";
      }
      break;
    case "payoneer":
      if (!settings.payoneerEmail.trim()) {
        errors.payoneerEmail = "Payoneer email address is required.";
      } else if (!isValidEmail(settings.payoneerEmail)) {
        errors.payoneerEmail = "Payoneer email address is invalid.";
      }
      if (!settings.accountHolderName.trim()) errors.accountHolderName = "Account holder name is required.";
      break;
    case "wire":
      if (!settings.beneficiaryName.trim()) errors.beneficiaryName = "Beneficiary name is required.";
      if (!settings.bankName.trim()) errors.bankName = "Bank name is required.";
      if (!settings.swiftBic.trim()) errors.swiftBic = "SWIFT / BIC code is required.";
      if (!settings.accountNumberIban.trim()) errors.accountNumberIban = "Account number / IBAN is required.";
      if (!settings.bankAddress.trim()) errors.bankAddress = "Bank address is required.";
      break;
    case "ach":
      if (!settings.accountHolderName.trim()) errors.accountHolderName = "Account holder name is required.";
      if (!settings.achAccountType) errors.achAccountType = "Account type is required.";
      if (!settings.achRoutingNumber.trim()) {
        errors.achRoutingNumber = "Routing number is required.";
      } else if (!/^\d{9}$/.test(settings.achRoutingNumber)) {
        errors.achRoutingNumber = "Routing number must be 9 digits.";
      }
      if (!settings.achAccountNumber.trim()) errors.achAccountNumber = "Account number is required.";
      break;
    case "crypto":
      if (!settings.cryptoNetwork) errors.cryptoNetwork = "Crypto network is required.";
      if (!settings.cryptoWalletAddress.trim()) errors.cryptoWalletAddress = "USDT wallet address is required.";
      break;
    default:
      break;
  }

  return errors;
}

export function validateSellerPaymentSettings(settings: SellerPaymentSettings): string | null {
  const errors = collectSellerPaymentFieldErrors(settings);
  const firstError = Object.values(errors)[0];
  return firstError ?? null;
}

type SellerPaymentDoc = {
  _id?: { toString(): string };
  method?: string | null;
  paypalEmail?: string | null;
  payoneerEmail?: string | null;
  accountHolderName?: string | null;
  beneficiaryName?: string | null;
  bankName?: string | null;
  swiftBic?: string | null;
  accountNumberIban?: string | null;
  bankAddress?: string | null;
  achAccountType?: string | null;
  achRoutingNumber?: string | null;
  achAccountNumber?: string | null;
  cryptoNetwork?: string | null;
  cryptoWalletAddress?: string | null;
};

export type SellerPaymentRecord = SellerPaymentSettings & {
  id: string;
  displayId: number;
};

export function formatPaymentMethodLabel(method: PaymentMethod | "") {
  return PAYMENT_METHODS.find((option) => option.value === method)?.label ?? (method || "—");
}

export function toSellerPaymentResponse(doc: SellerPaymentDoc, displayId: number): SellerPaymentRecord {
  const settings = sanitizeSellerPaymentSettings(doc);
  return {
    id: doc._id?.toString() ?? "",
    displayId,
    ...settings,
  };
}

export function toSellerPaymentSettings(doc: SellerPaymentDoc | null | undefined): SellerPaymentSettings {
  if (!doc) return emptySellerPaymentSettings();
  return sanitizeSellerPaymentSettings(doc);
}
