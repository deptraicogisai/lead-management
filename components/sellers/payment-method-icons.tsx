import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { PaymentMethod } from "@/lib/seller-payment";

type PaymentMethodIconProps = {
  method: PaymentMethod;
  size?: number;
  className?: string;
};

function IconShell({
  children,
  size,
  className,
  label,
}: {
  children: ReactNode;
  size: number;
  className?: string;
  label: string;
}) {
  return (
    <span
      role="img"
      aria-label={label}
      className={cn("inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      {children}
    </span>
  );
}

function PayPalIcon({ size, className }: { size: number; className?: string }) {
  return (
    <IconShell size={size} className={className} label="PayPal">
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
        <path
          fill="#003087"
          d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106z"
        />
        <path
          fill="#009cde"
          d="M20.677 9.456c-.13.81-.317 1.584-.557 2.312-.93 4.778-4.005 7.201-9.138 7.201h-2.19a.563.563 0 0 0-.556.479l-1.187 7.527h-.506l-.24 1.516a.56.56 0 0 0 .554.647h3.882c.483 0 .898-.354.972-.837l.038-.228.719-4.553.046-.282c.073-.483.488-.837.971-.837h.611c3.964 0 7.061-1.607 7.974-6.256.376-2.065.174-3.788-.794-5.008z"
        />
      </svg>
    </IconShell>
  );
}

function PayoneerIcon({ size, className }: { size: number; className?: string }) {
  return (
    <IconShell size={size} className={className} label="Payoneer">
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
        <path
          fill="#FF4800"
          d="M16.98 6.896h-3.403c-1.453 0-2.63 1.177-2.63 2.63v5.117c0 .459.372.831.831.831h1.662c.459 0 .831-.372.831-.831V9.526c0-.459.372-.831.831-.831h1.797c.459 0 .831-.372.831-.831V7.727c0-.459-.372-.831-.831-.831zm-6.98 0H7.02c-.459 0-.831.372-.831.831v5.117c0 .459.372.831.831.831h1.662c.459 0 .831-.372.831-.831V7.727c0-.459-.372-.831-.831-.831H10z"
        />
        <path
          fill="#FF4800"
          d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 1.8a8.2 8.2 0 1 1 0 16.4 8.2 8.2 0 0 1 0-16.4z"
          opacity="0.15"
        />
      </svg>
    </IconShell>
  );
}

function WireTransferIcon({ size, className }: { size: number; className?: string }) {
  return (
    <IconShell size={size} className={className} label="Wire Transfer">
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
        <circle cx="12" cy="12" r="10" fill="#1d4ed8" />
        <path
          fill="#fff"
          d="M12 6.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zm0 1.8a3.7 3.7 0 1 1 0 7.4 3.7 3.7 0 0 1 0-7.4z"
          opacity="0.35"
        />
        <path
          fill="#fff"
          d="M8.2 11.2h7.6v1.6H8.2v-1.6zm-1.2-2.4h10v1.6H7V8.8zm1.2 4.8h7.6v1.6H8.2v-1.6z"
        />
        <path fill="#93c5fd" d="M15.8 12.8 18 15l-2.2 2.2-1.1-1.1 1.1-1.1-1.1-1.1 1.1-1.1zM8.2 12.8 6 15l2.2 2.2 1.1-1.1-1.1-1.1 1.1-1.1-1.1-1.1z" />
      </svg>
    </IconShell>
  );
}

function AchIcon({ size, className }: { size: number; className?: string }) {
  return (
    <IconShell size={size} className={className} label="ACH">
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
        <rect x="2" y="4" width="20" height="16" rx="3" fill="#4c1d95" />
        <path
          fill="#fff"
          d="M5.8 15.4V8.6h2.3l1.5 3.9 1.5-3.9h2.3v6.8h-1.6v-4.6l-1.6 4.6h-1.2l-1.6-4.6v4.6H5.8zm9.2-3.4c0-1.9 1.4-3.4 3.3-3.4 1.1 0 2 .5 2.5 1.2l-1.2 1c-.4-.5-.9-.8-1.5-.8-.9 0-1.6.7-1.6 1.9s.7 1.9 1.6 1.9c.6 0 1.1-.3 1.5-.8l1.2 1c-.6.8-1.5 1.2-2.6 1.2-1.9 0-3.3-1.5-3.3-3.4z"
        />
      </svg>
    </IconShell>
  );
}

function UsdtIcon({ size, className }: { size: number; className?: string }) {
  return (
    <IconShell size={size} className={className} label="USDT">
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
        <circle cx="12" cy="12" r="11" fill="#50AF95" />
        <path
          fill="#fff"
          d="M13.322 12.684v2.366c1.573-.116 2.72-.557 2.72-1.226 0-.67-1.147-1.11-2.72-1.226v.086zm-2.644 0V10.32c-1.573.116-2.72.557-2.72 1.226 0 .67 1.147 1.11 2.72 1.226v.912zm2.644-6.01c4.075.208 7.133 1.258 7.133 2.7 0 1.44-3.058 2.49-7.133 2.698v-2.14c4.075-.208 7.133-1.258 7.133-2.698 0-1.442-3.058-2.492-7.133-2.7v2.14zm0 1.89v2.14c-4.075-.208-7.133-1.258-7.133-2.698 0-1.442 3.058-2.492 7.133-2.7v2.258zm-2.644 6.01v2.14c-4.075-.208-7.133-1.258-7.133-2.698 0-1.442 3.058-2.492 7.133-2.7v2.258zm2.644 2.258v-2.14c4.075.208 7.133 1.258 7.133 2.698 0 1.442-3.058 2.492-7.133 2.7z"
        />
      </svg>
    </IconShell>
  );
}

export function PaymentMethodIcon({ method, size = 24, className }: PaymentMethodIconProps) {
  switch (method) {
    case "paypal":
      return <PayPalIcon size={size} className={className} />;
    case "payoneer":
      return <PayoneerIcon size={size} className={className} />;
    case "wire":
      return <WireTransferIcon size={size} className={className} />;
    case "ach":
      return <AchIcon size={size} className={className} />;
    case "crypto":
      return <UsdtIcon size={size} className={className} />;
    default:
      return null;
  }
}
