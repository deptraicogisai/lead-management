"use client";

import { Check, CreditCard, TriangleAlert } from "lucide-react";
import { PaymentMethodIcon } from "@/components/sellers/payment-method-icons";
import { FieldLabel, FormError, Input, Select } from "@/components/ui/form-controls";
import {
  ACH_ACCOUNT_TYPES,
  CRYPTO_NETWORKS,
  isSellerPaymentFieldRequired,
  type PaymentMethod,
  type SellerPaymentFieldErrorKey,
  type SellerPaymentFieldErrors,
  type SellerPaymentSettings,
} from "@/lib/seller-payment";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type PaymentFieldKey = keyof SellerPaymentSettings;

type MethodMeta = {
  value: PaymentMethod;
  label: string;
  description: string;
  accent: string;
  iconBg: string;
};

export const PAYMENT_METHOD_META: MethodMeta[] = [
  {
    value: "paypal",
    label: "PayPal",
    description: "Fast digital payouts via email",
    accent: "border-sky-300 ring-sky-500/30 dark:border-sky-500/50",
    iconBg: "bg-sky-50 dark:bg-sky-500/10",
  },
  {
    value: "payoneer",
    label: "Payoneer",
    description: "Global mass payout platform",
    accent: "border-orange-300 ring-orange-500/30 dark:border-orange-500/50",
    iconBg: "bg-orange-50 dark:bg-orange-500/10",
  },
  {
    value: "wire",
    label: "Wire Transfer",
    description: "International bank transfer",
    accent: "border-indigo-300 ring-indigo-500/30 dark:border-indigo-500/50",
    iconBg: "bg-indigo-50 dark:bg-indigo-500/10",
  },
  {
    value: "ach",
    label: "ACH",
    description: "US domestic bank transfer",
    accent: "border-violet-300 ring-violet-500/30 dark:border-violet-500/50",
    iconBg: "bg-violet-50 dark:bg-violet-500/10",
  },
  {
    value: "crypto",
    label: "Crypto (USDT)",
    description: "Stablecoin wallet payout",
    accent: "border-emerald-300 ring-emerald-500/30 dark:border-emerald-500/50",
    iconBg: "bg-emerald-50 dark:bg-emerald-500/10",
  },
];

function MethodPanel({ meta, children }: { meta: MethodMeta; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50/90 to-white dark:border-slate-700 dark:from-slate-800/60 dark:to-slate-900">
      <div className="flex items-start gap-3 border-b border-slate-200/80 px-5 py-4 dark:border-slate-700">
        <span className={cn("inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", meta.iconBg)}>
          <PaymentMethodIcon method={meta.value} size={28} />
        </span>
        <div>
          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{meta.label} details</h4>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{meta.description}</p>
        </div>
      </div>
      <div className="space-y-4 p-5">{children}</div>
    </div>
  );
}

type SellerPaymentFormProps = {
  formIdPrefix: string;
  settings: SellerPaymentSettings;
  formError: string;
  fieldErrors: SellerPaymentFieldErrors;
  onChange: <K extends PaymentFieldKey>(key: K, value: SellerPaymentSettings[K]) => void;
};

function PaymentFormField({
  htmlFor,
  label,
  field,
  method,
  error,
  children,
}: {
  htmlFor: string;
  label: string;
  field: SellerPaymentFieldErrorKey;
  method: PaymentMethod | "";
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <FieldLabel
        htmlFor={htmlFor}
        label={label}
        required={isSellerPaymentFieldRequired(method, field)}
      />
      <FormError error={error} />
      {children}
    </div>
  );
}

