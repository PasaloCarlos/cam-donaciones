import { describe, it, expect } from "vitest";
import { monthlyNet, activeDonorsByMonth, subscriptionChangesByMonth } from "@/lib/trends";
import type { MetricPayment, MetricPledge } from "@/lib/metrics";

function pay(p: Partial<MetricPayment> = {}): MetricPayment {
  return { donor_id: "d", source: "stripe", period_month: "2026-06-01",
    gross_cents: 2601, net_cents: 2500, goal: "operacion_general", ...p };
}

function pledge(p: Partial<MetricPledge> = {}): MetricPledge {
  return { id: "p", donor_id: "d", source: "stripe", kind: "recurring", status: "active",
    goal: "operacion_general", monthly_net_cents: 2500, monthly_gross_cents: 2601,
    subscription_date: "2025-01-10", cancelled_at: null, source_year: 2026, ...p };
}

describe("monthlyNet", () => {
  it("sums net_cents per YYYY-MM month", () => {
    const payments = [
      pay({ period_month: "2026-06-01", net_cents: 1000 }),
      pay({ period_month: "2026-06-15", net_cents: 500 }),
      pay({ period_month: "2026-07-01", net_cents: 2000 }),
    ];
    const r = monthlyNet(payments);
    expect(r).toEqual([
      { month: "2026-06", netCents: 1500 },
      { month: "2026-07", netCents: 2000 },
    ]);
  });

  it("returns months in ascending order even if input out of order", () => {
    const payments = [
      pay({ period_month: "2026-08-01", net_cents: 100 }),
      pay({ period_month: "2026-06-01", net_cents: 200 }),
      pay({ period_month: "2026-07-15", net_cents: 300 }),
    ];
    const r = monthlyNet(payments);
    expect(r.map((m) => m.month)).toEqual(["2026-06", "2026-07", "2026-08"]);
  });

  it("handles empty input", () => {
    const r = monthlyNet([]);
    expect(r).toEqual([]);
  });

  it("aggregates multiple payments in same month from different days", () => {
    const payments = [
      pay({ period_month: "2026-06-01", net_cents: 100 }),
      pay({ period_month: "2026-06-05", net_cents: 200 }),
      pay({ period_month: "2026-06-28", net_cents: 150 }),
    ];
    const r = monthlyNet(payments);
    expect(r).toEqual([{ month: "2026-06", netCents: 450 }]);
  });
});

describe("activeDonorsByMonth", () => {
  it("counts distinct donors per month", () => {
    const payments = [
      pay({ donor_id: "a", period_month: "2026-06-01" }),
      pay({ donor_id: "b", period_month: "2026-06-01" }),
      pay({ donor_id: "a", period_month: "2026-07-01" }),
    ];
    const r = activeDonorsByMonth(payments);
    expect(r).toEqual([
      { month: "2026-06", donors: 2 },
      { month: "2026-07", donors: 1 },
    ]);
  });

  it("counts same donor twice in same month as one (distinct)", () => {
    const payments = [
      pay({ donor_id: "a", period_month: "2026-06-01", net_cents: 100 }),
      pay({ donor_id: "a", period_month: "2026-06-15", net_cents: 200 }),
    ];
    const r = activeDonorsByMonth(payments);
    expect(r).toEqual([{ month: "2026-06", donors: 1 }]);
  });

  it("returns months in ascending order", () => {
    const payments = [
      pay({ donor_id: "a", period_month: "2026-08-01" }),
      pay({ donor_id: "b", period_month: "2026-06-01" }),
      pay({ donor_id: "c", period_month: "2026-07-01" }),
    ];
    const r = activeDonorsByMonth(payments);
    expect(r.map((m) => m.month)).toEqual(["2026-06", "2026-07", "2026-08"]);
  });

  it("handles empty input", () => {
    const r = activeDonorsByMonth([]);
    expect(r).toEqual([]);
  });
});

