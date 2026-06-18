# CAM Donaciones — Milestone 2: Importers + UI + Real Data — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Load the historical "Plan de Apoyo Mensual" spreadsheet (and ongoing CAM cash / special gifts via a manual form) into the donor DB, and ship the internal UI — `/import` (upload → dry-run → commit + manual entry), `/panel` (donor-understanding dashboard), `/donantes` (list + per-donor timeline) — so staff can finally see who gives, MRR, lapsed, by source, by *objetivo*.

**Architecture:** Build on Milestone 1's tested pure core. A pure legacy-sheet parser turns each month-column tab into `NormalizedRecord[]`; a thin SheetJS reader feeds it from an uploaded `.xlsx`. A manual-entry form produces one `NormalizedRecord`. Both flow through M1's `planImport` and a new service-role `commitImport` writer (which wires payment→pledge linkage). Read actions feed M1's `buildDonorDashboard` + a new `donorTimeline` into admin-gated pages. Vendor CSV importers (Stripe/PayPal) are deferred to M3 (need sample exports).

**Tech Stack:** Next.js 16 (App Router, webpack), React 19, TypeScript, Tailwind 4, shadcn (base-nova), Supabase (`@supabase/ssr` + `@supabase/supabase-js`), `xlsx` (SheetJS), vitest, Netlify.

## Global Constraints

- Builds on M1 (merged at `0572014`). Reuse the pure core verbatim: `parseMoneyToCents`/`formatCents` (`@/lib/money`), `normalizeEmail`/`normalizeName`/`normalizePhone`/`buildDonorIndex`/`matchDonor` (`@/lib/donor-match`), `planImport` + `ImportPlan`/`PlannedDonor`/`PlannedPayment` (`@/lib/ingest/commit`), `NormalizedRecord`/`NormalizedDonor`/`NormalizedPledge`/`NormalizedPayment` (`@/lib/ingest/types`), `paymentIdempotencyKey` (`@/lib/ingest/idempotency`), `buildDonorDashboard`/`DonorDashboard` (`@/lib/donor-dashboard`), `MetricPledge`/`MetricPayment`/metrics fns (`@/lib/metrics`).
- `donors`/`pledges`/`payments`/`import_batches` are RLS deny-all → ALL access via the service-role client (`@/lib/supabase/admin`) inside Server Actions. Every action calls `await requireAdmin()` first. There is no public page; the proxy already gates everything but `/admin/login`.
- Money is integer cents everywhere; `parseMoneyToCents` is the only string→cents point. `formatCents` (with `donor.currency`) is the only render point.
- All UI/user copy is Spanish (es). Editable text/labels live in `src/config/donor.config.ts` (e.g. `goals`, `sources` label maps already exist) — never hardcode label strings in components.
- Pure logic goes in `src/lib/*` with vitest tests in `src/lib/__tests__/`; `asOf` is always a parameter to time-dependent code. Actions stay thin and delegate to pure functions.
- Do NOT push to GitHub. Migrations are NOT applied during code tasks — the user provisions a fresh Supabase project and we apply + import real data together in the final task. Code must `npm run build` without a live DB.
- Gates before a task is done: `npm run lint`, `npm test`, `npm run build` clean.
- `import_batches.importer` values used: `"legacy_month_columns"`, `"manual"`.

## File structure (new/changed)

```
src/config/import-mappings.config.ts        # MODIFY: header synonyms + recognized tabs + which are auto-import
src/lib/ingest/importers/legacy-month-columns.ts  # NEW pure: parseLegacySheet + helpers (Task 2)
src/lib/ingest/legacy-workbook.ts           # NEW: readLegacyWorkbook (SheetJS) (Task 3)
src/lib/ingest/importers/manual-entry.ts    # NEW pure: manualEntryToRecord (Task 4)
src/lib/donor-timeline.ts                   # NEW pure: donorTimeline (Task 5)
src/actions/imports.ts                      # NEW: runLegacyImport(dryRun), submitManualEntry (Task 6)
src/actions/metrics.ts                      # NEW: getDonorDashboard (Task 7)
src/actions/donors.ts                       # NEW: listDonors, getDonorDetail (Task 7)
src/app/import/page.tsx + components/import/*        # /import UI (Task 8)
src/app/panel/page.tsx  + components/panel/*         # dashboard UI (Task 9)
src/app/donantes/page.tsx + [id]/page.tsx + components/donantes/*  # list + detail (Task 10)
src/lib/__tests__/{legacy-month-columns,legacy-workbook,manual-entry,donor-timeline}.test.ts
```

---

### Task 1: Extend import-mappings config (legacy header synonyms + tab recognition)

**Files:**
- Modify: `src/config/import-mappings.config.ts`

**Interfaces:**
- Produces: `LEGACY_HEADERS` (synonym lists per logical field, normalized lowercase, accent-free) and `legacyTabs` updated so only `cam_cash`/`paypal`/`stripe` are auto-imported (`auto: true`); `special` + anything else are `auto: false`. Also `tabYear(sheetName): number | null` extracting a 4-digit year from a tab name.

- [ ] **Step 1: Replace `src/config/import-mappings.config.ts` with:**

```ts
import type { DonationSource } from "@/types";

// Pestañas del libro histórico "Plan de Apoyo Mensual". `auto` = se importa por
// el importador de columnas-mensuales. special/desconocidas se entran a mano.
export const legacyTabs: { match: RegExp; source: DonationSource; auto: boolean }[] = [
  { match: /^pagos\s*cam/i, source: "cam_cash", auto: true },
  { match: /^paypal/i, source: "paypal", auto: true },
  { match: /^stripe/i, source: "stripe", auto: true },
  { match: /^donantes\s*especiales/i, source: "special", auto: false },
];

// Sinónimos de encabezado → campo lógico. Comparados contra encabezados
// normalizados (minúsculas, sin acentos, espacios colapsados).
export const LEGACY_HEADERS = {
  email: ["email", "correo"],
  name: ["nombre"],
  gross: ["donacion mensual bruta", "bruto"],
  fee: ["comision"],
  net: ["donacion neta", "neto"],
  goal: ["objetivo de la donacion", "objetivo"],
  subscriptionDate: ["fecha de suscripcion"],
  address: ["direccion", "pais - pueblo - estado", "pais-pueblo-estado"],
  phone: ["telefono"],
} as const;

// Meses en español (índice 0 = Enero) para mapear las 12 columnas mensuales.
export const SPANISH_MONTHS = [
  "enero","febrero","marzo","abril","mayo","junio",
  "julio","agosto","septiembre","octubre","noviembre","diciembre",
] as const;

// Año embebido en el nombre de la pestaña ("Paypal 2025" -> 2025), si lo hay.
export function tabYear(sheetName: string): number | null {
  const m = sheetName.match(/(20\d{2})/);
  return m ? Number(m[1]) : null;
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: PASS (config compiles; `DonationSource` import resolves). No test for this task.

- [ ] **Step 3: Commit**

```bash
git add src/config/import-mappings.config.ts
git commit -m "feat(import): legacy header synonyms + tab recognition config"
```

---

### Task 2: Legacy month-columns parser (pure, TDD)

**Files:**
- Create: `src/lib/ingest/importers/legacy-month-columns.ts`
- Test: `src/lib/__tests__/legacy-month-columns.test.ts`

**Interfaces:**
- Consumes: `parseMoneyToCents` (`@/lib/money`); `LEGACY_HEADERS`, `SPANISH_MONTHS` (`@/config/import-mappings.config`); `NormalizedRecord` etc. (`@/lib/ingest/types`); `DonationSource`, `DonationGoal` (`@/types`).
- Produces:
  - `normalizeHeader(raw: unknown): string`
  - `parseGoal(raw: unknown): DonationGoal | null`
  - `parseLegacyDate(raw: unknown): string | null` (→ `YYYY-MM-DD`)
  - `monthIso(year: number, monthIndex0: number): string` (→ `YYYY-MM-01`)
  - `findHeaderRow(rows: unknown[][]): number`
  - `parseLegacySheet(opts: { rows: unknown[][]; source: DonationSource; year: number | null; defaultYear: number }): { records: NormalizedRecord[]; rowsParsed: number; rowsSkipped: number }`

- [ ] **Step 1: Write the failing test** (`src/lib/__tests__/legacy-month-columns.test.ts`):

```ts
import { describe, it, expect } from "vitest";
import { normalizeHeader, parseGoal, parseLegacyDate, monthIso, findHeaderRow, parseLegacySheet }
  from "@/lib/ingest/importers/legacy-month-columns";

