-- Create message_sequences table for programmed message sequences
CREATE TABLE IF NOT EXISTS public.message_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  message_type TEXT NOT NULL CHECK (message_type IN ('text', 'image', 'text_button', 'card')),
  message_arguments JSONB NOT NULL DEFAULT '{}'::jsonb,
  delay_minutes INTEGER NOT NULL DEFAULT 0,
  sequence_order INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'sending', 'sent', 'failed', 'cancelled')),
  scheduled_for TIMESTAMP WITH TIME ZONE,
  sent_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(campaign_id, sequence_order)
);

-- Add sequence-related columns to campaigns table
ALTER TABLE public.campaigns 
  ADD COLUMN IF NOT EXISTS is_sequence BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS sequence_start_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS current_sequence_step INTEGER DEFAULT 0;

-- Enable RLS on message_sequences
ALTER TABLE public.message_sequences ENABLE ROW LEVEL SECURITY;

-- RLS policies for message_sequences
CREATE POLICY "Users can manage message_sequences"
  ON public.message_sequences
  FOR ALL
  USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_message_sequences_updated_at
  BEFORE UPDATE ON public.message_sequences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable pg_cron and pg_net extensions for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create the cron job for sequence scheduler (runs every minute)
SELECT cron.schedule(
  'sequence-scheduler-job',
  '* * * * *', -- every minute
  $$
  SELECT
    net.http_post(
      url:='https://ejkndamjsfjdkithuqrj.supabase.co/functions/v1/sequence-scheduler',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqa25kYW1qc2ZqZGtpdGh1cXJqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDE3NDExNCwiZXhwIjoyMDc1NzUwMTE0fQ.PuYzuCp_W3JXsItKdADTlO8xMlkvbGX3mRhm8hME5qg"}'::jsonb
    ) as request_id;
  $$
);