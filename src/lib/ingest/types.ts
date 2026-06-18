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
