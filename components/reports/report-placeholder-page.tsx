import { PageSection } from "@/components/ui/state";

type ReportPlaceholderPageProps = {
  description: string;
};

export function ReportPlaceholderPage({ description }: ReportPlaceholderPageProps) {
  return (
    <PageSection>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p>
      </div>
    </PageSection>
  );
}
