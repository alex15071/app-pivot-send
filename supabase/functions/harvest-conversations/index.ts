import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { page_id } = await req.json();

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log(`[harvest-conversations] Starting harvest for page: ${page_id}`);

    // Start background task without waiting
    harvestConversations(supabaseClient, page_id).catch(err => 
      console.error('[harvest-conversations] Background error:', err)
    );

    // Return immediately
    return new Response(JSON.stringify({ success: true, message: 'Harvest started in background' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[harvest-conversations] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function harvestConversations(supabaseClient: any, page_id: string) {
  try {
    // Get fanpage with active app token
    const { data: fanpage, error: fanpageError } = await supabaseClient
      .from('fanpages')
      .select('*')
      .eq('page_id', page_id)
      .single();

    if (fanpageError || !fanpage) {
      throw new Error('Fanpage not found');
    }

    // Get page access token for the active app
    const { data: tokenData, error: tokenError } = await supabaseClient
      .from('fanpage_app_tokens')
      .select('*')
      .eq('page_id', page_id)
      .eq('app_key', fanpage.active_app_key)
      .single();

    if (tokenError || !tokenData) {
      throw new Error('Page access token not found for active app');
    }

    const pageAccessToken = atob(tokenData.page_access_token_encrypted);
    let totalSaved = 0;
    let nextUrl = `https://graph.facebook.com/v24.0/${page_id}/conversations?fields=senders,can_reply&limit=100&access_token=${pageAccessToken}`;

    // Paginate through conversations
    while (nextUrl) {
      console.log(`[harvest-conversations] Fetching: ${nextUrl.substring(0, 100)}...`);

      const response = await fetch(nextUrl);
      const data = await response.json();

      if (data.error) {
        console.error('[harvest-conversations] Facebook API error:', data.error);
        throw new Error(`Facebook API error: ${data.error.message}`);
      }

      if (data.data && data.data.length > 0) {
        // Filter and prepare conversations
        const conversations = data.data
          .filter((conv: any) => conv.can_reply === true && conv.senders?.data?.length > 0)
          .map((conv: any) => ({
            page_id: page_id,
            sender_id: conv.senders.data[0].id,
          }));

        if (conversations.length > 0) {
          // Insert conversations (ignore duplicates)
          const { error: insertError } = await supabaseClient
            .from('fanpage_conversations')
            .upsert(conversations, {
              onConflict: 'page_id,sender_id',
              ignoreDuplicates: true,
            });

          if (insertError) {
            console.error('[harvest-conversations] Insert error:', insertError);
          } else {
            totalSaved += conversations.length;
            console.log(`[harvest-conversations] Saved ${conversations.length} conversations (total: ${totalSaved})`);
            
            // Update fanpage count every 100 conversations for real-time progress
            if (totalSaved % 100 === 0 || totalSaved < 100) {
              await supabaseClient
                .from('fanpages')
                .update({ conversations: totalSaved })
                .eq('page_id', page_id);
            }
          }
        }
      }

      // Check for next page
      nextUrl = data.paging?.next || null;

      // Prevent infinite loops
      if (totalSaved > 100000) {
        console.log('[harvest-conversations] Safety limit reached (100k conversations)');
        break;
      }

      // Small delay to avoid rate limits
      if (nextUrl) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Update fanpage conversation count
    const { data: countData } = await supabaseClient
      .from('fanpage_conversations')
      .select('*', { count: 'exact', head: true })
      .eq('page_id', page_id);

    const count = countData ? (countData as any).count : totalSaved;

    await supabaseClient
      .from('fanpages')
      .update({ conversations: count })
      .eq('page_id', page_id);

    console.log(`[harvest-conversations] Completed. Total conversations: ${count}`);
  } catch (error) {
    console.error('[harvest-conversations] Background task error:', error);
  }
}
