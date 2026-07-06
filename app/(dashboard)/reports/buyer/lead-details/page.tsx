import { Suspense } from "react";
import { BuyerLeadDetailsPage } from "@/components/reports/buyer-lead-details-page";

export default function BuyerLeadDetailsRoutePage() {
  return (
    <Suspense fallback={null}>
      <BuyerLeadDetailsPage />
    </Suspense>
  );
}