export function SellerPaymentForm({
  formIdPrefix,
  settings,
  formError,
  fieldErrors,
  onChange,
}: SellerPaymentFormProps) {
  const activeMeta = PAYMENT_METHOD_META.find((item) => item.value === settings.method);
  const fieldId = (name: string) => `${formIdPrefix}-${name}`;
  const method = settings.method;

  return (
    <div className="space-y-6">
      <FormError error={formError} />

      <section className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Payment Method
            <span className="text-red-600 dark:text-red-400"> *</span>
          </p>
          <FormError error={fieldErrors.method} />
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Select the payout channel for this payment record.
          </p>
        </div>

        <div
          className={cn(
            "grid grid-cols-1 gap-3 sm:grid-cols-2",
            fieldErrors.method && "rounded-2xl ring-2 ring-red-400/40"
          )}
        >
          {PAYMENT_METHOD_META.map((meta) => {
            const isActive = settings.method === meta.value;

            return (
              <button
                key={meta.value}
                type="button"
                onClick={() => onChange("method", meta.value)}
                className={cn(
                  "group relative flex items-start gap-3 rounded-2xl border bg-white p-4 text-left transition duration-200 dark:bg-slate-900",
                  isActive
                    ? cn("ring-2 ring-emerald-500/40 shadow-md", meta.accent)
                    : "border-slate-200 hover:border-slate-300 hover:shadow-sm dark:border-slate-700 dark:hover:border-slate-600"
                )}
              >
                {isActive ? (
                  <span className="absolute right-3 top-3 inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white dark:bg-emerald-500">
                    <Check size={14} strokeWidth={3} />
                  </span>
                ) : null}
                <span
                  className={cn(
                    "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition group-hover:scale-105",
                    meta.iconBg
                  )}
                >
                  <PaymentMethodIcon method={meta.value} size={28} />
                </span>
                <span className="min-w-0 pr-6">
                  <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">{meta.label}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    {meta.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {!settings.method ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center dark:border-slate-600 dark:bg-slate-800/40">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-200/80 text-slate-500 dark:bg-slate-700 dark:text-slate-300">
            <CreditCard size={22} />
          </div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">No payment method selected</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">
            Pick a payout option above to configure payment details.
          </p>
        </div>
      ) : activeMeta ? (
        <section className="space-y-4">
          {settings.method === "paypal" ? (
            <MethodPanel meta={activeMeta}>
              <PaymentFormField
                htmlFor={fieldId("paypal-email")}
                label="PayPal Email Address"
                field="paypalEmail"
                method={method}
                error={fieldErrors.paypalEmail}
              >
                <Input
                  id={fieldId("paypal-email")}
                  type="email"
                  value={settings.paypalEmail}
                  invalid={Boolean(fieldErrors.paypalEmail)}
                  onChange={(event) => onChange("paypalEmail", event.target.value)}
                  placeholder="e.g. billing@publisher.com"
                />
              </PaymentFormField>
            </MethodPanel>
          ) : null}

          {settings.method === "payoneer" ? (
            <MethodPanel meta={activeMeta}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <PaymentFormField
                  htmlFor={fieldId("payoneer-email")}
                  label="Payoneer Email Address"
                  field="payoneerEmail"
                  method={method}
                  error={fieldErrors.payoneerEmail}
                >
                  <Input
                    id={fieldId("payoneer-email")}
                    type="email"
                    value={settings.payoneerEmail}
                    invalid={Boolean(fieldErrors.payoneerEmail)}
                    onChange={(event) => onChange("payoneerEmail", event.target.value)}
                    placeholder="e.g. pay@publisher.com"
                  />
                </PaymentFormField>
                <PaymentFormField
                  htmlFor={fieldId("payoneer-account-holder")}
                  label="Account Holder Name"
                  field="accountHolderName"
                  method={method}
                  error={fieldErrors.accountHolderName}
                >
                  <Input
                    id={fieldId("payoneer-account-holder")}
                    value={settings.accountHolderName}
                    invalid={Boolean(fieldErrors.accountHolderName)}
                    onChange={(event) => onChange("accountHolderName", event.target.value)}
                    placeholder="e.g. John Doe"
                  />
                </PaymentFormField>
              </div>
            </MethodPanel>
          ) : null}

          {settings.method === "wire" ? (
            <MethodPanel meta={activeMeta}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <PaymentFormField
                    htmlFor={fieldId("wire-beneficiary")}
                    label="Beneficiary Name"
                    field="beneficiaryName"
                    method={method}
                    error={fieldErrors.beneficiaryName}
                  >
                    <Input
                      id={fieldId("wire-beneficiary")}
                      value={settings.beneficiaryName}
                      invalid={Boolean(fieldErrors.beneficiaryName)}
                      onChange={(event) => onChange("beneficiaryName", event.target.value)}
                      placeholder="Company Name or Full Name"
                    />
                  </PaymentFormField>
                </div>
                <PaymentFormField
                  htmlFor={fieldId("wire-bank-name")}
                  label="Bank Name"
                  field="bankName"
                  method={method}
                  error={fieldErrors.bankName}
                >
                  <Input
                    id={fieldId("wire-bank-name")}
                    value={settings.bankName}
                    invalid={Boolean(fieldErrors.bankName)}
                    onChange={(event) => onChange("bankName", event.target.value)}
                    placeholder="e.g. J.P. Morgan"
                  />
                </PaymentFormField>
                <PaymentFormField
                  htmlFor={fieldId("wire-swift")}
                  label="SWIFT / BIC Code"
                  field="swiftBic"
                  method={method}
                  error={fieldErrors.swiftBic}
                >
                  <Input
                    id={fieldId("wire-swift")}
                    value={settings.swiftBic}
                    invalid={Boolean(fieldErrors.swiftBic)}
                    onChange={(event) => onChange("swiftBic", event.target.value)}
                    placeholder="8 or 11 characters"
                  />
                </PaymentFormField>
                <div className="md:col-span-2">
                  <PaymentFormField
                    htmlFor={fieldId("wire-account")}
                    label="Account Number / IBAN"
                    field="accountNumberIban"
                    method={method}
                    error={fieldErrors.accountNumberIban}
                  >
                    <Input
                      id={fieldId("wire-account")}
                      value={settings.accountNumberIban}
                      invalid={Boolean(fieldErrors.accountNumberIban)}
                      onChange={(event) => onChange("accountNumberIban", event.target.value)}
                      placeholder="Standard International Format"
                      className="font-mono text-sm"
                    />
                  </PaymentFormField>
                </div>
                <div className="md:col-span-2">
                  <PaymentFormField
                    htmlFor={fieldId("wire-bank-address")}
                    label="Bank Address"
                    field="bankAddress"
                    method={method}
                    error={fieldErrors.bankAddress}
                  >
                    <Input
                      id={fieldId("wire-bank-address")}
                      value={settings.bankAddress}
                      invalid={Boolean(fieldErrors.bankAddress)}
                      onChange={(event) => onChange("bankAddress", event.target.value)}
                      placeholder="City, Country"
                    />
                  </PaymentFormField>
                </div>
              </div>
            </MethodPanel>
          ) : null}

          {settings.method === "ach" ? (
            <MethodPanel meta={activeMeta}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <PaymentFormField
                  htmlFor={fieldId("ach-account-holder")}
                  label="Account Holder Name"
                  field="accountHolderName"
                  method={method}
                  error={fieldErrors.accountHolderName}
                >
                  <Input
                    id={fieldId("ach-account-holder")}
                    value={settings.accountHolderName}
                    invalid={Boolean(fieldErrors.accountHolderName)}
                    onChange={(event) => onChange("accountHolderName", event.target.value)}
                    placeholder="John Doe"
                  />
                </PaymentFormField>
                <PaymentFormField
                  htmlFor={fieldId("ach-account-type")}
                  label="Account Type"
                  field="achAccountType"
                  method={method}
                  error={fieldErrors.achAccountType}
                >
                  <Select
                    id={fieldId("ach-account-type")}
                    value={settings.achAccountType}
                    invalid={Boolean(fieldErrors.achAccountType)}
                    onChange={(event) =>
                      onChange("achAccountType", event.target.value as SellerPaymentSettings["achAccountType"])
                    }
                  >
                    <option value="">Select account type...</option>
                    {ACH_ACCOUNT_TYPES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </PaymentFormField>
                <PaymentFormField
                  htmlFor={fieldId("ach-routing")}
                  label="Routing Number"
                  field="achRoutingNumber"
                  method={method}
                  error={fieldErrors.achRoutingNumber}
                >
                  <Input
                    id={fieldId("ach-routing")}
                    value={settings.achRoutingNumber}
                    invalid={Boolean(fieldErrors.achRoutingNumber)}
                    onChange={(event) => onChange("achRoutingNumber", event.target.value)}
                    placeholder="9 digits only"
                    maxLength={9}
                    className="font-mono text-sm tracking-wider"
                  />
                </PaymentFormField>
                <PaymentFormField
                  htmlFor={fieldId("ach-account-number")}
                  label="Account Number"
                  field="achAccountNumber"
                  method={method}
                  error={fieldErrors.achAccountNumber}
                >
                  <Input
                    id={fieldId("ach-account-number")}
                    value={settings.achAccountNumber}
                    invalid={Boolean(fieldErrors.achAccountNumber)}
                    onChange={(event) => onChange("achAccountNumber", event.target.value)}
                    placeholder="US Bank Account Number"
                    className="font-mono text-sm"
                  />
                </PaymentFormField>
              </div>
            </MethodPanel>
          ) : null}

          {settings.method === "crypto" ? (
            <MethodPanel meta={activeMeta}>
              <div className="flex gap-3 rounded-xl border border-amber-200/80 bg-gradient-to-r from-amber-50 to-orange-50 p-4 text-amber-900 dark:border-amber-500/30 dark:from-amber-500/10 dark:to-orange-500/5 dark:text-amber-100">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200">
                  <TriangleAlert size={18} />
                </span>
                <div>
                  <p className="text-sm font-semibold">Double-check network &amp; address</p>
                  <p className="mt-1 text-xs leading-relaxed text-amber-800/90 dark:text-amber-100/80">
                    Ensure you select the matching network. Providing an incorrect address will result in permanent loss
                    of funds.
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                <PaymentFormField
                  htmlFor={fieldId("crypto-network")}
                  label="Select Network"
                  field="cryptoNetwork"
                  method={method}
                  error={fieldErrors.cryptoNetwork}
                >
                  <Select
                    id={fieldId("crypto-network")}
                    value={settings.cryptoNetwork}
                    invalid={Boolean(fieldErrors.cryptoNetwork)}
                    onChange={(event) =>
                      onChange("cryptoNetwork", event.target.value as SellerPaymentSettings["cryptoNetwork"])
                    }
                  >
                    <option value="">Select network...</option>
                    {CRYPTO_NETWORKS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </PaymentFormField>
                <PaymentFormField
                  htmlFor={fieldId("crypto-wallet")}
                  label="USDT Wallet Address"
                  field="cryptoWalletAddress"
                  method={method}
                  error={fieldErrors.cryptoWalletAddress}
                >
                  <Input
                    id={fieldId("crypto-wallet")}
                    value={settings.cryptoWalletAddress}
                    invalid={Boolean(fieldErrors.cryptoWalletAddress)}
                    onChange={(event) => onChange("cryptoWalletAddress", event.target.value)}
                    placeholder="Enter exact destination wallet address"
                    className="font-mono text-sm"
                  />
                </PaymentFormField>
              </div>
            </MethodPanel>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
