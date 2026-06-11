import { handleSellerLeadPost } from "@/lib/seller-lead-intake-route";

export async function POST(req: Request) {
  return handleSellerLeadPost(req);
}
