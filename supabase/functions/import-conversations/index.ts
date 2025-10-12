import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ConversationRecord {
  sender_id?: string;
  conversation_id?: string;
  page_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { page_id, conversations } = await req.json();

    if (!page_id || !Array.isArray(conversations)) {
      return new Response(
        JSON.stringify({ error: 'page_id and conversations array required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[import-conversations] Starting import for page ${page_id}, ${conversations.length} records`);

    let imported = 0;
    let skipped = 0;

    // Process in batches of 500
    const batchSize = 500;
    for (let i = 0; i < conversations.length; i += batchSize) {
      const batch = conversations.slice(i, i + batchSize);
      
      // Prepare records for insertion
      const records = batch.map((conv: ConversationRecord) => ({
        page_id: page_id,
        sender_id: conv.sender_id || conv.conversation_id,
        created_at: new Date().toISOString(),
      }));

      // Insert batch, ignore duplicates
      const { data, error } = await supabase
        .from('fanpage_conversations')
        .upsert(records, { 
          onConflict: 'page_id,sender_id',
          ignoreDuplicates: true 
        })
        .select();

      if (error) {
        console.error(`[import-conversations] Error inserting batch ${i}:`, error);
        skipped += batch.length;
      } else {
        imported += (data?.length || 0);
        skipped += batch.length - (data?.length || 0);
      }

      console.log(`[import-conversations] Batch ${Math.floor(i/batchSize) + 1}: ${data?.length || 0} imported, ${batch.length - (data?.length || 0)} skipped`);
    }

    // Update fanpage conversation count
    const { count } = await supabase
      .from('fanpage_conversations')
      .select('*', { count: 'exact', head: true })
      .eq('page_id', page_id);

    await supabase
      .from('fanpages')
      .update({ conversations: count || 0 })
      .eq('page_id', page_id);

    console.log(`[import-conversations] Import complete: ${imported} imported, ${skipped} skipped, total: ${count}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        imported, 
        skipped,
        total: count || 0
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[import-conversations] Error:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
