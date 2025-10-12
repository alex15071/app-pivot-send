import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[sequence-scheduler] Starting scheduled message check');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // First, reset any messages stuck in 'sending' for more than 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: stuckMessages } = await supabase
      .from('message_sequences')
      .select('id')
      .eq('status', 'sending')
      .lt('updated_at', fiveMinutesAgo);

    if (stuckMessages && stuckMessages.length > 0) {
      console.log(`[sequence-scheduler] Resetting ${stuckMessages.length} stuck messages`);
      await supabase
        .from('message_sequences')
        .update({ status: 'scheduled' })
        .in('id', stuckMessages.map(m => m.id));
    }

    // Find messages that should be sent now
    const { data: dueMessages, error: fetchError } = await supabase
      .from('message_sequences')
      .select('*, campaigns!inner(id, name, status, is_sequence)')
      .eq('status', 'scheduled')
      .lte('scheduled_for', new Date().toISOString())
      .eq('campaigns.status', 'running')
      .order('scheduled_for', { ascending: true })
      .limit(10); // Process max 10 messages per minute

    if (fetchError) {
      console.error('[sequence-scheduler] Error fetching due messages:', fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!dueMessages || dueMessages.length === 0) {
      console.log('[sequence-scheduler] No messages due for sending');
      return new Response(JSON.stringify({ processed: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[sequence-scheduler] Found ${dueMessages.length} messages to send`);

    // Process each message
    const results = [];
    for (const message of dueMessages) {
      try {
        console.log(`[sequence-scheduler] Processing message ${message.id} (order: ${message.sequence_order}) for campaign ${message.campaign_id}`);

        // Mark as sending
        await supabase
          .from('message_sequences')
          .update({ status: 'sending' })
          .eq('id', message.id);

        // Invoke campaign-control to send this specific message
        const controlUrl = `${supabaseUrl}/functions/v1/campaign-control`;
        const response = await fetch(controlUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`
          },
          body: JSON.stringify({
            action: 'start',
            campaign_id: message.campaign_id,
            message_sequence_id: message.id,
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[sequence-scheduler] Error invoking campaign-control for message ${message.id}:`, errorText);
          await supabase
            .from('message_sequences')
            .update({ status: 'failed' })
            .eq('id', message.id);
          
          results.push({ message_id: message.id, success: false, error: errorText });
        } else {
          const resultData = await response.json();
          console.log(`[sequence-scheduler] Successfully triggered message ${message.id}:`, resultData);
          results.push({ message_id: message.id, success: true });
        }
      } catch (err) {
        console.error(`[sequence-scheduler] Unexpected error processing message ${message.id}:`, err);
        await supabase
          .from('message_sequences')
          .update({ status: 'failed' })
          .eq('id', message.id);
        
        results.push({ message_id: message.id, success: false, error: String(err) });
      }
    }

    console.log('[sequence-scheduler] Processing complete:', results);

    return new Response(JSON.stringify({ processed: dueMessages.length, results }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[sequence-scheduler] Fatal error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
