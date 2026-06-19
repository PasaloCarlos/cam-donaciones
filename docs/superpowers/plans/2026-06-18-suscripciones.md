# Suscripciones Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate a donor's per-year recurring pledges into one subscription per source, and rename all "Compromisos" UI labels to "Suscripciones."

**Architecture:** Add a pure helper `consolidateSubscriptions()` in `src/lib/subscriptions.ts` that groups `MetricPledge[]` by source (recurring only) into `SubscriptionGroup[]`, taking amounts/status from the latest-year pledge. Wire it into `DonorListItem.subscriptionCount`, `donor-table.tsx`, and `donor-detail.tsx`. No DB schema change — presentation only.

**Tech Stack:** Next.js 16.2.2, React 19, TypeScript 5, Vitest 4, Supabase, Tailwind CSS 4 / shadcn.

## Global Constraints

- No DB migrations or schema changes — purely a presentation/derived layer
- `one_time` pledges (kind = "one_time") are never subscriptions; show them separately in donor detail
- All monetary values in cents (integers)
- `source_year` field on `MetricPledge` drives year ordering
- `status` / amounts / goal come from the **latest-year** pledge within a source group
- Sort output alphabetically by source
- Spanish copy throughout: "Suscripciones", "Suscripción", "Activa", "Cancelada", "Pausada", "Donativos especiales"
- `npm run lint && npm test && npm run build` must all pass clean
- Branch: `feat/suscripciones`; commit on branch; merge to master with `--no-ff`

---

### Task 1: Create `src/lib/subscriptions.ts` + Vitest tests

**Files:**
- Create: `src/lib/subscriptions.ts`
- Create: `src/lib/__tests__/subscriptions.test.ts`

**Interfaces:**
- Consumes: `MetricPledge` from `@/lib/metrics`; `PledgeStatus` from `@/types`
- Produces:
  ```ts
  export type SubscriptionGroup = {
    source: string;
    firstYear: number | null;
    lastYear: number | null;
    yearCount: number;
    status: PledgeStatus;
    monthlyNetCents: number | null;
    monthlyGrossCents: number | null;
    goal: string | null;
  };
  export function consolidateSubscriptions(pledges: MetricPledge[]): SubscriptionGroup[];
  ```

- [ ] **Step 1: Create git branch**

```bash
cd C:/Users/carlosfigueroa/source/repos/cam-donaciones
git checkout -b feat/suscripciones
```

- [ ] **Step 2: Write failing tests**

Create `src/lib/__tests__/subscriptions.test.ts` with this exact content:

