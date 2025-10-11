-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- First, remove any existing sequence scheduler jobs (using DO block to handle errors gracefully)
DO $$
BEGIN
  PERFORM cron.unschedule('sequence-scheduler-job');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('check-sequence-messages');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('sequence-scheduler-every-minute');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Create the cron job to run sequence-scheduler every minute
SELECT cron.schedule(
  'sequence-scheduler-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
      url:='https://ejkndamjsfjdkithuqrj.supabase.co/functions/v1/sequence-scheduler',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqa25kYW1qc2ZqZGtpdGh1cXJqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDE3NDExNCwiZXhwIjoyMDc1NzUwMTE0fQ.Mou2TYKhKZ6lFVhyqaBGjlNzLPkECZn6HCqJE3B2MXY"}'::jsonb,
      body:='{}'::jsonb
  ) as request_id;
  $$
);