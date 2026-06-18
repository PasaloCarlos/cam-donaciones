import { describe, it, expect } from "vitest";
import { buildDonorDashboard } from "@/lib/donor-dashboard";
import type { MetricPledge, MetricPayment } from "@/lib/metrics";

const asOf = new Date("2026-06-15T00:00:00Z");

const pledges: MetricPledge[] = [
  { id: "p1", donor_id: "A", source: "stripe", kind: "recurring", status: "active", goal: "operacion_general",
    monthly_net_cents: 2500, monthly_gross_cents: 2601, subscription_date: "2025-01-01", cancelled_at: null },
  { id: "p2", donor_id: "B", source: "paypal", kind: "recurring", status: "cancelled", goal: "compras_solidarias",
    monthly_net_cents: 5000, monthly_gross_cents: 5152, subscription_date: "2024-01-01", cancelled_at: "2026-02-01" },
  { id: "p3", donor_id: "C", source: "special", kind: "one_time", status: "active", goal: "operacion_general",
    monthly_net_cents: null, monthly_gross_cents: null, subscription_date: "2025-12-08", cancelled_at: null },
];
const payments: MetricPayment[] = [
  { donor_id: "A", source: "stripe", period_month: "2026-06-01", gross_cents: 2601, net_cents: 2500, goal: "operacion_general" },
  { donor_id: "A", source: "stripe", period_month: "2026-01-01", gross_cents: 2601, net_cents: 2500, goal: "operacion_general" },
  { donor_id: "B", source: "paypal", period_month: "2026-01-01", gross_cents: 5152, net_cents: 5000, goal: "compras_solidarias" },
  { donor_id: "C", source: "special", period_month: "2025-12-01", gross_cents: 200000, net_cents: 195971, goal: "operacion_general" },
];

describe("buildDonorDashboard", () => {
  const d = buildDonorDashboard({ pledges, payments }, asOf, 2);
  it("MRR counts only active recurring (donor A)", () => {
    expect(d.mrr).toEqual({ netCents: 2500, grossCents: 2601 });
  });
  it("classifies each donor", () => {
    expect(d.donorCounts.active).toBe(1);          // A
    expect(d.donorCounts.cancelled).toBe(1);       // B
    expect(d.donorCounts.one_time_only).toBe(1);   // C
    expect(d.donorCounts.total).toBe(3);
  });
  it("total raised sums all payments; YTD sums asOf-year payments", () => {
    expect(d.totalRaisedCents).toBe(2500 + 2500 + 5000 + 195971);
    expect(d.ytdRaisedCents).toBe(2500 + 2500 + 5000); // 2026 net only
  });
  it("breaks down by source and goal", () => {
    expect(d.bySource.stripe.count).toBe(2);
    expect(d.byGoal.operacion_general.count).toBe(3);
  });
});
