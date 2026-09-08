-- Short-TTL cache for on-demand wallet PnL lookups (see wallet-trades edge
-- function) so repeat views of a popular wallet don't re-spend Helius credits.
-- No public RLS policy at all: only the service-role client inside the edge
-- function touches this table, matching the same lockdown ANSEM Hub uses for
-- its equivalent table.
create table if not exists public.wallet_trade_cache (
  wallet text primary key,
  computed_at timestamptz not null default now(),
  buys integer not null default 0,
  sells integer not null default 0,
  nasduck_bought numeric not null default 0,
  nasduck_sold numeric not null default 0,
  cost_basis_sol numeric not null default 0,
  proceeds_sol numeric not null default 0,
  current_balance numeric not null default 0
);

alter table public.wallet_trade_cache enable row level security;
