import { describe, it, expect } from "vitest";
import { donorTimeline } from "@/lib/donor-timeline";
import type { MetricPayment } from "@/lib/metrics";

const pays: MetricPayment[] = [
  { donor_id: "A", source: "stripe", period_month: "2026-01-01", gross_cents: 1000, net_cents: 933, goal: "operacion_general" },
  { donor_id: "A", source: "paypal", period_month: "2026-03-01", gross_cents: 2500, net_cents: 2400, goal: "compras_solidarias" },
  { donor_id: "A", source: "cam_cash", period_month: "2026-01-01", gross_cents: 2000, net_cents: 2000, goal: null },
];

describe("donorTimeline", () => {
  const t = donorTimeline(pays);
  it("sorts newest period first, then by source", () => {
    expect(t.map((e) => e.periodMonth)).toEqual(["2026-03-01","2026-01-01","2026-01-01"]);
    expect(t[0]).toMatchObject({ source: "paypal", grossCents: 2500, netCents: 2400, goal: "compras_solidarias" });
  });
  it("breaks period ties by source name (cam_cash before stripe)", () => {
    expect([t[1].source, t[2].source]).toEqual(["cam_cash", "stripe"]);
  });
});
