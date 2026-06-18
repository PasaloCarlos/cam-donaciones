# CAM Donaciones — Milestone 1: Foundation + Domain Core — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the `cam-donaciones` internal donor-management app shell (cloned from ka-basket-pr), define the donor/pledge/payment schema + RLS, and build the fully unit-tested pure domain core (money, donor matching, donor-understanding metrics, dashboard aggregation, and the import normalize→plan engine) that every later UI and importer consumes.

**Architecture:** Next.js 16 + Supabase + TS, mirroring `ka-basket-pr`. Sensitive tables are RLS deny-all; all access via the service-role client inside Server Actions guarded by `requireAdmin()`. Business logic lives in pure, tested functions under `src/lib/*`; actions stay thin and delegate to them (the `actions/dashboard.ts` → `lib/dashboard.ts` pattern). Money is integer cents. Ingestion is built around one normalized record shape + one idempotent commit path so file imports now and API sync later share it.

**Tech Stack:** Next.js 16.2.2 (App Router, webpack), React 19, TypeScript, Tailwind 4, shadcn (base-nova), Supabase (`@supabase/ssr` + `@supabase/supabase-js`), vitest, Netlify. New deps: `papaparse` + `@types/papaparse`, `xlsx`.

## Global Constraints

- The repo was cloned from `ka-basket-pr` (baseline commit `a824c23`) — it still contains ka-basket DOMAIN code (brackets, teams, tournaments, registration, equipos, torneo, landing) that Task 1 removes. Reusable STACK files stay.
- `donors`, `pledges`, `payments`, `import_batches` are sensitive (PII + financial) → RLS enabled, **zero anon policies (deny-all)**; all reads/writes via the service-role client (`@/lib/supabase/admin`) inside Server Actions. Never a public page in this milestone.
- Every admin Server Action calls `await requireAdmin()` (`@/lib/admin-guard`) as its first line. `src/proxy.ts` gates every route except `/admin/login`.
- All money is stored and computed as **integer cents** (`bigint` in SQL, `number` in TS). Never float math on currency.
- All UI/user-facing copy is Spanish (es). Editable content lives in `src/config/*.config.ts` — never hardcode it in components.
- Pure logic goes in `src/lib/*` with vitest tests in `src/lib/__tests__/`; actions delegate to it. `asOf` is always an explicit parameter to time-dependent functions (never read the clock inside pure code).
- Lapsed default = a recurring, non-cancelled pledge with no payment in the last **2** months (configurable in `donor.config.ts`).
- Gates before a task is done: `npm run lint`, `npm test`, `npm run build` clean.
- Do NOT apply migrations to any database or push to GitHub in this milestone.

---

### Task 1: Scaffold — prune ka-basket domain code, adapt the shell

**Files:**
- Delete (ka-basket domain): `src/components/landing/` (all), `src/components/registro/`, `src/components/equipos/`, `src/components/torneo/`, `src/components/admin/` EXCEPT `login-form.tsx` and `admin-nav.tsx`, `src/app/registro/`, `src/app/equipos/`, `src/app/torneo/`, `src/app/admin/brackets/`, `src/app/admin/reglas/`, `src/app/admin/checkin/`, `src/app/admin/page.tsx`, `src/app/opengraph-image.tsx`, `src/actions/registrations.ts`, `src/actions/brackets.ts`, `src/actions/checkin.ts`, `src/actions/dashboard.ts`, `src/lib/bracket.ts`, `src/lib/brackets-public.ts`, `src/lib/settings.ts`, `src/lib/stats.ts`, `src/lib/capacity.ts`, `src/lib/whatsapp.ts`, `src/lib/dashboard.ts`, `src/lib/checkin-search.ts`, `src/lib/deadline.ts`, `src/lib/format.ts`, `src/lib/registration.ts`, `src/config/event.config.ts`, `supabase/migrations/004_brackets.sql`, `005_brackets_rls.sql`, `006_brackets_triggers.sql`, `007_admin_ops.sql`, `supabase/seed.sql`, and all of `src/lib/__tests__/` EXCEPT `admin-session.test.ts`.
- Keep (stack): `src/lib/supabase/{server,client,admin}.ts`, `src/lib/admin-session.ts`, `src/lib/admin-guard.ts`, `src/lib/utils.ts`, `src/proxy.ts`, `src/components/ui/*`, `src/components/shared/submit-button.tsx`, `src/components/admin/login-form.tsx`, `src/components/admin/admin-nav.tsx`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/admin/login/page.tsx`, `src/app/admin/error.tsx`, `src/app/admin/loading.tsx`, `src/lib/__tests__/admin-session.test.ts`, all root configs.
- Modify: `package.json`, `src/actions/admin.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/components/admin/admin-nav.tsx`, `src/proxy.ts`, `README.md`, `AGENTS.md`, `.env.local.example`, `src/app/icon.svg`.

**Interfaces:**
- Produces: a clean-building Next.js shell with a working `/admin/login` → cookie gate; `src/actions/admin.ts` exporting `adminLogin(formData)`, `adminLogout()` only; `requireAdmin()` available from `@/lib/admin-guard`.

- [ ] **Step 1: Delete the ka-basket domain files** listed above.

```bash
cd /c/Users/carlosfigueroa/source/repos/cam-donaciones
git rm -r src/components/landing src/components/registro src/components/equipos src/components/torneo \
  src/app/registro src/app/equipos src/app/torneo src/app/admin/brackets src/app/admin/reglas src/app/admin/checkin
