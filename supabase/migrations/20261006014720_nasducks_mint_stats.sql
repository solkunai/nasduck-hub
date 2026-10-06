-- Cached, public snapshot of the NasDucks mint (supply / minted / prices).
-- The nasducks-mint function refreshes it from chain at most every few
-- seconds no matter how many people are watching; pages read it directly and
-- get changes pushed via Realtime, so visitor count never multiplies RPC use.
create table public.nasducks_mint_stats (
  id smallint primary key default 1 check (id = 1),
  cluster text not null,
  supply integer not null,
  minted integer not null,
  public_remaining integer not null,
  otc_open boolean not null,
  otc_remaining integer not null,
  price_mint text,
  price_decimals smallint,
  price_public text,
  price_otc text,
  refreshed_at timestamptz not null default now(),
  refresh_claimed_at timestamptz
);

alter table public.nasducks_mint_stats enable row level security;

-- Everything in this row is already public on-chain.
create policy "nasducks_mint_stats_public_read" on public.nasducks_mint_stats for select using (true);
grant select on public.nasducks_mint_stats to anon, authenticated;
-- No insert/update policy: only the function (service role) writes.

alter publication supabase_realtime add table public.nasducks_mint_stats;

-- Lets exactly one caller per window do the chain refresh; everyone else is
-- served the cached row. Returns true if the caller won the claim.
create or replace function public.claim_mint_stats_refresh(p_min_gap_seconds integer)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with claimed as (
    update public.nasducks_mint_stats
       set refresh_claimed_at = now()
     where id = 1
       and (refresh_claimed_at is null or refresh_claimed_at < now() - make_interval(secs => p_min_gap_seconds))
    returning 1
  )
  select exists (select 1 from claimed);
$$;

revoke all on function public.claim_mint_stats_refresh(integer) from public, anon, authenticated;
grant execute on function public.claim_mint_stats_refresh(integer) to service_role;
