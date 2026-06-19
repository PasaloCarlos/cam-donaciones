export const DONOR_STATUSES = ["active", "lapsed", "cancelled", "one_time_only"] as const;
export type DonorStatus = (typeof DONOR_STATUSES)[number];