git rm src/components/admin/brackets-admin.tsx src/components/admin/bracket-manager.tsx src/components/admin/rules-editor.tsx \
  src/components/admin/stats-board.tsx src/components/admin/checkin-board.tsx src/components/admin/teams-table.tsx \
  src/components/shared/qr-code.tsx \
  src/app/admin/page.tsx src/app/opengraph-image.tsx \
  src/actions/registrations.ts src/actions/brackets.ts src/actions/checkin.ts src/actions/dashboard.ts \
  src/lib/bracket.ts src/lib/brackets-public.ts src/lib/settings.ts src/lib/stats.ts src/lib/capacity.ts \
  src/lib/whatsapp.ts src/lib/dashboard.ts src/lib/checkin-search.ts src/lib/deadline.ts src/lib/format.ts src/lib/registration.ts \
  src/config/event.config.ts \
  supabase/migrations/004_brackets.sql supabase/migrations/005_brackets_rls.sql supabase/migrations/006_brackets_triggers.sql supabase/migrations/007_admin_ops.sql \
  supabase/seed.sql
git rm src/lib/__tests__/registration.test.ts src/lib/__tests__/bracket.test.ts src/lib/__tests__/capacity.test.ts \
  src/lib/__tests__/whatsapp.test.ts src/lib/__tests__/dashboard.test.ts src/lib/__tests__/checkin-search.test.ts
```
(If a file is already absent, ignore that removal.)

- [ ] **Step 2: Update `package.json`** — set `"name": "cam-donaciones"`; remove `qrcode.react` and `html5-qrcode` from dependencies; add `"papaparse": "^5.4.1"`, `"xlsx": "^0.18.5"` to dependencies and `"@types/papaparse": "^5.3.14"` to devDependencies. Keep all other deps/scripts identical.

- [ ] **Step 3: Trim `src/actions/admin.ts`** to only the auth actions. Replace the file with:

```ts
"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { signSession, ADMIN_COOKIE } from "@/lib/admin-session";

export type LoginResult = { ok: false; error: string };

