import { describe, it, expect } from "vitest";
import { manualEntryToRecord, type ManualEntry } from "@/lib/ingest/importers/manual-entry";

const base: ManualEntry = {
  source: "cam_cash", email: null, name: "Cecilia Carrasquillo", phone: null, address: null,
  goal: "operacion_general", kind: "recurring", grossCents: 2000, feeCents: 0,
  periodMonth: "2026-03-01", subscriptionDate: "2026-03-01",
};

describe("manualEntryToRecord", () => {
  it("recurring cash: donor + recurring pledge + one payment", () => {
    const r = manualEntryToRecord(base);
    expect(r.donor).toMatchObject({ name: "Cecilia Carrasquillo", email: null });
    expect(r.pledge).toMatchObject({ source: "cam_cash", kind: "recurring", status: "active",
      monthlyGrossCents: 2000, monthlyNetCents: 2000, goal: "operacion_general" });
    expect(r.payments).toHaveLength(1);
    expect(r.payments[0]).toMatchObject({ source: "cam_cash", periodMonth: "2026-03-01", grossCents: 2000, netCents: 2000 });
  });
  it("one_time special gift: pledge kind one_time with null monthly amounts", () => {
    const r = manualEntryToRecord({ ...base, source: "special", kind: "one_time", grossCents: 200000, feeCents: 4029, name: "Bryan Oxender" });
    expect(r.pledge).toMatchObject({ source: "special", kind: "one_time", monthlyGrossCents: null, monthlyNetCents: null });
    expect(r.payments[0]).toMatchObject({ grossCents: 200000, feeCents: 4029, netCents: 200000 - 4029 });
  });
});
