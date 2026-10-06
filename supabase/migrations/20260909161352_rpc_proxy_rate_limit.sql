-- rpc-proxy has to be callable with no Supabase auth (a wallet's Connection
-- object can't send our headers), so this table backs a real per-IP rate
-- limit instead of relying on obscurity alone.
create table if not exists public.rpc_proxy_rate_limit (
  ip text not null,
  window_start timestamptz not null,
  request_count integer not null default 0,
  primary key (ip, window_start)
);

alter table public.rpc_proxy_rate_limit enable row level security;
-- No policies: service-role only (the edge function), never exposed to anon/authenticated.

create or replace function public.increment_rpc_rate_limit(p_ip text, p_window timestamptz)
returns integer
language sql
security definer
set search_path = public
as $$
  insert into public.rpc_proxy_rate_limit (ip, window_start, request_count)
  values (p_ip, p_window, 1)
  on conflict (ip, window_start) do update
    set request_count = rpc_proxy_rate_limit.request_count + 1
  returning request_count;
$$;

revoke all on function public.increment_rpc_rate_limit(text, timestamptz) from public;
revoke execute on function public.increment_rpc_rate_limit(text, timestamptz) from anon, authenticated;
grant execute on function public.increment_rpc_rate_limit(text, timestamptz) to service_role;
