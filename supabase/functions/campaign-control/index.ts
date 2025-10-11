import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Declare EdgeRuntime global for TypeScript
declare const EdgeRuntime: {
  waitUntil: (promise: Promise<any>) => void;
} | undefined;

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

    const { action, campaign_id, offset, message_sequence_id } = await req.json();

    console.log(`[campaign-control] Action: ${action}, Campaign: ${campaign_id}, Offset: ${offset || 0}, Sequence Message: ${message_sequence_id || 'none'}`);

    if (action === "start" || action === "continue") {
      const startOffset = offset || 0;
      
      // Check if this is a sequence campaign
      const { data: campaign } = await supabaseClient
        .from('campaigns')
        .select('is_sequence')
        .eq('id', campaign_id)
        .single();

      // For sequence campaigns on start (without specific message_sequence_id), trigger the scheduler immediately
      if (action === "start" && campaign?.is_sequence && !message_sequence_id) {
        console.log('[campaign-control] Starting sequence campaign, triggering scheduler');
        
        // Update campaign status to running
        await supabaseClient
          .from('campaigns')
          .update({ status: 'running' })
          .eq('id', campaign_id);

        // Update any scheduled messages that are overdue to now
        const now = new Date().toISOString();
        await supabaseClient
          .from('message_sequences')
          .update({ scheduled_for: now })
          .eq('campaign_id', campaign_id)
          .eq('status', 'scheduled')
          .lt('scheduled_for', now);

        // Invoke the sequence scheduler to process any ready messages
        const schedulerPromise = supabaseClient.functions.invoke('sequence-scheduler', {
          body: {}
        }).then(({ data, error }) => {
          if (error) {
            console.error('[campaign-control] Error invoking sequence-scheduler:', error);
          } else {
            console.log('[campaign-control] Sequence scheduler triggered:', data);
          }
        });

        if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
          EdgeRuntime.waitUntil(schedulerPromise);
        }

        return new Response(JSON.stringify({ success: true, message: 'Sequence started, scheduler triggered' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // For regular campaigns, update status on start
      if (action === "start" && !message_sequence_id) {
        await supabaseClient
          .from('campaigns')
          .update({ status: 'running' })
          .eq('id', campaign_id);
      }

      // Start the sending process in background with offset using waitUntil
      const sendingPromise = startCampaignSending(campaign_id, startOffset, message_sequence_id).catch(err => 
        console.error('[campaign-control] Background task error:', err)
      );
      
      // Use waitUntil to ensure the function stays alive until the task completes
      if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
        EdgeRuntime.waitUntil(sendingPromise);
      }

      // Return immediately to avoid timeout
      return new Response(JSON.stringify({ success: true, message: 'Campaign started in background' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === "pause") {
      await supabaseClient
        .from('campaigns')
        .update({ 
          status: 'paused',
          current_page_stats: []
        })
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

async function startCampaignSending(campaignId: string, offset: number = 0, messageSequenceId?: string) {
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    console.log(`[campaign-sending] Starting campaign: ${campaignId}, offset: ${offset}`);

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabaseClient
      .from('campaigns')
      .select('*, messages(*)')
      .eq('id', campaignId)
      .maybeSingle();

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

    // Handle sequence message or regular message
    let message;
    let sequenceAppKey;
    if (messageSequenceId) {
      // For sequences, fetch the specific message from message_sequences
      const { data: seqMessage, error: seqError } = await supabaseClient
        .from('message_sequences')
        .select('*')
        .eq('id', messageSequenceId)
        .maybeSingle();

      if (seqError || !seqMessage) {
        console.error('[campaign-sending] Sequence message not found:', seqError);
        await supabaseClient.from('message_sequences').update({ status: 'failed' }).eq('id', messageSequenceId);
        return;
      }

      message = {
        type: seqMessage.message_type,
        arguments: seqMessage.message_arguments,
      };
      sequenceAppKey = seqMessage.app_key; // Get the app_key from sequence message
      console.log(`[campaign-sending] Using sequence message ${messageSequenceId} (order: ${seqMessage.sequence_order}, app: ${sequenceAppKey || 'default'})`);
    } else {
      // Regular campaign message
      message = campaign.messages?.[0];
      if (!message) {
        console.error('[campaign-sending] No message found for campaign');
        return;
      }
    }

    // CHUNK-BASED PROCESSING: Process max 1000 messages per invocation to avoid timeout
    const CHUNK_SIZE = 1000;
    
    // Get total count first (only on first run)
    if (offset === 0) {
      const { count } = await supabaseClient
        .from('fanpage_conversations')
        .select('*', { count: 'exact', head: true })
        .in('page_id', campaignFanpages.map(f => f.page_id));
      
      if (count) {
        await supabaseClient
          .from('campaigns')
          .update({ total_recipients: count })
          .eq('id', campaignId);
        console.log(`[campaign-sending] Total recipients: ${count}`);
      }
    }
    
    // Fetch only this chunk of conversations
    const { data: conversations, error: convError } = await supabaseClient
      .from('fanpage_conversations')
      .select('*')
      .in('page_id', campaignFanpages.map(f => f.page_id))
      .range(offset, offset + CHUNK_SIZE - 1);

    if (convError) {
      console.error('[campaign-sending] Error fetching conversations:', convError);
      throw convError;
    }

    if (!conversations || conversations.length === 0) {
      console.log('[campaign-sending] No more conversations to process');
      
      if (messageSequenceId) {
        // Mark sequence message as completed
        await supabaseClient
          .from('message_sequences')
          .update({ 
            status: 'sent',
            sent_count: 0,
            delivered_count: 0,
            failed_count: 0
          })
          .eq('id', messageSequenceId);
        
        console.log(`[campaign-sending] Sequence message ${messageSequenceId} completed with no conversations`);
      } else {
        // Mark regular campaign as finished and clear stats
        await supabaseClient
          .from('campaigns')
          .update({ 
            status: 'finished',
            current_page_stats: []
          })
          .eq('id', campaignId);
      }
      
      return;
    }

    console.log(`[campaign-sending] Processing chunk: ${offset}-${offset + conversations.length} (${conversations.length} conversations)`);

    // Get current campaign stats to accumulate
    const { data: currentStats } = await supabaseClient
      .from('campaigns')
      .select('processed, delivered, failed')
      .eq('id', campaignId)
      .maybeSingle();
    
    // Process in batches with pacing
    const batchSize = pacingProfile.batch_size;
    const parallelBatches = pacingProfile.parallel_batches;
    let processed = currentStats?.processed || 0;
    let delivered = currentStats?.delivered || 0;
    let failed = currentStats?.failed || 0;
    let currentCooldown = pacingProfile.cooldown_on_error_sec;
    
    // Track which pages are being processed
    const pageIds = campaignFanpages.map(f => f.page_id);
    const { data: fanpageNames } = await supabaseClient
      .from('fanpages')
      .select('page_id, name')
      .in('page_id', pageIds);

    for (let i = 0; i < conversations.length; i += batchSize * parallelBatches) {
      // Check if campaign is still running (use maybeSingle to avoid errors)
      const { data: currentCampaign } = await supabaseClient
        .from('campaigns')
        .select('status')
        .eq('id', campaignId)
        .maybeSingle();

      if (!currentCampaign || currentCampaign.status !== 'running') {
        console.log('[campaign-sending] Campaign paused or stopped');
        break;
      }
      
      console.log(`[campaign-sending] Processing batch ${Math.floor(i / (batchSize * parallelBatches)) + 1} (${i}-${Math.min(i + batchSize * parallelBatches, conversations.length)} of ${conversations.length})`);

      // Process parallel batches
      const batchPromises = [];
      for (let j = 0; j < parallelBatches; j++) {
        const start = i + (j * batchSize);
        const end = Math.min(start + batchSize, conversations.length);
        if (start >= conversations.length) break;

        const batch = conversations.slice(start, end);
        // Pass message and sequence app_key to sendBatch via modified campaign
        const campaignWithMessage = { ...campaign, messages: [message], sequence_app_key: sequenceAppKey };
        batchPromises.push(sendBatch(supabaseClient, campaignId, campaignWithMessage, batch, pacingProfile));
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

      // Calculate page stats for this batch
      const pageStatsMap = new Map<string, { delivered: number; failed: number }>();
      conversations.slice(i, Math.min(i + batchSize * parallelBatches, conversations.length)).forEach(conv => {
        if (!pageStatsMap.has(conv.page_id)) {
          pageStatsMap.set(conv.page_id, { delivered: 0, failed: 0 });
        }
      });
      
      // Build current_page_stats with fanpage names
      const currentPageStats = Array.from(pageStatsMap.keys()).map(pageId => {
        const fanpage = fanpageNames?.find(f => f.page_id === pageId);
        return {
          page_id: pageId,
          page_name: fanpage?.name || pageId,
          processing: true
        };
      });
      
      // Update campaign stats every batch
      const { error: updateError } = await supabaseClient
        .from('campaigns')
        .update({ 
          processed, 
          delivered, 
          failed,
          current_offset: offset + i,
          current_page_stats: currentPageStats
        })
        .eq('id', campaignId);
      
      if (updateError) {
        console.error('[campaign-sending] Error updating stats:', updateError);
      }

      // If processing a sequence message, also update its stats
      if (messageSequenceId) {
        await supabaseClient
          .from('message_sequences')
          .update({
            sent_count: processed,
            delivered_count: delivered,
            failed_count: failed
          })
          .eq('id', messageSequenceId);
      }

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

    // Check if there are more conversations to process
    const nextOffset = offset + conversations.length;
    const { data: moreConversations } = await supabaseClient
      .from('fanpage_conversations')
      .select('page_id')
      .in('page_id', campaignFanpages.map(f => f.page_id))
      .range(nextOffset, nextOffset)
      .limit(1);

    if (moreConversations && moreConversations.length > 0) {
      // More messages to send - reinvoke this function
      console.log(`[campaign-sending] More messages pending. Reinvoking from offset ${nextOffset}`);
      
      // Call campaign-control to continue processing
      const continueUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/campaign-control`;
      await fetch(continueUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
        },
        body: JSON.stringify({
          action: 'continue',
          campaign_id: campaignId,
          offset: nextOffset,
          message_sequence_id: messageSequenceId
        })
      }).then(res => {
        if (!res.ok) {
          console.error('[campaign-sending] Failed to reinvoke:', res.status, res.statusText);
        } else {
          console.log('[campaign-sending] Successfully reinvoked');
        }
      }).catch(err => console.error('[campaign-sending] Reinvoke error:', err));
    } else {
      // Update status based on whether this is a sequence or regular campaign
      if (messageSequenceId) {
        // Mark sequence message as sent
        await supabaseClient
          .from('message_sequences')
          .update({
            status: 'sent',
            sent_count: processed,
            delivered_count: delivered,
            failed_count: failed,
          })
          .eq('id', messageSequenceId);

        // Update campaign's current_sequence_step
        const { data: seqData } = await supabaseClient
          .from('message_sequences')
          .select('sequence_order')
          .eq('id', messageSequenceId)
          .maybeSingle();
        
        if (seqData) {
          await supabaseClient
            .from('campaigns')
            .update({ current_sequence_step: seqData.sequence_order })
            .eq('id', campaignId);
        }

        console.log(`[campaign-sending] Sequence message ${messageSequenceId} finished. Delivered: ${delivered}, Failed: ${failed}`);
      } else {
        // Regular campaign finished
        await supabaseClient
          .from('campaigns')
          .update({
            status: 'finished',
            processed,
            delivered,
            failed,
            current_page_stats: []
          })
          .eq('id', campaignId);

        console.log(`[campaign-sending] Campaign finished. Total delivered: ${delivered}, Failed: ${failed}`);
      }
    }
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

  // Message should already be set in startCampaignSending and passed via campaign
  const message = campaign.messages?.[0];
  if (!message) {
    throw new Error('No message found');
  }

  // Group conversations by page for efficient token fetching
  const conversationsByPage = new Map<string, any[]>();
  for (const conv of conversations) {
    if (!conversationsByPage.has(conv.page_id)) {
      conversationsByPage.set(conv.page_id, []);
    }
    conversationsByPage.get(conv.page_id)!.push(conv);
  }

  // Process each page's conversations
  for (const [pageId, pageConversations] of conversationsByPage) {
    try {
      // Get token for this page (once per page instead of per conversation)
      // Use sequence app_key if available, otherwise campaign active_app_key or fanpage active_app_key
      const appKey = campaign.sequence_app_key || campaign.active_app_key || 
        (await supabaseClient.from('fanpages').select('active_app_key').eq('page_id', pageId).maybeSingle()).data?.active_app_key;

      if (!appKey) {
        console.error(`[send-batch] No app key for page ${pageId}`);
        failed += pageConversations.length;
        continue;
      }

      const { data: tokenData } = await supabaseClient
        .from('fanpage_app_tokens')
        .select('page_access_token_encrypted')
        .eq('page_id', pageId)
        .eq('app_key', appKey)
        .maybeSingle();

      if (!tokenData) {
        console.error(`[send-batch] No token for page ${pageId} with app ${appKey}`);
        failed += pageConversations.length;
        continue;
      }

      const pageAccessToken = atob(tokenData.page_access_token_encrypted);

      // Send messages to all conversations for this page in parallel
      const sendPromises = pageConversations.map(async (conv) => {
        try {
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
            messageData.message = {
              attachment: message.arguments.attachment
            };
          } else if (message.type === 'generic') {
            // Card message - ensure default_action for clickable image
            const cardPayload = JSON.parse(JSON.stringify(message.arguments.attachment.payload));
            if (cardPayload.elements?.[0] && !cardPayload.elements[0].default_action) {
              const firstButton = cardPayload.elements[0].buttons?.[0];
              if (firstButton?.url) {
                cardPayload.elements[0].default_action = {
                  type: "web_url",
                  url: firstButton.url
                };
              }
            }
            messageData.message = {
              attachment: {
                type: message.arguments.attachment.type,
                payload: cardPayload
              }
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

          // Save result
          await supabaseClient.from('send_results').insert({
            campaign_id: campaignId,
            page_id: pageId,
            sender_id: conv.sender_id,
            http_code: response.status,
            fb_body_json: result,
          });

          return { success: response.ok, result, conv };
        } catch (error) {
          console.error(`[send-batch] Error sending to ${conv.sender_id}:`, error);
          return { success: false, error, conv };
        }
      });

      // Wait for all sends for this page to complete
      const results = await Promise.allSettled(sendPromises);
      
      results.forEach((result) => {
        processed++;
        if (result.status === 'fulfilled' && result.value.success) {
          delivered++;
        } else {
          failed++;
          errors++;
        }
      });

    } catch (error) {
      console.error(`[send-batch] Error processing page ${pageId}:`, error);
      failed += pageConversations.length;
      errors += pageConversations.length;
    }
  }

  return { processed, delivered, failed, errors };
}
