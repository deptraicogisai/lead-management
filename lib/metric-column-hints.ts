export type MetricColumnHint = {
  title: string;
  description: string;
};

export const METRIC_COLUMN_HINTS = {
  epl: {
    title: "EPL",
    description: "The Publisher earnings per lead\n(Publisher earnings ÷ total leads).",
  },
  alp: {
    title: "ALP",
    description: "The average lead price\n(Publisher earnings ÷ sold leads).",
  },
  adm: {
    title: "ADM",
    description: "Admin revenue.",
  },
  pub: {
    title: "Pub",
    description: "The Publisher earnings.",
  },
  cpl: {
    title: "CPL",
    description: "The earning per lead\n(total earnings ÷ number of posts).",
  },
  ttl: {
    title: "TTL",
    description: "Total revenue.",
  },
} as const satisfies Record<string, MetricColumnHint>;

export type MetricColumnHintKey = keyof typeof METRIC_COLUMN_HINTS;

/** Friendly label for column-visibility menus when header `label` is a React node. */
export function metricColumnVisibilityLabel(columnKey: string, fallback: string) {
  if (columnKey === "publisherPayout" || columnKey === "pub") return METRIC_COLUMN_HINTS.pub.title;
  if (columnKey === "adm") return METRIC_COLUMN_HINTS.adm.title;
  if (columnKey === "epl") return METRIC_COLUMN_HINTS.epl.title;
  if (columnKey === "alp") return METRIC_COLUMN_HINTS.alp.title;
  if (columnKey === "cpl") return METRIC_COLUMN_HINTS.cpl.title;
  if (columnKey === "ttl") return METRIC_COLUMN_HINTS.ttl.title;
  return fallback;
}
