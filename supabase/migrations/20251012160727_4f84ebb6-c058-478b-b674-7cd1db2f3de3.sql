-- 1. Modify fanpages.account_id constraint to preserve fanpages when account is deleted
ALTER TABLE public.fanpages
DROP CONSTRAINT IF EXISTS fanpages_account_id_fkey;

ALTER TABLE public.fanpages
ADD CONSTRAINT fanpages_account_id_fkey
FOREIGN KEY (account_id)
REFERENCES public.accounts(id)
ON DELETE SET NULL;

-- 2. Add status column to fanpages
ALTER TABLE public.fanpages
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- 3. Add comment to clarify the possible values
COMMENT ON COLUMN public.fanpages.status IS 'Status of the fanpage: active (connected to account), disconnected (orphaned, no account)';

-- 4. Update existing fanpages based on account_id
UPDATE public.fanpages
SET status = CASE
  WHEN account_id IS NULL THEN 'disconnected'
  ELSE 'active'
END;