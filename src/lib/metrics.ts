import type { DonationSource, PledgeKind, PledgeStatus, DonationGoal } from "@/types";

export type MetricPledge = {
  id: string; donor_id: string; source: DonationSource; kind: PledgeKind; status: PledgeStatus;
  goal: DonationGoal | null; monthly_net_cents: number | null; monthly_gross_cents: number | null;
  subscription_date: string | null; cancelled_at: string | null; source_year: number | null;
};
export type MetricPayment = {
  donor_id: string; source: DonationSource; period_month: string;
  gross_cents: number; net_cents: number; goal: DonationGoal | null;
};

export function monthsBetween(a: Date, b: Date): number {
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
}

export function activeMrrCents(pledges: MetricPledge[]): { netCents: number; grossCents: number } {
  // A donor with the same source across multiple years (one tab per year) has
  // one active recurring pledge per year; only the LATEST represents their
  // current monthly commitment. Counting every year would inflate MRR.
  // Different sources for the same donor are distinct real commitments.
  const latestPerDonorSource = new Map<string, MetricPledge>();
  for (const p of pledges) {
    if (p.kind !== "recurring" || p.status !== "active") continue;
    const key = `${p.donor_id}|${p.source}`;
    const cur = latestPerDonorSource.get(key);
    if (!cur || (p.source_year ?? 0) > (cur.source_year ?? 0)) {
      latestPerDonorSource.set(key, p);
    }
  }
  let netCents = 0, grossCents = 0;
  for (const p of latestPerDonorSource.values()) {
    netCents += p.monthly_net_cents ?? 0;
    grossCents += p.monthly_gross_cents ?? 0;
  }
  return { netCents, grossCents };
}

export function classifyDonor(
  pledges: MetricPledge[], payments: MetricPayment[], asOf: Date, lapsedAfterMonths: number
): "active" | "lapsed" | "cancelled" | "one_time_only" {
  const recurring = pledges.filter((p) => p.kind === "recurring");
  if (recurring.length === 0) return "one_time_only";
  const live = recurring.filter((p) => p.status !== "cancelled");
  if (live.length === 0) return "cancelled";
  const lastPayment = payments.reduce<Date | null>((acc, p) => {
    const d = new Date(p.period_month);
    return acc === null || d > acc ? d : acc;
  }, null);
  if (lastPayment === null) return "lapsed";
  return monthsBetween(lastPayment, asOf) <= lapsedAfterMonths ? "active" : "lapsed";
}

function group(payments: MetricPayment[], keyOf: (p: MetricPayment) => string) {
  const out: Record<string, { grossCents: number; netCents: number; count: number }> = {};
  for (const p of payments) {
    const k = keyOf(p);
    const row = out[k] ?? { grossCents: 0, netCents: 0, count: 0 };
    row.grossCents += p.gross_cents; row.netCents += p.net_cents; row.count += 1;
    out[k] = row;
  }
  return out;
}
export function totalsBySource(payments: MetricPayment[]) { return group(payments, (p) => p.source); }
export function totalsByGoal(payments: MetricPayment[]) { return group(payments, (p) => p.goal ?? "sin_objetivo"); }