describe("subscriptionChangesByMonth", () => {
  it("counts new recurring subscriptions by subscription_date month", () => {
    const pledges = [
      pledge({ kind: "recurring", subscription_date: "2026-01-10", cancelled_at: null }),
      pledge({ kind: "recurring", subscription_date: "2026-01-25", cancelled_at: null, donor_id: "b" }),
      pledge({ kind: "recurring", subscription_date: "2026-02-05", cancelled_at: null, donor_id: "c" }),
    ];
    const r = subscriptionChangesByMonth(pledges);
    expect(r).toEqual([
      { month: "2026-01", started: 2, cancelled: 0 },
      { month: "2026-02", started: 1, cancelled: 0 },
    ]);
  });

  it("counts cancellations by cancelled_at month", () => {
    const pledges = [
      pledge({ kind: "recurring", subscription_date: "2026-01-10", cancelled_at: "2026-03-15" }),
      pledge({ kind: "recurring", subscription_date: "2026-01-20", cancelled_at: "2026-03-20", donor_id: "b" }),
      pledge({ kind: "recurring", subscription_date: "2026-02-10", cancelled_at: "2026-04-01", donor_id: "c" }),
    ];
    const r = subscriptionChangesByMonth(pledges);
    expect(r).toEqual([
      { month: "2026-01", started: 2, cancelled: 0 },
      { month: "2026-02", started: 1, cancelled: 0 },
      { month: "2026-03", started: 0, cancelled: 2 },
      { month: "2026-04", started: 0, cancelled: 1 },
    ]);
  });

  it("does not count one_time pledges as started", () => {
    const pledges = [
      pledge({ kind: "one_time", subscription_date: "2026-01-10", cancelled_at: null }),
      pledge({ kind: "recurring", subscription_date: "2026-01-10", cancelled_at: null, donor_id: "b" }),
    ];
    const r = subscriptionChangesByMonth(pledges);
    expect(r).toEqual([{ month: "2026-01", started: 1, cancelled: 0 }]);
  });

  it("counts cancelled pledges regardless of kind", () => {
    const pledges = [
      pledge({ kind: "one_time", subscription_date: null, cancelled_at: "2026-01-10" }),
      pledge({ kind: "recurring", subscription_date: "2026-01-10", cancelled_at: "2026-01-15", donor_id: "b" }),
    ];
    const r = subscriptionChangesByMonth(pledges);
    expect(r).toEqual([{ month: "2026-01", started: 1, cancelled: 2 }]);
  });

  it("counts pledge without cancelled_at in started but not cancelled", () => {
    const pledges = [
      pledge({ kind: "recurring", subscription_date: "2026-01-10", cancelled_at: null }),
    ];
    const r = subscriptionChangesByMonth(pledges);
    expect(r).toEqual([{ month: "2026-01", started: 1, cancelled: 0 }]);
  });

  it("returns months in ascending order", () => {
    const pledges = [
      pledge({ kind: "recurring", subscription_date: "2026-03-10", cancelled_at: null }),
      pledge({ kind: "recurring", subscription_date: "2026-01-10", cancelled_at: null, donor_id: "b" }),
      pledge({ kind: "recurring", subscription_date: "2026-02-10", cancelled_at: null, donor_id: "c" }),
    ];
    const r = subscriptionChangesByMonth(pledges);
    expect(r.map((m) => m.month)).toEqual(["2026-01", "2026-02", "2026-03"]);
  });

  it("handles empty input", () => {
    const r = subscriptionChangesByMonth([]);
    expect(r).toEqual([]);
  });

  it("counts same month start and cancel separately", () => {
    const pledges = [
      pledge({ kind: "recurring", subscription_date: "2026-01-10", cancelled_at: "2026-01-25" }),
    ];
    const r = subscriptionChangesByMonth(pledges);
    expect(r).toEqual([{ month: "2026-01", started: 1, cancelled: 1 }]);
  });
});
