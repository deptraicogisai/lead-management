import { BackLink } from "@/components/ui/action-buttons";
import { PingTreeSettingsPage } from "@/components/ping-trees/ping-tree-settings-page";

type Props = { searchParams: Promise<{ id?: string; type?: string }> };

export default async function PingTreeEditorPage({ searchParams }: Props) {
  const { id, type } = await searchParams;
  const initialCampaignType = type === "Silent" ? "Silent" : "Redirect";

  return (
    <div className="space-y-4">
      <BackLink href="/ping-tree-settings" label="Back to Ping Tree Settings" />
      <PingTreeSettingsPage configId={id} initialCampaignType={initialCampaignType} />
    </div>
  );
}
