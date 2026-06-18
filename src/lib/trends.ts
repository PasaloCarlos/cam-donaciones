import type { MetricPayment, MetricPledge } from "@/lib/metrics";

export type MonthNet = { month: string; netCents: number };
export type MonthActive = { month: string; donors: number };
export type MonthChange = { month: string; started: number; cancelled: number };

// Net received per calendar month (YYYY-MM), ascending.
export function monthlyNet(payments: MetricPayment[]): MonthNet[] {
  const m = new Map<string, number>();
  for (const p of payments) {
    const k = p.period_month.slice(0, 7);
    m.set(k, (m.get(k) ?? 0) + p.net_cents);
  }
  return [...m.entries()].map(([month, netCents]) => ({ month, netCents })).sort((a, b) => (a.month < b.month ? -1 : 1));
}

// Distinct donors who gave each month (YYYY-MM), ascending.
export function activeDonorsByMonth(payments: MetricPayment[]): MonthActive[] {
  const m = new Map<string, Set<string>>();
  for (const p of payments) {
    const k = p.period_month.slice(0, 7);
    const s = m.get(k) ?? new Set<string>();
    s.add(p.donor_id);
    m.set(k, s);
  }
  return [...m.entries()].map(([month, s]) => ({ month, donors: s.size })).sort((a, b) => (a.month < b.month ? -1 : 1));
}

// New recurring subscriptions started (by subscription_date) vs cancellations
// (by cancelled_at) per month (YYYY-MM), ascending.
export function subscriptionChangesByMonth(pledges: MetricPledge[]): MonthChange[] {
  const m = new Map<string, { started: number; cancelled: number }>();
  const get = (k: string) => {
    let v = m.get(k);
    if (!v) { v = { started: 0, cancelled: 0 }; m.set(k, v); }
    return v;
  };
  for (const p of pledges) {
    if (p.kind === "recurring" && p.subscription_date) get(p.subscription_date.slice(0, 7)).started += 1;
    if (p.cancelled_at) get(p.cancelled_at.slice(0, 7)).cancelled += 1;
  }
  return [...m.entries()].map(([month, v]) => ({ month, started: v.started, cancelled: v.cancelled })).sort((a, b) => (a.month < b.month ? -1 : 1));
}