describe("helpers", () => {
  it("normalizeHeader lowercases, strips accents, collapses spaces", () => {
    expect(normalizeHeader("  Donación   Neta ")).toBe("donacion neta");
    expect(normalizeHeader("País - Pueblo - Estado")).toBe("pais - pueblo - estado");
    expect(normalizeHeader(null)).toBe("");
  });
  it("parseGoal maps the two known objetivos, else null", () => {
    expect(parseGoal("Operación General")).toBe("operacion_general");
    expect(parseGoal("Compras Solidarias")).toBe("compras_solidarias");
    expect(parseGoal("")).toBeNull();
    expect(parseGoal("otra cosa")).toBeNull();
  });
  it("parseLegacyDate handles 'YYYY-MM-DD hh:mm:ss', 'MM/DD/YYYY', blank", () => {
    expect(parseLegacyDate("2023-12-18 00:00:00")).toBe("2023-12-18");
    expect(parseLegacyDate("12/18/2023")).toBe("2023-12-18");
    expect(parseLegacyDate("")).toBeNull();
    expect(parseLegacyDate(null)).toBeNull();
  });
  it("monthIso builds first-of-month ISO", () => {
    expect(monthIso(2026, 0)).toBe("2026-01-01");
    expect(monthIso(2025, 11)).toBe("2025-12-01");
  });
});

// A STRIPE-style sheet: header on row 0, no Objetivo, address = País-Pueblo-Estado.
const stripeRows: unknown[][] = [
  ["Email","Nombre","Donación Mensual Bruta","Comisión","Donación Neta","Total Bruto - Año 2025","Fecha de Suscripción",
   "Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
   "","País - Pueblo - Estado","Teléfono"],
  ["abdel@x.com","Abdel Rivera","10","0.67","9.33","120","2023-07-24 00:00:00",
   "9.33","9.33","9.33","","","","","","","","","","", "PR - Ponce","7875551234"],
];

// A PAYPAL-style sheet: spurious top row, header on row 1, Objetivo present, address = Dirección, a CANCELADO cell.
const paypalRows: unknown[][] = [
  ["","","","","","","","Mes/Día/Año","2025"],
  ["Email","Nombre","Donación Mensual Bruta","Comisión","Donación Neta","Total Bruto - Año 2025","Objetivo de la Donación","Fecha de Suscripción",
   "Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre","","Dirección"],
  ["jean@x.com","Jeanette Lee","26.01","1.01","25","78.03","Compras Solidarias","2024-10-17 00:00:00",
   "25","25","25","CANCELADO","","","","","","","","","", "Calle 1, San Juan"],
  ["","","","","","","","","","","","","","","","","","","","","",""], // blank spacer row
];

describe("findHeaderRow", () => {
  it("finds the row containing Email+Nombre (row 0 for stripe, row 1 for paypal)", () => {
    expect(findHeaderRow(stripeRows)).toBe(0);
    expect(findHeaderRow(paypalRows)).toBe(1);
  });
});

describe("parseLegacySheet — stripe", () => {
  const { records, rowsParsed } = parseLegacySheet({ rows: stripeRows, source: "stripe", year: 2025, defaultYear: 2025 });
  it("parses one donor record", () => {
    expect(rowsParsed).toBe(1);
    expect(records).toHaveLength(1);
  });
  const r = records[0];
  it("maps donor + pledge fields (no objetivo on stripe)", () => {
    expect(r.donor).toMatchObject({ email: "abdel@x.com", name: "Abdel Rivera", phone: "7875551234", address: "PR - Ponce" });
    expect(r.pledge).toMatchObject({ source: "stripe", kind: "recurring", status: "active", goal: null,
      monthlyGrossCents: 1000, feeCents: 67, monthlyNetCents: 933, subscriptionDate: "2023-07-24", sourceYear: 2025 });
  });
  it("turns the 3 filled month cells into payments at the right periods, fee proportional", () => {
    expect(r.payments).toHaveLength(3);
    expect(r.payments[0]).toMatchObject({ source: "stripe", periodMonth: "2025-01-01", grossCents: 933 });
    // proportional fee: rowFee/rowGross = 67/1000 -> round(933*0.067)=63; net=870
    expect(r.payments[0].feeCents).toBe(63);
    expect(r.payments[0].netCents).toBe(933 - 63);
    expect(r.payments.map((p) => p.periodMonth)).toEqual(["2025-01-01","2025-02-01","2025-03-01"]);
  });
});

