-- Caches NASDUCK's live holder-reward stats from OTC Desks
-- (otcdesks.cash/api/coins?mint=...) — a real Solana protocol NASDUCK's
-- creator fees route through: 70% of fees accumulate as SOL, swap into
-- NASDUCK's assigned tokenized stock (QQQx, a custodian-backed Nasdaq-100
-- ETF token) once the balance clears a threshold, and holders claim their
-- share via merkle proof. Single row (mint as PK, though only one row will
-- ever exist for this app) rather than querying their API from every
-- visitor's browser directly — same reasoning as holder_snapshots: avoid
-- hammering a third-party endpoint per-pageview, and this app doesn't
-- control their uptime/rate limits.
create table if not exists public.otc_desks_rewards (
  mint text primary key,
  reward_symbol text not null,
  reward_mint text not null,
  paid_to_holders_lamports bigint not null,
  creator_fees_earned_lamports bigint not null,
  to_protocol_lamports bigint not null,
  to_pot_lamports bigint not null,
  to_buyback_lamports bigint not null,
  owed_lamports bigint not null,
  last_paid_holders integer not null default 0,
  last_distributed_at timestamptz,
  last_claim_tx text,
  updated_at timestamptz not null default now()
);

alter table public.otc_desks_rewards enable row level security;

drop policy if exists "otc_desks_rewards_public_read" on public.otc_desks_rewards;
create policy "otc_desks_rewards_public_read" on public.otc_desks_rewards for select using (true);

grant select on public.otc_desks_rewards to anon, authenticated;
-- No insert/update policy — only the snapshot-otc-desks function (via its
-- service-role client) writes here, same lockdown as holder_snapshots.