```ts
import { describe, it, expect } from "vitest";
import { consolidateSubscriptions } from "@/lib/subscriptions";
import type { MetricPledge } from "@/lib/metrics";

const base: Omit<MetricPledge, "source_year" | "source" | "kind" | "status" | "monthly_net_cents" | "goal"> = {
  id: "x",
  donor_id: "d1",
  monthly_gross_cents: null,
  subscription_date: null,
  cancelled_at: null,
};

function pledge(overrides: Partial<MetricPledge> & Pick<MetricPledge, "source" | "kind" | "status" | "source_year">): MetricPledge {
  return { ...base, id: Math.random().toString(36).slice(2), monthly_net_cents: null, goal: null, monthly_gross_cents: null, ...overrides };
}

describe("consolidateSubscriptions", () => {
  it("two recurring pledges same source across years → ONE group, latest-year wins", () => {
    const pledges: MetricPledge[] = [
      pledge({ source: "stripe", kind: "recurring", status: "active", source_year: 2025, monthly_net_cents: 2000, goal: "operacion_general" }),
      pledge({ source: "stripe", kind: "recurring", status: "active", source_year: 2026, monthly_net_cents: 2500, goal: "compras_solidarias" }),
    ];
    const groups = consolidateSubscriptions(pledges);
    expect(groups).toHaveLength(1);
    const g = groups[0];
    expect(g.source).toBe("stripe");
    expect(g.firstYear).toBe(2025);
    expect(g.lastYear).toBe(2026);
    expect(g.yearCount).toBe(2);
    expect(g.status).toBe("active");
    expect(g.monthlyNetCents).toBe(2500);          // latest year
    expect(g.goal).toBe("compras_solidarias");     // latest year
  });

  it("different sources → two groups sorted alphabetically", () => {
    const pledges: MetricPledge[] = [
      pledge({ source: "stripe", kind: "recurring", status: "active", source_year: 2025, monthly_net_cents: 1000, goal: null }),
      pledge({ source: "paypal", kind: "recurring", status: "cancelled", source_year: 2025, monthly_net_cents: 500, goal: null }),
    ];
    const groups = consolidateSubscriptions(pledges);
    expect(groups).toHaveLength(2);
    expect(groups[0].source).toBe("paypal");
    expect(groups[1].source).toBe("stripe");
  });

  it("one_time pledges are excluded — donor with only one_time → empty array", () => {
    const pledges: MetricPledge[] = [
      pledge({ source: "special", kind: "one_time", status: "active", source_year: 2025, monthly_net_cents: null, goal: null }),
    ];
    expect(consolidateSubscriptions(pledges)).toHaveLength(0);
  });

  it("mixed kinds: only recurring pledges included in groups", () => {
    const pledges: MetricPledge[] = [
      pledge({ source: "stripe", kind: "recurring", status: "active", source_year: 2025, monthly_net_cents: 1000, goal: null }),
      pledge({ source: "special", kind: "one_time", status: "active", source_year: 2025, monthly_net_cents: null, goal: null }),
    ];
    const groups = consolidateSubscriptions(pledges);
    expect(groups).toHaveLength(1);
    expect(groups[0].source).toBe("stripe");
  });

  it("single recurring pledge → group with firstYear === lastYear, yearCount 1", () => {
    const pledges: MetricPledge[] = [
      pledge({ source: "cam_cash", kind: "recurring", status: "paused", source_year: 2024, monthly_net_cents: 750, goal: "operacion_general" }),
    ];
    const groups = consolidateSubscriptions(pledges);
    expect(groups).toHaveLength(1);
    const g = groups[0];
    expect(g.firstYear).toBe(2024);
    expect(g.lastYear).toBe(2024);
    expect(g.yearCount).toBe(1);
    expect(g.status).toBe("paused");
  });

  it("pledge with null source_year is included, years array treated safely", () => {
    const pledges: MetricPledge[] = [
      pledge({ source: "other", kind: "recurring", status: "active", source_year: null, monthly_net_cents: null, goal: null }),
    ];
    const groups = consolidateSubscriptions(pledges);
    expect(groups).toHaveLength(1);
    expect(groups[0].firstYear).toBeNull();
    expect(groups[0].lastYear).toBeNull();
    expect(groups[0].yearCount).toBe(1);
  });
});
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
cd C:/Users/carlosfigueroa/source/repos/cam-donaciones
npm test -- src/lib/__tests__/subscriptions.test.ts
```

Expected: FAIL with "Cannot find module '@/lib/subscriptions'"

- [ ] **Step 4: Create `src/lib/subscriptions.ts`**

```ts
import type { MetricPledge } from "@/lib/metrics";
import type { PledgeStatus } from "@/types";

export type SubscriptionGroup = {
  source: string;
  firstYear: number | null;
  lastYear: number | null;
  yearCount: number;
  status: PledgeStatus;
  monthlyNetCents: number | null;
  monthlyGrossCents: number | null;
  goal: string | null;
};

/**
 * Consolidate a donor's RECURRING pledges into one subscription per source.
 * A month-by-month continuation across years (one tab per year in the legacy
 * sheet) is treated as ONE subscription. one_time pledges are excluded.
 */
export function consolidateSubscriptions(pledges: MetricPledge[]): SubscriptionGroup[] {
  const bySource = new Map<string, MetricPledge[]>();
  for (const p of pledges) {
    if (p.kind !== "recurring") continue;
    const arr = bySource.get(p.source) ?? [];
    arr.push(p);
    bySource.set(p.source, arr);
  }
  const out: SubscriptionGroup[] = [];
  for (const [source, ps] of bySource) {
    const years = ps.map((p) => p.source_year).filter((y): y is number => y != null);
    const latest = ps.reduce((a, b) => ((b.source_year ?? 0) >= (a.source_year ?? 0) ? b : a));
    out.push({
      source,
      firstYear: years.length ? Math.min(...years) : null,
      lastYear: years.length ? Math.max(...years) : null,
      yearCount: ps.length,
      status: latest.status,
      monthlyNetCents: latest.monthly_net_cents,
      monthlyGrossCents: latest.monthly_gross_cents,
      goal: latest.goal,
    });
  }
  return out.sort((a, b) => a.source.localeCompare(b.source));
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
cd C:/Users/carlosfigueroa/source/repos/cam-donaciones
npm test -- src/lib/__tests__/subscriptions.test.ts
```

