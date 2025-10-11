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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { action, campaign_id } = await req.json();

    console.log(`[campaign-control] Action: ${action}, Campaign: ${campaign_id}`);

    if (action === "start") {
      // Update campaign status
      await supabaseClient
        .from('campaigns')
        .update({ status: 'running' })
        .eq('id', campaign_id);

      // Start the sending process in background (fire and forget)
      startCampaignSending(campaign_id).catch(err => 
        console.error('[campaign-control] Background task error:', err)
      );

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === "pause") {
      await supabaseClient
        .from('campaigns')
        .update({ status: 'paused' })
        .eq('id', campaign_id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error('Invalid action');
  } catch (error) {
    console.error('[campaign-control] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function startCampaignSending(campaignId: string) {
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    console.log(`[campaign-sending] Starting campaign: ${campaignId}`);

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabaseClient
      .from('campaigns')
      .select('*, messages(*)')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      throw new Error('Campaign not found');
    }

    // Get campaign fanpages
    const { data: campaignFanpages } = await supabaseClient
      .from('campaign_fanpages')
      .select('page_id')
      .eq('campaign_id', campaignId);

    if (!campaignFanpages || campaignFanpages.length === 0) {
      throw new Error('No fanpages linked to campaign');
    }

    // Get pacing profile
    let pacingProfile: any = {
      batch_size: 50,
      parallel_batches: 3,
      sleep_between_pools_sec: 3,
      jitter_pct: 30,
      error_ratio_threshold: 12,
      cooldown_on_error_sec: 20,
      max_retries_per_pool: 2,
      backoff_multiplier: 2,
    };

    if (campaign.pacing_profile_id) {
      const { data: profile } = await supabaseClient
        .from('pacing_profiles')
        .select('*')
        .eq('id', campaign.pacing_profile_id)
        .single();
      
      if (profile) {
        pacingProfile = profile;
      }
    }

    console.log(`[campaign-sending] Pacing: ${JSON.stringify(pacingProfile)}`);

    // Get all conversations for selected fanpages (fetch ALL without limit)
    let allConversations: any[] = [];
    let from = 0;
    const pageSize = 1000;
    
    while (true) {
      const { data: conversations, error } = await supabaseClient
        .from('fanpage_conversations')
        .select('*')
        .in('page_id', campaignFanpages.map(f => f.page_id))
        .range(from, from + pageSize - 1);
      
      if (error) {
        console.error('[campaign-sending] Error fetching conversations:', error);
        break;
      }
      
      if (!conversations || conversations.length === 0) break;
      
      allConversations = allConversations.concat(conversations);
      console.log(`[campaign-sending] Fetched ${conversations.length} conversations (total: ${allConversations.length})`);
      
      if (conversations.length < pageSize) break;
      from += pageSize;
    }
    
    const conversations = allConversations;

    if (!conversations || conversations.length === 0) {
      throw new Error('No conversations found');
    }

    // Update total recipients
    await supabaseClient
      .from('campaigns')
      .update({ total_recipients: conversations.length })
      .eq('id', campaignId);

    console.log(`[campaign-sending] Found ${conversations.length} recipients`);

    // Process in batches with pacing
    const batchSize = pacingProfile.batch_size;
    const parallelBatches = pacingProfile.parallel_batches;
    let processed = 0;
    let delivered = 0;
    let failed = 0;
    let currentCooldown = pacingProfile.cooldown_on_error_sec;

    for (let i = 0; i < conversations.length; i += batchSize * parallelBatches) {
      // Check if campaign is still running
      const { data: currentCampaign } = await supabaseClient
        .from('campaigns')
        .select('status')
        .eq('id', campaignId)
        .single();

      if (currentCampaign?.status !== 'running') {
        console.log('[campaign-sending] Campaign paused or stopped');
        break;
      }

      // Process parallel batches
      const batchPromises = [];
      for (let j = 0; j < parallelBatches; j++) {
        const start = i + (j * batchSize);
        const end = Math.min(start + batchSize, conversations.length);
        if (start >= conversations.length) break;

        const batch = conversations.slice(start, end);
        batchPromises.push(sendBatch(supabaseClient, campaignId, campaign, batch, pacingProfile));
      }

      const results = await Promise.allSettled(batchPromises);
      
      // Count results
      let batchErrors = 0;
      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          processed += result.value.processed;
          delivered += result.value.delivered;
          failed += result.value.failed;
          batchErrors += result.value.errors;
        } else {
          console.error('[campaign-sending] Batch failed:', result.reason);
        }
      });

      // Update campaign stats
      await supabaseClient
        .from('campaigns')
        .update({ processed, delivered, failed })
        .eq('id', campaignId);

      // Calculate error ratio
      const totalRequests = results.reduce((acc, r) => 
        acc + (r.status === 'fulfilled' ? r.value.processed : 0), 0);
      const errorRatio = totalRequests > 0 ? (batchErrors / totalRequests) * 100 : 0;

      console.log(`[campaign-sending] Batch complete. Processed: ${processed}, Delivered: ${delivered}, Failed: ${failed}, Error ratio: ${errorRatio.toFixed(2)}%`);

      // Apply cooldown if error threshold exceeded
      if (errorRatio > pacingProfile.error_ratio_threshold) {
        console.log(`[campaign-sending] Error threshold exceeded (${errorRatio.toFixed(2)}% > ${pacingProfile.error_ratio_threshold}%), applying cooldown: ${currentCooldown}s`);
        await new Promise(resolve => setTimeout(resolve, currentCooldown * 1000));
        currentCooldown = Math.min(currentCooldown * pacingProfile.backoff_multiplier, 300); // Max 5 min
      } else {
        // Reset cooldown on success
        currentCooldown = pacingProfile.cooldown_on_error_sec;
        
        // Normal sleep with jitter
        const jitterRange = pacingProfile.sleep_between_pools_sec * (pacingProfile.jitter_pct / 100);
        const jitter = (Math.random() * 2 - 1) * jitterRange;
        const sleepTime = Math.max(0, pacingProfile.sleep_between_pools_sec + jitter);
        await new Promise(resolve => setTimeout(resolve, sleepTime * 1000));
      }
    }

    // Mark campaign as finished
    await supabaseClient
      .from('campaigns')
      .update({ status: 'finished' })
      .eq('id', campaignId);

    console.log(`[campaign-sending] Campaign finished. Total delivered: ${delivered}, Failed: ${failed}`);
  } catch (error) {
    console.error('[campaign-sending] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    await supabaseClient
      .from('campaigns')
      .update({ status: 'failed' })
      .eq('id', campaignId);
  }
}

