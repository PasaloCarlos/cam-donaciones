"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-guard";
import { classifyDonor, type MetricPledge, type MetricPayment } from "@/lib/metrics";
import { donorTimeline, type TimelineEntry } from "@/lib/donor-timeline";
import { donor as donorCfg } from "@/config/donor.config";
import { PLEDGE_COLS, PAYMENT_COLS } from "@/lib/query-cols";
import { fetchAllRows } from "@/lib/supabase/page";
import { consolidateSubscriptions } from "@/lib/subscriptions";
import type { Donor } from "@/types";
import type { DonorStatus } from "@/lib/donor-status";

export type { DonorStatus } from "@/lib/donor-status";
export type DonorListItem = {
  id: string; display_name: string; email_normalized: string | null; status: DonorStatus; subscriptionCount: number;
};

export async function listDonors(query?: string, status?: DonorStatus): Promise<DonorListItem[]> {
  await requireAdmin();
  const supabase = createAdminClient();
  const clean = (query ?? "").trim().replace(/[%,]/g, "");
  const donorsRaw = await fetchAllRows<{ id: string; display_name: string; email_normalized: string | null }>(
    (f, t) => {
      let q = supabase.from("donors").select("id, display_name, email_normalized").order("display_name");
      if (clean) q = q.or(`display_name.ilike.%${clean}%,email_normalized.ilike.%${clean}%`);
      return q.range(f, t) as never;
    }
  );
  const list = donorsRaw;
  const ids = list.map((d) => d.id as string);
  if (ids.length === 0) return [];

  const [pledges, payments] = await Promise.all([
    fetchAllRows<MetricPledge>((f, t) => supabase.from("pledges").select(PLEDGE_COLS).in("donor_id", ids).range(f, t) as never),
    fetchAllRows<MetricPayment>((f, t) => supabase.from("payments").select(PAYMENT_COLS).in("donor_id", ids).range(f, t) as never),
  ]);
  const asOf = new Date();

  const result = list.map((d) => {
    const dp = pledges.filter((p) => p.donor_id === d.id);
    const dpay = payments.filter((p) => p.donor_id === d.id);
    return {
      id: d.id as string, display_name: d.display_name as string,
      email_normalized: (d.email_normalized as string | null) ?? null,
      status: classifyDonor(dp, dpay, asOf, donorCfg.lapsedAfterMonths), subscriptionCount: consolidateSubscriptions(dp).length,
    };
  });

  if (status !== undefined) return result.filter((d) => d.status === status);
  return result;
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
