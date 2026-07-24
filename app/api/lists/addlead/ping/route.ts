import { connectToDatabase } from "@/lib/mongodb";
import { handleMockBuyerLeadPost } from "@/lib/mock-buyer-post-handler";

/** Test Mode mock endpoint for Ping Post — ping phase. */
export async function POST(req: Request) {
  await connectToDatabase();
  return handleMockBuyerLeadPost(req, { phase: "ping" });
}
