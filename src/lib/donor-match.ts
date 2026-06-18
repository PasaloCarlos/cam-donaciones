// Pure donor identity resolution. Auto-match ONLY on normalized email, or on
// an unambiguous exact name+phone. Anything else returns none (never guess) —
// ambiguous name-only collisions are surfaced for manual review upstream.

export type DonorIdentity = {
  id: string;
  email_normalized: string | null;
  name_normalized: string;
  phone_normalized: string | null;
};

export function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  return s === "" ? null : s;
}

export function normalizeName(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  return digits === "" ? null : digits;
}

export type DonorIndex = {
  byEmail: Map<string, string>;          // email -> donorId
  byNamePhone: Map<string, string[]>;    // "name|phone" -> donorIds
  byName: Map<string, string[]>;         // name -> donorIds (for ambiguity detection)
};

export function buildDonorIndex(existing: DonorIdentity[]): DonorIndex {
  const byEmail = new Map<string, string>();
  const byNamePhone = new Map<string, string[]>();
  const byName = new Map<string, string[]>();
  for (const d of existing) {
    if (d.email_normalized) byEmail.set(d.email_normalized, d.id);
    if (d.phone_normalized) {
      const key = `${d.name_normalized}|${d.phone_normalized}`;
      const arr = byNamePhone.get(key) ?? [];
      arr.push(d.id);
      byNamePhone.set(key, arr);
    }
    // Always track by name for ambiguity detection
    const nameArr = byName.get(d.name_normalized) ?? [];
    nameArr.push(d.id);
    byName.set(d.name_normalized, nameArr);
  }
  return { byEmail, byNamePhone, byName };
}

export function matchDonor(
  index: DonorIndex,
  candidate: { email: string | null; name: string; phone: string | null }
): { donorId: string | null; reason: "email" | "name_phone" | "none"; ambiguous: boolean } {
  const email = normalizeEmail(candidate.email);
  if (email) {
    const id = index.byEmail.get(email);
    if (id) return { donorId: id, reason: "email", ambiguous: false };
    return { donorId: null, reason: "none", ambiguous: false };
  }
  const name = normalizeName(candidate.name);
  const phone = normalizePhone(candidate.phone);
  if (name && phone) {
    const ids = index.byNamePhone.get(`${name}|${phone}`) ?? [];
    if (ids.length === 1) return { donorId: ids[0], reason: "name_phone", ambiguous: false };
    if (ids.length > 1) return { donorId: null, reason: "none", ambiguous: true };
  }
  // Name-only collision with an existing donor is ambiguous (don't guess).
  // Check if there are multiple donors with this name.
  const nameMatches = index.byName.get(name) ?? [];
  const ambiguous = nameMatches.length > 1;
  return { donorId: null, reason: "none", ambiguous };
}
