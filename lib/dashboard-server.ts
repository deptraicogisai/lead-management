import { connectToDatabase } from "@/lib/mongodb";
import { BuyerModel, ensureBuyerFieldsMigrated } from "@/lib/models/buyer";
import { BuyerRequestLogModel } from "@/lib/models/buyer-request-log";
import { CampaignModel } from "@/lib/models/campaign";
import { ensureVerticalCollectionMigrated, VerticalModel } from "@/lib/models/industry";
import { LeadDeliveryModel } from "@/lib/models/lead-delivery";
import { ensureSellerCollectionMigrated, SellerModel } from "@/lib/models/seller";
import { ensureSellerLeadReferencesMigrated, SellerLeadModel } from "@/lib/models/seller-lead";
import { resolveBuyerName } from "@/lib/buyer";
import { formatProductLabel } from "@/lib/integration-builder";
import {
  addDays,
  endOfDay,
  resolveDateRangePreset,
  startOfDay,
} from "@/lib/date-range";
import { excludeDeletedStatusFilter } from "@/lib/soft-delete";
import { finalizeBuyerPerformanceMetrics } from "@/lib/buyer-performance-summary";
import { finalizePublisherPerformanceMetrics } from "@/lib/publisher-performance-summary";
import {
  BUYER_CHART_SERIES,
  PUBLISHER_CHART_SERIES,
  type DashboardActivitySegment,
  type DashboardBuyerRankingRow,
  type DashboardChart,
  type DashboardKpiCard,
  type DashboardNamedRow,
  type DashboardPeriod,
  type DashboardProductRankingRow,
  type DashboardPublisherRankingRow,
  type DashboardRankingData,
  type DashboardSnapshot,
} from "@/lib/dashboard";

type DateRange = {
  from: Date;
  to: Date;
};

type LeadProjection = {
  _id?: { toString(): string };
  sellerRef?: { toString(): string } | string;
  verticalRef?: { toString(): string } | string;
  validationStatus?: "success" | "fail";
  publisherStatus?: "Sold" | "Reject" | "Post Error" | "Test";
  soldPrice?: number | null;
  postedAt?: Date | string;
  redirectConfirmedAt?: Date | string | null;
};

type DeliveryProjection = {
  buyerRef?: { toString(): string } | string;
  sellerRef?: { toString(): string } | string;
  sellerLeadRef?: { toString(): string } | string;
  verticalRef?: { toString(): string } | string;
  buyerStatus?: string;
  price?: number | null;
  postedAt?: Date | string;
};

type PublisherAccumulator = {
  post: number;
  lead: number;
  sold: number;
  redirect: number;
  pub: number;
  ttl: number;
};

type BuyerAccumulator = {
  post: number;
  rejected: number;
  accept: number;
  redirect: number;
  pub: number;
  ttl: number;
};

type ReferenceData = {
  sellerIndexById: Map<string, number>;
  sellerNameById: Map<string, string>;
  buyerLabelById: Map<string, string>;
  productLabelById: Map<string, string>;
};

const TOP_RANKING_LIMIT = 10;
const CHART_DAY_COUNT = 8;

function refToString(ref?: { toString(): string } | string | null) {
  if (!ref) return "";
  return typeof ref === "string" ? ref : ref.toString();
}

function createPublisherAccumulator(): PublisherAccumulator {
  return { post: 0, lead: 0, sold: 0, redirect: 0, pub: 0, ttl: 0 };
}

function createBuyerAccumulator(): BuyerAccumulator {
  return { post: 0, rejected: 0, accept: 0, redirect: 0, pub: 0, ttl: 0 };
}

function isInRange(value: Date | string | undefined, range: DateRange) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date >= range.from && date <= range.to;
}

