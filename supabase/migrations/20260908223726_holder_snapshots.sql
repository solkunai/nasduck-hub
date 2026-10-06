create table if not exists public.holder_snapshots (
  wallet text primary key,
  rank integer not null,
  balance numeric not null,
  change_24h numeric not null default 0,
  updated_at timestamptz not null default now()
);

-- Not exposed for public reads — only the snapshot-holders function (via
-- its service-role client) reads this, to compute change_24h against a
-- balance from ~23h+ ago. No public RLS policy at all, same lockdown as
-- wallet_trade_cache.
create table if not exists public.holder_balance_history (
  wallet text not null,
  balance numeric not null,
  snapshot_at timestamptz not null default now()
);
create index if not exists holder_balance_history_wallet_idx on public.holder_balance_history (wallet, snapshot_at desc);

alter table public.holder_snapshots enable row level security;
alter table public.holder_balance_history enable row level security;

drop policy if exists "holder_snapshots_public_read" on public.holder_snapshots;
create policy "holder_snapshots_public_read" on public.holder_snapshots for select using (true);

grant select on public.holder_snapshots to anon, authenticated;
