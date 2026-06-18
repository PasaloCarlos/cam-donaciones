import * as XLSX from "xlsx";
import { legacyTabs, tabYear } from "@/config/import-mappings.config";
import { parseLegacySheet } from "@/lib/ingest/importers/legacy-month-columns";
import type { NormalizedRecord } from "@/lib/ingest/types";
import type { DonationSource } from "@/types";

export type LegacyTabResult = {
  name: string; source: DonationSource | null; auto: boolean;
  rowsParsed: number; rowsSkipped: number; recognized: boolean;
};

export function readLegacyWorkbook(
  buf: ArrayBuffer, defaultYear: number
): { records: NormalizedRecord[]; tabs: LegacyTabResult[] } {
  const wb = XLSX.read(buf, { type: "array" });
  const records: NormalizedRecord[] = [];
  const tabs: LegacyTabResult[] = [];

  for (const name of wb.SheetNames) {
    const cfg = legacyTabs.find((t) => t.match.test(name));
    if (!cfg || !cfg.auto) {
      tabs.push({ name, source: cfg?.source ?? null, auto: cfg?.auto ?? false, rowsParsed: 0, rowsSkipped: 0, recognized: false });
      continue;
    }
    const ws = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: "" });
    const parsed = parseLegacySheet({ rows, source: cfg.source, year: tabYear(name), defaultYear });
    records.push(...parsed.records);
    tabs.push({ name, source: cfg.source, auto: true, rowsParsed: parsed.rowsParsed, rowsSkipped: parsed.rowsSkipped, recognized: true });
  }

  return { records, tabs };
}
