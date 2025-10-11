-- Add app_key column to message_sequences table for per-message app selection
ALTER TABLE message_sequences ADD COLUMN IF NOT EXISTS app_key text;