export async function adminLogin(formData: FormData): Promise<LoginResult> {
  const password = String(formData.get("password") ?? "");
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return { ok: false, error: "ADMIN_PASSWORD no está configurado en el servidor." };
  if (password !== expected) return { ok: false, error: "Contraseña incorrecta." };

  (await cookies()).set(ADMIN_COOKIE, await signSession(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  redirect("/panel");
}

export async function adminLogout() {
  (await cookies()).delete(ADMIN_COOKIE);
  redirect("/admin/login");
}
```

- [ ] **Step 4: Replace `src/app/page.tsx`** with a redirect to the dashboard (no public landing):

```tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/panel");
}
```

- [ ] **Step 5: Replace `src/components/admin/admin-nav.tsx`** links with this milestone's routes (the `/panel`, `/donantes`, `/import` pages arrive in Milestone 2, but the nav is defined now):

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/panel", label: "Panel" },
  { href: "/donantes", label: "Donantes" },
  { href: "/import", label: "Importar" },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav className="mb-8 flex flex-wrap gap-2">
      {LINKS.map((l) => {
        const active = path === l.href || path.startsWith(l.href + "/");
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`rounded-full border px-4 py-1.5 font-display text-sm uppercase tracking-wider transition-colors ${
              active
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 6: Update `src/proxy.ts`** so the matcher gates the whole app except the login route and Next internals. Keep the existing cookie-verify logic; change only the exported `config.matcher` to:

```ts
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|admin/login).*)"],
};
```

If the existing proxy only redirected `/admin/*`, also ensure its redirect target is `/admin/login` and that it allows `/admin/login` through (the matcher already excludes it).

- [ ] **Step 7: Adapt branding/text** — in `src/app/layout.tsx` set the metadata `title`/`description` to "CAM Donaciones — Comedores Sociales de PR" / a one-line Spanish description, keep `lang="es"`, keep fonts/Toaster. In `src/app/admin/login/page.tsx` and `src/components/admin/login-form.tsx`, change any "KA Basket" copy to "CAM Donaciones". Replace `README.md` and `AGENTS.md` bodies with a short CAM-donaciones description (keep AGENTS.md's "Next.js 16 — read node_modules/next docs" + the RLS/service-role/admin-gate project-shape notes, retargeted to donors). Update `.env.local.example` to the same var list (no Stripe vars yet). Leave `src/app/icon.svg` as-is or replace with a neutral glyph (non-blocking).

- [ ] **Step 8: Install deps and verify the shell builds**

Run: `npm install`
Then: `npm run lint && npm test && npm run build`
Expected: lint clean; tests = the single `admin-session.test.ts` suite passing; build compiles with routes `/` (redirect), `/admin/login`, `/panel`+`/donantes`+`/import` not yet present (that's fine — they're Milestone 2). If the build errors on a missing import from a deleted file, fix the dangling import (it indicates a kept file referenced a deleted one).

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore(scaffold): prune ka-basket domain code; adapt shell for cam-donaciones"
```

---

### Task 2: Database schema, RLS, triggers, types, config skeletons

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`, `supabase/migrations/002_rls_policies.sql`, `supabase/migrations/003_triggers.sql`
- Create: `src/config/donor.config.ts`, `src/config/import-mappings.config.ts`
- Rewrite: `src/types/database.ts`, `src/types/index.ts`

**Interfaces:**
- Produces (enums): `donation_source('cam_cash','paypal','stripe','special','other')`, `pledge_status('active','cancelled','paused')`, `pledge_kind('recurring','one_time')`, `donation_goal('operacion_general','compras_solidarias')`.
- Produces (TS types in `database.ts`): Row/Insert/Update for `donors`, `pledges`, `payments`, `import_batches`; enum unions.
- Produces (`donor.config.ts`): `donor = { org: { name, shortName }, lapsedAfterMonths: 2, goals: {...labels}, sources: {...labels}, currency: "$" } as const`.

- [ ] **Step 1: Write `supabase/migrations/001_initial_schema.sql`**

```sql
-- ============================================================
-- CAM DONACIONES — core schema (donors / pledges / payments)
-- Money is integer cents. PII + financial -> RLS deny-all (see 002).
-- ============================================================
create type donation_source as enum ('cam_cash','paypal','stripe','special','other');
create type pledge_status   as enum ('active','cancelled','paused');
create type pledge_kind     as enum ('recurring','one_time');
create type donation_goal   as enum ('operacion_general','compras_solidarias');

create table public.donors (
  id               uuid primary key default gen_random_uuid(),
  email_normalized text,
  display_name     text not null,
  name_normalized  text not null,
  phone_normalized text,
  address          text,
  country_region   text,
  notes            text,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);
create unique index uq_donors_email on public.donors(email_normalized) where email_normalized is not null;
create index idx_donors_name  on public.donors(name_normalized);
create index idx_donors_phone on public.donors(phone_normalized);

create table public.import_batches (
  id                uuid primary key default gen_random_uuid(),
  source            donation_source not null,
  importer          text not null,
  filename          text,
  file_hash         text,
  row_count         int default 0,
  created_donors    int default 0,
  created_pledges   int default 0,
  inserted_payments int default 0,
  skipped_payments  int default 0,
  notes             text,
  created_by        text,
  created_at        timestamptz default now()
);

create table public.pledges (
  id                  uuid primary key default gen_random_uuid(),
  donor_id            uuid not null references public.donors(id) on delete cascade,
  source              donation_source not null,
  kind                pledge_kind not null default 'recurring',
  status              pledge_status not null default 'active',
  goal                donation_goal,
  monthly_gross_cents bigint,
  fee_cents           bigint default 0,
  monthly_net_cents   bigint,
  subscription_date   date,
  cancelled_at        date,
  source_year         int,
  external_ref        text,
  import_batch_id     uuid references public.import_batches(id) on delete set null,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);
create index idx_pledges_donor  on public.pledges(donor_id);
create index idx_pledges_status on public.pledges(status);
create index idx_pledges_source on public.pledges(source);

create table public.payments (
  id              uuid primary key default gen_random_uuid(),
  donor_id        uuid not null references public.donors(id) on delete cascade,
  pledge_id       uuid references public.pledges(id) on delete set null,
  source          donation_source not null,
  period_month    date not null,
  gross_cents     bigint not null,
  fee_cents       bigint not null default 0,
  net_cents       bigint not null,
  goal            donation_goal,
  external_ref    text,
  idempotency_key text not null,
  import_batch_id uuid references public.import_batches(id) on delete set null,
  created_at      timestamptz default now()
);
create unique index uq_payments_idem  on public.payments(idempotency_key);
create index idx_payments_donor  on public.payments(donor_id);
create index idx_payments_pledge on public.payments(pledge_id);
create index idx_payments_period on public.payments(period_month);
create index idx_payments_source on public.payments(source);
```

- [ ] **Step 2: Write `supabase/migrations/002_rls_policies.sql`** (deny-all to anon; service role bypasses RLS):

```sql
-- All tables hold PII/financial data -> RLS enabled with ZERO anon policies
-- (deny-all). The service-role client used by Server Actions bypasses RLS.
alter table public.donors         enable row level security;
alter table public.pledges        enable row level security;
alter table public.payments       enable row level security;
alter table public.import_batches enable row level security;
```

- [ ] **Step 3: Write `supabase/migrations/003_triggers.sql`** (reuse the ka-basket `update_updated_at` shape):

```sql
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger on_donor_update
  before update on public.donors
  for each row execute function public.update_updated_at();

create trigger on_pledge_update
  before update on public.pledges
  for each row execute function public.update_updated_at();
```

- [ ] **Step 4: Write `src/config/donor.config.ts`**

```ts
// ÚNICA FUENTE DE VERDAD para textos/ajustes del panel. (No hay datos editables
// públicos en este milestone.)
export const donor = {
  org: { name: "Comedores Sociales de Puerto Rico", shortName: "CAM Donaciones" },
  currency: "$",
  // Un donante recurrente sin pago en los últimos N meses cuenta como "lapsed".
  lapsedAfterMonths: 2,
  goals: {
    operacion_general: "Operación General",
    compras_solidarias: "Compras Solidarias",
  },
  sources: {
    cam_cash: "Efectivo (CAM)",
    paypal: "PayPal",
    stripe: "Stripe",
    special: "Donante Especial",
    other: "Otro",
  },
} as const;

export type DonorConfig = typeof donor;
```

- [ ] **Step 5: Write `src/config/import-mappings.config.ts`** (tab-name → source/year for the legacy workbook; column header maps come in Milestone 2 — keep the shape here):

```ts
import type { DonationSource } from "@/types";

// Reconoce las pestañas del libro histórico "Plan de Apoyo Mensual".
// La pestaña define (source, year). Nombres normalizados en minúsculas.
export const legacyTabs: { match: RegExp; source: DonationSource; yearFrom: "name" | null }[] = [
  { match: /^pagos\s*cam/i, source: "cam_cash", yearFrom: null },
  { match: /^paypal/i, source: "paypal", yearFrom: "name" },
  { match: /^stripe/i, source: "stripe", yearFrom: "name" },
  { match: /^donantes\s*especiales/i, source: "special", yearFrom: null },
];

// Meses en español (índice 0 = Enero) para mapear las 12 columnas mensuales.
export const SPANISH_MONTHS = [
  "enero","febrero","marzo","abril","mayo","junio",
  "julio","agosto","septiembre","octubre","noviembre","diciembre",
] as const;
```

- [ ] **Step 6: Rewrite `src/types/database.ts`** to a hand-written `Database` type with `donors`, `pledges`, `payments`, `import_batches` Row/Insert/Update matching the SQL, plus an `Enums` block. Use the ka-basket `database.ts` shape (Json type, `public.Tables`, `public.Enums`, empty `Relationships: []`). Example for the enums + payments table (write all four tables analogously):

```ts
export type Json = string | number | boolean | null | { [k: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      payments: {
        Row: {
          id: string; donor_id: string; pledge_id: string | null;
          source: DonationSource; period_month: string;
          gross_cents: number; fee_cents: number; net_cents: number;
          goal: DonationGoal | null; external_ref: string | null;
          idempotency_key: string; import_batch_id: string | null; created_at: string;
        };
        Insert: {
          id?: string; donor_id: string; pledge_id?: string | null;
          source: DonationSource; period_month: string;
          gross_cents: number; fee_cents?: number; net_cents: number;
          goal?: DonationGoal | null; external_ref?: string | null;
          idempotency_key: string; import_batch_id?: string | null; created_at?: string;
        };
        Update: { /* same fields all optional */ };
        Relationships: [];
      };
      // donors, pledges, import_batches: same Row/Insert/Update treatment
    };
    Enums: {
      donation_source: "cam_cash" | "paypal" | "stripe" | "special" | "other";
      pledge_status: "active" | "cancelled" | "paused";
      pledge_kind: "recurring" | "one_time";
      donation_goal: "operacion_general" | "compras_solidarias";
    };
  };
};

export type DonationSource = Database["public"]["Enums"]["donation_source"];
export type PledgeStatus = Database["public"]["Enums"]["pledge_status"];
export type PledgeKind = Database["public"]["Enums"]["pledge_kind"];
export type DonationGoal = Database["public"]["Enums"]["donation_goal"];
```

Then update `src/types/index.ts` to re-export `Database` and define Row aliases `Donor`, `Pledge`, `Payment`, `ImportBatch` plus the enum unions (mirror ka-basket `types/index.ts`).

- [ ] **Step 7: Verify build/typecheck**

Run: `npm run build`
Expected: PASS (types compile; migrations are not executed by the build). Fix any type mismatch between `database.ts` and the configs.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations src/config src/types
git commit -m "feat(schema): donors/pledges/payments schema, RLS deny-all, triggers, types, config"
```

---

### Task 3: `money.ts` — currency parsing/formatting (pure, TDD)

**Files:**
- Create: `src/lib/money.ts`
- Test: `src/lib/__tests__/money.test.ts`

**Interfaces:**
- Produces: `parseMoneyToCents(raw: string | number | null | undefined): number | null` and `formatCents(cents: number, currency?: string): string`.

- [ ] **Step 1: Write the failing test** (`src/lib/__tests__/money.test.ts`):

```ts
import { describe, it, expect } from "vitest";
import { parseMoneyToCents, formatCents } from "@/lib/money";

describe("parseMoneyToCents", () => {
  it("parses a plain decimal to cents", () => {
    expect(parseMoneyToCents("26.01")).toBe(2601);
    expect(parseMoneyToCents(26.01)).toBe(2601);
  });
  it("strips currency symbols, commas and spaces", () => {
    expect(parseMoneyToCents("$1,858.74")).toBe(185874);
    expect(parseMoneyToCents(" $ 50 ")).toBe(5000);
  });
  it("rounds to the nearest cent (no float drift)", () => {
    expect(parseMoneyToCents("10.005")).toBe(1001);
    expect(parseMoneyToCents(189.60000000000002)).toBe(18960);
  });
  it("returns null for blank or non-numeric (e.g. CANCELADO)", () => {
    expect(parseMoneyToCents("")).toBeNull();
    expect(parseMoneyToCents("   ")).toBeNull();
    expect(parseMoneyToCents("CANCELADO")).toBeNull();
    expect(parseMoneyToCents(null)).toBeNull();
    expect(parseMoneyToCents(undefined)).toBeNull();
  });
  it("handles zero", () => {
    expect(parseMoneyToCents("0")).toBe(0);
    expect(parseMoneyToCents(0)).toBe(0);
  });
});

describe("formatCents", () => {
  it("formats cents as a currency string with 2 decimals", () => {
    expect(formatCents(2601)).toBe("$26.01");
    expect(formatCents(185874)).toBe("$1,858.74");
    expect(formatCents(0)).toBe("$0.00");
  });
  it("accepts a custom currency symbol", () => {
    expect(formatCents(5000, "USD ")).toBe("USD 50.00");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- money`
Expected: FAIL (cannot resolve `@/lib/money`).

- [ ] **Step 3: Write `src/lib/money.ts`**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- money`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/money.ts src/lib/__tests__/money.test.ts
git commit -m "feat(core): money cents parse/format helper with tests"
```

---

### Task 4: `donor-match.ts` — identity normalization + dedup (pure, TDD)

**Files:**
- Create: `src/lib/donor-match.ts`
- Test: `src/lib/__tests__/donor-match.test.ts`

**Interfaces:**
- Produces: `normalizeEmail(raw): string | null`; `normalizeName(raw): string`; `normalizePhone(raw): string | null`; `type DonorIdentity = { id: string; email_normalized: string | null; name_normalized: string; phone_normalized: string | null }`; `buildDonorIndex(existing: DonorIdentity[]): DonorIndex`; `matchDonor(index: DonorIndex, candidate: { email: string | null; name: string; phone: string | null }): { donorId: string | null; reason: "email" | "name_phone" | "none"; ambiguous: boolean }`. (`candidate` fields are RAW; matchDonor normalizes internally.)

- [ ] **Step 1: Write the failing test** (`src/lib/__tests__/donor-match.test.ts`):

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- donor-match`
Expected: FAIL (cannot resolve `@/lib/donor-match`).

- [ ] **Step 3: Write `src/lib/donor-match.ts`**

```ts
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
};

export function buildDonorIndex(existing: DonorIdentity[]): DonorIndex {
  const byEmail = new Map<string, string>();
  const byNamePhone = new Map<string, string[]>();
  for (const d of existing) {
    if (d.email_normalized) byEmail.set(d.email_normalized, d.id);
    if (d.phone_normalized) {
      const key = `${d.name_normalized}|${d.phone_normalized}`;
      const arr = byNamePhone.get(key) ?? [];
      arr.push(d.id);
      byNamePhone.set(key, arr);
    }
  }
  return { byEmail, byNamePhone };
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
  const ambiguous = !!name && Array.from(index.byNamePhone.keys()).some((k) => k.startsWith(`${name}|`));
  return { donorId: null, reason: "none", ambiguous };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- donor-match`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/donor-match.ts src/lib/__tests__/donor-match.test.ts
git commit -m "feat(core): donor identity normalization + dedup matcher with tests"
```

---

### Task 5: `metrics.ts` — donor-understanding functions (pure, TDD)

**Files:**
- Create: `src/lib/metrics.ts`
- Test: `src/lib/__tests__/metrics.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks (defines its own minimal row shapes).
- Produces:
  - `type MetricPledge = { id: string; donor_id: string; source: DonationSource; kind: PledgeKind; status: PledgeStatus; goal: DonationGoal | null; monthly_net_cents: number | null; monthly_gross_cents: number | null; subscription_date: string | null; cancelled_at: string | null }`
  - `type MetricPayment = { donor_id: string; source: DonationSource; period_month: string; gross_cents: number; net_cents: number; goal: DonationGoal | null }`
  - `activeMrrCents(pledges: MetricPledge[]): { netCents: number; grossCents: number }`
  - `classifyDonor(pledges: MetricPledge[], payments: MetricPayment[], asOf: Date, lapsedAfterMonths: number): "active" | "lapsed" | "cancelled" | "one_time_only"`
  - `monthsBetween(a: Date, b: Date): number` (whole calendar months, b - a)
  - `totalsBySource(payments: MetricPayment[]): Record<string, { grossCents: number; netCents: number; count: number }>`
  - `totalsByGoal(payments: MetricPayment[]): Record<string, { grossCents: number; netCents: number; count: number }>`

- [ ] **Step 1: Write the failing test** (`src/lib/__tests__/metrics.test.ts`):

```ts
import { describe, it, expect } from "vitest";
import { activeMrrCents, classifyDonor, monthsBetween, totalsBySource, totalsByGoal,
  type MetricPledge, type MetricPayment } from "@/lib/metrics";

const asOf = new Date("2026-06-15T00:00:00Z");

function pledge(p: Partial<MetricPledge> = {}): MetricPledge {
  return { id: "p", donor_id: "d", source: "stripe", kind: "recurring", status: "active",
    goal: "operacion_general", monthly_net_cents: 2500, monthly_gross_cents: 2601,
    subscription_date: "2025-01-10", cancelled_at: null, ...p };
}
function pay(p: Partial<MetricPayment> = {}): MetricPayment {
  return { donor_id: "d", source: "stripe", period_month: "2026-06-01",
    gross_cents: 2601, net_cents: 2500, goal: "operacion_general", ...p };
}

describe("activeMrrCents", () => {
  it("sums net+gross over active recurring pledges only", () => {
    const r = activeMrrCents([
      pledge({ monthly_net_cents: 2500, monthly_gross_cents: 2601 }),
      pledge({ status: "cancelled", monthly_net_cents: 9999 }),
      pledge({ kind: "one_time", monthly_net_cents: 9999 }),
      pledge({ monthly_net_cents: 5000, monthly_gross_cents: 5152 }),
    ]);
    expect(r).toEqual({ netCents: 7500, grossCents: 7753 });
  });
});

describe("monthsBetween", () => {
  it("counts whole calendar months", () => {
    expect(monthsBetween(new Date("2026-04-01"), new Date("2026-06-15"))).toBe(2);
    expect(monthsBetween(new Date("2025-06-01"), new Date("2026-06-01"))).toBe(12);
  });
});

describe("classifyDonor", () => {
  it("active: recurring pledge with a recent payment", () => {
    expect(classifyDonor([pledge()], [pay({ period_month: "2026-06-01" })], asOf, 2)).toBe("active");
  });
  it("lapsed: recurring pledge, no payment within the window", () => {
    expect(classifyDonor([pledge()], [pay({ period_month: "2026-01-01" })], asOf, 2)).toBe("lapsed");
  });
  it("cancelled: all recurring pledges cancelled", () => {
    expect(classifyDonor([pledge({ status: "cancelled" })], [], asOf, 2)).toBe("cancelled");
  });
  it("one_time_only: no recurring pledges at all", () => {
    expect(classifyDonor([pledge({ kind: "one_time", status: "active" })], [pay()], asOf, 2)).toBe("one_time_only");
  });
});

describe("totals", () => {
  it("totalsBySource groups gross/net/count", () => {
    const r = totalsBySource([pay({ source: "stripe", gross_cents: 100, net_cents: 90 }),
      pay({ source: "stripe", gross_cents: 100, net_cents: 90 }),
      pay({ source: "paypal", gross_cents: 50, net_cents: 45 })]);
    expect(r.stripe).toEqual({ grossCents: 200, netCents: 180, count: 2 });
    expect(r.paypal).toEqual({ grossCents: 50, netCents: 45, count: 1 });
  });
  it("totalsByGoal groups by objetivo", () => {
    const r = totalsByGoal([pay({ goal: "operacion_general", net_cents: 10 }),
      pay({ goal: "compras_solidarias", net_cents: 20 })]);
    expect(r.operacion_general.netCents).toBe(10);
    expect(r.compras_solidarias.netCents).toBe(20);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- metrics`
Expected: FAIL (cannot resolve `@/lib/metrics`).

- [ ] **Step 3: Write `src/lib/metrics.ts`**

```ts
import type { DonationSource, PledgeKind, PledgeStatus, DonationGoal } from "@/types";

export type MetricPledge = {
  id: string; donor_id: string; source: DonationSource; kind: PledgeKind; status: PledgeStatus;
  goal: DonationGoal | null; monthly_net_cents: number | null; monthly_gross_cents: number | null;
  subscription_date: string | null; cancelled_at: string | null;
};
export type MetricPayment = {
  donor_id: string; source: DonationSource; period_month: string;
  gross_cents: number; net_cents: number; goal: DonationGoal | null;
};

export function monthsBetween(a: Date, b: Date): number {
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
}

export function activeMrrCents(pledges: MetricPledge[]): { netCents: number; grossCents: number } {
  let netCents = 0, grossCents = 0;
  for (const p of pledges) {
    if (p.kind === "recurring" && p.status === "active") {
      netCents += p.monthly_net_cents ?? 0;
      grossCents += p.monthly_gross_cents ?? 0;
    }
  }
  return { netCents, grossCents };
}

export function classifyDonor(
  pledges: MetricPledge[], payments: MetricPayment[], asOf: Date, lapsedAfterMonths: number
): "active" | "lapsed" | "cancelled" | "one_time_only" {
  const recurring = pledges.filter((p) => p.kind === "recurring");
  if (recurring.length === 0) return "one_time_only";
  const live = recurring.filter((p) => p.status !== "cancelled");
  if (live.length === 0) return "cancelled";
  const lastPayment = payments.reduce<Date | null>((acc, p) => {
    const d = new Date(p.period_month);
    return acc === null || d > acc ? d : acc;
  }, null);
  if (lastPayment === null) return "lapsed";
  return monthsBetween(lastPayment, asOf) <= lapsedAfterMonths ? "active" : "lapsed";
}

function group(payments: MetricPayment[], keyOf: (p: MetricPayment) => string) {
  const out: Record<string, { grossCents: number; netCents: number; count: number }> = {};
  for (const p of payments) {
    const k = keyOf(p);
    const row = out[k] ?? { grossCents: 0, netCents: 0, count: 0 };
    row.grossCents += p.gross_cents; row.netCents += p.net_cents; row.count += 1;
    out[k] = row;
  }
  return out;
}
export function totalsBySource(payments: MetricPayment[]) { return group(payments, (p) => p.source); }
export function totalsByGoal(payments: MetricPayment[]) { return group(payments, (p) => p.goal ?? "sin_objetivo"); }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- metrics`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/metrics.ts src/lib/__tests__/metrics.test.ts
git commit -m "feat(core): donor-understanding metrics (MRR, classify, totals) with tests"
```

---

### Task 6: `donor-dashboard.ts` — dashboard aggregation (pure, TDD)

**Files:**
- Create: `src/lib/donor-dashboard.ts`
- Test: `src/lib/__tests__/donor-dashboard.test.ts`

**Interfaces:**
- Consumes: `MetricPledge`, `MetricPayment`, `activeMrrCents`, `classifyDonor`, `totalsBySource`, `totalsByGoal`, `monthsBetween` from `@/lib/metrics`.
- Produces: `type DonorDashboard = { mrr: { netCents: number; grossCents: number }; donorCounts: { active: number; lapsed: number; cancelled: number; one_time_only: number; total: number }; totalRaisedCents: number; ytdRaisedCents: number; bySource: Record<string, { grossCents: number; netCents: number; count: number }>; byGoal: Record<string, { grossCents: number; netCents: number; count: number }> }`; `buildDonorDashboard(input: { pledges: MetricPledge[]; payments: MetricPayment[] }, asOf: Date, lapsedAfterMonths: number): DonorDashboard`.

- [ ] **Step 1: Write the failing test** (`src/lib/__tests__/donor-dashboard.test.ts`):

```ts
import { describe, it, expect } from "vitest";
import { buildDonorDashboard } from "@/lib/donor-dashboard";
import type { MetricPledge, MetricPayment } from "@/lib/metrics";

const asOf = new Date("2026-06-15T00:00:00Z");

const pledges: MetricPledge[] = [
  { id: "p1", donor_id: "A", source: "stripe", kind: "recurring", status: "active", goal: "operacion_general",
    monthly_net_cents: 2500, monthly_gross_cents: 2601, subscription_date: "2025-01-01", cancelled_at: null },
  { id: "p2", donor_id: "B", source: "paypal", kind: "recurring", status: "cancelled", goal: "compras_solidarias",
    monthly_net_cents: 5000, monthly_gross_cents: 5152, subscription_date: "2024-01-01", cancelled_at: "2026-02-01" },
  { id: "p3", donor_id: "C", source: "special", kind: "one_time", status: "active", goal: "operacion_general",
    monthly_net_cents: null, monthly_gross_cents: null, subscription_date: "2025-12-08", cancelled_at: null },
];
const payments: MetricPayment[] = [
  { donor_id: "A", source: "stripe", period_month: "2026-06-01", gross_cents: 2601, net_cents: 2500, goal: "operacion_general" },
  { donor_id: "A", source: "stripe", period_month: "2026-01-01", gross_cents: 2601, net_cents: 2500, goal: "operacion_general" },
  { donor_id: "B", source: "paypal", period_month: "2026-01-01", gross_cents: 5152, net_cents: 5000, goal: "compras_solidarias" },
  { donor_id: "C", source: "special", period_month: "2025-12-01", gross_cents: 200000, net_cents: 195971, goal: "operacion_general" },
];

describe("buildDonorDashboard", () => {
  const d = buildDonorDashboard({ pledges, payments }, asOf, 2);
  it("MRR counts only active recurring (donor A)", () => {
    expect(d.mrr).toEqual({ netCents: 2500, grossCents: 2601 });
  });
  it("classifies each donor", () => {
    expect(d.donorCounts.active).toBe(1);          // A
    expect(d.donorCounts.cancelled).toBe(1);       // B
    expect(d.donorCounts.one_time_only).toBe(1);   // C
    expect(d.donorCounts.total).toBe(3);
  });
  it("total raised sums all payments; YTD sums asOf-year payments", () => {
    expect(d.totalRaisedCents).toBe(2500 + 2500 + 5000 + 195971);
    expect(d.ytdRaisedCents).toBe(2500 + 2500 + 5000); // 2026 net only
  });
  it("breaks down by source and goal", () => {
    expect(d.bySource.stripe.count).toBe(2);
    expect(d.byGoal.operacion_general.count).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- donor-dashboard`
Expected: FAIL (cannot resolve `@/lib/donor-dashboard`).

- [ ] **Step 3: Write `src/lib/donor-dashboard.ts`**

```ts
import {
  activeMrrCents, classifyDonor, totalsBySource, totalsByGoal,
  type MetricPledge, type MetricPayment,
} from "@/lib/metrics";

export type DonorDashboard = {
  mrr: { netCents: number; grossCents: number };
  donorCounts: { active: number; lapsed: number; cancelled: number; one_time_only: number; total: number };
  totalRaisedCents: number;
  ytdRaisedCents: number;
  bySource: Record<string, { grossCents: number; netCents: number; count: number }>;
  byGoal: Record<string, { grossCents: number; netCents: number; count: number }>;
};

export function buildDonorDashboard(
  input: { pledges: MetricPledge[]; payments: MetricPayment[] },
  asOf: Date,
  lapsedAfterMonths: number
): DonorDashboard {
  const { pledges, payments } = input;

  // group pledges + payments by donor for classification
  const donorIds = new Set<string>([...pledges.map((p) => p.donor_id), ...payments.map((p) => p.donor_id)]);
  const counts = { active: 0, lapsed: 0, cancelled: 0, one_time_only: 0, total: 0 };
  for (const id of donorIds) {
    const dp = pledges.filter((p) => p.donor_id === id);
    const dpay = payments.filter((p) => p.donor_id === id);
    counts[classifyDonor(dp, dpay, asOf, lapsedAfterMonths)] += 1;
    counts.total += 1;
  }

  const asOfYear = asOf.getUTCFullYear();
  let totalRaisedCents = 0, ytdRaisedCents = 0;
  for (const p of payments) {
    totalRaisedCents += p.net_cents;
    if (new Date(p.period_month).getUTCFullYear() === asOfYear) ytdRaisedCents += p.net_cents;
  }

  return {
    mrr: activeMrrCents(pledges),
    donorCounts: counts,
    totalRaisedCents,
    ytdRaisedCents,
    bySource: totalsBySource(payments),
    byGoal: totalsByGoal(payments),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- donor-dashboard`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/donor-dashboard.ts src/lib/__tests__/donor-dashboard.test.ts
git commit -m "feat(core): donor dashboard aggregation with tests"
```

---

### Task 7: Ingest core — normalized types + idempotency keys (pure, TDD)

**Files:**
- Create: `src/lib/ingest/types.ts`, `src/lib/ingest/idempotency.ts`
- Test: `src/lib/__tests__/idempotency.test.ts`

**Interfaces:**
- Produces (`types.ts`):
  - `type NormalizedDonor = { email: string | null; name: string; phone: string | null; address?: string | null; countryRegion?: string | null }`
  - `type NormalizedPledge = { source: DonationSource; kind: PledgeKind; status: PledgeStatus; goal: DonationGoal | null; monthlyGrossCents: number | null; feeCents: number; monthlyNetCents: number | null; subscriptionDate: string | null; sourceYear: number | null; externalRef: string | null }`
  - `type NormalizedPayment = { source: DonationSource; periodMonth: string; grossCents: number; feeCents: number; netCents: number; goal: DonationGoal | null; externalRef: string | null }`
  - `type NormalizedRecord = { donor: NormalizedDonor; pledge: NormalizedPledge | null; payments: NormalizedPayment[] }`
  - `interface Importer { id: string; source: DonationSource; parse(file: ArrayBuffer | string): NormalizedRecord[] }`
- Produces (`idempotency.ts`): `paymentIdempotencyKey(p: { source: DonationSource; externalRef: string | null; donorEmailOrName: string; periodMonth: string; grossCents: number }): string`.

- [ ] **Step 1: Write the failing test** (`src/lib/__tests__/idempotency.test.ts`):

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- idempotency`
Expected: FAIL (cannot resolve `@/lib/ingest/idempotency`).

- [ ] **Step 3: Write `src/lib/ingest/types.ts`**

```ts
import type { DonationSource, PledgeKind, PledgeStatus, DonationGoal } from "@/types";

export type NormalizedDonor = {
  email: string | null; name: string; phone: string | null;
  address?: string | null; countryRegion?: string | null;
};
export type NormalizedPledge = {
  source: DonationSource; kind: PledgeKind; status: PledgeStatus; goal: DonationGoal | null;
  monthlyGrossCents: number | null; feeCents: number; monthlyNetCents: number | null;
  subscriptionDate: string | null; sourceYear: number | null; externalRef: string | null;
};
export type NormalizedPayment = {
  source: DonationSource; periodMonth: string; grossCents: number; feeCents: number;
  netCents: number; goal: DonationGoal | null; externalRef: string | null;
};
export type NormalizedRecord = {
  donor: NormalizedDonor; pledge: NormalizedPledge | null; payments: NormalizedPayment[];
};

export interface Importer {
  id: string;
  source: DonationSource;
  parse(file: ArrayBuffer | string): NormalizedRecord[];
}
```

- [ ] **Step 4: Write `src/lib/ingest/idempotency.ts`**

```ts
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- idempotency`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ingest/types.ts src/lib/ingest/idempotency.ts src/lib/__tests__/idempotency.test.ts
git commit -m "feat(ingest): normalized record types + payment idempotency key with tests"
```

---

### Task 8: Ingest core — `planImport` normalize→plan engine (pure, TDD)

**Files:**
- Create: `src/lib/ingest/commit.ts`
- Test: `src/lib/__tests__/commit.test.ts`

**Interfaces:**
- Consumes: `NormalizedRecord` (Task 7 `types.ts`); `DonorIndex`, `matchDonor`, `normalizeEmail`, `normalizeName` (Task 4 `donor-match.ts`); `paymentIdempotencyKey` (Task 7).
- Produces:
  - `type PlannedDonor = { tempId: string; donor: NormalizedDonor }` (new donors to create)
  - `type PlannedPayment = { donorRef: string; pledgeRef: string | null; payment: NormalizedPayment; idempotencyKey: string }` (`donorRef` is an existing donor id OR a `PlannedDonor.tempId`)
  - `type ImportPlan = { donorsToCreate: PlannedDonor[]; pledgesToCreate: { donorRef: string; pledge: NormalizedPledge }[]; paymentsToInsert: PlannedPayment[]; skippedPayments: number; possibleDuplicates: { name: string; reason: string }[]; counts: { records: number; newDonors: number; matchedDonors: number; newPledges: number; payments: number; skipped: number } }`
  - `planImport(records: NormalizedRecord[], ctx: { donorIndex: DonorIndex; existingPaymentKeys: Set<string> }): ImportPlan`

- [ ] **Step 1: Write the failing test** (`src/lib/__tests__/commit.test.ts`):

```ts
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- commit`
Expected: FAIL (cannot resolve `@/lib/ingest/commit`).

- [ ] **Step 3: Write `src/lib/ingest/commit.ts`**

```ts
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

// donorEmailOrName for the fallback idempotency key + new-donor identity.
function donorKey(d: NormalizedDonor): string {
  return normalizeEmail(d.email) ?? normalizeName(d.name);
}

export function planImport(
  records: NormalizedRecord[],
  ctx: { donorIndex: DonorIndex; existingPaymentKeys: Set<string> }
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

  records.forEach((record, i) => {
    const key = donorKey(record.donor);
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

    if (record.pledge) pledgesToCreate.push({ donorRef, pledge: record.pledge });

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- commit`
Expected: PASS.

- [ ] **Step 5: Run the full suite + build**

Run: `npm run lint && npm test && npm run build`
Expected: all PASS (suites: admin-session, money, donor-match, metrics, donor-dashboard, idempotency, commit).

- [ ] **Step 6: Commit**

```bash
git add src/lib/ingest/commit.ts src/lib/__tests__/commit.test.ts
git commit -m "feat(ingest): pure planImport normalize->plan engine with idempotent dedupe + tests"
```

---

## Milestone 1 complete

Deliverable: a clean-building `cam-donaciones` shell with a working admin gate, the full donor/pledge/payment schema + RLS + types, and a fully unit-tested pure domain core (money, donor matching, donor metrics, dashboard aggregation, ingest types/idempotency/planImport). No DB applied, no UI yet.

**Milestone 2 (planned next):** the legacy `.xlsx` importer (`legacy-month-columns.ts`) + per-source column mapping, vendor CSV importers (stripe/paypal), the manual CAM cash form, `src/actions/imports.ts` (`commitImport` writing via service-role), `src/actions/metrics.ts` + `donors.ts`, and the UI (`/import` dry-run+commit, `/panel` dashboard, `/donantes` list + `/donantes/[id]` timeline + duplicate review). Then apply migrations to Supabase, import the real `Plan de Apoyo Mensual TODO.xlsx`, reconcile totals, and deploy to Netlify.
