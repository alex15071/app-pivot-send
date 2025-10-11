-- Create enum for app role
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create enum for campaign status
CREATE TYPE public.campaign_status AS ENUM ('draft', 'running', 'paused', 'finished');

-- Create enum for message type
CREATE TYPE public.message_type AS ENUM ('text', 'image', 'audio', 'video', 'generic', 'media', 'button');

-- Apps table
CREATE TABLE public.apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  fb_app_id TEXT NOT NULL,
  fb_app_secret_encrypted TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Accounts table (Facebook user accounts connected via OAuth)
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fb_user_id TEXT UNIQUE NOT NULL,
  name TEXT,
  photo_url TEXT,
  access_token_encrypted TEXT NOT NULL,
  app_key TEXT REFERENCES public.apps(key) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Fanpages table
CREATE TABLE public.fanpages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  image_url TEXT,
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
  conversations INT DEFAULT 0,
  active_app_key TEXT REFERENCES public.apps(key) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Fanpage app tokens (multi-app support per fanpage)
CREATE TABLE public.fanpage_app_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id TEXT REFERENCES public.fanpages(page_id) ON DELETE CASCADE,
  app_key TEXT REFERENCES public.apps(key) ON DELETE CASCADE,
  page_access_token_encrypted TEXT NOT NULL,
  webhook_subscribed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(page_id, app_key)
);

-- Pacing profiles table
CREATE TABLE public.pacing_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  batch_size INT DEFAULT 50,
  parallel_batches INT DEFAULT 3,
  sleep_between_pools_sec NUMERIC(5,2) DEFAULT 3.0,
  jitter_pct NUMERIC(5,2) DEFAULT 30.0,
  error_ratio_threshold NUMERIC(5,2) DEFAULT 12.0,
  cooldown_on_error_sec INT DEFAULT 20,
  max_retries_per_pool INT DEFAULT 2,
  backoff_multiplier NUMERIC(3,2) DEFAULT 2.0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Campaigns table
CREATE TABLE public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  status public.campaign_status DEFAULT 'draft',
  pacing_profile_id UUID REFERENCES public.pacing_profiles(id) ON DELETE SET NULL,
  active_app_key TEXT REFERENCES public.apps(key) ON DELETE SET NULL,
  total_recipients INT DEFAULT 0,
  processed INT DEFAULT 0,
  delivered INT DEFAULT 0,
  failed INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Campaign fanpages relation
CREATE TABLE public.campaign_fanpages (
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  page_id TEXT REFERENCES public.fanpages(page_id) ON DELETE CASCADE,
  PRIMARY KEY (campaign_id, page_id)
);

-- Messages table
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  type public.message_type NOT NULL,
  arguments JSONB NOT NULL,
  sent INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Fanpage conversations (harvested sender IDs)
CREATE TABLE public.fanpage_conversations (
  page_id TEXT REFERENCES public.fanpages(page_id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (page_id, sender_id)
);

-- Processed URLs (for deduplication during harvesting)
CREATE TABLE public.processed_urls (
  page_id TEXT REFERENCES public.fanpages(page_id) ON DELETE CASCADE,
  url_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (page_id, url_hash)
);

-- Send results (optional detailed logs per recipient)
CREATE TABLE public.send_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  page_id TEXT REFERENCES public.fanpages(page_id) ON DELETE CASCADE,
  sender_id TEXT,
  http_code INT,
  fb_body_json JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- User roles table for admin access
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fanpages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fanpage_app_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pacing_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_fanpages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fanpage_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processed_urls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.send_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check admin role
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'admin'
  )
$$;

-- RLS Policies - Admin full access
CREATE POLICY "Admins have full access to apps"
  ON public.apps FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins have full access to accounts"
  ON public.accounts FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins have full access to fanpages"
  ON public.fanpages FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins have full access to fanpage_app_tokens"
  ON public.fanpage_app_tokens FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins have full access to pacing_profiles"
  ON public.pacing_profiles FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins have full access to campaigns"
  ON public.campaigns FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins have full access to campaign_fanpages"
  ON public.campaign_fanpages FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins have full access to messages"
  ON public.messages FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins have full access to fanpage_conversations"
  ON public.fanpage_conversations FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins have full access to processed_urls"
  ON public.processed_urls FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins have full access to send_results"
  ON public.send_results FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can view their own role"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

-- Trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Triggers for updated_at columns
CREATE TRIGGER update_apps_updated_at
  BEFORE UPDATE ON public.apps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_accounts_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_fanpages_updated_at
  BEFORE UPDATE ON public.fanpages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_fanpage_app_tokens_updated_at
  BEFORE UPDATE ON public.fanpage_app_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pacing_profiles_updated_at
  BEFORE UPDATE ON public.pacing_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_apps_key ON public.apps(key);
CREATE INDEX idx_accounts_app_key ON public.accounts(app_key);
CREATE INDEX idx_fanpages_page_id ON public.fanpages(page_id);
CREATE INDEX idx_fanpage_app_tokens_page_app ON public.fanpage_app_tokens(page_id, app_key);
CREATE INDEX idx_campaigns_status ON public.campaigns(status);
CREATE INDEX idx_messages_campaign_id ON public.messages(campaign_id);
CREATE INDEX idx_fanpage_conversations_page ON public.fanpage_conversations(page_id);
CREATE INDEX idx_send_results_campaign ON public.send_results(campaign_id);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);

-- Insert default pacing profile
INSERT INTO public.pacing_profiles (name, batch_size, parallel_batches, sleep_between_pools_sec, jitter_pct, error_ratio_threshold, cooldown_on_error_sec, max_retries_per_pool, backoff_multiplier)
VALUES ('Default', 50, 3, 3.0, 30.0, 12.0, 20, 2, 2.0);

INSERT INTO public.pacing_profiles (name, batch_size, parallel_batches, sleep_between_pools_sec, jitter_pct, error_ratio_threshold, cooldown_on_error_sec, max_retries_per_pool, backoff_multiplier)
VALUES ('Aggressive', 50, 6, 2.0, 30.0, 15.0, 10, 1, 1.5);

INSERT INTO public.pacing_profiles (name, batch_size, parallel_batches, sleep_between_pools_sec, jitter_pct, error_ratio_threshold, cooldown_on_error_sec, max_retries_per_pool, backoff_multiplier)
VALUES ('Conservative', 30, 2, 5.0, 30.0, 8.0, 30, 3, 2.5);