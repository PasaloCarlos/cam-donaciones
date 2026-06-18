import {
  activeMrrCents, classifyDonor, totalsBySource, totalsByGoal,
  type MetricPledge, type MetricPayment,
} from "@/lib/metrics";

export type DonorDashboard = {
  mrr: { netCents: number; grossCents: number };
  donorCounts: { active: number; lapsed: number; cancelled: number; one_time_only: number; total: number };
  totalRaisedCents: number;
  ytdRaisedCents: number;
  bySource: Record<string, { grossCents: number; netCents: number; count: number }>;
  byGoal: Record<string, { grossCents: number; netCents: number; count: number }>;
};

export function buildDonorDashboard(
  input: { pledges: MetricPledge[]; payments: MetricPayment[] },
  asOf: Date,
  lapsedAfterMonths: number
): DonorDashboard {
  const { pledges, payments } = input;

  // group pledges + payments by donor for classification
  const donorIds = new Set<string>([...pledges.map((p) => p.donor_id), ...payments.map((p) => p.donor_id)]);
  const counts = { active: 0, lapsed: 0, cancelled: 0, one_time_only: 0, total: 0 };
  for (const id of donorIds) {
    const dp = pledges.filter((p) => p.donor_id === id);
    const dpay = payments.filter((p) => p.donor_id === id);
    counts[classifyDonor(dp, dpay, asOf, lapsedAfterMonths)] += 1;
    counts.total += 1;
  }

  const asOfYear = asOf.getUTCFullYear();
  let totalRaisedCents = 0, ytdRaisedCents = 0;
  for (const p of payments) {
    totalRaisedCents += p.net_cents;
    if (new Date(p.period_month).getUTCFullYear() === asOfYear) ytdRaisedCents += p.net_cents;
  }

  return {
    mrr: activeMrrCents(pledges),
    donorCounts: counts,
    totalRaisedCents,
    ytdRaisedCents,
    bySource: totalsBySource(payments),
    byGoal: totalsByGoal(payments),
  };
}