function dayKey(value: Date | string | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatChartDateLabel(value: Date) {
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  const year = value.getFullYear();
  return `${month}/${day}/${year}`;
}

function isRejectedBuyerStatus(status: string) {
  return status === "Reject" || status === "Price Reject" || status === "Price Conflict";
}

function buildDashboardRanges(reference = new Date()) {
  const todayStart = startOfDay(reference);
  const todayEnd = endOfDay(reference);
  const yesterdayStart = startOfDay(addDays(reference, -1));
  const yesterdayEnd = endOfDay(addDays(reference, -1));
  const weekStart = startOfDay(addDays(reference, -(CHART_DAY_COUNT - 1)));
  const priorWeekStart = startOfDay(addDays(reference, -7));
  const priorWeekEnd = yesterdayEnd;
  const lastWeekRange = resolveDateRangePreset("last-week", reference);
  const lastMonthRange = resolveDateRangePreset("last-month", reference);
  const chartStart = weekStart;

  return {
    today: { from: todayStart, to: todayEnd },
    yesterday: { from: yesterdayStart, to: yesterdayEnd },
    week: { from: weekStart, to: todayEnd },
    priorWeek: { from: priorWeekStart, to: priorWeekEnd },
    chart: { from: chartStart, to: todayEnd },
    fetch: { from: chartStart, to: todayEnd },
    activity: {
      today: { from: todayStart, to: todayEnd },
      yesterday: { from: yesterdayStart, to: yesterdayEnd },
      lastWeek: lastWeekRange,
      lastMonth: lastMonthRange,
    },
  };
}

function finalizePublisherBucket(bucket: PublisherAccumulator) {
  return finalizePublisherPerformanceMetrics({
    post: bucket.post,
    lead: bucket.lead,
    sold: bucket.sold,
    reject: 0,
    redirect: bucket.redirect,
    pub: bucket.pub,
    ttl: bucket.ttl,
    ref: 0,
    agn: 0,
    dup1Rate: 0,
    dup14Rate: 0,
    dup30Rate: 0,
    dup45Rate: 0,
  });
}

function finalizeBuyerBucket(bucket: BuyerAccumulator) {
  return finalizeBuyerPerformanceMetrics({
    post: bucket.post,
    rejected: bucket.rejected,
    accept: bucket.accept,
    redirect: bucket.redirect,
    pub: bucket.pub,
    ttl: bucket.ttl,
    sendError: 0,
    timeout: 0,
  });
}

function buildKpiCards(
  todayPublisher: PublisherAccumulator,
  todayBuyer: BuyerAccumulator,
  priorDayPublisher: PublisherAccumulator,
  priorDayBuyer: BuyerAccumulator,
  priorWeekPublisher: PublisherAccumulator,
  priorWeekBuyer: BuyerAccumulator
): DashboardKpiCard[] {
  const todayPub = finalizePublisherBucket(todayPublisher);
  const priorDayPub = finalizePublisherBucket(priorDayPublisher);
  const priorWeekPub = finalizePublisherBucket(priorWeekPublisher);
  const todayBuyerMetrics = finalizeBuyerBucket(todayBuyer);
  const priorDayBuyerMetrics = finalizeBuyerBucket(priorDayBuyer);
  const priorWeekBuyerMetrics = finalizeBuyerBucket(priorWeekBuyer);

  return [
    {
      key: "total-revenue",
      title: "Today's Total Revenue",
      value: todayPub.ttl,
      format: "money",
      comparison: { priorDay: priorDayPub.ttl, priorWeek: priorWeekPub.ttl },
    },
    {
      key: "net-earnings",
      title: "Today's Net Earnings",
      value: todayPub.adm,
      format: "money-paren",
      comparison: { priorDay: priorDayPub.adm, priorWeek: priorWeekPub.adm },
    },
    {
      key: "total-leads",
      title: "Today's Total Leads",
      value: todayPub.lead,
      format: "count",
      comparison: { priorDay: priorDayPub.lead, priorWeek: priorWeekPub.lead },
    },
    {
      key: "sold-leads",
      title: "Today's Sold Leads",
      value: todayPub.sold,
      format: "count",
      comparison: { priorDay: priorDayPub.sold, priorWeek: priorWeekPub.sold },
    },
    {
      key: "epl",
      title: "Today's EPL",
      value: todayPub.epl,
      format: "money",
      comparison: { priorDay: priorDayPub.epl, priorWeek: priorWeekPub.epl },
    },
    {
      key: "buyer-total",
      title: "Today's Buyer Total",
      value: todayBuyerMetrics.ttl,
      format: "money",
      comparison: { priorDay: priorDayBuyerMetrics.ttl, priorWeek: priorWeekBuyerMetrics.ttl },
    },
    {
      key: "total-posts",
      title: "Today's Total Posts",
      value: todayBuyerMetrics.post,
      format: "count",
      comparison: { priorDay: priorDayBuyerMetrics.post, priorWeek: priorWeekBuyerMetrics.post },
    },
    {
      key: "purchased-leads",
      title: "Today's Purchased Leads",
      value: todayBuyerMetrics.accept,
      format: "count",
      comparison: { priorDay: priorDayBuyerMetrics.accept, priorWeek: priorWeekBuyerMetrics.accept },
    },
    {
      key: "accept-rate",
      title: "Accept Rate",
      value: todayBuyerMetrics.acceptRate,
      format: "percent",
      comparison: { priorDay: priorDayBuyerMetrics.acceptRate, priorWeek: priorWeekBuyerMetrics.acceptRate },
    },
  ];
}

function buildPublisherChart(
  publisherByDay: Map<string, PublisherAccumulator>,
  chartDays: Date[]
): DashboardChart {
  const dates = chartDays.map(formatChartDateLabel);

  const series = PUBLISHER_CHART_SERIES.map((definition) => ({
    ...definition,
    values: chartDays.map((day) => {
      const metrics = finalizePublisherBucket(publisherByDay.get(dayKey(day)) ?? createPublisherAccumulator());
      switch (definition.key) {
        case "post":
          return metrics.post;
        case "lead":
          return metrics.lead;
        case "sold":
          return metrics.sold;
        case "redirect":
          return metrics.redirect;
        case "pub":
          return metrics.pub;
        case "ttl":
          return metrics.ttl;
        case "adm":
          return metrics.adm;
        case "epl":
          return metrics.epl;
        default:
          return 0;
      }
    }),
  }));

  return {
    title: "Publisher Summary: Group by Date",
    dates,
    series,
  };
}

function buildBuyerChart(buyerByDay: Map<string, BuyerAccumulator>, chartDays: Date[]): DashboardChart {
  const dates = chartDays.map(formatChartDateLabel);

  const series = BUYER_CHART_SERIES.map((definition) => ({
    ...definition,
    values: chartDays.map((day) => {
      const metrics = finalizeBuyerBucket(buyerByDay.get(dayKey(day)) ?? createBuyerAccumulator());
      switch (definition.key) {
        case "post":
          return metrics.post;
        case "rejected":
          return metrics.rejected;
        case "sold":
          return metrics.accept;
        case "redirectRate":
          return metrics.redirectRate;
        case "acceptRate":
          return metrics.acceptRate;
        case "pub":
          return metrics.pub;
        case "adm":
          return metrics.adm;
        case "ttl":
          return metrics.ttl;
        default:
          return 0;
      }
    }),
  }));

  return {
    title: "Buyer Summary: Group by Date",
    dates,
    series,
  };
}

function toPublisherRankingRows(
  buckets: Map<string, PublisherAccumulator>,
  refs: ReferenceData
): DashboardPublisherRankingRow[] {
  return [...buckets.entries()]
    .map(([sellerId, bucket]) => {
      const metrics = finalizePublisherBucket(bucket);
      const index = refs.sellerIndexById.get(sellerId) ?? 0;
      const name = refs.sellerNameById.get(sellerId) ?? "Unknown";
      return {
        id: sellerId,
        label: index ? `[${index}] ${name}` : name,
        leads: metrics.lead,
        sold: metrics.sold,
        redirect: metrics.redirect,
        redirectRate: metrics.redirectRate,
        epl: metrics.epl,
        earning: metrics.pub,
      };
    })
    .sort((left, right) => right.earning - left.earning || right.leads - left.leads)
    .slice(0, TOP_RANKING_LIMIT);
}

function toBuyerRankingRows(buckets: Map<string, BuyerAccumulator>, refs: ReferenceData): DashboardBuyerRankingRow[] {
  return [...buckets.entries()]
    .map(([buyerId, bucket]) => {
      const metrics = finalizeBuyerBucket(bucket);
      return {
        id: buyerId,
        label: refs.buyerLabelById.get(buyerId) ?? "Unknown",
        leads: metrics.post,
        sold: metrics.accept,
        earning: metrics.ttl,
      };
    })
    .sort((left, right) => right.earning - left.earning || right.leads - left.leads)
    .slice(0, TOP_RANKING_LIMIT);
}

function toProductPublisherRows(
  buckets: Map<string, PublisherAccumulator>,
  refs: ReferenceData
): DashboardProductRankingRow[] {
  return [...buckets.entries()]
    .map(([productId, bucket]) => {
      const metrics = finalizePublisherBucket(bucket);
      return {
        id: productId,
        label: refs.productLabelById.get(productId) ?? "Unknown",
        leads: metrics.lead,
        sold: metrics.sold,
        redirect: metrics.redirect,
        redirectRate: metrics.redirectRate,
        epl: metrics.epl,
        earning: metrics.pub,
      };
    })
    .sort((left, right) => right.earning - left.earning || right.leads - left.leads)
    .slice(0, TOP_RANKING_LIMIT);
}

function toProductBuyerRows(
  buckets: Map<string, BuyerAccumulator>,
  refs: ReferenceData
): DashboardProductRankingRow[] {
  return [...buckets.entries()]
    .map(([productId, bucket]) => {
      const metrics = finalizeBuyerBucket(bucket);
      const epl = metrics.accept > 0 ? metrics.ttl / metrics.accept : 0;
      const redirectRate = metrics.accept > 0 ? metrics.redirect / metrics.accept : 0;
      return {
        id: productId,
        label: refs.productLabelById.get(productId) ?? "Unknown",
        leads: metrics.post,
        sold: metrics.accept,
        redirect: metrics.redirect,
        redirectRate,
        epl,
        earning: metrics.ttl,
      };
    })
    .sort((left, right) => right.earning - left.earning || right.leads - left.leads)
    .slice(0, TOP_RANKING_LIMIT);
}

function buildRankingData(
  range: DateRange,
  leads: LeadProjection[],
  deliveries: DeliveryProjection[],
  soldPriceByLeadId: Map<string, number>,
  redirectedLeadIds: Set<string>,
  refs: ReferenceData
): DashboardRankingData {
  const publisherBySeller = new Map<string, PublisherAccumulator>();
  const productPublisher = new Map<string, PublisherAccumulator>();
  const buyerById = new Map<string, BuyerAccumulator>();
  const productBuyer = new Map<string, BuyerAccumulator>();

  const ensurePublisher = (map: Map<string, PublisherAccumulator>, key: string) => {
    let bucket = map.get(key);
    if (!bucket) {
      bucket = createPublisherAccumulator();
      map.set(key, bucket);
    }
    return bucket;
  };

  const ensureBuyer = (map: Map<string, BuyerAccumulator>, key: string) => {
    let bucket = map.get(key);
    if (!bucket) {
      bucket = createBuyerAccumulator();
      map.set(key, bucket);
    }
    return bucket;
  };

  for (const lead of leads) {
    if (!isInRange(lead.postedAt, range)) continue;

    const sellerId = refToString(lead.sellerRef);
    const productId = refToString(lead.verticalRef);
    if (!sellerId) continue;

    const sellerBucket = ensurePublisher(publisherBySeller, sellerId);
    sellerBucket.post += 1;
    if (productId) ensurePublisher(productPublisher, productId).post += 1;

    const isValid = lead.validationStatus !== "fail";
    if (isValid) {
      sellerBucket.lead += 1;
      if (productId) ensurePublisher(productPublisher, productId).lead += 1;
    }

    if (lead.publisherStatus === "Sold") {
      sellerBucket.sold += 1;
      if (productId) ensurePublisher(productPublisher, productId).sold += 1;
      if (typeof lead.soldPrice === "number" && Number.isFinite(lead.soldPrice)) {
        sellerBucket.pub += lead.soldPrice;
        if (productId) ensurePublisher(productPublisher, productId).pub += lead.soldPrice;
      }
    }

    if (lead.redirectConfirmedAt && isInRange(lead.postedAt, range)) {
      sellerBucket.redirect += 1;
      if (productId) ensurePublisher(productPublisher, productId).redirect += 1;
    }
  }

  for (const delivery of deliveries) {
    if (!isInRange(delivery.postedAt, range)) continue;

    const buyerId = refToString(delivery.buyerRef);
    const sellerId = refToString(delivery.sellerRef);
    const productId = refToString(delivery.verticalRef);
    const leadId = refToString(delivery.sellerLeadRef);
    const status = String(delivery.buyerStatus ?? "");

    if (status === "Skipped" || !buyerId) continue;

    const buyerBucket = ensureBuyer(buyerById, buyerId);
    buyerBucket.post += 1;
    if (productId) ensureBuyer(productBuyer, productId).post += 1;

    if (status === "Accept") {
      buyerBucket.accept += 1;
      if (productId) ensureBuyer(productBuyer, productId).accept += 1;

      if (typeof delivery.price === "number" && Number.isFinite(delivery.price)) {
        buyerBucket.ttl += delivery.price;
        if (productId) ensureBuyer(productBuyer, productId).ttl += delivery.price;
      }

      if (sellerId) {
        const sellerBucket = ensurePublisher(publisherBySeller, sellerId);
        sellerBucket.ttl += typeof delivery.price === "number" && Number.isFinite(delivery.price) ? delivery.price : 0;
        if (productId) {
          ensurePublisher(productPublisher, productId).ttl +=
            typeof delivery.price === "number" && Number.isFinite(delivery.price) ? delivery.price : 0;
        }
      }

      if (leadId) {
        const pub = soldPriceByLeadId.get(leadId) ?? 0;
        buyerBucket.pub += pub;
        if (productId) ensureBuyer(productBuyer, productId).pub += pub;
        if (redirectedLeadIds.has(leadId)) {
          buyerBucket.redirect += 1;
          if (productId) ensureBuyer(productBuyer, productId).redirect += 1;
        }
      }
    } else if (isRejectedBuyerStatus(status)) {
      buyerBucket.rejected += 1;
      if (productId) ensureBuyer(productBuyer, productId).rejected += 1;
    }
  }

  return {
    topPublishers: toPublisherRankingRows(publisherBySeller, refs),
    topBuyers: toBuyerRankingRows(buyerById, refs),
    topProductsByPublisher: toProductPublisherRows(productPublisher, refs),
    topProductsByBuyers: toProductBuyerRows(productBuyer, refs),
    newPublishers: [],
    newCampaigns: [],
  };
}

function aggregateTotalsForRange(
  range: DateRange,
  leads: LeadProjection[],
  deliveries: DeliveryProjection[],
  soldPriceByLeadId: Map<string, number>,
  redirectedLeadIds: Set<string>
) {
  const publisher = createPublisherAccumulator();
  const buyer = createBuyerAccumulator();

  for (const lead of leads) {
    if (!isInRange(lead.postedAt, range)) continue;
    publisher.post += 1;
    if (lead.validationStatus !== "fail") publisher.lead += 1;
    if (lead.publisherStatus === "Sold") {
      publisher.sold += 1;
      if (typeof lead.soldPrice === "number" && Number.isFinite(lead.soldPrice)) {
        publisher.pub += lead.soldPrice;
      }
    }
    if (lead.redirectConfirmedAt) publisher.redirect += 1;
  }

  for (const delivery of deliveries) {
    if (!isInRange(delivery.postedAt, range)) continue;
    const status = String(delivery.buyerStatus ?? "");
    if (status === "Skipped") continue;

    buyer.post += 1;
    if (status === "Accept") {
      buyer.accept += 1;
      if (typeof delivery.price === "number" && Number.isFinite(delivery.price)) {
        buyer.ttl += delivery.price;
        publisher.ttl += delivery.price;
      }
      const leadId = refToString(delivery.sellerLeadRef);
      if (leadId) {
        buyer.pub += soldPriceByLeadId.get(leadId) ?? 0;
        if (redirectedLeadIds.has(leadId)) buyer.redirect += 1;
      }
    } else if (isRejectedBuyerStatus(status)) {
      buyer.rejected += 1;
    }
  }

  return { publisher, buyer };
}

async function countFailedLogs(range: DateRange) {
  return BuyerRequestLogModel.countDocuments({
    deliveryStatus: "fail",
    createdAt: {
      $gte: range.from,
      $lte: range.to,
    },
  });
}

async function fetchNewPublishers(range: DateRange, refs: ReferenceData): Promise<DashboardNamedRow[]> {
  const sellers = await SellerModel.find({
    createdAt: { $gte: range.from, $lte: range.to },
  })
    .sort({ createdAt: -1 })
    .select({ _id: 1, name: 1 })
    .limit(TOP_RANKING_LIMIT)
    .lean();

  return sellers.map((seller) => {
    const sellerId = seller._id.toString();
    const index = refs.sellerIndexById.get(sellerId) ?? 0;
    const name = refs.sellerNameById.get(sellerId) ?? seller.name;
    return {
      id: sellerId,
      label: index ? `[${index}] ${name}` : name,
    };
  });
}

async function fetchNewCampaigns(range: DateRange): Promise<DashboardNamedRow[]> {
  const campaigns = await CampaignModel.find({
    createdAt: { $gte: range.from, $lte: range.to },
    status: { $ne: "Deleted" },
  })
    .sort({ createdAt: -1 })
    .select({ _id: 1, name: 1, displayId: 1 })
    .limit(TOP_RANKING_LIMIT)
    .lean();

  return campaigns.map((campaign) => ({
    id: campaign._id.toString(),
    label: campaign.displayId ? `[${campaign.displayId}] ${campaign.name}` : campaign.name,
  }));
}

export async function buildDashboardSnapshot(layoutName: string): Promise<DashboardSnapshot> {
  await connectToDatabase();
  await ensureBuyerFieldsMigrated();
  await ensureSellerCollectionMigrated();
  await ensureVerticalCollectionMigrated();
  await ensureSellerLeadReferencesMigrated();

  const ranges = buildDashboardRanges();
  const chartDays = Array.from({ length: CHART_DAY_COUNT }, (_, index) =>
    startOfDay(addDays(ranges.today.from, index - (CHART_DAY_COUNT - 1)))
  );

  const [verticals, sellers, buyers, leads, deliveries] = await Promise.all([
    VerticalModel.find().sort({ createdAt: 1 }).select({ _id: 1, name: 1 }).lean(),
    SellerModel.find().sort({ createdAt: 1 }).select({ _id: 1, name: 1 }).lean(),
    BuyerModel.find(excludeDeletedStatusFilter())
      .sort({ displayId: 1, createdAt: 1 })
      .select({ _id: 1, displayId: 1, name: 1, company: 1, firstName: 1, lastName: 1 })
      .lean(),
    SellerLeadModel.find({
      postedAt: { $gte: ranges.fetch.from, $lte: ranges.fetch.to },
    })
      .select({
        sellerRef: 1,
        verticalRef: 1,
        validationStatus: 1,
        publisherStatus: 1,
        soldPrice: 1,
        postedAt: 1,
        redirectConfirmedAt: 1,
      })
      .lean(),
    LeadDeliveryModel.find({
      postedAt: { $gte: ranges.fetch.from, $lte: ranges.fetch.to },
    })
      .select({
        buyerRef: 1,
        sellerRef: 1,
        sellerLeadRef: 1,
        verticalRef: 1,
        buyerStatus: 1,
        price: 1,
        postedAt: 1,
      })
      .lean(),
  ]);

  const acceptLeadIds = new Set<string>();
  for (const delivery of deliveries as DeliveryProjection[]) {
    if (delivery.buyerStatus === "Accept") {
      const leadId = refToString(delivery.sellerLeadRef);
      if (leadId) acceptLeadIds.add(leadId);
    }
  }

  const sellerLeadDocs =
    acceptLeadIds.size > 0
      ? await SellerLeadModel.find({ _id: { $in: [...acceptLeadIds] } })
          .select({ soldPrice: 1, redirectConfirmedAt: 1 })
          .lean()
      : [];

  const soldPriceByLeadId = new Map<string, number>();
  const redirectedLeadIds = new Set<string>();
  for (const lead of sellerLeadDocs) {
    const leadId = lead._id?.toString() ?? "";
    if (!leadId) continue;
    if (typeof lead.soldPrice === "number" && Number.isFinite(lead.soldPrice)) {
      soldPriceByLeadId.set(leadId, lead.soldPrice);
    }
    if (lead.redirectConfirmedAt) redirectedLeadIds.add(leadId);
  }

  const refs: ReferenceData = {
    sellerIndexById: new Map(sellers.map((seller, index) => [seller._id.toString(), index + 1001])),
    sellerNameById: new Map(sellers.map((seller) => [seller._id.toString(), seller.name])),
    buyerLabelById: new Map(
      buyers.map((buyer) => {
        const name = resolveBuyerName(buyer);
        const label = buyer.displayId ? `[${buyer.displayId}] ${name}` : name;
        return [buyer._id.toString(), label];
      })
    ),
    productLabelById: new Map(
      verticals.map((vertical, index) => [vertical._id.toString(), formatProductLabel(vertical.name, index + 1)])
    ),
  };

  const leadRows = leads as LeadProjection[];
  const deliveryRows = deliveries as DeliveryProjection[];

  const publisherByDay = new Map<string, PublisherAccumulator>();
  const buyerByDay = new Map<string, BuyerAccumulator>();

  for (const lead of leadRows) {
    const key = dayKey(lead.postedAt);
    if (!key) continue;
    const bucket = publisherByDay.get(key) ?? createPublisherAccumulator();
    bucket.post += 1;
    if (lead.validationStatus !== "fail") bucket.lead += 1;
    if (lead.publisherStatus === "Sold") {
      bucket.sold += 1;
      if (typeof lead.soldPrice === "number" && Number.isFinite(lead.soldPrice)) bucket.pub += lead.soldPrice;
    }
    if (lead.redirectConfirmedAt) bucket.redirect += 1;
    publisherByDay.set(key, bucket);
  }

  for (const delivery of deliveryRows) {
    const key = dayKey(delivery.postedAt);
    if (!key) continue;
    const status = String(delivery.buyerStatus ?? "");
    if (status === "Skipped") continue;

    const buyerBucket = buyerByDay.get(key) ?? createBuyerAccumulator();
    buyerBucket.post += 1;

    const publisherBucket = publisherByDay.get(key) ?? createPublisherAccumulator();

    if (status === "Accept") {
      buyerBucket.accept += 1;
      if (typeof delivery.price === "number" && Number.isFinite(delivery.price)) {
        buyerBucket.ttl += delivery.price;
        publisherBucket.ttl += delivery.price;
      }
      const leadId = refToString(delivery.sellerLeadRef);
      if (leadId) {
        buyerBucket.pub += soldPriceByLeadId.get(leadId) ?? 0;
        if (redirectedLeadIds.has(leadId)) buyerBucket.redirect += 1;
      }
    } else if (isRejectedBuyerStatus(status)) {
      buyerBucket.rejected += 1;
    }

    buyerByDay.set(key, buyerBucket);
    publisherByDay.set(key, publisherBucket);
  }

  const todayTotals = aggregateTotalsForRange(ranges.today, leadRows, deliveryRows, soldPriceByLeadId, redirectedLeadIds);
  const priorDayTotals = aggregateTotalsForRange(
    ranges.yesterday,
    leadRows,
    deliveryRows,
    soldPriceByLeadId,
    redirectedLeadIds
  );
  const priorWeekTotals = aggregateTotalsForRange(
    ranges.priorWeek,
    leadRows,
    deliveryRows,
    soldPriceByLeadId,
    redirectedLeadIds
  );

  const [todayRankings, yesterdayRankings, weekRankings, activityToday, activityYesterday, activityLastWeek, activityLastMonth] =
    await Promise.all([
      Promise.resolve(
        buildRankingData(ranges.today, leadRows, deliveryRows, soldPriceByLeadId, redirectedLeadIds, refs)
      ),
      Promise.resolve(
        buildRankingData(ranges.yesterday, leadRows, deliveryRows, soldPriceByLeadId, redirectedLeadIds, refs)
      ),
      Promise.resolve(
        buildRankingData(ranges.week, leadRows, deliveryRows, soldPriceByLeadId, redirectedLeadIds, refs)
      ),
      countFailedLogs(ranges.activity.today),
      countFailedLogs(ranges.activity.yesterday),
      countFailedLogs(ranges.activity.lastWeek),
      countFailedLogs(ranges.activity.lastMonth),
    ]);

  const rankings: Record<DashboardPeriod, DashboardRankingData> = {
    today: {
      ...todayRankings,
      newPublishers: await fetchNewPublishers(ranges.today, refs),
      newCampaigns: await fetchNewCampaigns(ranges.today),
    },
    yesterday: {
      ...yesterdayRankings,
      newPublishers: await fetchNewPublishers(ranges.yesterday, refs),
      newCampaigns: await fetchNewCampaigns(ranges.yesterday),
    },
    week: {
      ...weekRankings,
      newPublishers: await fetchNewPublishers(ranges.week, refs),
      newCampaigns: await fetchNewCampaigns(ranges.week),
    },
  };

  const activity: DashboardActivitySegment[] = [
    { key: "today", label: "Today", count: activityToday, tone: "today" },
    { key: "yesterday", label: "Yesterday", count: activityYesterday, tone: "yesterday" },
    { key: "week", label: "Last Week", count: activityLastWeek, tone: "last-week" },
    { key: "last-month", label: "Last Month", count: activityLastMonth, tone: "last-month" },
  ];

  return {
    layoutName,
    kpis: buildKpiCards(
      todayTotals.publisher,
      todayTotals.buyer,
      priorDayTotals.publisher,
      priorDayTotals.buyer,
      priorWeekTotals.publisher,
      priorWeekTotals.buyer
    ),
    activity,
    publisherChart: buildPublisherChart(publisherByDay, chartDays),
    buyerChart: buildBuyerChart(buyerByDay, chartDays),
    rankings,
  };
}
