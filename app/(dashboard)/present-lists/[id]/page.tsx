import { PresentListDetail } from "@/components/present-lists/present-list-detail";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function PresentListDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <PresentListDetail listId={id} />;
}
