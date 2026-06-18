import type { MetricPledge } from "@/lib/metrics";
import type { PledgeStatus } from "@/types";

export type SubscriptionGroup = {
  source: string;
  firstYear: number | null;
  lastYear: number | null;
  yearCount: number;
  status: PledgeStatus;
  monthlyNetCents: number | null;
  monthlyGrossCents: number | null;
  goal: string | null;
};

/**
 * Consolidate a donor's RECURRING pledges into one subscription per source.
 * A month-by-month continuation across years (one tab per year in the legacy
 * sheet) is treated as ONE subscription. one_time pledges are excluded.
 */
export function consolidateSubscriptions(pledges: MetricPledge[]): SubscriptionGroup[] {
  const bySource = new Map<string, MetricPledge[]>();
  for (const p of pledges) {
    if (p.kind !== "recurring") continue;
    const arr = bySource.get(p.source) ?? [];
    arr.push(p);
    bySource.set(p.source, arr);
  }
  const out: SubscriptionGroup[] = [];
  for (const [source, ps] of bySource) {
    const years = ps.map((p) => p.source_year).filter((y): y is number => y != null);
    const latest = ps.reduce((a, b) => ((b.source_year ?? 0) >= (a.source_year ?? 0) ? b : a));
    out.push({
      source,
      firstYear: years.length ? Math.min(...years) : null,
      lastYear: years.length ? Math.max(...years) : null,
      yearCount: ps.length,
      status: latest.status,
      monthlyNetCents: latest.monthly_net_cents,
      monthlyGrossCents: latest.monthly_gross_cents,
      goal: latest.goal,
    });
  }
  return out.sort((a, b) => a.source.localeCompare(b.source));
}
