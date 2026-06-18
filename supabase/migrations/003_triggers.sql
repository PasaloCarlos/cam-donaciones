create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger on_donor_update
  before update on public.donors
  for each row execute function public.update_updated_at();

create trigger on_pledge_update
  before update on public.pledges
  for each row execute function public.update_updated_at();
