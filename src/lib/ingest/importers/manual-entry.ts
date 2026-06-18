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
