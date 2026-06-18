"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-guard";
import { buildDonorDashboard, type DonorDashboard } from "@/lib/donor-dashboard";
import { donor } from "@/config/donor.config";
import type { MetricPledge, MetricPayment } from "@/lib/metrics";
import { PLEDGE_COLS, PAYMENT_COLS } from "@/lib/query-cols";
import { fetchAllRows } from "@/lib/supabase/page";

export async function getDonorDashboard(asOfISO?: string): Promise<DonorDashboard> {
  await requireAdmin();
  const supabase = createAdminClient();
  const [pledges, payments] = await Promise.all([
    fetchAllRows<MetricPledge>((f, t) => supabase.from("pledges").select(PLEDGE_COLS).range(f, t) as never),
    fetchAllRows<MetricPayment>((f, t) => supabase.from("payments").select(PAYMENT_COLS).range(f, t) as never),
  ]);
  const asOf = asOfISO ? new Date(asOfISO) : new Date();
  return buildDonorDashboard(
    { pledges, payments },
    asOf,
    donor.lapsedAfterMonths
  );
}
