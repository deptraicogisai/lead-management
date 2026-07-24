import { connectToDatabase } from "@/lib/mongodb";
import { handleMockBuyerLeadPost } from "@/lib/mock-buyer-post-handler";

/** Test Mode mock endpoint for Direct Post / Ping Post — post phase. */
export async function POST(req: Request) {
  await connectToDatabase();
  return handleMockBuyerLeadPost(req, { phase: "post" });
}
