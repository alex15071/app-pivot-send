-- Fix the sequence-scheduler cron job with correct JWT token
SELECT cron.unschedule('sequence-scheduler-every-minute');

-- Get the current service role key from vault (this will use the actual key at runtime)
SELECT cron.schedule(
  'sequence-scheduler-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
      url:='https://ejkndamjsfjdkithuqrj.supabase.co/functions/v1/sequence-scheduler',
      headers:=jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key', true)
      ),
      body:='{}'::jsonb
  ) as request_id;
  $$
);