import { describe, it, expect } from "vitest";
import { planImport } from "@/lib/ingest/commit";
import { buildDonorIndex } from "@/lib/donor-match";
import type { NormalizedRecord } from "@/lib/ingest/types";

function rec(over: Partial<NormalizedRecord> = {}): NormalizedRecord {
  return {
    donor: { email: "doris@gmail.com", name: "Doris Acevedo", phone: "7875551234" },
    pledge: { source: "stripe", kind: "recurring", status: "active", goal: "operacion_general",
      monthlyGrossCents: 2601, feeCents: 101, monthlyNetCents: 2500,
      subscriptionDate: "2025-01-01", sourceYear: 2026, externalRef: null },
    payments: [{ source: "stripe", periodMonth: "2026-06-01", grossCents: 2601, feeCents: 101,
      netCents: 2500, goal: "operacion_general", externalRef: null }],
    ...over,
  };
}

describe("planImport", () => {
  it("creates a new donor + pledge + payment when nothing matches", () => {
    const plan = planImport([rec()], { donorIndex: buildDonorIndex([]), existingPaymentKeys: new Set() });
    expect(plan.donorsToCreate).toHaveLength(1);
    expect(plan.pledgesToCreate).toHaveLength(1);
    expect(plan.paymentsToInsert).toHaveLength(1);
    expect(plan.counts).toMatchObject({ records: 1, newDonors: 1, payments: 1, skipped: 0 });
    // payment references the temp donor id of the donor it created
    expect(plan.paymentsToInsert[0].donorRef).toBe(plan.donorsToCreate[0].tempId);
  });

  it("matches an existing donor by email (no new donor)", () => {
    const index = buildDonorIndex([
      { id: "D1", email_normalized: "doris@gmail.com", name_normalized: "doris acevedo", phone_normalized: "7875551234" },
    ]);
    const plan = planImport([rec()], { donorIndex: index, existingPaymentKeys: new Set() });
    expect(plan.donorsToCreate).toHaveLength(0);
    expect(plan.paymentsToInsert[0].donorRef).toBe("D1");
    expect(plan.counts.matchedDonors).toBe(1);
  });

  it("dedupes the same donor appearing twice in one file to ONE created donor", () => {
    const plan = planImport([rec(), rec({ payments: [{ source: "stripe", periodMonth: "2026-07-01",
      grossCents: 2601, feeCents: 101, netCents: 2500, goal: "operacion_general", externalRef: null }] })],
      { donorIndex: buildDonorIndex([]), existingPaymentKeys: new Set() });
    expect(plan.donorsToCreate).toHaveLength(1);
    expect(plan.paymentsToInsert).toHaveLength(2);
  });

  it("skips a payment whose idempotency key already exists", () => {
    // Precompute the key the engine will generate for the default record's payment.
    const first = planImport([rec()], { donorIndex: buildDonorIndex([]), existingPaymentKeys: new Set() });
    const existingKey = first.paymentsToInsert[0].idempotencyKey;
    const plan = planImport([rec()], { donorIndex: buildDonorIndex([]), existingPaymentKeys: new Set([existingKey]) });
    expect(plan.paymentsToInsert).toHaveLength(0);
    expect(plan.skippedPayments).toBe(1);
  });

  it("dedupes duplicate payments within the same batch", () => {
    const plan = planImport([rec(), rec()], { donorIndex: buildDonorIndex([]), existingPaymentKeys: new Set() });
    // identical payment in both records -> same idempotency key -> one inserted
    expect(plan.paymentsToInsert).toHaveLength(1);
    expect(plan.skippedPayments).toBe(1);
  });

  it("skips creating a pledge that already exists (existingPledgeKeys)", () => {
    const index = buildDonorIndex([
      { id: "D1", email_normalized: "doris@gmail.com", name_normalized: "doris acevedo", phone_normalized: "7875551234" },
    ]);
    const plan = planImport([rec()], {
      donorIndex: index, existingPaymentKeys: new Set(),
      existingPledgeKeys: new Set(["D1|stripe|2026"]),
    });
    expect(plan.pledgesToCreate).toHaveLength(0);
  });

  it("dedups duplicate pledges within one batch (same donor+source+year)", () => {
    const plan = planImport([rec(), rec()], { donorIndex: buildDonorIndex([]), existingPaymentKeys: new Set() });
    expect(plan.pledgesToCreate).toHaveLength(1);
  });

  it("does not merge distinct anonymous rows (no email, no name) into one donor", () => {
    const anon = (periodMonth: string): NormalizedRecord => ({
      donor: { email: null, name: "", phone: null },
      pledge: null,
      payments: [{ source: "cam_cash", periodMonth, grossCents: 2000, feeCents: 0,
        netCents: 2000, goal: null, externalRef: null }],
    });
    const plan = planImport([anon("2026-01-01"), anon("2026-02-01")],
      { donorIndex: buildDonorIndex([]), existingPaymentKeys: new Set() });
    expect(plan.donorsToCreate).toHaveLength(2);
    expect(plan.paymentsToInsert).toHaveLength(2);
  });
});
