import { parseMoneyToCents } from "@/lib/money";
import { LEGACY_HEADERS, SPANISH_MONTHS } from "@/config/import-mappings.config";
import type { NormalizedRecord, NormalizedPayment } from "@/lib/ingest/types";
import type { DonationSource, DonationGoal } from "@/types";

export function normalizeHeader(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  return String(raw).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function parseGoal(raw: unknown): DonationGoal | null {
  const s = normalizeHeader(raw);
  if (s === "operacion general") return "operacion_general";
  if (s === "compras solidarias") return "compras_solidarias";
  return null;
}

export function parseLegacyDate(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (s === "") return null;
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  const usMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (usMatch) {
    const mm = usMatch[1].padStart(2, "0");
    const dd = usMatch[2].padStart(2, "0");
    return `${usMatch[3]}-${mm}-${dd}`;
  }
  return null;
}

export function monthIso(year: number, monthIndex0: number): string {
  return `${year}-${String(monthIndex0 + 1).padStart(2, "0")}-01`;
}

function buildHeaderMap(headerRow: unknown[]): Map<string, number> {
  const map = new Map<string, number>();
  headerRow.forEach((cell, i) => {
    const h = normalizeHeader(cell);
    if (h && !map.has(h)) map.set(h, i);
  });
  return map;
}

function col(map: Map<string, number>, synonyms: readonly string[]): number | undefined {
  for (const s of synonyms) {
    const i = map.get(s);
    if (i !== undefined) return i;
  }
  return undefined;
}

export function findHeaderRow(rows: unknown[][]): number {
  for (let i = 0; i < rows.length; i++) {
    const norm = rows[i].map(normalizeHeader);
    if (norm.includes("email") && norm.includes("nombre")) return i;
  }
  return 0;
}

export function parseLegacySheet(opts: {
  rows: unknown[][]; source: DonationSource; year: number | null; defaultYear: number;
}): { records: NormalizedRecord[]; rowsParsed: number; rowsSkipped: number } {
  const { rows, source } = opts;
  const year = opts.year ?? opts.defaultYear;
  const headerIdx = findHeaderRow(rows);
  const map = buildHeaderMap(rows[headerIdx] ?? []);

  const cEmail = col(map, LEGACY_HEADERS.email);
  const cName = col(map, LEGACY_HEADERS.name);
  const cGross = col(map, LEGACY_HEADERS.gross);
  const cFee = col(map, LEGACY_HEADERS.fee);
  const cNet = col(map, LEGACY_HEADERS.net);
  const cGoal = col(map, LEGACY_HEADERS.goal);
  const cSubDate = col(map, LEGACY_HEADERS.subscriptionDate);
  const cAddress = col(map, LEGACY_HEADERS.address);
  const cPhone = col(map, LEGACY_HEADERS.phone);
  const monthCols = SPANISH_MONTHS.map((m) => map.get(m));

  const get = (row: unknown[], i: number | undefined): string =>
    i === undefined ? "" : (row[i] === null || row[i] === undefined ? "" : String(row[i]).trim());

  const records: NormalizedRecord[] = [];
  let rowsParsed = 0, rowsSkipped = 0;

  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    const email = get(row, cEmail) || null;
    const name = get(row, cName);
    if (!name && !email) { rowsSkipped += 1; continue; } // blank/spacer row

    const rowGrossCents = parseMoneyToCents(get(row, cGross));
    const rowFeeCents = parseMoneyToCents(get(row, cFee)) ?? 0;
    const rowNetCents = parseMoneyToCents(get(row, cNet));
    const goal = cGoal === undefined ? null : parseGoal(get(row, cGoal));
    const feeRatio = rowGrossCents && rowGrossCents > 0 ? rowFeeCents / rowGrossCents : 0;

    let cancelled = false;
    const payments: NormalizedPayment[] = [];
    monthCols.forEach((mc, monthIndex) => {
      const cell = mc === undefined ? "" : get(row, mc);
      if (normalizeHeader(cell) === "cancelado") { cancelled = true; return; }
      const grossCents = parseMoneyToCents(cell);
      if (grossCents === null || grossCents <= 0) return;
      const feeCents = Math.round(grossCents * feeRatio);
      payments.push({
        source, periodMonth: monthIso(year, monthIndex),
        grossCents, feeCents, netCents: grossCents - feeCents, goal, externalRef: null,
      });
    });

    records.push({
      donor: { email, name, phone: get(row, cPhone) || null, address: get(row, cAddress) || null, countryRegion: null },
      pledge: {
        source, kind: "recurring", status: cancelled ? "cancelled" : "active", goal,
        monthlyGrossCents: rowGrossCents, feeCents: rowFeeCents, monthlyNetCents: rowNetCents,
        subscriptionDate: parseLegacyDate(get(row, cSubDate)), sourceYear: year, externalRef: null,
      },
      payments,
    });
    rowsParsed += 1;
  }

  return { records, rowsParsed, rowsSkipped };
}