Expected: All 6 tests PASS.

- [ ] **Step 6: Commit**

```bash
cd C:/Users/carlosfigueroa/source/repos/cam-donaciones
git add src/lib/subscriptions.ts src/lib/__tests__/subscriptions.test.ts
git commit -m "feat(subscriptions): add consolidateSubscriptions helper + vitest tests"
```

---

### Task 2: Update `src/actions/donors.ts` — rename `pledgeCount` → `subscriptionCount`

**Files:**
- Modify: `src/actions/donors.ts`

**Interfaces:**
- Consumes: `consolidateSubscriptions` from `@/lib/subscriptions`
- Produces: `DonorListItem` with `subscriptionCount: number` (replaces `pledgeCount: number`)

> **Note:** `DonorListItem` is exported — `donor-table.tsx` imports it. Both files change in this task and the next; TypeScript will catch any mismatch at build time.

- [ ] **Step 1: Edit `src/actions/donors.ts`**

Replace the import section at the top of the file. Currently:
```ts
import { classifyDonor, type MetricPledge, type MetricPayment } from "@/lib/metrics";
```
Change to:
```ts
import { classifyDonor, type MetricPledge, type MetricPayment } from "@/lib/metrics";
import { consolidateSubscriptions } from "@/lib/subscriptions";
```

- [ ] **Step 2: Rename `pledgeCount` in `DonorListItem` type**

Currently in `DonorListItem`:
```ts
export type DonorListItem = {
  id: string; display_name: string; email_normalized: string | null; status: DonorStatus; pledgeCount: number;
};
```
Change to:
```ts
export type DonorListItem = {
  id: string; display_name: string; email_normalized: string | null; status: DonorStatus; subscriptionCount: number;
};
```

- [ ] **Step 3: Replace `pledgeCount: dp.length` with `subscriptionCount`**

Currently in `listDonors` return statement:
```ts
      status: classifyDonor(dp, dpay, asOf, donorCfg.lapsedAfterMonths), pledgeCount: dp.length,
```
Change to:
```ts
      status: classifyDonor(dp, dpay, asOf, donorCfg.lapsedAfterMonths), subscriptionCount: consolidateSubscriptions(dp).length,
```

- [ ] **Step 4: Verify TypeScript compiles (type-check only)**

```bash
cd C:/Users/carlosfigueroa/source/repos/cam-donaciones
npx tsc --noEmit 2>&1 | head -40
```

Expected: Errors only about `pledgeCount` in `donor-table.tsx` (which is the next task). No errors inside `donors.ts` or `subscriptions.ts`.

- [ ] **Step 5: Commit**

```bash
cd C:/Users/carlosfigueroa/source/repos/cam-donaciones
git add src/actions/donors.ts
git commit -m "feat(donors): rename pledgeCount→subscriptionCount via consolidateSubscriptions"
```

---

### Task 3: Update `src/components/donantes/donor-table.tsx` — "Compromisos" → "Suscripciones"

**Files:**
- Modify: `src/components/donantes/donor-table.tsx`

**Interfaces:**
- Consumes: `DonorListItem` with `subscriptionCount` (from Task 2)

- [ ] **Step 1: Replace mobile card text**

Currently:
```tsx
                  <span className="text-xs text-muted-foreground tabular-nums">{d.pledgeCount} compromisos</span>
```
Change to:
```tsx
                  <span className="text-xs text-muted-foreground tabular-nums">{d.subscriptionCount} suscripciones</span>
```

- [ ] **Step 2: Replace desktop table column header**

Currently:
```tsx
                <tr><th className="px-4 py-3">Donante</th><th className="px-3 py-3">Estado</th><th className="px-3 py-3 text-right">Compromisos</th></tr>
```
Change to:
```tsx
                <tr><th className="px-4 py-3">Donante</th><th className="px-3 py-3">Estado</th><th className="px-3 py-3 text-right">Suscripciones</th></tr>
```

- [ ] **Step 3: Replace desktop table cell**

Currently:
```tsx
                    <td className="px-3 py-3 text-right tabular-nums">{d.pledgeCount}</td>
```
Change to:
```tsx
                    <td className="px-3 py-3 text-right tabular-nums">{d.subscriptionCount}</td>
```

