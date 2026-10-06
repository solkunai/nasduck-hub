-- Live $NASDUCK/USD price for dollar-pegged mint pricing. The nasducks-mint
-- function samples Jupiter at most every ~15s (one caller per window, via
-- claim_price_refresh) and checks each quote against the recent median, so a
-- sudden spike or bad reading pauses minting instead of mispricing it.
create table public.nasduck_price_samples (
  id bigint generated always as identity primary key,
  usd numeric not null check (usd > 0),
  sampled_at timestamptz not null default now()
);
create index nasduck_price_samples_sampled_at on public.nasduck_price_samples (sampled_at desc);

create table public.nasduck_price_refresh (
  id smallint primary key default 1 check (id = 1),
  claimed_at timestamptz
);
insert into public.nasduck_price_refresh (id) values (1);

-- Service role only: no policies.
alter table public.nasduck_price_samples enable row level security;
alter table public.nasduck_price_refresh enable row level security;

create or replace function public.claim_price_refresh(p_min_gap_seconds integer)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with claimed as (
    update public.nasduck_price_refresh
       set claimed_at = now()
     where id = 1
       and (claimed_at is null or claimed_at < now() - make_interval(secs => p_min_gap_seconds))
    returning 1
  )
  select exists (select 1 from claimed);
$$;

revoke all on function public.claim_price_refresh(integer) from public, anon, authenticated;
grant execute on function public.claim_price_refresh(integer) to service_role;
