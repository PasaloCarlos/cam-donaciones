// Shared Supabase column selectors used by multiple server actions.
export const PLEDGE_COLS = "id, donor_id, source, kind, status, goal, monthly_net_cents, monthly_gross_cents, subscription_date, cancelled_at, source_year";
export const PAYMENT_COLS = "donor_id, source, period_month, gross_cents, net_cents, goal";
