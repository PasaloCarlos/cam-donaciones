import { createHash } from "crypto";
import type { DonationSource } from "@/types";

// Strong key when a vendor transaction id exists; deterministic fallback for
// legacy/cash rows. Re-importing the same payment collides -> skipped on insert.
export function paymentIdempotencyKey(p: {
  source: DonationSource;
  externalRef: string | null;
  donorEmailOrName: string;
  periodMonth: string;
  grossCents: number;
}): string {
  const basis = p.externalRef
    ? `${p.source}:ref:${p.externalRef}`
    : `${p.source}:${p.donorEmailOrName.trim().toLowerCase()}:${p.periodMonth}:${p.grossCents}`;
  return createHash("sha256").update(basis).digest("hex");
}
