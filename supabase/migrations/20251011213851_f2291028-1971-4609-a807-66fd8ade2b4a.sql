-- Remove duplicate cron jobs for sequence scheduler
SELECT cron.unschedule('sequence-scheduler-job');
SELECT cron.unschedule('check-sequence-messages');

-- Create a single cron job that runs every minute
SELECT cron.schedule(
  'sequence-scheduler-every-minute',
  '* * * * *', -- Every minute
  $$
  SELECT net.http_post(
      url:='https://ejkndamjsfjdkithuqrj.supabase.co/functions/v1/sequence-scheduler',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqa25kYW1qc2ZqZGtpdGh1cXJqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDE3NDExNCwiZXhwIjoyMDc1NzUwMTE0fQ.Mou2TYKhKZ6lFVhyqaBGjlNzLPkECZn6HCqJE3B2MXY"}'::jsonb,
      body:='{}'::jsonb
  ) as request_id;
  $$
);