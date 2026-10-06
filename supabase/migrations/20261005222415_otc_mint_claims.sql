-- One $2 NasDucks mint per OTC Desk NFT, ever. Each row is one OTC Desk
-- asset that has been used (or is reserved for an in-flight mint), so the
-- primary key alone makes double-claiming the same desk impossible — even
-- across wallets, and even with simultaneous requests.
create table if not exists public.otc_mint_claims (
  otc_asset text primary key,
  wallet text not null,
  -- Shared by every asset reserved for the same mint transaction; written
  -- into that transaction's memo so its on-chain outcome can be verified.
  reservation_id uuid not null,
  status text not null check (status in ('pending', 'confirmed')),
  signature text,
  reserved_at timestamptz not null default now(),
  expires_at timestamptz not null,
  confirmed_at timestamptz
);

create index if not exists otc_mint_claims_reservation_idx on public.otc_mint_claims (reservation_id);
create index if not exists otc_mint_claims_pending_expiry_idx on public.otc_mint_claims (expires_at) where status = 'pending';

alter table public.otc_mint_claims enable row level security;
-- No policies: service-role only (the edge function), never exposed to anon/authenticated.

-- Reserves up to p_quantity of the wallet's OTC Desk assets that have never
-- been claimed. Expired-but-unverified pending rows still block their asset:
-- they're only ever freed by release_otc_reservation, after the backend has
-- confirmed on-chain that the reserved mint did not land.
create or replace function public.reserve_otc_claims(
  p_wallet text,
  p_assets text[],
  p_quantity integer,
  p_ttl_seconds integer
)
returns table (otc_asset text, reservation_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation uuid := gen_random_uuid();
begin
  return query
  insert into public.otc_mint_claims as c (otc_asset, wallet, reservation_id, status, expires_at)
  select u.a, p_wallet, v_reservation, 'pending', now() + make_interval(secs => p_ttl_seconds)
  from unnest(p_assets) with ordinality as u(a, ord)
  where not exists (select 1 from public.otc_mint_claims x where x.otc_asset = u.a)
  order by u.ord
  limit greatest(p_quantity, 0)
  on conflict on constraint otc_mint_claims_pkey do nothing
  returning c.otc_asset, c.reservation_id;
end;
$$;

create or replace function public.confirm_otc_reservation(p_reservation uuid, p_signature text)
returns integer
language sql
security definer
set search_path = public
as $$
  with updated as (
    update public.otc_mint_claims
    set status = 'confirmed', signature = p_signature, confirmed_at = now()
    where reservation_id = p_reservation and status = 'pending'
    returning 1
  )
  select count(*)::integer from updated;
$$;

create or replace function public.release_otc_reservation(p_reservation uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  with deleted as (
    delete from public.otc_mint_claims
    where reservation_id = p_reservation and status = 'pending'
    returning 1
  )
  select count(*)::integer from deleted;
$$;

revoke all on function public.reserve_otc_claims(text, text[], integer, integer) from public;
revoke execute on function public.reserve_otc_claims(text, text[], integer, integer) from anon, authenticated;
grant execute on function public.reserve_otc_claims(text, text[], integer, integer) to service_role;

revoke all on function public.confirm_otc_reservation(uuid, text) from public;
revoke execute on function public.confirm_otc_reservation(uuid, text) from anon, authenticated;
grant execute on function public.confirm_otc_reservation(uuid, text) to service_role;

revoke all on function public.release_otc_reservation(uuid) from public;
revoke execute on function public.release_otc_reservation(uuid) from anon, authenticated;
grant execute on function public.release_otc_reservation(uuid) to service_role;
