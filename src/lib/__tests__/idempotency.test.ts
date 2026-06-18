import { describe, it, expect } from "vitest";
import { paymentIdempotencyKey } from "@/lib/ingest/idempotency";

describe("paymentIdempotencyKey", () => {
  const base = { source: "stripe" as const, externalRef: null, donorEmailOrName: "doris@gmail.com",
    periodMonth: "2026-06-01", grossCents: 2601 };

  it("is deterministic for the same inputs", () => {
    expect(paymentIdempotencyKey(base)).toBe(paymentIdempotencyKey({ ...base }));
  });
  it("prefers externalRef when present (ignores donor/period/amount)", () => {
    const a = paymentIdempotencyKey({ ...base, externalRef: "ch_123" });
    const b = paymentIdempotencyKey({ ...base, externalRef: "ch_123", grossCents: 9999, periodMonth: "2020-01-01" });
    expect(a).toBe(b);
  });
  it("falls back to source+donor+period+amount when no externalRef", () => {
    const a = paymentIdempotencyKey(base);
    const b = paymentIdempotencyKey({ ...base, grossCents: 2602 });
    expect(a).not.toBe(b);
  });
  it("differs across sources", () => {
    expect(paymentIdempotencyKey(base)).not.toBe(paymentIdempotencyKey({ ...base, source: "paypal" }));
  });
  it("returns a 64-char hex sha256", () => {
    expect(paymentIdempotencyKey(base)).toMatch(/^[0-9a-f]{64}$/);
  });
});
