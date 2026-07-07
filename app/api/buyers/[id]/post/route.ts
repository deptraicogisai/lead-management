import { connectToDatabase } from "@/lib/mongodb";
import { handleMockBuyerLeadPost } from "@/lib/mock-buyer-post-handler";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: Params) {
  await connectToDatabase();
  const { id } = await context.params;
  return handleMockBuyerLeadPost(req, { buyerId: id });
}
