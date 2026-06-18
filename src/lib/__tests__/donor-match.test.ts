import { describe, it, expect } from "vitest";
import { normalizeEmail, normalizeName, normalizePhone, buildDonorIndex, matchDonor } from "@/lib/donor-match";

describe("normalizers", () => {
  it("normalizeEmail lowercases/trims, null when empty", () => {
    expect(normalizeEmail("  Doris@Gmail.com ")).toBe("doris@gmail.com");
    expect(normalizeEmail("")).toBeNull();
    expect(normalizeEmail(null as unknown as string)).toBeNull();
  });
  it("normalizeName lowercases, strips accents, collapses spaces", () => {
    expect(normalizeName("  José   Pérez ")).toBe("jose perez");
    expect(normalizeName("María Rodríguez")).toBe("maria rodriguez");
  });
  it("normalizePhone keeps digits only, null when none", () => {
    expect(normalizePhone("(787) 555-1234")).toBe("7875551234");
    expect(normalizePhone("n/a")).toBeNull();
    expect(normalizePhone("")).toBeNull();
  });
});

describe("matchDonor", () => {
  const index = buildDonorIndex([
    { id: "D1", email_normalized: "doris@gmail.com", name_normalized: "doris acevedo", phone_normalized: "7875551234" },
    { id: "D2", email_normalized: null, name_normalized: "lydia", phone_normalized: "7875559999" },
    { id: "D3", email_normalized: null, name_normalized: "ana matos", phone_normalized: null },
    { id: "D4", email_normalized: null, name_normalized: "ana matos", phone_normalized: null },
  ]);

  it("matches by normalized email first", () => {
    expect(matchDonor(index, { email: "DORIS@gmail.com", name: "whatever", phone: null }))
      .toEqual({ donorId: "D1", reason: "email", ambiguous: false });
  });
  it("falls back to exact name+phone when no email", () => {
    expect(matchDonor(index, { email: null, name: "Lydia", phone: "787-555-9999" }))
      .toEqual({ donorId: "D2", reason: "name_phone", ambiguous: false });
  });
  it("returns none (not a guess) when only an ambiguous name matches", () => {
    const r = matchDonor(index, { email: null, name: "Ana Matos", phone: null });
    expect(r.donorId).toBeNull();
    expect(r.reason).toBe("none");
    expect(r.ambiguous).toBe(true);
  });
  it("returns none for a brand-new donor", () => {
    expect(matchDonor(index, { email: "new@x.com", name: "New Person", phone: "1112223333" }))
      .toEqual({ donorId: null, reason: "none", ambiguous: false });
  });
});