async function sendBatch(supabaseClient: any, campaignId: string, campaign: any, conversations: any[], pacingProfile: any) {
  let processed = 0;
  let delivered = 0;
  let failed = 0;
  let errors = 0;

  // Get message
  const message = campaign.messages[0];
  if (!message) {
    throw new Error('No message found');
  }

  // Build batch requests
  const batchRequests = conversations.map((conv, idx) => {
    const messageData: any = {
      recipient: { id: conv.sender_id },
      messaging_type: "MESSAGE_TAG",
      tag: "CONFIRMED_EVENT_UPDATE",
    };

    if (message.type === 'text') {
      messageData.message = { text: message.arguments.text };
    } else if (message.type === 'image') {
      messageData.message = {
        attachment: message.arguments.attachment,
        text: message.arguments.text || '',
      };
    }

    return {
      method: "POST",
      relative_url: "me/messages",
      body: JSON.stringify(messageData),
    };
  });

  // Get page tokens and send
  for (const conv of conversations) {
    try {
      // Get token for this page
      const appKey = campaign.active_app_key || 
        (await supabaseClient.from('fanpages').select('active_app_key').eq('page_id', conv.page_id).single()).data?.active_app_key;

      if (!appKey) {
        console.error(`[send-batch] No app key for page ${conv.page_id}`);
        failed++;
        continue;
      }

      const { data: tokenData } = await supabaseClient
        .from('fanpage_app_tokens')
        .select('page_access_token_encrypted')
        .eq('page_id', conv.page_id)
        .eq('app_key', appKey)
        .single();

      if (!tokenData) {
        console.error(`[send-batch] No token for page ${conv.page_id} with app ${appKey}`);
        failed++;
        continue;
      }

      const pageAccessToken = atob(tokenData.page_access_token_encrypted);

      // Send message
      const messageData: any = {
        recipient: { id: conv.sender_id },
        messaging_type: "MESSAGE_TAG",
        tag: "CONFIRMED_EVENT_UPDATE",
      };

      if (message.type === 'text') {
        messageData.message = { text: message.arguments.text };
      } else if (message.type === 'image') {
        messageData.message = message.arguments;
      } else if (message.type === 'button') {
        // Text + Button message
        messageData.message = {
          attachment: message.arguments.attachment
        };
      } else if (message.type === 'generic') {
        // Card message - ensure default_action is present for clickable image
        const cardPayload = message.arguments.attachment.payload;
        if (cardPayload.elements && cardPayload.elements[0] && !cardPayload.elements[0].default_action) {
          // Add default_action if not present (use first button URL)
          const firstButton = cardPayload.elements[0].buttons?.[0];
          if (firstButton?.url) {
            cardPayload.elements[0].default_action = {
              type: "web_url",
              url: firstButton.url
            };
          }
        }
        messageData.message = {
          attachment: message.arguments.attachment
        };
      }

      const response = await fetch(
        `https://graph.facebook.com/v24.0/me/messages?access_token=${pageAccessToken}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(messageData),
        }
      );

      const result = await response.json();
      processed++;

      if (response.ok) {
        delivered++;
      } else {
        failed++;
        errors++;
        console.error(`[send-batch] Error sending to ${conv.sender_id}:`, result);
      }

      // Save result
      await supabaseClient.from('send_results').insert({
        campaign_id: campaignId,
        page_id: conv.page_id,
        sender_id: conv.sender_id,
        http_code: response.status,
        fb_body_json: result,
      });

    } catch (error) {
      processed++;
      failed++;
      errors++;
      console.error('[send-batch] Error:', error);
    }
  }

  return { processed, delivered, failed, errors };
}
