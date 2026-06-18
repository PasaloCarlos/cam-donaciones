import type { MetricPayment } from "@/lib/metrics";

export type TimelineEntry = {
  periodMonth: string; source: string; grossCents: number; netCents: number; goal: string | null;
};

export function donorTimeline(payments: MetricPayment[]): TimelineEntry[] {
  return payments
    .map((p) => ({
      periodMonth: p.period_month, source: p.source,
      grossCents: p.gross_cents, netCents: p.net_cents, goal: p.goal,
    }))
    .sort((a, b) =>
      a.periodMonth === b.periodMonth ? a.source.localeCompare(b.source) : (a.periodMonth < b.periodMonth ? 1 : -1)
    );
}
