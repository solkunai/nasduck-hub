-- Security advisor correctly flagged these: security definer + public schema
-- makes PostgREST auto-expose them as callable RPCs by default, but they're
-- trigger functions only (reference NEW/OLD, meaningless called directly).
-- Revoke direct execute — they should only ever run implicitly via the
-- triggers already wired to meme_votes/meme_reports inserts.
revoke all on function public.sync_meme_votes() from public, anon, authenticated;
revoke all on function public.sync_meme_reports() from public, anon, authenticated;
