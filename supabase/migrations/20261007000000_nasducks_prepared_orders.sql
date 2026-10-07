-- Orders built by the nasducks-mint function, so the buyer's wallet can sign
-- FIRST (Phantom's recommended order) and the backend co-signs only after
-- checking the returned transaction against exactly what it built. Each
-- order can be co-signed at most once, and never after it was cancelled or
-- expired — so an unsubmitted transaction can never land.
create table public.nasducks_prepared (
  token uuid primary key default gen_random_uuid(),
  wallet text not null,
  message text not null, -- base64 of the unsigned transaction message as built
  reservation_id uuid,   -- OTC desk reservation, if any
  state text not null default 'pending' check (state in ('pending', 'submitted', 'cancelled')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index nasducks_prepared_expires_at on public.nasducks_prepared (expires_at);

-- Service role only: no policies.
alter table public.nasducks_prepared enable row level security;

-- Atomically moves a still-valid pending order to p_state ('submitted' or
-- 'cancelled') and returns it; returns nothing if it was already used,
-- cancelled, or expired. This is what makes each order usable once.
create or replace function public.take_prepared_order(p_token uuid, p_state text)
returns table (wallet text, message text, reservation_id uuid)
language sql
security definer
set search_path = ''
as $$
  update public.nasducks_prepared
     set state = p_state
   where token = p_token
     and state = 'pending'
     and expires_at > now()
     and p_state in ('submitted', 'cancelled')
  returning wallet, message, reservation_id;
$$;

revoke all on function public.take_prepared_order(uuid, text) from public, anon, authenticated;
grant execute on function public.take_prepared_order(uuid, text) to service_role;
