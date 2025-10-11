-- Remove the old unique constraint on fb_user_id alone
ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS accounts_fb_user_id_key;

-- Add a new unique constraint on the combination of fb_user_id and app_key
-- This allows the same Facebook user to connect with multiple apps
ALTER TABLE public.accounts ADD CONSTRAINT accounts_fb_user_id_app_key_key UNIQUE (fb_user_id, app_key);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_accounts_fb_user_id ON public.accounts(fb_user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_app_key ON public.accounts(app_key);