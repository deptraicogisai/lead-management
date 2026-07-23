import { Suspense } from "react";
import { LeadDetailPage } from "@/components/leads/lead-detail-page";
import { PageLoadingShell } from "@/components/ui/state";

export default function LeadDetailRoutePage() {
  return (
    <Suspense fallback={<PageLoadingShell />}>
      <LeadDetailPage />
    </Suspense>
  );
}
