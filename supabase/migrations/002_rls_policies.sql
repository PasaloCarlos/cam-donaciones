-- All tables hold PII/financial data -> RLS enabled with ZERO anon policies
-- (deny-all). The service-role client used by Server Actions bypasses RLS.
alter table public.donors         enable row level security;
alter table public.pledges        enable row level security;
alter table public.payments       enable row level security;
alter table public.import_batches enable row level security;
