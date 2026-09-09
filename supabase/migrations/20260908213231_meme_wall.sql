-- The Meme Desk: wallet-gated, auto-publish uploads (explicit user choice —
-- no moderation queue), with lightweight after-the-fact guardrails instead:
-- a denormalized vote count kept in sync by trigger (not a mutable column
-- clients can just overwrite), one vote per wallet per meme, and a report
-- count that auto-hides a meme past a threshold.
--
-- Note on "wallet-gated": there is no real signature-based auth in this
-- project — the wallet address is a client-asserted text field, not
-- cryptographically verified server-side. A known, accepted tradeoff for a
-- vanity feature like this, not an oversight.
create table if not exists public.memes (
  id bigint generated always as identity primary key,
  wallet text not null,
  image_path text not null,
  caption text not null default '',
  votes integer not null default 0,
  reported_count integer not null default 0,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists memes_votes_idx on public.memes (votes desc) where not hidden;
create index if not exists memes_created_idx on public.memes (created_at desc) where not hidden;

create table if not exists public.meme_votes (
  meme_id bigint not null references public.memes (id) on delete cascade,
  wallet text not null,
  created_at timestamptz not null default now(),
  primary key (meme_id, wallet)
);

create table if not exists public.meme_reports (
  meme_id bigint not null references public.memes (id) on delete cascade,
  wallet text not null,
  created_at timestamptz not null default now(),
  primary key (meme_id, wallet)
);

-- Keep memes.votes as a fast-to-query denormalized count, but derive it only
-- from meme_votes rows (one per wallet, enforced by the primary key above) —
-- never writable directly by a client.
create or replace function public.sync_meme_votes() returns trigger as $$
begin
  if tg_op = 'INSERT' then
    update public.memes set votes = votes + 1 where id = new.meme_id;
  elsif tg_op = 'DELETE' then
    update public.memes set votes = greatest(0, votes - 1) where id = old.meme_id;
  end if;
  return null;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists meme_votes_sync on public.meme_votes;
create trigger meme_votes_sync
  after insert or delete on public.meme_votes
  for each row execute function public.sync_meme_votes();

-- Auto-hide past a report threshold rather than requiring an admin action —
-- matches the "flag it, the desk reviews after the fact" copy already on
-- the page; 5 is a starting point, easy to tune later.
create or replace function public.sync_meme_reports() returns trigger as $$
begin
  update public.memes
  set reported_count = reported_count + 1,
      hidden = (reported_count + 1) >= 5
  where id = new.meme_id;
  return null;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists meme_reports_sync on public.meme_reports;
create trigger meme_reports_sync
  after insert on public.meme_reports
  for each row execute function public.sync_meme_reports();

alter table public.memes enable row level security;
alter table public.meme_votes enable row level security;
alter table public.meme_reports enable row level security;

drop policy if exists "memes_public_read" on public.memes;
create policy "memes_public_read" on public.memes for select using (not hidden);

-- Shape-constrained public insert: caption length capped, and the mutable/computed
-- columns (votes, reported_count, hidden) must be left at their defaults —
-- forging them through this insert path is blocked by the check clause.
drop policy if exists "memes_insert" on public.memes;
create policy "memes_insert" on public.memes for insert
  with check (char_length(caption) <= 200 and votes = 0 and reported_count = 0 and hidden = false);

drop policy if exists "meme_votes_public_read" on public.meme_votes;
create policy "meme_votes_public_read" on public.meme_votes for select using (true);

drop policy if exists "meme_votes_insert" on public.meme_votes;
create policy "meme_votes_insert" on public.meme_votes for insert with check (true);

drop policy if exists "meme_reports_insert" on public.meme_reports;
create policy "meme_reports_insert" on public.meme_reports for insert with check (true);

grant select on public.memes to anon, authenticated;
grant select, insert on public.meme_votes to anon, authenticated;
grant insert on public.meme_reports to anon, authenticated;
