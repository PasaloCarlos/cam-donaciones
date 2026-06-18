"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-guard";
import { classifyDonor, type MetricPledge, type MetricPayment } from "@/lib/metrics";
import { donorTimeline, type TimelineEntry } from "@/lib/donor-timeline";
import { donor as donorCfg } from "@/config/donor.config";
import { PLEDGE_COLS, PAYMENT_COLS } from "@/lib/query-cols";
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
