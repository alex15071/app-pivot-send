import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ConversationRecord {
  id?: string;
  sender_id?: string;
  conversation_id?: string;
  fanpage_id?: string;
  page_id?: string;
  created_at?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { page_id, conversations } = body;

    console.log(`[import-conversations] Request body size: ${JSON.stringify(body).length} bytes`);

    if (!page_id || !Array.isArray(conversations)) {
      console.error('[import-conversations] Invalid request:', { page_id, conversationsType: typeof conversations });
      return new Response(
        JSON.stringify({ error: 'page_id and conversations array required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[import-conversations] Starting import for page ${page_id}, ${conversations.length} records`);
    console.log(`[import-conversations] First record:`, conversations[0]);

    // Prepare ALL records for insertion at once
    const records = conversations.map((conv: ConversationRecord, index: number) => {
      const senderId = conv.conversation_id || conv.sender_id;
      
      if (!senderId) {
        console.error(`[import-conversations] Record ${index} missing conversation_id/sender_id:`, conv);
      }
      
      return {
        page_id: conv.fanpage_id || conv.page_id || page_id,
        sender_id: senderId,
        created_at: conv.created_at || new Date().toISOString(),
      };
    }).filter(record => record.sender_id); // Filter out invalid records

    console.log(`[import-conversations] Prepared ${records.length} valid records for insertion`);

    // Insert ALL records at once, ignore duplicates
    const { data, error } = await supabase
      .from('fanpage_conversations')
      .upsert(records, { 
        onConflict: 'page_id,sender_id',
        ignoreDuplicates: true 
      })
      .select();

    const imported = data?.length || 0;
    const skipped = conversations.length - imported;

    if (error) {
      console.error(`[import-conversations] Error inserting records:`, error);
    }

    console.log(`[import-conversations] Import complete: ${imported} imported, ${skipped} skipped`);

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
