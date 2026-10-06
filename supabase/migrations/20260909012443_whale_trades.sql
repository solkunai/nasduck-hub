create table if not exists public.whale_trades (
  id bigint generated always as identity primary key,
  signature text not null unique,
  wallet text not null,
  side text not null check (side in ('buy', 'sell')),
  token_amount numeric not null,
  usd_amount numeric not null,
  created_at timestamptz not null default now()
);

create index if not exists whale_trades_created_idx on public.whale_trades (created_at desc);

alter table public.whale_trades enable row level security;

drop policy if exists "whale_trades_public_read" on public.whale_trades;
create policy "whale_trades_public_read" on public.whale_trades for select using (true);

grant select on public.whale_trades to anon, authenticated;
-- No insert/update/delete policy at all — only the webhook ingestion
-- function (via its service-role client) writes here.

-- Realtime: let the frontend subscribe to new rows landing here instead of
-- polling.
alter publication supabase_realtime add table public.whale_trades;