- [ ] **Step 4: Run full test suite + lint**

```bash
cd C:/Users/carlosfigueroa/source/repos/cam-donaciones
npm run lint && npm test
```

Expected: Lint passes. All tests pass (existing 62 + new 6 = 68 total).

- [ ] **Step 5: Commit**

```bash
cd C:/Users/carlosfigueroa/source/repos/cam-donaciones
git add src/components/donantes/donor-table.tsx
git commit -m "feat(donor-table): rename Compromisos→Suscripciones, pledgeCount→subscriptionCount"
```

---

### Task 4: Update `src/components/donantes/donor-detail.tsx` — "Suscripciones" section + "Donativos especiales"

**Files:**
- Modify: `src/components/donantes/donor-detail.tsx`

**Interfaces:**
- Consumes: `consolidateSubscriptions` from `@/lib/subscriptions`; `SubscriptionGroup` from `@/lib/subscriptions`
- The `pledges` prop is already `MetricPledge[]` via `DonorDetail` from `@/actions/donors`

The existing `PLEDGE_STATUS` map and `SRC`/`GOAL` maps can be reused. Add a new `STATUS_ES` map for subscription statuses.

- [ ] **Step 1: Add import for `consolidateSubscriptions` + `SubscriptionGroup`**

At the top of `src/components/donantes/donor-detail.tsx`, after the existing imports, add:
```ts
import { consolidateSubscriptions, type SubscriptionGroup } from "@/lib/subscriptions";
```

- [ ] **Step 2: Replace the entire `<section>` for "Compromisos" with the new "Suscripciones" + "Donativos especiales" sections**

Find and replace the existing section:
```tsx
      <section>
        <h2 className="mb-3 font-display text-xs uppercase tracking-widest text-muted-foreground">Compromisos ({pledges.length})</h2>
        <div className="space-y-2">
          {pledges.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card/60 px-4 py-3 text-sm">
              <span className="font-medium text-foreground">{SRC[p.source] ?? p.source}</span>
              <span className="text-muted-foreground">{p.kind === "recurring" ? "Mensual" : "Único"} · {PLEDGE_STATUS[p.status] ?? p.status}{p.goal ? ` · ${GOAL[p.goal] ?? p.goal}` : ""}</span>
              <span className="tabular-nums text-foreground">{p.monthly_net_cents != null ? `${formatCents(p.monthly_net_cents, cfg.currency)}/mes` : "—"}</span>
            </div>
          ))}
        </div>
      </section>
```

Replace with:

```tsx
      {/* ── Suscripciones ─────────────────────────────────────── */}
      {(() => {
        const groups: SubscriptionGroup[] = consolidateSubscriptions(pledges);
        const STATUS_ES: Record<string, string> = { active: "Activa", cancelled: "Cancelada", paused: "Pausada" };
        const yearSpan = (g: SubscriptionGroup) => {
          if (g.firstYear == null) return null;
          return g.firstYear === g.lastYear ? String(g.firstYear) : `${g.firstYear}–${g.lastYear}`;
        };
        return (
          <section>
            <h2 className="mb-3 font-display text-xs uppercase tracking-widest text-muted-foreground">
              Suscripciones ({groups.length})
            </h2>
            <div className="space-y-2">
              {groups.map((g) => (
                <div key={g.source} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card/60 px-4 py-3 text-sm">
                  <span className="font-medium text-foreground">{SRC[g.source] ?? g.source}</span>
                  <span className="text-muted-foreground">
                    {yearSpan(g) ? `${yearSpan(g)} · ` : ""}{STATUS_ES[g.status] ?? g.status}
                    {g.goal ? ` · ${GOAL[g.goal] ?? g.goal}` : ""}
                  </span>
                  <span className="tabular-nums text-foreground">
                    {g.monthlyNetCents != null ? `${formatCents(g.monthlyNetCents, cfg.currency)}/mes` : "—"}
                  </span>
                </div>
              ))}
            </div>
          </section>
        );
      })()}

      {/* ── Donativos especiales ────────────────────────────────── */}
      {(() => {
        const oneTime = pledges.filter((p) => p.kind === "one_time");
        if (oneTime.length === 0) return null;
        return (
          <section>
            <h2 className="mb-3 font-display text-xs uppercase tracking-widest text-muted-foreground">
              Donativos especiales ({oneTime.length})
            </h2>
            <div className="space-y-2">
              {oneTime.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card/60 px-4 py-3 text-sm">
                  <span className="font-medium text-foreground">{SRC[p.source] ?? p.source}</span>
                  <span className="text-muted-foreground">{p.goal ? (GOAL[p.goal] ?? p.goal) : "sin objetivo"}</span>
                  <span className="tabular-nums text-foreground">
                    {p.monthly_net_cents != null ? `${formatCents(p.monthly_net_cents, cfg.currency)}` : "—"}
                  </span>
                </div>
              ))}
            </div>
          </section>
        );
      })()}
```

