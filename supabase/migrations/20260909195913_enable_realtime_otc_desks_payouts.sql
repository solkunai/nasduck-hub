-- Live updates for the frontend feed (new payout arrives -> Realtime INSERT
-- event, no polling) — same mechanism as whale_trades.
alter publication supabase_realtime add table public.otc_desks_payouts;
