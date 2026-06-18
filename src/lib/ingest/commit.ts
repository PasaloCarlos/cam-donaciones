import { buildDonorIndex, matchDonor, normalizeEmail, normalizeName, type DonorIndex } from "@/lib/donor-match";
import { paymentIdempotencyKey } from "@/lib/ingest/idempotency";
import type { NormalizedDonor, NormalizedPledge, NormalizedPayment, NormalizedRecord } from "@/lib/ingest/types";

export type PlannedDonor = { tempId: string; donor: NormalizedDonor };
export type PlannedPayment = {
  donorRef: string; pledgeRef: string | null; payment: NormalizedPayment; idempotencyKey: string;
};
export type ImportPlan = {
  donorsToCreate: PlannedDonor[];
  pledgesToCreate: { donorRef: string; pledge: NormalizedPledge }[];
  paymentsToInsert: PlannedPayment[];
  skippedPayments: number;
  possibleDuplicates: { name: string; reason: string }[];
  counts: { records: number; newDonors: number; matchedDonors: number; newPledges: number; payments: number; skipped: number };
};

// Stable identity key for batch-level donor dedup. Falls back to a per-record
// anonymous key so rows with neither email nor name never collide together.
function donorKey(d: NormalizedDonor, i: number): string {
  const byEmail = normalizeEmail(d.email);
  if (byEmail) return byEmail;
  const byName = normalizeName(d.name);
  return byName !== "" ? byName : `__anon:${i}`;
}

export function planImport(
  records: NormalizedRecord[],
  ctx: { donorIndex: DonorIndex; existingPaymentKeys: Set<string>; existingPledgeKeys?: Set<string> }
): ImportPlan {
  const donorsToCreate: PlannedDonor[] = [];
  const pledgesToCreate: { donorRef: string; pledge: NormalizedPledge }[] = [];
  const paymentsToInsert: PlannedPayment[] = [];
  const possibleDuplicates: { name: string; reason: string }[] = [];
  let skipped = 0, matchedDonors = 0;

  // Resolve donors within the batch too: a donorKey seen earlier in THIS file
  // reuses the same temp id (don't create the same donor twice).
  const tempByKey = new Map<string, string>();
  const seenKeys = new Set<string>(ctx.existingPaymentKeys);
  const seenPledgeKeys = new Set<string>(ctx.existingPledgeKeys ?? []);

  records.forEach((record, i) => {
    const key = donorKey(record.donor, i);
    let donorRef: string;

    if (tempByKey.has(key)) {
      donorRef = tempByKey.get(key)!;
    } else {
      const match = matchDonor(ctx.donorIndex, {
        email: record.donor.email, name: record.donor.name, phone: record.donor.phone,
      });
      if (match.donorId) {
        donorRef = match.donorId;
        matchedDonors += 1;
      } else {
        const tempId = `new:${i}:${key}`;
        donorsToCreate.push({ tempId, donor: record.donor });
        donorRef = tempId;
        if (match.ambiguous) possibleDuplicates.push({ name: record.donor.name, reason: "nombre ambiguo" });
      }
      tempByKey.set(key, donorRef);
    }

    if (record.pledge) {
      const pledgeKey = `${donorRef}|${record.pledge.source}|${record.pledge.sourceYear ?? ""}`;
      if (!seenPledgeKeys.has(pledgeKey)) {
        seenPledgeKeys.add(pledgeKey);
        pledgesToCreate.push({ donorRef, pledge: record.pledge });
      }
    }

    for (const payment of record.payments) {
      const idempotencyKey = paymentIdempotencyKey({
        source: payment.source, externalRef: payment.externalRef,
        donorEmailOrName: key, periodMonth: payment.periodMonth, grossCents: payment.grossCents,
      });
      if (seenKeys.has(idempotencyKey)) { skipped += 1; continue; }
      seenKeys.add(idempotencyKey);
      paymentsToInsert.push({ donorRef, pledgeRef: null, payment, idempotencyKey });
    }
  });

  return {
    donorsToCreate, pledgesToCreate, paymentsToInsert,
    skippedPayments: skipped, possibleDuplicates,
    counts: {
      records: records.length, newDonors: donorsToCreate.length, matchedDonors,
      newPledges: pledgesToCreate.length, payments: paymentsToInsert.length, skipped,
    },
  };
}

// Re-export so callers can build the index from existing rows.
export { buildDonorIndex };
