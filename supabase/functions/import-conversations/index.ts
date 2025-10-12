import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ImportRequest {
  page_id: string;
  conversation_ids?: string[];
  conversations?: any[]; // Legacy support
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: ImportRequest = await req.json();
    const { page_id, conversation_ids, conversations } = body;

    console.log(`[import-conversations] Request body size: ${JSON.stringify(body).length} bytes`);

    if (!page_id) {
      console.error('[import-conversations] Missing page_id');
      return new Response(
        JSON.stringify({ error: 'page_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use new format (conversation_ids) or legacy format (conversations)
    const idsToImport = conversation_ids || 
      (conversations?.map((c: any) => c.conversation_id || c.sender_id).filter(Boolean)) || 
      [];

    if (idsToImport.length === 0) {
      console.error('[import-conversations] No conversation IDs to import');
      return new Response(
        JSON.stringify({ error: 'No conversation IDs provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[import-conversations] Starting import for page ${page_id}, ${idsToImport.length} conversation IDs`);
    console.log(`[import-conversations] First ID:`, idsToImport[0]);

    // Create records using ONLY the conversation IDs and selected page_id
    const records = idsToImport.map((conversationId: string) => ({
      page_id: page_id,
      sender_id: conversationId,
      created_at: new Date().toISOString(),
    }));

    console.log(`[import-conversations] Prepared ${records.length} records for page ${page_id}`);

    // Insert ALL records at once, ignore duplicates
    const { data, error } = await supabase
      .from('fanpage_conversations')
      .upsert(records, { 
        onConflict: 'page_id,sender_id',
        ignoreDuplicates: true 
      })
      .select();

    const imported = data?.length || 0;
    const skipped = idsToImport.length - imported;

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
