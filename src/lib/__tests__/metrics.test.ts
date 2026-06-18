import { describe, it, expect } from "vitest";
import { activeMrrCents, classifyDonor, monthsBetween, totalsBySource, totalsByGoal,
  type MetricPledge, type MetricPayment } from "@/lib/metrics";

const asOf = new Date("2026-06-15T00:00:00Z");

function pledge(p: Partial<MetricPledge> = {}): MetricPledge {
  return { id: "p", donor_id: "d", source: "stripe", kind: "recurring", status: "active",
    goal: "operacion_general", monthly_net_cents: 2500, monthly_gross_cents: 2601,
    subscription_date: "2025-01-10", cancelled_at: null, source_year: 2026, ...p };
}
function pay(p: Partial<MetricPayment> = {}): MetricPayment {
  return { donor_id: "d", source: "stripe", period_month: "2026-06-01",
    gross_cents: 2601, net_cents: 2500, goal: "operacion_general", ...p };
}

describe("activeMrrCents", () => {
  it("sums net+gross over active recurring pledges across donors/sources", () => {
    const r = activeMrrCents([
      pledge({ donor_id: "a", source: "stripe", monthly_net_cents: 2500, monthly_gross_cents: 2601 }),
      pledge({ donor_id: "b", source: "stripe", status: "cancelled", monthly_net_cents: 9999 }),
      pledge({ donor_id: "c", source: "stripe", kind: "one_time", monthly_net_cents: 9999 }),
      pledge({ donor_id: "d", source: "paypal", monthly_net_cents: 5000, monthly_gross_cents: 5152 }),
    ]);
    expect(r).toEqual({ netCents: 7500, grossCents: 7753 });
  });
  it("counts only the latest-year pledge per donor+source (no multi-year double count)", () => {
    const r = activeMrrCents([
      pledge({ donor_id: "a", source: "paypal", source_year: 2025, monthly_net_cents: 2500, monthly_gross_cents: 2601 }),
      pledge({ donor_id: "a", source: "paypal", source_year: 2026, monthly_net_cents: 3000, monthly_gross_cents: 3100 }),
    ]);
    expect(r).toEqual({ netCents: 3000, grossCents: 3100 });
  });
  it("counts a donor's different sources separately", () => {
    const r = activeMrrCents([
      pledge({ donor_id: "a", source: "paypal", source_year: 2026, monthly_net_cents: 3000, monthly_gross_cents: 3100 }),
      pledge({ donor_id: "a", source: "cam_cash", source_year: 2026, monthly_net_cents: 2000, monthly_gross_cents: 2000 }),
    ]);
    expect(r).toEqual({ netCents: 5000, grossCents: 5100 });
  });
});

describe("monthsBetween", () => {
  it("counts whole calendar months", () => {
    expect(monthsBetween(new Date("2026-04-01"), new Date("2026-06-15"))).toBe(2);
    expect(monthsBetween(new Date("2025-06-01"), new Date("2026-06-01"))).toBe(12);
  });
});

describe("classifyDonor", () => {
  it("active: recurring pledge with a recent payment", () => {
    expect(classifyDonor([pledge()], [pay({ period_month: "2026-06-01" })], asOf, 2)).toBe("active");
  });
  it("lapsed: recurring pledge, no payment within the window", () => {
    expect(classifyDonor([pledge()], [pay({ period_month: "2026-01-01" })], asOf, 2)).toBe("lapsed");
  });
  it("cancelled: all recurring pledges cancelled", () => {
    expect(classifyDonor([pledge({ status: "cancelled" })], [], asOf, 2)).toBe("cancelled");
  });
  it("one_time_only: no recurring pledges at all", () => {
    expect(classifyDonor([pledge({ kind: "one_time", status: "active" })], [pay()], asOf, 2)).toBe("one_time_only");
  });
});

describe("totals", () => {
  it("totalsBySource groups gross/net/count", () => {
    const r = totalsBySource([pay({ source: "stripe", gross_cents: 100, net_cents: 90 }),
      pay({ source: "stripe", gross_cents: 100, net_cents: 90 }),
      pay({ source: "paypal", gross_cents: 50, net_cents: 45 })]);
    expect(r.stripe).toEqual({ grossCents: 200, netCents: 180, count: 2 });
    expect(r.paypal).toEqual({ grossCents: 50, netCents: 45, count: 1 });
  });
  it("totalsByGoal groups by objetivo", () => {
    const r = totalsByGoal([pay({ goal: "operacion_general", net_cents: 10 }),
      pay({ goal: "compras_solidarias", net_cents: 20 })]);
    expect(r.operacion_general.netCents).toBe(10);
    expect(r.compras_solidarias.netCents).toBe(20);
  });
});
