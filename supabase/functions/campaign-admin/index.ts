import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const isMissingTableError = (error: { message?: string; code?: string } | null) => {
  if (!error) return false;
  return error.code === "PGRST205" || (error.message || "").toLowerCase().includes("scheduled_messages");
};

async function deleteCampaignTree(supabaseAdmin: any, campaignIds: string[]) {
  if (campaignIds.length === 0) return;

  // Pause campaigns first to avoid background jobs writing while deleting
  await supabaseAdmin
    .from("campaigns")
    .update({ status: "paused", current_page_stats: [] })
    .in("id", campaignIds);

  // Optional table in some environments
  const { error: scheduledError } = await supabaseAdmin
    .from("scheduled_messages")
    .delete()
    .in("campaign_id", campaignIds);

  if (scheduledError && !isMissingTableError(scheduledError)) {
    throw new Error(`Error deleting scheduled_messages: ${scheduledError.message}`);
  }

  const children = ["campaign_fanpages", "messages", "message_sequences", "send_results"];
  for (const table of children) {
    const { error } = await supabaseAdmin.from(table).delete().in("campaign_id", campaignIds);
    if (error) {
      throw new Error(`Error deleting ${table}: ${error.message}`);
    }
  }

  const { error: campaignError } = await supabaseAdmin.from("campaigns").delete().in("id", campaignIds);
  if (campaignError) {
    throw new Error(`Error deleting campaigns: ${campaignError.message}`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      return jsonResponse({ error: "Backend secrets not configured" }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { action, campaign_id } = await req.json();

    if (action === "delete_campaign") {
      if (!campaign_id || typeof campaign_id !== "string") {
        return jsonResponse({ error: "campaign_id is required" }, 400);
      }

      await deleteCampaignTree(supabaseAdmin, [campaign_id]);
      return jsonResponse({ success: true, deleted_count: 1 });
    }

    if (action === "delete_all_campaigns") {
      const { data: campaigns, error: campaignsError } = await supabaseAdmin
        .from("campaigns")
        .select("id");

      if (campaignsError) {
        throw new Error(campaignsError.message);
      }

      const campaignIds = (campaigns || []).map((campaign: { id: string }) => campaign.id);
      if (campaignIds.length === 0) {
        return jsonResponse({ success: true, deleted_count: 0 });
      }

      await deleteCampaignTree(supabaseAdmin, campaignIds);
      return jsonResponse({ success: true, deleted_count: campaignIds.length });
    }

    return jsonResponse({ error: "Invalid action" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[campaign-admin]", message);
    return jsonResponse({ error: message }, 400);
  }
});
