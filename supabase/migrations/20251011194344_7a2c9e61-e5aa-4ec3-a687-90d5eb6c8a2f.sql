-- Add 'scheduled' status to campaign_status enum
ALTER TYPE campaign_status ADD VALUE IF NOT EXISTS 'scheduled';