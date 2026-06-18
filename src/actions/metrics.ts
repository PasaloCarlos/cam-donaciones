"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-guard";
import { buildDonorDashboard, type DonorDashboard } from "@/lib/donor-dashboard";
import { donor } from "@/config/donor.config";
import type { MetricPledge, MetricPayment } from "@/lib/metrics";
import { PLEDGE_COLS, PAYMENT_COLS } from "@/lib/query-cols";

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

