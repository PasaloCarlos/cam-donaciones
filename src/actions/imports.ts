"use server";

import { randomUUID } from "node:crypto";
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
  const [{ data: donors }, { data: payKeys }, { data: pledges }] = await Promise.all([
    supabase.from("donors").select("id, email_normalized, name_normalized, phone_normalized"),
    supabase.from("payments").select("idempotency_key"),
    supabase.from("pledges").select("donor_id, source, source_year"),
  ]);
  return {
    donorIndex: buildDonorIndex(donors ?? []),
    existingPaymentKeys: new Set<string>((payKeys ?? []).map((k) => k.idempotency_key as string)),
    existingPledgeKeys: new Set<string>(
      (pledges ?? []).map((p) => `${p.donor_id}|${p.source}|${p.source_year ?? ""}`)
    ),
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
  const rawYear = Number(formData.get("defaultYear"));
  const defaultYear = Number.isFinite(rawYear) && rawYear >= 2000 ? rawYear : new Date().getUTCFullYear();
  const mode = String(formData.get("mode") ?? "preview");
  if (!file) throw new Error("No se recibió un archivo.");

  const buf = await file.arrayBuffer();
  const { records, tabs } = readLegacyWorkbook(buf, defaultYear);

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

export async function submitCashDonation(
  formData: FormData
): Promise<{ committed: true; counts: ImportPlan["counts"] }> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const grossCents = Math.round(Number(formData.get("gross") ?? 0) * 100);
  if (!Number.isFinite(grossCents) || grossCents <= 0) throw new Error("Ingresa un monto válido.");
  const monthInput = String(formData.get("periodMonth") ?? "").trim(); // "YYYY-MM" optional
  const ym = /^\d{4}-\d{2}$/.test(monthInput)
    ? monthInput
    : new Date().toISOString().slice(0, 7);
  const anon = name === "";

  const entry: ManualEntry = {
    source: "cam_cash",
    kind: "one_time",
    goal: null,
    name: anon ? "Donante anónimo (efectivo)" : name,
    email: anon ? "anonimo@efectivo.cam" : null,
    phone: null,
    address: null,
    grossCents,
    feeCents: 0,
    periodMonth: `${ym}-01`,
    subscriptionDate: `${ym}-01`,
  };
  const record = manualEntryToRecord(entry);
  // Unique ref per gift so two identical same-month cash gifts both count (no idempotency collision).
  const ref = randomUUID();
  record.payments = record.payments.map((p) => ({ ...p, externalRef: ref }));

  const supabase = createAdminClient();
  const ctx = await loadIngestContext(supabase);
  const plan = planImport([record], ctx);
  const counts = await writePlan(supabase, plan, {
    importer: "manual",
    source: "cam_cash",
    filename: null,
  });
  return { committed: true, counts };
}
