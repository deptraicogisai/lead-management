import { CampaignDetail } from "@/components/campaigns/campaign-detail";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function CampaignDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <CampaignDetail campaignId={id} />;
}
