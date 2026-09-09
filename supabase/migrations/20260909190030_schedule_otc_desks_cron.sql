-- Every 10 minutes — OTC Desks pays out roughly every ~11 minutes per a
-- live check while building this, so this stays close to real-time without
-- polling a third-party endpoint faster than their own data actually
-- changes. REPLACE_WITH_OTC_CRON_SECRET below is a placeholder, same
-- reasoning as schedule_holder_snapshot_cron.sql — the real deployed value
-- is a project-generated random string, intentionally not committed here.
-- Uses its own OTC_CRON_SECRET, not the shared CRON_SECRET other functions
-- use, so this job's setup can never risk breaking snapshot-holders'.
select cron.schedule(
  'nasduck-snapshot-otc-desks-10min',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://qrqenowwwccmfgwsnfpa.supabase.co/functions/v1/snapshot-otc-desks',
    headers := '{"x-cron-secret": "REPLACE_WITH_OTC_CRON_SECRET", "content-type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
