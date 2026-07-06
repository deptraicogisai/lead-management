import { Suspense } from "react";
import { PublisherLeadDetailsPage } from "@/components/reports/publisher-lead-details-page";

export default function PublisherLeadDetailsRoutePage() {
  return (
    <Suspense fallback={null}>
      <PublisherLeadDetailsPage />
    </Suspense>
  );
}