- [ ] **Step 3: Remove now-unused `PLEDGE_STATUS` constant (if no longer used anywhere in the file)**

Check if `PLEDGE_STATUS` is referenced anywhere after the edit. If not used, remove it:
```ts
const PLEDGE_STATUS: Record<string, string> = { active: "Activo", cancelled: "Cancelado", paused: "Pausado" };
```
(Delete this line if unused — it will cause a lint "no-unused-vars" warning if left.)

- [ ] **Step 4: Run full test suite, lint, and build**

```bash
cd C:/Users/carlosfigueroa/source/repos/cam-donaciones
npm run lint && npm test && npm run build
```

Expected:
- Lint: 0 errors, 0 warnings
- Tests: 68 passes (62 existing + 6 new subscriptions tests)
- Build: exits 0 (Next.js webpack build succeeds)

- [ ] **Step 5: Commit**

```bash
cd C:/Users/carlosfigueroa/source/repos/cam-donaciones
git add src/components/donantes/donor-detail.tsx
git commit -m "feat(donor-detail): replace Compromisos with Suscripciones + Donativos especiales sections"
```

---

### Task 5: Merge to master, write report

**Files:**
- No source changes — merge + report only

- [ ] **Step 1: Verify all tests + build one final time on the feature branch**

```bash
cd C:/Users/carlosfigueroa/source/repos/cam-donaciones
npm run lint && npm test && npm run build
```

Expected: lint clean, all tests pass, build succeeds.

- [ ] **Step 2: Merge feature branch to master with --no-ff**

```bash
cd C:/Users/carlosfigueroa/source/repos/cam-donaciones
git checkout master
git merge --no-ff feat/suscripciones -m "merge: Suscripciones consolidation + rename"
```

- [ ] **Step 3: Delete the feature branch**

```bash
cd C:/Users/carlosfigueroa/source/repos/cam-donaciones
git branch -d feat/suscripciones
```

- [ ] **Step 4: Record the commit SHAs**

```bash
cd C:/Users/carlosfigueroa/source/repos/cam-donaciones
git log --oneline -6
```

Note the feature commit SHAs and the merge commit SHA.

- [ ] **Step 5: Write report to `.git/sdd/suscripciones-report.md`**

```bash
mkdir -p C:/Users/carlosfigueroa/source/repos/cam-donaciones/.git/sdd
```

Write the file `C:/Users/carlosfigueroa/source/repos/cam-donaciones/.git/sdd/suscripciones-report.md` with content:

```markdown
# Suscripciones Implementation Report

**Status:** Complete
**Feature commit SHA:** <SHA from git log>
**Merge commit SHA:** <SHA from git log>
**Test count:** 68 (62 existing + 6 new)
**Lint:** Clean
**Build:** Clean

## Files changed
- **Created** `src/lib/subscriptions.ts` — `consolidateSubscriptions()` helper, groups recurring pledges by source, latest-year wins for status/amounts/goal
- **Created** `src/lib/__tests__/subscriptions.test.ts` — 6 vitest tests covering cross-year merge, multi-source sort, one_time exclusion, null source_year, mixed kinds
- **Modified** `src/actions/donors.ts` — added `consolidateSubscriptions` import; renamed `pledgeCount→subscriptionCount` in `DonorListItem`; compute via `consolidateSubscriptions(dp).length`
- **Modified** `src/components/donantes/donor-table.tsx` — column header "Compromisos"→"Suscripciones"; cell `pledgeCount`→`subscriptionCount`; mobile card "compromisos"→"suscripciones"
- **Modified** `src/components/donantes/donor-detail.tsx` — replaced "Compromisos" section with "Suscripciones" (grouped by source, year span, latest-year amount) + "Donativos especiales" section (one_time pledges, hidden when empty)

**Report path:** `.git/sdd/suscripciones-report.md`
```
