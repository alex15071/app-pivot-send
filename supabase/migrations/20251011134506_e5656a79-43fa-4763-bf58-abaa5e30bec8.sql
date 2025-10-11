-- Fix RLS policies to allow authenticated users to manage their data

-- Apps: Allow authenticated users to manage apps
DROP POLICY IF EXISTS "Admins have full access to apps" ON apps;

CREATE POLICY "Users can view all apps"
  ON apps FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create apps"
  ON apps FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update apps"
  ON apps FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Users can delete apps"
  ON apps FOR DELETE
  TO authenticated
  USING (true);

-- Accounts: Allow authenticated users to manage accounts
DROP POLICY IF EXISTS "Admins have full access to accounts" ON accounts;

CREATE POLICY "Users can manage accounts"
  ON accounts FOR ALL
  TO authenticated
  USING (true);

-- Fanpages: Allow authenticated users to manage fanpages
DROP POLICY IF EXISTS "Admins have full access to fanpages" ON fanpages;

CREATE POLICY "Users can manage fanpages"
  ON fanpages FOR ALL
  TO authenticated
  USING (true);

-- Fanpage conversations: Allow authenticated users to manage conversations
DROP POLICY IF EXISTS "Admins have full access to fanpage_conversations" ON fanpage_conversations;

CREATE POLICY "Users can manage conversations"
  ON fanpage_conversations FOR ALL
  TO authenticated
  USING (true);

-- Campaign fanpages: Allow authenticated users to manage campaign fanpages
DROP POLICY IF EXISTS "Admins have full access to campaign_fanpages" ON campaign_fanpages;

CREATE POLICY "Users can manage campaign_fanpages"
  ON campaign_fanpages FOR ALL
  TO authenticated
  USING (true);

-- Campaigns: Allow authenticated users to manage campaigns
DROP POLICY IF EXISTS "Admins have full access to campaigns" ON campaigns;

CREATE POLICY "Users can manage campaigns"
  ON campaigns FOR ALL
  TO authenticated
  USING (true);

-- Messages: Allow authenticated users to manage messages
DROP POLICY IF EXISTS "Admins have full access to messages" ON messages;

CREATE POLICY "Users can manage messages"
  ON messages FOR ALL
  TO authenticated
  USING (true);

-- Send results: Allow authenticated users to view send results
DROP POLICY IF EXISTS "Admins have full access to send_results" ON send_results;

CREATE POLICY "Users can view send_results"
  ON send_results FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can insert send_results"
  ON send_results FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Pacing profiles: Allow authenticated users to manage pacing profiles
DROP POLICY IF EXISTS "Admins have full access to pacing_profiles" ON pacing_profiles;

CREATE POLICY "Users can manage pacing_profiles"
  ON pacing_profiles FOR ALL
  TO authenticated
  USING (true);

-- Processed URLs: Allow authenticated users to manage processed URLs
DROP POLICY IF EXISTS "Admins have full access to processed_urls" ON processed_urls;

CREATE POLICY "Users can manage processed_urls"
  ON processed_urls FOR ALL
  TO authenticated
  USING (true);

-- Fanpage app tokens: Allow authenticated users to manage tokens
DROP POLICY IF EXISTS "Admins have full access to fanpage_app_tokens" ON fanpage_app_tokens;

CREATE POLICY "Users can manage fanpage_app_tokens"
  ON fanpage_app_tokens FOR ALL
  TO authenticated
  USING (true);