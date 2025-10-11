-- Fix security warning: Set search_path for function
DROP FUNCTION IF EXISTS get_campaign_fanpage_stats(uuid);

CREATE OR REPLACE FUNCTION get_campaign_fanpage_stats(p_campaign_id uuid)
RETURNS TABLE (
  page_id text,
  fanpage_name text,
  image_url text,
  total_sent bigint,
  successful bigint,
  failed bigint
) 
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    sr.page_id,
    f.name as fanpage_name,
    f.image_url,
    COUNT(*) as total_sent,
    COUNT(*) FILTER (WHERE sr.http_code = 200) as successful,
    COUNT(*) FILTER (WHERE sr.http_code != 200) as failed
  FROM send_results sr
  LEFT JOIN fanpages f ON sr.page_id = f.page_id
  WHERE sr.campaign_id = p_campaign_id
  GROUP BY sr.page_id, f.name, f.image_url
  ORDER BY total_sent DESC;
$$;