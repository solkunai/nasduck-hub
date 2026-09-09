create table if not exists public.clicker_scores (
  wallet text primary key,
  score bigint not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists clicker_scores_rank_idx on public.clicker_scores (score desc);

-- Disclosed limitation, not solved cheat-proofing: a client-submitted score
-- is spoofable no matter what. This just keeps it from being trivial —
-- caps each flush to a plausible amount and ignores flushes faster than the
-- client is expected to send them, rather than building real anti-cheat
-- infra for a vanity leaderboard.
create or replace function public.increment_clicker_score(p_wallet text, p_amount int)
returns bigint as $$
declare
  v_last timestamptz;
  v_capped int;
  v_new_score bigint;
begin
  v_capped := least(greatest(p_amount, 1), 50);

  select updated_at into v_last from public.clicker_scores where wallet = p_wallet;

  if v_last is not null and now() - v_last < interval '500 milliseconds' then
    select score into v_new_score from public.clicker_scores where wallet = p_wallet;
    return coalesce(v_new_score, 0);
  end if;

  insert into public.clicker_scores (wallet, score, updated_at)
  values (p_wallet, v_capped, now())
  on conflict (wallet) do update
    set score = public.clicker_scores.score + v_capped,
        updated_at = now()
  returning score into v_new_score;

  return v_new_score;
end;
$$ language plpgsql security definer set search_path = public;

revoke all on function public.increment_clicker_score(text, int) from public;
grant execute on function public.increment_clicker_score(text, int) to anon, authenticated;

alter table public.clicker_scores enable row level security;

drop policy if exists "clicker_scores_public_read" on public.clicker_scores;
create policy "clicker_scores_public_read" on public.clicker_scores for select using (true);

grant select on public.clicker_scores to anon, authenticated;
-- No insert/update policy at all — only the security-definer function above
-- may write, the same lockdown pattern used for equivalent point-increment functions.