describe("parseLegacySheet — paypal (spurious top row, objetivo, CANCELADO, blank row)", () => {
  const { records, rowsParsed, rowsSkipped } = parseLegacySheet({ rows: paypalRows, source: "paypal", year: 2025, defaultYear: 2025 });
  it("skips the blank spacer row, parses one donor", () => {
    expect(rowsParsed).toBe(1);
    expect(rowsSkipped).toBe(1);
    expect(records).toHaveLength(1);
  });
  const r = records[0];
  it("reads objetivo + Dirección, marks pledge cancelled (a CANCELADO month), emits only real payments", () => {
    expect(r.donor).toMatchObject({ email: "jean@x.com", name: "Jeanette Lee", address: "Calle 1, San Juan" });
    expect(r.pledge).toMatchObject({ source: "paypal", goal: "compras_solidarias", status: "cancelled" });
    // Enero/Febrero/Marzo filled (25 each), Abril = CANCELADO (no payment), rest blank
    expect(r.payments).toHaveLength(3);
    expect(r.payments.every((p) => p.grossCents === 2500)).toBe(true);
    expect(r.payments.map((p) => p.periodMonth)).toEqual(["2025-01-01","2025-02-01","2025-03-01"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- legacy-month-columns`
Expected: FAIL (cannot resolve the module).

- [ ] **Step 3: Write `src/lib/ingest/importers/legacy-month-columns.ts`**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- legacy-month-columns`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ingest/importers/legacy-month-columns.ts src/lib/__tests__/legacy-month-columns.test.ts
git commit -m "feat(import): pure legacy month-columns parser with tests"
```

---

### Task 3: SheetJS workbook reader

**Files:**
- Create: `src/lib/ingest/legacy-workbook.ts`
- Test: `src/lib/__tests__/legacy-workbook.test.ts`

**Interfaces:**
- Consumes: `xlsx` (SheetJS); `legacyTabs`, `tabYear` (`@/config/import-mappings.config`); `parseLegacySheet` (Task 2); `NormalizedRecord` (`@/lib/ingest/types`).
- Produces: `type LegacyTabResult = { name: string; source: DonationSource | null; auto: boolean; rowsParsed: number; rowsSkipped: number; recognized: boolean }`; `readLegacyWorkbook(buf: ArrayBuffer, defaultYear: number): { records: NormalizedRecord[]; tabs: LegacyTabResult[] }`.

- [ ] **Step 1: Write the failing test** (`src/lib/__tests__/legacy-workbook.test.ts`) — builds a 2-sheet workbook in-memory with SheetJS, round-trips through a buffer:

```ts
import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { readLegacyWorkbook } from "@/lib/ingest/legacy-workbook";

function makeBuffer(): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  const stripe = XLSX.utils.aoa_to_sheet([
    ["Email","Nombre","Donación Mensual Bruta","Comisión","Donación Neta","Total Bruto - Año 2025","Fecha de Suscripción",
     "Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
     "","País - Pueblo - Estado","Teléfono"],
    ["a@x.com","Ana","10","0.67","9.33","120","2023-07-24","9.33","","","","","","","","","","","","","PR","7870000000"],
  ]);
  XLSX.utils.book_append_sheet(wb, stripe, "STRIPE 2025");
  const other = XLSX.utils.aoa_to_sheet([["just","some","notes"]]);
  XLSX.utils.book_append_sheet(wb, other, "Sheet2");
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return out as ArrayBuffer;
}

describe("readLegacyWorkbook", () => {
  const { records, tabs } = readLegacyWorkbook(makeBuffer(), 2025);
  it("parses recognized auto tabs and reports the rest", () => {
    expect(records).toHaveLength(1);
    expect(records[0].pledge?.source).toBe("stripe");
    const stripeTab = tabs.find((t) => t.name === "STRIPE 2025")!;
    expect(stripeTab).toMatchObject({ source: "stripe", auto: true, recognized: true, rowsParsed: 1 });
    const otherTab = tabs.find((t) => t.name === "Sheet2")!;
    expect(otherTab.recognized).toBe(false);
  });
  it("derives the year from the tab name", () => {
    expect(records[0].payments[0].periodMonth).toBe("2025-01-01");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- legacy-workbook`
Expected: FAIL (cannot resolve module).

- [ ] **Step 3: Write `src/lib/ingest/legacy-workbook.ts`**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- legacy-workbook`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ingest/legacy-workbook.ts src/lib/__tests__/legacy-workbook.test.ts
git commit -m "feat(import): SheetJS workbook reader feeding the legacy parser"
```

---

### Task 4: Manual-entry → NormalizedRecord (pure, TDD)

**Files:**
- Create: `src/lib/ingest/importers/manual-entry.ts`
- Test: `src/lib/__tests__/manual-entry.test.ts`

**Interfaces:**
- Consumes: `NormalizedRecord` (`@/lib/ingest/types`); `DonationSource`, `DonationGoal` (`@/types`).
- Produces: `type ManualEntry = { source: DonationSource; email: string | null; name: string; phone: string | null; address: string | null; goal: DonationGoal | null; kind: "recurring" | "one_time"; grossCents: number; feeCents: number; periodMonth: string; subscriptionDate: string | null }`; `manualEntryToRecord(e: ManualEntry): NormalizedRecord`.

- [ ] **Step 1: Write the failing test** (`src/lib/__tests__/manual-entry.test.ts`):

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- manual-entry`
Expected: FAIL (cannot resolve module).

- [ ] **Step 3: Write `src/lib/ingest/importers/manual-entry.ts`**

```ts
import type { NormalizedRecord } from "@/lib/ingest/types";
import type { DonationSource, DonationGoal } from "@/types";

export type ManualEntry = {
  source: DonationSource; email: string | null; name: string; phone: string | null; address: string | null;
  goal: DonationGoal | null; kind: "recurring" | "one_time"; grossCents: number; feeCents: number;
  periodMonth: string; subscriptionDate: string | null;
};

export function manualEntryToRecord(e: ManualEntry): NormalizedRecord {
  const netCents = e.grossCents - e.feeCents;
  return {
    donor: { email: e.email, name: e.name, phone: e.phone, address: e.address, countryRegion: null },
    pledge: {
      source: e.source, kind: e.kind, status: "active", goal: e.goal,
      monthlyGrossCents: e.kind === "recurring" ? e.grossCents : null,
      feeCents: e.feeCents,
      monthlyNetCents: e.kind === "recurring" ? netCents : null,
      subscriptionDate: e.subscriptionDate, sourceYear: Number(e.periodMonth.slice(0, 4)), externalRef: null,
    },
    payments: [{
      source: e.source, periodMonth: e.periodMonth, grossCents: e.grossCents,
      feeCents: e.feeCents, netCents, goal: e.goal, externalRef: null,
    }],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- manual-entry`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ingest/importers/manual-entry.ts src/lib/__tests__/manual-entry.test.ts
git commit -m "feat(import): manual-entry -> NormalizedRecord helper with tests"
```

---

### Task 5: `donorTimeline` (pure, TDD)

**Files:**
- Create: `src/lib/donor-timeline.ts`
- Test: `src/lib/__tests__/donor-timeline.test.ts`

**Interfaces:**
- Consumes: `MetricPayment` (`@/lib/metrics`).
- Produces: `type TimelineEntry = { periodMonth: string; source: string; grossCents: number; netCents: number; goal: string | null }`; `donorTimeline(payments: MetricPayment[]): TimelineEntry[]` (descending by `periodMonth`, then source).

- [ ] **Step 1: Write the failing test** (`src/lib/__tests__/donor-timeline.test.ts`):

```ts
import { describe, it, expect } from "vitest";
import { donorTimeline } from "@/lib/donor-timeline";
import type { MetricPayment } from "@/lib/metrics";

const pays: MetricPayment[] = [
  { donor_id: "A", source: "stripe", period_month: "2026-01-01", gross_cents: 1000, net_cents: 933, goal: "operacion_general" },
  { donor_id: "A", source: "paypal", period_month: "2026-03-01", gross_cents: 2500, net_cents: 2400, goal: "compras_solidarias" },
  { donor_id: "A", source: "cam_cash", period_month: "2026-01-01", gross_cents: 2000, net_cents: 2000, goal: null },
];

describe("donorTimeline", () => {
  const t = donorTimeline(pays);
  it("sorts newest period first, then by source", () => {
    expect(t.map((e) => e.periodMonth)).toEqual(["2026-03-01","2026-01-01","2026-01-01"]);
    expect(t[0]).toMatchObject({ source: "paypal", grossCents: 2500, netCents: 2400, goal: "compras_solidarias" });
  });
  it("breaks period ties by source name (cam_cash before stripe)", () => {
    expect([t[1].source, t[2].source]).toEqual(["cam_cash", "stripe"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- donor-timeline`
Expected: FAIL (cannot resolve module).

- [ ] **Step 3: Write `src/lib/donor-timeline.ts`**

```ts
import type { MetricPayment } from "@/lib/metrics";

export type TimelineEntry = {
  periodMonth: string; source: string; grossCents: number; netCents: number; goal: string | null;
};

export function donorTimeline(payments: MetricPayment[]): TimelineEntry[] {
  return payments
    .map((p) => ({
      periodMonth: p.period_month, source: p.source,
      grossCents: p.gross_cents, netCents: p.net_cents, goal: p.goal,
    }))
    .sort((a, b) =>
      a.periodMonth === b.periodMonth ? a.source.localeCompare(b.source) : (a.periodMonth < b.periodMonth ? 1 : -1)
    );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- donor-timeline`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/donor-timeline.ts src/lib/__tests__/donor-timeline.test.ts
git commit -m "feat(core): donorTimeline pure helper with tests"
```

---

### Task 6: Persistence — import preview + commit + manual entry actions

**Files:**
- Create: `src/actions/imports.ts`

**Interfaces:**
- Consumes: `createAdminClient` (`@/lib/supabase/admin`), `requireAdmin` (`@/lib/admin-guard`), `readLegacyWorkbook` (Task 3), `manualEntryToRecord`+`ManualEntry` (Task 4), `planImport`+`buildDonorIndex`+`ImportPlan` (`@/lib/ingest/commit`), `NormalizedRecord` (`@/lib/ingest/types`).
- Produces:
  - `type ImportPreview = { plan: ImportPlan; tabs: import("@/lib/ingest/legacy-workbook").LegacyTabResult[] }`
  - `runLegacyImport(formData: FormData): Promise<ImportPreview | { committed: true; counts: ImportPlan["counts"] }>` — formData has `file` (the `.xlsx`), `defaultYear` (string), `mode` (`"preview"` | `"commit"`).
  - `submitManualEntry(formData: FormData): Promise<{ committed: true; counts: ImportPlan["counts"] }>`

- [ ] **Step 1: Write the action file** `src/actions/imports.ts`

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-guard";
import { readLegacyWorkbook, type LegacyTabResult } from "@/lib/ingest/legacy-workbook";
import { manualEntryToRecord, type ManualEntry } from "@/lib/ingest/importers/manual-entry";
import { planImport, buildDonorIndex, type ImportPlan } from "@/lib/ingest/commit";
import { normalizeEmail, normalizeName, normalizePhone } from "@/lib/donor-match";
import type { DonationGoal, DonationSource } from "@/types";

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

// Load the current donor index + existing payment idempotency keys (service-role).
async function loadIngestContext(supabase: SupabaseAdmin) {
  const [{ data: donors }, { data: keys }] = await Promise.all([
    supabase.from("donors").select("id, email_normalized, name_normalized, phone_normalized"),
    supabase.from("payments").select("idempotency_key"),
  ]);
  return {
    donorIndex: buildDonorIndex(donors ?? []),
    existingPaymentKeys: new Set<string>((keys ?? []).map((k) => k.idempotency_key as string)),
  };
}

// Write a plan to the DB. Returns the final counts.
async function writePlan(
  supabase: SupabaseAdmin, plan: ImportPlan, meta: { importer: string; source: DonationSource | null; filename: string | null }
): Promise<ImportPlan["counts"]> {
  const { data: batch } = await supabase.from("import_batches").insert({
    source: meta.source ?? "other", importer: meta.importer, filename: meta.filename,
    row_count: plan.counts.records, created_donors: plan.counts.newDonors, created_pledges: plan.counts.newPledges,
    inserted_payments: plan.counts.payments, skipped_payments: plan.counts.skipped,
  }).select("id").single();
  const batchId = batch?.id as string | undefined;

  // 1) Create donors; map tempId -> real id.
  const idByRef = new Map<string, string>();
  for (const d of plan.donorsToCreate) {
    const { data: row } = await supabase.from("donors").insert({
      email_normalized: normalizeEmail(d.donor.email),
      display_name: d.donor.name,
      name_normalized: normalizeName(d.donor.name),
      phone_normalized: normalizePhone(d.donor.phone),
      address: d.donor.address ?? null, country_region: d.donor.countryRegion ?? null,
    }).select("id").single();
    if (row?.id) idByRef.set(d.tempId, row.id as string);
  }
  const resolveDonor = (ref: string) => idByRef.get(ref) ?? ref; // non-temp refs are real ids

  // 2) Create pledges; map (donorId|source|year) -> pledgeId for payment linkage.
  const pledgeByKey = new Map<string, string>();
  for (const p of plan.pledgesToCreate) {
    const donorId = resolveDonor(p.donorRef);
    const { data: row } = await supabase.from("pledges").insert({
      donor_id: donorId, source: p.pledge.source, kind: p.pledge.kind, status: p.pledge.status,
      goal: p.pledge.goal, monthly_gross_cents: p.pledge.monthlyGrossCents, fee_cents: p.pledge.feeCents,
      monthly_net_cents: p.pledge.monthlyNetCents, subscription_date: p.pledge.subscriptionDate,
      source_year: p.pledge.sourceYear, external_ref: p.pledge.externalRef, import_batch_id: batchId,
    }).select("id").single();
    if (row?.id) pledgeByKey.set(`${donorId}|${p.pledge.source}|${p.pledge.sourceYear ?? ""}`, row.id as string);
  }

  // 3) Insert payments, linking to a pledge by (donor, source, year-of-period); idempotency-safe.
  if (plan.paymentsToInsert.length > 0) {
    const rows = plan.paymentsToInsert.map((pp) => {
      const donorId = resolveDonor(pp.donorRef);
      const year = pp.payment.periodMonth.slice(0, 4);
      const pledgeId = pledgeByKey.get(`${donorId}|${pp.payment.source}|${year}`)
        ?? pledgeByKey.get(`${donorId}|${pp.payment.source}|`) ?? null;
      return {
        donor_id: donorId, pledge_id: pledgeId, source: pp.payment.source, period_month: pp.payment.periodMonth,
        gross_cents: pp.payment.grossCents, fee_cents: pp.payment.feeCents, net_cents: pp.payment.netCents,
        goal: pp.payment.goal, external_ref: pp.payment.externalRef, idempotency_key: pp.idempotencyKey,
        import_batch_id: batchId,
      };
    });
    await supabase.from("payments").upsert(rows, { onConflict: "idempotency_key", ignoreDuplicates: true });
  }

  revalidatePath("/panel");
  revalidatePath("/donantes");
  return plan.counts;
}

export type ImportPreview = { plan: ImportPlan; tabs: LegacyTabResult[] };

export async function runLegacyImport(
  formData: FormData
): Promise<ImportPreview | { committed: true; counts: ImportPlan["counts"] }> {
  await requireAdmin();
  const file = formData.get("file") as File | null;
  const defaultYear = Number(formData.get("defaultYear") ?? new Date().getUTCFullYear());
  const mode = String(formData.get("mode") ?? "preview");
  if (!file) throw new Error("No se recibió un archivo.");

  const buf = await file.arrayBuffer();
  const { records, tabs } = readLegacyWorkbook(buf, Number.isFinite(defaultYear) ? defaultYear : new Date().getUTCFullYear());

  const supabase = createAdminClient();
  const ctx = await loadIngestContext(supabase);
  const plan = planImport(records, ctx);

  if (mode === "commit") {
    const counts = await writePlan(supabase, plan, { importer: "legacy_month_columns", source: null, filename: file.name });
    return { committed: true, counts };
  }
  return { plan, tabs };
}

export async function submitManualEntry(formData: FormData): Promise<{ committed: true; counts: ImportPlan["counts"] }> {
  await requireAdmin();
  const entry: ManualEntry = {
    source: String(formData.get("source") ?? "cam_cash") as DonationSource,
    email: (String(formData.get("email") ?? "").trim() || null),
    name: String(formData.get("name") ?? "").trim(),
    phone: (String(formData.get("phone") ?? "").trim() || null),
    address: (String(formData.get("address") ?? "").trim() || null),
    goal: (String(formData.get("goal") ?? "").trim() || null) as DonationGoal | null,
    kind: String(formData.get("kind") ?? "recurring") === "one_time" ? "one_time" : "recurring",
    grossCents: Math.round(Number(formData.get("gross") ?? 0) * 100),
    feeCents: Math.round(Number(formData.get("fee") ?? 0) * 100),
    periodMonth: String(formData.get("periodMonth") ?? "") + "-01",
    subscriptionDate: (String(formData.get("subscriptionDate") ?? "").trim() || null),
  };
  if (!entry.name) throw new Error("El nombre es obligatorio.");

  const supabase = createAdminClient();
  const ctx = await loadIngestContext(supabase);
  const plan = planImport([manualEntryToRecord(entry)], ctx);
  const counts = await writePlan(supabase, plan, { importer: "manual", source: entry.source, filename: null });
  return { committed: true, counts };
}
```

- [ ] **Step 2: Verify build**

Run: `npm run lint && npm test && npm run build`
Expected: PASS (no new unit tests; this is integration over tested pure parts. The Supabase types must accept the inserts — if a typed-insert mismatch surfaces, cast the embedded/insert rows with `as` at the boundary, mirroring `src/lib/brackets-public.ts` from ka-basket if needed). Full suite stays green; build compiles (the `/import` route doesn't exist yet — that's Task 8).

- [ ] **Step 3: Commit**

```bash
git add src/actions/imports.ts
git commit -m "feat(import): preview/commit legacy import + manual entry (service-role, pledge linkage)"
```

---

### Task 7: Read actions — dashboard + donor list/detail

**Files:**
- Create: `src/actions/metrics.ts`, `src/actions/donors.ts`

(No separate row-mapper module is needed: the `pledges`/`payments` DB columns already match the `MetricPledge`/`MetricPayment` field names, so the select lists below produce those shapes directly — cast at the boundary.)

**Interfaces:**
- Consumes: `createAdminClient`, `requireAdmin`, `buildDonorDashboard`/`DonorDashboard` (`@/lib/donor-dashboard`), `classifyDonor`/`MetricPledge`/`MetricPayment` (`@/lib/metrics`), `donorTimeline`/`TimelineEntry` (`@/lib/donor-timeline`), `donor` config.
- Produces: `getDonorDashboard(asOfISO?: string): Promise<DonorDashboard>`; `type DonorListItem`; `listDonors(query?: string): Promise<DonorListItem[]>`; `type DonorDetail`; `getDonorDetail(id: string): Promise<DonorDetail | null>`.

- [ ] **Step 1: Write `src/actions/metrics.ts`**

```ts
"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-guard";
import { buildDonorDashboard, type DonorDashboard } from "@/lib/donor-dashboard";
import { donor } from "@/config/donor.config";
import type { MetricPledge, MetricPayment } from "@/lib/metrics";

const PLEDGE_COLS = "id, donor_id, source, kind, status, goal, monthly_net_cents, monthly_gross_cents, subscription_date, cancelled_at";
const PAYMENT_COLS = "donor_id, source, period_month, gross_cents, net_cents, goal";

export async function getDonorDashboard(asOfISO?: string): Promise<DonorDashboard> {
  await requireAdmin();
  const supabase = createAdminClient();
  const [{ data: pledges }, { data: payments }] = await Promise.all([
    supabase.from("pledges").select(PLEDGE_COLS),
    supabase.from("payments").select(PAYMENT_COLS),
  ]);
  const asOf = asOfISO ? new Date(asOfISO) : new Date();
  return buildDonorDashboard(
    { pledges: (pledges ?? []) as unknown as MetricPledge[], payments: (payments ?? []) as unknown as MetricPayment[] },
    asOf,
    donor.lapsedAfterMonths
  );
}

export { PLEDGE_COLS, PAYMENT_COLS };
```

- [ ] **Step 2: Write `src/actions/donors.ts`**

```ts
"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-guard";
import { classifyDonor, type MetricPledge, type MetricPayment } from "@/lib/metrics";
import { donorTimeline, type TimelineEntry } from "@/lib/donor-timeline";
import { donor as donorCfg } from "@/config/donor.config";
import { PLEDGE_COLS, PAYMENT_COLS } from "@/actions/metrics";
import type { Donor } from "@/types";

export type DonorStatus = "active" | "lapsed" | "cancelled" | "one_time_only";
export type DonorListItem = {
  id: string; display_name: string; email_normalized: string | null; status: DonorStatus; pledgeCount: number;
};

export async function listDonors(query?: string): Promise<DonorListItem[]> {
  await requireAdmin();
  const supabase = createAdminClient();
  let q = supabase.from("donors").select("id, display_name, email_normalized").order("display_name");
  const clean = (query ?? "").trim().replace(/[%,]/g, "");
  if (clean) q = q.or(`display_name.ilike.%${clean}%,email_normalized.ilike.%${clean}%`);
  const { data: donors } = await q.limit(200);
  const list = donors ?? [];
  const ids = list.map((d) => d.id as string);
  if (ids.length === 0) return [];

  const [{ data: pledges }, { data: payments }] = await Promise.all([
    supabase.from("pledges").select(PLEDGE_COLS).in("donor_id", ids),
    supabase.from("payments").select(PAYMENT_COLS).in("donor_id", ids),
  ]);
  const allP = (pledges ?? []) as unknown as MetricPledge[];
  const allPay = (payments ?? []) as unknown as MetricPayment[];
  const asOf = new Date();

  return list.map((d) => {
    const dp = allP.filter((p) => p.donor_id === d.id);
    const dpay = allPay.filter((p) => p.donor_id === d.id);
    return {
      id: d.id as string, display_name: d.display_name as string,
      email_normalized: (d.email_normalized as string | null) ?? null,
      status: classifyDonor(dp, dpay, asOf, donorCfg.lapsedAfterMonths), pledgeCount: dp.length,
    };
  });
}

export type DonorDetail = { donor: Donor; pledges: MetricPledge[]; timeline: TimelineEntry[] };

export async function getDonorDetail(id: string): Promise<DonorDetail | null> {
  await requireAdmin();
  const supabase = createAdminClient();
  const { data: d } = await supabase.from("donors").select("*").eq("id", id).maybeSingle();
  if (!d) return null;
  const [{ data: pledges }, { data: payments }] = await Promise.all([
    supabase.from("pledges").select(PLEDGE_COLS).eq("donor_id", id),
    supabase.from("payments").select(PAYMENT_COLS).eq("donor_id", id),
  ]);
  return {
    donor: d as unknown as Donor,
    pledges: (pledges ?? []) as unknown as MetricPledge[],
    timeline: donorTimeline((payments ?? []) as unknown as MetricPayment[]),
  };
}
```

- [ ] **Step 3: Verify**

Run: `npm run lint && npm test && npm run build`
Expected: PASS (integration over tested core; full suite green; build compiles — `/panel`, `/donantes` pages arrive in Tasks 9–10).

- [ ] **Step 4: Commit**

```bash
git add src/actions/metrics.ts src/actions/donors.ts
git commit -m "feat(read): dashboard + donor list/detail actions"
```

---

### Task 8: `/import` UI — upload + dry-run preview + commit + manual entry

**Files:**
- Create: `src/app/import/page.tsx`, `src/components/import/import-client.tsx`
- Reference (read, mirror patterns): `src/components/admin/admin-nav.tsx`, `src/components/admin/login-form.tsx` (sonner `toast` + `useTransition` pattern), `src/components/ui/{button,input,label,card}.tsx`, `src/config/donor.config.ts` (labels).

**Interfaces:**
- Consumes: `runLegacyImport`, `submitManualEntry`, `ImportPreview` (`@/actions/imports`); `formatCents` (`@/lib/money`); `donor` config; `AdminNav`.

- [ ] **Step 1: Write the page** `src/app/import/page.tsx`

```tsx
import { AdminNav } from "@/components/admin/admin-nav";
import { ImportClient } from "@/components/import/import-client";

export const metadata = { title: "Importar — CAM Donaciones", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function ImportPage() {
  return (
    <main className="relative min-h-dvh px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <AdminNav />
        <header className="mb-8">
          <p className="font-display text-sm uppercase tracking-[0.3em] text-primary">Datos</p>
          <h1 className="mt-1 font-display text-5xl font-black uppercase">Importar</h1>
        </header>
        <ImportClient />
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Write the client component** `src/components/import/import-client.tsx`

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { runLegacyImport, submitManualEntry, type ImportPreview } from "@/actions/imports";
import { donor } from "@/config/donor.config";
import { formatCents } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ImportClient() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [preview, setPreview] = useState<ImportPreview | null>(null);

  function buildFD(mode: "preview" | "commit") {
    const fd = new FormData();
    if (file) fd.set("file", file);
    fd.set("defaultYear", year);
    fd.set("mode", mode);
    return fd;
  }

  function doPreview() {
    if (!file) { toast.error("Selecciona un archivo .xlsx"); return; }
    startTransition(async () => {
      try {
        const res = await runLegacyImport(buildFD("preview"));
        if ("plan" in res) setPreview(res);
      } catch (e) { toast.error(e instanceof Error ? e.message : "Error"); }
    });
  }
  function doCommit() {
    startTransition(async () => {
      try {
        const res = await runLegacyImport(buildFD("commit"));
        if ("committed" in res) {
          toast.success(`Importado: ${res.counts.payments} pagos, ${res.counts.newDonors} donantes nuevos (${res.counts.skipped} omitidos)`);
          setPreview(null); setFile(null); router.refresh();
        }
      } catch (e) { toast.error(e instanceof Error ? e.message : "Error"); }
    });
  }

  return (
    <div className="space-y-10">
      {/* Subir archivo histórico */}
      <section className="rounded-2xl border border-border bg-card/70 p-6">
        <h2 className="font-display text-2xl font-black uppercase">Subir libro histórico (.xlsx)</h2>
        <p className="mt-1 text-sm text-muted-foreground">Plan de Apoyo Mensual. Las pestañas Pagos CAM / PayPal / STRIPE se importan automáticamente.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <div>
            <Label htmlFor="file">Archivo</Label>
            <input id="file" type="file" accept=".xlsx" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreview(null); }}
              className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:py-2 file:text-primary-foreground" />
          </div>
          <div>
            <Label htmlFor="year">Año (para Pagos CAM)</Label>
            <Input id="year" value={year} onChange={(e) => setYear(e.target.value)} className="w-28" inputMode="numeric" />
          </div>
          <Button onClick={doPreview} disabled={pending || !file}>Previsualizar</Button>
        </div>

        {preview && (
          <div className="mt-6 space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Tile label="Donantes nuevos" value={preview.plan.counts.newDonors} />
              <Tile label="Donantes existentes" value={preview.plan.counts.matchedDonors} />
              <Tile label="Pagos a insertar" value={preview.plan.counts.payments} />
              <Tile label="Pagos omitidos (ya existen)" value={preview.plan.counts.skipped} />
            </div>
            <div className="rounded-xl border border-border bg-secondary/30 p-4 text-sm">
              <p className="font-display text-xs uppercase tracking-widest text-muted-foreground">Pestañas</p>
              <ul className="mt-2 space-y-1">
                {preview.tabs.map((t) => (
                  <li key={t.name} className={t.recognized ? "text-foreground" : "text-muted-foreground"}>
                    {t.recognized ? `✓ ${t.name} — ${t.rowsParsed} filas (${t.rowsSkipped} vacías)` : `– ${t.name} — no se importa (entrar a mano)`}
                  </li>
                ))}
              </ul>
            </div>
            {preview.plan.possibleDuplicates.length > 0 && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
                <p className="font-display text-xs uppercase tracking-widest text-amber-500">Posibles duplicados ({preview.plan.possibleDuplicates.length})</p>
                <ul className="mt-2 space-y-1 text-muted-foreground">
                  {preview.plan.possibleDuplicates.slice(0, 20).map((d, i) => <li key={i}>{d.name} — {d.reason}</li>)}
                </ul>
              </div>
            )}
            <Button onClick={doCommit} disabled={pending} size="lg">Confirmar e importar</Button>
          </div>
        )}
      </section>

      {/* Entrada manual */}
      <section className="rounded-2xl border border-border bg-card/70 p-6">
        <h2 className="font-display text-2xl font-black uppercase">Entrada manual</h2>
        <p className="mt-1 text-sm text-muted-foreground">Efectivo en el CAM o donativo especial (un solo pago).</p>
        <form
          action={(fd) => startTransition(async () => {
            try {
              const res = await submitManualEntry(fd);
              toast.success(`Guardado (${res.counts.payments} pago).`);
              (document.getElementById("manual-form") as HTMLFormElement)?.reset();
              router.refresh();
            } catch (e) { toast.error(e instanceof Error ? e.message : "Error"); }
          })}
          id="manual-form"
          className="mt-4 grid gap-4 sm:grid-cols-2"
        >
          <div><Label htmlFor="m-name">Nombre *</Label><Input id="m-name" name="name" required /></div>
          <div><Label htmlFor="m-email">Email</Label><Input id="m-email" name="email" type="email" /></div>
          <div>
            <Label htmlFor="m-source">Fuente</Label>
            <select id="m-source" name="source" className="flex h-11 w-full rounded-lg border border-input bg-secondary/40 px-3.5 text-base">
              <option value="cam_cash">{donor.sources.cam_cash}</option>
              <option value="special">{donor.sources.special}</option>
              <option value="other">{donor.sources.other}</option>
            </select>
          </div>
          <div>
            <Label htmlFor="m-kind">Tipo</Label>
            <select id="m-kind" name="kind" className="flex h-11 w-full rounded-lg border border-input bg-secondary/40 px-3.5 text-base">
              <option value="recurring">Mensual (recurrente)</option>
              <option value="one_time">Único</option>
            </select>
          </div>
          <div>
            <Label htmlFor="m-goal">Objetivo</Label>
            <select id="m-goal" name="goal" className="flex h-11 w-full rounded-lg border border-input bg-secondary/40 px-3.5 text-base">
              <option value="">—</option>
              <option value="operacion_general">{donor.goals.operacion_general}</option>
              <option value="compras_solidarias">{donor.goals.compras_solidarias}</option>
            </select>
          </div>
          <div><Label htmlFor="m-month">Mes (YYYY-MM) *</Label><Input id="m-month" name="periodMonth" required placeholder="2026-03" /></div>
          <div><Label htmlFor="m-gross">Monto bruto ($) *</Label><Input id="m-gross" name="gross" required inputMode="decimal" /></div>
          <div><Label htmlFor="m-fee">Comisión ($)</Label><Input id="m-fee" name="fee" defaultValue="0" inputMode="decimal" /></div>
          <div className="sm:col-span-2"><Button type="submit" disabled={pending}>Guardar donativo</Button></div>
        </form>
      </section>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card/70 px-4 py-3">
      <p className="font-display text-3xl font-black text-primary tabular-nums">{value}</p>
      <p className="font-display text-[0.65rem] uppercase tracking-widest text-muted-foreground">{label}</p>
    </div>
  );
}
```
*(`formatCents` import is available for any amount display you add; the counts above are integers.)*

- [ ] **Step 3: Verify**

Run: `npm run lint && npm run build`
Expected: PASS. Manual verification waits for Task 11 (needs a live DB).

- [ ] **Step 4: Commit**

```bash
git add src/app/import/page.tsx src/components/import/import-client.tsx
git commit -m "feat(ui): /import upload+preview+commit and manual entry"
```

---

### Task 9: `/panel` — donor-understanding dashboard

**Files:**
- Create: `src/app/panel/page.tsx`, `src/components/panel/dashboard.tsx`
- Reference: `src/components/admin/admin-nav.tsx`, `src/config/donor.config.ts`, `src/lib/money.ts`.

**Interfaces:**
- Consumes: `getDonorDashboard` (`@/actions/metrics`), `DonorDashboard` (`@/lib/donor-dashboard`), `formatCents` (`@/lib/money`), `donor` config, `AdminNav`.

- [ ] **Step 1: Write the page** `src/app/panel/page.tsx`

```tsx
import { AdminNav } from "@/components/admin/admin-nav";
import { getDonorDashboard } from "@/actions/metrics";
import { Dashboard } from "@/components/panel/dashboard";

export const metadata = { title: "Panel — CAM Donaciones", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PanelPage() {
  const stats = await getDonorDashboard();
  return (
    <main className="relative min-h-dvh px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <AdminNav />
        <header className="mb-8">
          <p className="font-display text-sm uppercase tracking-[0.3em] text-primary">Plan de Apoyo Mensual</p>
          <h1 className="mt-1 font-display text-5xl font-black uppercase">Panel</h1>
        </header>
        <Dashboard stats={stats} />
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Write the component** `src/components/panel/dashboard.tsx`

```tsx
import { donor } from "@/config/donor.config";
import { formatCents } from "@/lib/money";
import type { DonorDashboard } from "@/lib/donor-dashboard";

function Tile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-card/70 px-5 py-4">
      <p className="font-display text-4xl font-black text-primary tabular-nums">{value}</p>
      <p className="font-display text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
    </div>
  );
}

const SRC = donor.sources as Record<string, string>;
const GOAL = donor.goals as Record<string, string>;
const money = (c: number) => formatCents(c, donor.currency);

export function Dashboard({ stats }: { stats: DonorDashboard }) {
  const { mrr, donorCounts, totalRaisedCents, ytdRaisedCents, bySource, byGoal } = stats;
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Recaudo mensual (MRR neto)" value={money(mrr.netCents)} />
        <Tile label="Donantes activos" value={donorCounts.active} />
        <Tile label="Lapsed" value={donorCounts.lapsed} />
        <Tile label="Cancelados" value={donorCounts.cancelled} />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Donativos únicos" value={donorCounts.one_time_only} />
        <Tile label="Total donantes" value={donorCounts.total} />
        <Tile label="Recaudado (total)" value={money(totalRaisedCents)} />
        <Tile label="Recaudado (año)" value={money(ytdRaisedCents)} />
      </div>

      <Breakdown title="Por fuente" rows={Object.entries(bySource).map(([k, v]) => ({ label: SRC[k] ?? k, ...v }))} />
      <Breakdown title="Por objetivo" rows={Object.entries(byGoal).map(([k, v]) => ({ label: GOAL[k] ?? (k === "sin_objetivo" ? "Sin objetivo" : k), ...v }))} />
    </div>
  );
}

function Breakdown({ title, rows }: { title: string; rows: { label: string; grossCents: number; netCents: number; count: number }[] }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-secondary/40 text-left font-display text-xs uppercase tracking-widest text-muted-foreground">
          <tr><th className="px-4 py-3">{title}</th><th className="px-3 py-3 text-right"># pagos</th><th className="px-3 py-3 text-right">Neto</th></tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">Sin datos todavía.</td></tr>
          ) : rows.map((r) => (
            <tr key={r.label} className="border-t border-border">
              <td className="px-4 py-3 text-foreground">{r.label}</td>
              <td className="px-3 py-3 text-right tabular-nums">{r.count}</td>
              <td className="px-3 py-3 text-right tabular-nums">{formatCents(r.netCents, donor.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npm run lint && npm run build`
Expected: PASS (the page calls `getDonorDashboard` which degrades to zeros/empty when tables are empty/absent at build is not invoked — build does not run the action; it just compiles). Manual verification in Task 11.

- [ ] **Step 4: Commit**

```bash
git add src/app/panel/page.tsx src/components/panel/dashboard.tsx
git commit -m "feat(ui): /panel donor-understanding dashboard"
```

---

### Task 10: `/donantes` — list + per-donor timeline

**Files:**
- Create: `src/app/donantes/page.tsx`, `src/app/donantes/[id]/page.tsx`, `src/components/donantes/donor-table.tsx`, `src/components/donantes/donor-detail.tsx`
- Reference: `src/components/admin/admin-nav.tsx`, `src/components/ui/{badge,input,button}.tsx`, `src/config/donor.config.ts`, `src/lib/money.ts`.

**Interfaces:**
- Consumes: `listDonors`/`DonorListItem`, `getDonorDetail`/`DonorDetail` (`@/actions/donors`); `formatCents`; `donor` config; `AdminNav`. Next 16: `params` is a `Promise` in the `[id]` page — `await` it.

- [ ] **Step 1: Write `src/app/donantes/page.tsx`**

```tsx
import { AdminNav } from "@/components/admin/admin-nav";
import { listDonors } from "@/actions/donors";
import { DonorTable } from "@/components/donantes/donor-table";

export const metadata = { title: "Donantes — CAM Donaciones", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function DonantesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const donors = await listDonors(q);
  return (
    <main className="relative min-h-dvh px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <AdminNav />
        <header className="mb-8">
          <p className="font-display text-sm uppercase tracking-[0.3em] text-primary">Base de datos</p>
          <h1 className="mt-1 font-display text-5xl font-black uppercase">Donantes</h1>
        </header>
        <DonorTable donors={donors} initialQuery={q ?? ""} />
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Write `src/components/donantes/donor-table.tsx`**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { DonorListItem, DonorStatus } from "@/actions/donors";

const STATUS: Record<DonorStatus, { label: string; variant: "confirmed" | "pending" | "cancelled" | "paid" }> = {
  active: { label: "Activo", variant: "confirmed" },
  lapsed: { label: "Lapsed", variant: "pending" },
  cancelled: { label: "Cancelado", variant: "cancelled" },
  one_time_only: { label: "Único", variant: "paid" },
};

export function DonorTable({ donors, initialQuery }: { donors: DonorListItem[]; initialQuery: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);
  return (
    <div className="space-y-5">
      <form onSubmit={(e) => { e.preventDefault(); router.push(`/donantes?q=${encodeURIComponent(q)}`); }} className="flex gap-3">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o email" />
        <Button type="submit">Buscar</Button>
      </form>
      {donors.length === 0 ? (
        <p className="rounded-xl border border-border bg-card/60 p-8 text-center text-muted-foreground">No hay donantes en esta vista.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-left font-display text-xs uppercase tracking-widest text-muted-foreground">
              <tr><th className="px-4 py-3">Donante</th><th className="px-3 py-3">Estado</th><th className="px-3 py-3 text-right">Compromisos</th></tr>
            </thead>
            <tbody>
              {donors.map((d) => (
                <tr key={d.id} className="border-t border-border hover:bg-secondary/20">
                  <td className="px-4 py-3">
                    <Link href={`/donantes/${d.id}`} className="font-medium text-foreground hover:text-primary">{d.display_name}</Link>
                    {d.email_normalized && <span className="block text-xs text-muted-foreground">{d.email_normalized}</span>}
                  </td>
                  <td className="px-3 py-3"><Badge variant={STATUS[d.status].variant}>{STATUS[d.status].label}</Badge></td>
                  <td className="px-3 py-3 text-right tabular-nums">{d.pledgeCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Write `src/app/donantes/[id]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { AdminNav } from "@/components/admin/admin-nav";
import { getDonorDetail } from "@/actions/donors";
import { DonorDetail } from "@/components/donantes/donor-detail";

export const metadata = { title: "Donante — CAM Donaciones", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function DonorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getDonorDetail(id);
  if (!detail) notFound();
  return (
    <main className="relative min-h-dvh px-6 py-10">
      <div className="mx-auto max-w-3xl">
        <AdminNav />
        <DonorDetail detail={detail} />
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Write `src/components/donantes/donor-detail.tsx`**

```tsx
import Link from "next/link";
import { donor as cfg } from "@/config/donor.config";
import { formatCents } from "@/lib/money";
import type { DonorDetail as Detail } from "@/actions/donors";

const SRC = cfg.sources as Record<string, string>;
const GOAL = cfg.goals as Record<string, string>;

export function DonorDetail({ detail }: { detail: Detail }) {
  const { donor, pledges, timeline } = detail;
  return (
    <div className="space-y-8">
      <Link href="/donantes" className="text-sm text-muted-foreground hover:text-foreground">← Donantes</Link>
      <header>
        <h1 className="font-display text-4xl font-black uppercase">{donor.display_name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {donor.email_normalized ?? "sin email"}{donor.phone_normalized ? ` · ${donor.phone_normalized}` : ""}
          {donor.address ? ` · ${donor.address}` : ""}
        </p>
      </header>

      <section>
        <h2 className="mb-3 font-display text-xs uppercase tracking-widest text-muted-foreground">Compromisos ({pledges.length})</h2>
        <div className="space-y-2">
          {pledges.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card/60 px-4 py-3 text-sm">
              <span className="font-medium text-foreground">{SRC[p.source] ?? p.source}</span>
              <span className="text-muted-foreground">{p.kind === "recurring" ? "Mensual" : "Único"} · {p.status}{p.goal ? ` · ${GOAL[p.goal] ?? p.goal}` : ""}</span>
              <span className="tabular-nums text-foreground">{p.monthly_net_cents != null ? `${formatCents(p.monthly_net_cents, cfg.currency)}/mes` : "—"}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-xs uppercase tracking-widest text-muted-foreground">Historial de pagos ({timeline.length})</h2>
        <div className="overflow-hidden rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-left font-display text-xs uppercase tracking-widest text-muted-foreground">
              <tr><th className="px-4 py-3">Mes</th><th className="px-3 py-3">Fuente</th><th className="px-3 py-3">Objetivo</th><th className="px-3 py-3 text-right">Neto</th></tr>
            </thead>
            <tbody>
              {timeline.map((e, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-4 py-3 tabular-nums">{e.periodMonth.slice(0, 7)}</td>
                  <td className="px-3 py-3">{SRC[e.source] ?? e.source}</td>
                  <td className="px-3 py-3 text-muted-foreground">{e.goal ? (GOAL[e.goal] ?? e.goal) : "—"}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{formatCents(e.netCents, cfg.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 5: Verify**

Run: `npm run lint && npm test && npm run build`
Expected: all PASS (full suite green — the M2 unit tests from Tasks 2–5; build compiles all routes: `/`, `/admin/login`, `/import`, `/panel`, `/donantes`, `/donantes/[id]`).

- [ ] **Step 6: Commit**

```bash
git add src/app/donantes src/components/donantes
git commit -m "feat(ui): /donantes list + per-donor timeline detail"
```

---

### Task 11: Provision Supabase, apply migrations, import real data, reconcile, deploy (collaborative)

**Files:** none (operational task). This task is done WITH the user — the agent prepares + verifies; the user provisions Supabase + Netlify (the agent cannot log into those).

- [ ] **Step 1: User provisions a NEW Supabase project** for Comedores Sociales and fills `.env.local` (copy from `.env.local.example`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` (32-byte hex), `NEXT_PUBLIC_APP_URL=http://localhost:3000`.

- [ ] **Step 2: Apply migrations** in the Supabase SQL editor, in order: paste `supabase/migrations/001_initial_schema.sql`, then `002_rls_policies.sql`, then `003_triggers.sql`. Verify the four tables exist and RLS is on.

- [ ] **Step 3: Smoke the app locally**

Run: `npm run dev` → open `http://localhost:3000` → redirected to `/admin/login` → log in with `ADMIN_PASSWORD`. Confirm `/panel` loads (all zeros), `/donantes` empty, `/import` renders.

- [ ] **Step 4: Import the real spreadsheet (dry-run → commit)**

On `/import`, upload `C:\Users\carlosfigueroa\Downloads\Plan de Apoyo Mensual TODO.xlsx`, set the year for Pagos CAM, click **Previsualizar**. Verify the preview: recognized tabs (Pagos CAM, PayPal 2025/2026, STRIPE 2025/2026) show parsed row counts; "Donantes Especiales" + "Sheet2" show "no se importa"; sane new-donor/payment counts; review possible-duplicates. Then **Confirmar e importar**.

- [ ] **Step 5: Reconcile**

On `/panel`, sanity-check the numbers against the spreadsheet: a donor in both PayPal 2025 and PayPal 2026 appears as ONE donor with two pledges (check on their `/donantes/[id]`); `CANCELADO` rows show a cancelled pledge; total/YTD raised and by-source/by-objetivo are in the right ballpark vs the Excel column totals. **Re-run the same import** → preview should show ~all payments skipped (idempotency holds), zero/near-zero new donors.

- [ ] **Step 6: Enter the special gifts manually**

Use `/import` → Entrada manual to add the "Donantes Especiales" one-time gifts (e.g. Bryan Oxender $2000, Jules Fishelman ~$100) as `source: special`, `kind: one_time`.

- [ ] **Step 7: Deploy to Netlify** (`netlify.toml` already present)

User: import the repo into Netlify; add the env vars (mark `SUPABASE_SERVICE_ROLE_KEY` + `ADMIN_*` as secret; only `NEXT_PUBLIC_*` reach the browser); deploy; set `NEXT_PUBLIC_APP_URL` to the deployed URL and redeploy. Smoke the deployed `/admin/login` → `/panel`.

---

## Milestone 2 complete

Deliverable: staff can upload the historical spreadsheet, enter cash/special gifts by hand, and see the donor base on `/panel` + `/donantes`. Deferred to **M3**: Stripe/PayPal CSV importers (need sample exports), a dedicated "Donantes Especiales" raw-export importer, the Stripe-deposit reconciliation view, and a donor-merge UI for the possible-duplicates list.

