-- Append-only feed of individual NASDUCK payout events, distinct from
-- otc_desks_rewards (which only holds the current cumulative snapshot).
-- OTC Desks has no per-coin payout history API — confirmed by checking:
-- their /api/claims endpoint is global and per-claimant-wallet, mixing
-- every coin on the platform with no field identifying which originating
-- coin triggered a claim. So this table is built up by snapshot-otc-desks
-- itself: each poll compares the fresh cumulative "distributed" total and
-- last_claim_tx against the previously stored row, and inserts one row
-- here only when a genuinely new payout is detected. claim_tx is UNIQUE so
-- re-polling with nothing new is a safe no-op (ON CONFLICT DO NOTHING),
-- not a duplicate feed entry.
create table if not exists public.otc_desks_payouts (
  id bigint generated always as identity primary key,
  mint text not null,
  claim_tx text not null unique,
  amount_lamports_delta bigint not null,
  holders_paid integer not null,
  paid_at timestamptz not null,
  detected_at timestamptz not null default now()
);

create index if not exists otc_desks_payouts_mint_paid_at_idx
  on public.otc_desks_payouts (mint, paid_at desc);

alter table public.otc_desks_payouts enable row level security;

drop policy if exists "otc_desks_payouts_public_read" on public.otc_desks_payouts;
create policy "otc_desks_payouts_public_read" on public.otc_desks_payouts for select using (true);

grant select on public.otc_desks_payouts to anon, authenticated;
-- No insert/update policy — only the snapshot-otc-desks function (via its
-- service-role client) writes here, same lockdown as every other cron-fed
-- table in this project.

-- Live updates for the frontend feed (new payout arrives -> Realtime INSERT
-- event, no polling) — same mechanism as whale_trades.
alter publication supabase_realtime add table public.otc_desks_payouts;
