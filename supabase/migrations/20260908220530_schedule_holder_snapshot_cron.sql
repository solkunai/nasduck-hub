create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Every 5 minutes, not more often — staying well clear of Helius rate
-- limits (2 RPC calls per run, so ~576 calls/day at this cadence, trivial
-- for any tier). REPLACE_WITH_CRON_SECRET below is a placeholder — the
-- real deployed value is a project-generated random string (not a
-- third-party credential), intentionally not committed here since this
-- file could end up in a public repo. The actual applied migration has the
-- real value; keep this placeholder in sync with the snapshot-holders
-- function's CRON_SECRET secret (set via the dashboard) if this job is
-- ever recreated from this file.
select cron.schedule(
  'nasduck-snapshot-holders-5min',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://qrqenowwwccmfgwsnfpa.supabase.co/functions/v1/snapshot-holders',
    headers := '{"x-cron-secret": "REPLACE_WITH_CRON_SECRET", "content-type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
