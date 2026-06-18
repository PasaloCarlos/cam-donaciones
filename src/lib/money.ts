// Currency as integer cents. parseMoneyToCents tolerates the messy strings
// found in spreadsheet/CSV exports; returns null for blanks / non-numeric
// (e.g. the literal "CANCELADO"), which callers treat as "no amount".

export function parseMoneyToCents(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  let s = typeof raw === "number" ? String(raw) : raw.trim();
  if (s === "") return null;
  s = s.replace(/[$\s,]/g, "");
  if (s === "" || !/^-?\d*\.?\d+$/.test(s)) return null;
  const value = Number(s);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

export function formatCents(cents: number, currency = "$"): string {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const rem = abs % 100;
  const grouped = dollars.toLocaleString("en-US");
  return `${negative ? "-" : ""}${currency}${grouped}.${rem.toString().padStart(2, "0")}`;
}
