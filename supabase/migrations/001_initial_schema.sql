-- ============================================================
-- CAM DONACIONES — core schema (donors / pledges / payments)
-- Money is integer cents. PII + financial -> RLS deny-all (see 002).
-- ============================================================
create type donation_source as enum ('cam_cash','paypal','stripe','special','other');
create type pledge_status   as enum ('active','cancelled','paused');
create type pledge_kind     as enum ('recurring','one_time');
create type donation_goal   as enum ('operacion_general','compras_solidarias');

create table public.donors (
  id               uuid primary key default gen_random_uuid(),
  email_normalized text,
  display_name     text not null,
  name_normalized  text not null,
  phone_normalized text,
  address          text,
  country_region   text,
  notes            text,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);
create unique index uq_donors_email on public.donors(email_normalized) where email_normalized is not null;
create index idx_donors_name  on public.donors(name_normalized);
create index idx_donors_phone on public.donors(phone_normalized);

create table public.import_batches (
  id                uuid primary key default gen_random_uuid(),
  source            donation_source not null,
  importer          text not null,
  filename          text,
  file_hash         text,
  row_count         int default 0,
  created_donors    int default 0,
  created_pledges   int default 0,
  inserted_payments int default 0,
  skipped_payments  int default 0,
  notes             text,
  created_by        text,
  created_at        timestamptz default now()
);

create table public.pledges (
  id                  uuid primary key default gen_random_uuid(),
  donor_id            uuid not null references public.donors(id) on delete cascade,
  source              donation_source not null,
  kind                pledge_kind not null default 'recurring',
  status              pledge_status not null default 'active',
  goal                donation_goal,
  monthly_gross_cents bigint,
  fee_cents           bigint default 0,
  monthly_net_cents   bigint,
  subscription_date   date,
  cancelled_at        date,
  source_year         int,
  external_ref        text,
  import_batch_id     uuid references public.import_batches(id) on delete set null,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);
create index idx_pledges_donor  on public.pledges(donor_id);
create index idx_pledges_status on public.pledges(status);
create index idx_pledges_source on public.pledges(source);

create table public.payments (
  id              uuid primary key default gen_random_uuid(),
  donor_id        uuid not null references public.donors(id) on delete cascade,
  pledge_id       uuid references public.pledges(id) on delete set null,
  source          donation_source not null,
  period_month    date not null,
  gross_cents     bigint not null,
  fee_cents       bigint not null default 0,
  net_cents       bigint not null,
  goal            donation_goal,
  external_ref    text,
  idempotency_key text not null,
  import_batch_id uuid references public.import_batches(id) on delete set null,
  created_at      timestamptz default now()
);
create unique index uq_payments_idem  on public.payments(idempotency_key);
create index idx_payments_donor  on public.payments(donor_id);
create index idx_payments_pledge on public.payments(pledge_id);
create index idx_payments_period on public.payments(period_month);
create index idx_payments_source on public.payments(source);
