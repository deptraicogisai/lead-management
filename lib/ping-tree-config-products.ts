import { VerticalModel } from "@/lib/models/industry";
import { formatPingTreeProductLabel } from "@/lib/ping-tree-config";

export type PingTreeProduct = {
  verticalId: string;
  verticalName: string;
  productLabel: string;
  index: number;
};

/**
 * Build a lookup of products (verticals) keyed by id, where the index is
 * 1-based by createdAt ascending (matching the rest of the app's product labels).
 */
export async function buildPingTreeProductMap() {
  const verticals = await VerticalModel.find({}, { _id: 1, name: 1, status: 1, createdAt: 1 })
    .sort({ createdAt: 1 })
    .lean();

  const map = new Map<string, PingTreeProduct>();
  verticals.forEach((vertical, index) => {
    const id = vertical._id.toString();
    map.set(id, {
      verticalId: id,
      verticalName: vertical.name,
      productLabel: formatPingTreeProductLabel(vertical.name, index + 1),
      index: index + 1,
    });
  });

  return map;
}

/** Active products only, ordered by index, for use in dropdowns. */
export async function listActivePingTreeProducts(): Promise<PingTreeProduct[]> {
  const verticals = await VerticalModel.find({}, { _id: 1, name: 1, status: 1, createdAt: 1 })
    .sort({ createdAt: 1 })
    .lean();

  return verticals
    .map((vertical, index) => ({ vertical, index }))
    .filter(({ vertical }) => vertical.status !== "Deleted")
    .map(({ vertical, index }) => ({
      verticalId: vertical._id.toString(),
      verticalName: vertical.name,
      productLabel: formatPingTreeProductLabel(vertical.name, index + 1),
      index: index + 1,
    }));
}
