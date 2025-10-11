import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Handle GET request for webhook verification
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');

      const VERIFY_TOKEN = Deno.env.get('FB_WEBHOOK_VERIFY_TOKEN') || 'pivot_send_webhook_verify_2025';

      console.log('[webhook] Verification request:', { mode, token, challenge });

      if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('[webhook] Webhook verified successfully');
        return new Response(challenge, { status: 200 });
      } else {
        console.error('[webhook] Verification failed');
        return new Response('Forbidden', { status: 403 });
      }
    }

    // Handle POST request for webhook events
    if (req.method === 'POST') {
      const body = await req.json();
      console.log('[webhook] Received event:', JSON.stringify(body, null, 2));

      // Process each entry in the webhook payload
      if (body.object === 'page') {
        for (const entry of body.entry || []) {
          const pageId = entry.id;
          
          // Process messaging events
          for (const messaging of entry.messaging || []) {
            const senderId = messaging.sender?.id;
            
            if (senderId && pageId) {
              console.log(`[webhook] New message from ${senderId} to page ${pageId}`);
              
              // Check if this conversation already exists
              const { data: existing } = await supabaseClient
                .from('fanpage_conversations')
                .select('*')
                .eq('page_id', pageId)
                .eq('sender_id', senderId)
                .maybeSingle();
              
              if (!existing) {
                // New conversation - add it
                const { error: insertError } = await supabaseClient
                  .from('fanpage_conversations')
                  .insert({
                    page_id: pageId,
                    sender_id: senderId,
                  });
                
                if (insertError) {
                  console.error('[webhook] Error inserting conversation:', insertError);
                } else {
                  console.log('[webhook] New conversation saved');
                  
                  // Update conversation count for all fanpages with this page_id
                  const { count, error: countError } = await supabaseClient
                    .from('fanpage_conversations')
                    .select('*', { count: 'exact', head: true })
                    .eq('page_id', pageId);
                  
                  if (countError) {
                    console.error('[webhook] Error counting conversations:', countError);
                  }
                  
                  const conversationCount = count || 0;
                  
                  // Update all fanpages with this page_id (they might be connected to different apps)
                  const { error: updateError } = await supabaseClient
                    .from('fanpages')
                    .update({ conversations: conversationCount })
                    .eq('page_id', pageId);
                  
                  if (updateError) {
                    console.error('[webhook] Error updating fanpage:', updateError);
                  } else {
                    console.log(`[webhook] Updated fanpage ${pageId} count to ${conversationCount}`);
                  }
                }
              }
            }
          }
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response('Method not allowed', { status: 405 });
  } catch (error) {
    console.error('[webhook] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
