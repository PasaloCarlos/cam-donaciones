import { describe, it, expect } from "vitest";
import { consolidateSubscriptions } from "@/lib/subscriptions";
import type { MetricPledge } from "@/lib/metrics";

const base: Omit<MetricPledge, "source_year" | "source" | "kind" | "status" | "monthly_net_cents" | "goal"> = {
  id: "x",
  donor_id: "d1",
  monthly_gross_cents: null,
  subscription_date: null,
  cancelled_at: null,
};

function pledge(overrides: Partial<MetricPledge> & Pick<MetricPledge, "source" | "kind" | "status" | "source_year">): MetricPledge {
  return { ...base, id: Math.random().toString(36).slice(2), monthly_net_cents: null, goal: null, monthly_gross_cents: null, ...overrides };
}

describe("consolidateSubscriptions", () => {
  it("two recurring pledges same source across years → ONE group, latest-year wins", () => {
    const pledges: MetricPledge[] = [
      pledge({ source: "stripe", kind: "recurring", status: "active", source_year: 2025, monthly_net_cents: 2000, goal: "operacion_general" }),
      pledge({ source: "stripe", kind: "recurring", status: "active", source_year: 2026, monthly_net_cents: 2500, goal: "compras_solidarias" }),
    ];
    const groups = consolidateSubscriptions(pledges);
    expect(groups).toHaveLength(1);
    const g = groups[0];
    expect(g.source).toBe("stripe");
    expect(g.firstYear).toBe(2025);
    expect(g.lastYear).toBe(2026);
    expect(g.yearCount).toBe(2);
    expect(g.status).toBe("active");
    expect(g.monthlyNetCents).toBe(2500);          // latest year
    expect(g.goal).toBe("compras_solidarias");     // latest year
  });

  it("different sources → two groups sorted alphabetically", () => {
    const pledges: MetricPledge[] = [
      pledge({ source: "stripe", kind: "recurring", status: "active", source_year: 2025, monthly_net_cents: 1000, goal: null }),
      pledge({ source: "paypal", kind: "recurring", status: "cancelled", source_year: 2025, monthly_net_cents: 500, goal: null }),
    ];
    const groups = consolidateSubscriptions(pledges);
    expect(groups).toHaveLength(2);
    expect(groups[0].source).toBe("paypal");
    expect(groups[1].source).toBe("stripe");
  });

  it("one_time pledges are excluded — donor with only one_time → empty array", () => {
    const pledges: MetricPledge[] = [
      pledge({ source: "special", kind: "one_time", status: "active", source_year: 2025, monthly_net_cents: null, goal: null }),
    ];
    expect(consolidateSubscriptions(pledges)).toHaveLength(0);
  });

  it("mixed kinds: only recurring pledges included in groups", () => {
    const pledges: MetricPledge[] = [
      pledge({ source: "stripe", kind: "recurring", status: "active", source_year: 2025, monthly_net_cents: 1000, goal: null }),
      pledge({ source: "special", kind: "one_time", status: "active", source_year: 2025, monthly_net_cents: null, goal: null }),
    ];
    const groups = consolidateSubscriptions(pledges);
    expect(groups).toHaveLength(1);
    expect(groups[0].source).toBe("stripe");
  });

  it("single recurring pledge → group with firstYear === lastYear, yearCount 1", () => {
    const pledges: MetricPledge[] = [
      pledge({ source: "cam_cash", kind: "recurring", status: "paused", source_year: 2024, monthly_net_cents: 750, goal: "operacion_general" }),
    ];
    const groups = consolidateSubscriptions(pledges);
    expect(groups).toHaveLength(1);
    const g = groups[0];
    expect(g.firstYear).toBe(2024);
    expect(g.lastYear).toBe(2024);
    expect(g.yearCount).toBe(1);
    expect(g.status).toBe("paused");
  });

  it("pledge with null source_year is included, years array treated safely", () => {
    const pledges: MetricPledge[] = [
      pledge({ source: "other", kind: "recurring", status: "active", source_year: null, monthly_net_cents: null, goal: null }),
    ];
    const groups = consolidateSubscriptions(pledges);
    expect(groups).toHaveLength(1);
    expect(groups[0].firstYear).toBeNull();
    expect(groups[0].lastYear).toBeNull();
    expect(groups[0].yearCount).toBe(1);
  });
});
