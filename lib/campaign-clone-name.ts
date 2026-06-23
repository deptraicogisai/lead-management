export function buildClonedCampaignName(baseName: string, minPrice: number) {
  const trimmedName = baseName.trim();
  const normalizedPrice = Number.isFinite(minPrice) ? Math.round(minPrice * 100) / 100 : 0;
  return `${trimmedName}_${normalizedPrice}`;
}
