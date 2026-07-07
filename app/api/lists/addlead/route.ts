import { connectToDatabase } from "@/lib/mongodb";
import { handleMockBuyerLeadPost } from "@/lib/mock-buyer-post-handler";

export async function POST(req: Request) {
  await connectToDatabase();
  return handleMockBuyerLeadPost(req);
}
