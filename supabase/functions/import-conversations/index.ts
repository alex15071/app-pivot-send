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

    const { page_id, conversations } = await req.json();

    if (!page_id || !Array.isArray(conversations)) {
      return new Response(
        JSON.stringify({ error: 'page_id and conversations array required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[import-conversations] Starting import for page ${page_id}, ${conversations.length} records`);

    // Prepare ALL records for insertion at once
    const records = conversations.map((conv: ConversationRecord) => ({
      page_id: conv.fanpage_id || conv.page_id || page_id,
      sender_id: conv.conversation_id || conv.sender_id,
      created_at: conv.created_at || new Date().toISOString(),
    }));

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
