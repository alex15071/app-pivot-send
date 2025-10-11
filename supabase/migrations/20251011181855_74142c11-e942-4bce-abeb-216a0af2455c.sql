-- Add current_offset field to track campaign progress through conversations
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS current_offset integer DEFAULT 0;

-- Add current_page_stats jsonb to track which fanpages are being processed
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS current_page_stats jsonb DEFAULT '[]'::jsonb;