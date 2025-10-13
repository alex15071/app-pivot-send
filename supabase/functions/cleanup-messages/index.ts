import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('[cleanup] Starting cleanup process');

  // Ultra-aggressive cleanup - direct DELETE without SELECT
  async function performCleanup() {
    try {
      console.log('[cleanup] Starting ULTRA-AGGRESSIVE cleanup - direct delete approach');
      
      // Paso 1: Pausar todas las campañas primero (con timeout corto)
      console.log('[cleanup] Step 1: Pausing all campaigns');
      try {
        const { error: pauseError } = await supabase
          .from('campaigns')
          .update({ status: 'paused' })
          .eq('status', 'running');
        
        if (pauseError) {
          console.error('[cleanup] Could not pause campaigns:', pauseError.message);
        } else {
          console.log('[cleanup] Campaigns paused successfully');
        }
      } catch (e) {
        console.error('[cleanup] Exception pausing campaigns:', e);
      }

      // Paso 2: Intentar DELETE directo por bloques usando limit
      // Esto es más rápido que SELECT + DELETE
      console.log('[cleanup] Step 2: Starting direct delete operations');
      
      let totalDeleted = 0;
      const batchSize = 100; // Lotes ULTRA pequeños
      const maxBatches = 500; // Muchas más iteraciones
      const delayMs = 300; // Delay corto entre lotes
      
      for (let i = 0; i < maxBatches; i++) {
        try {
          console.log(`[cleanup] Direct delete batch ${i + 1}/${maxBatches}`);
          
          // DELETE directo con límite - más eficiente que SELECT + DELETE
          const { error, count } = await supabase
            .from('scheduled_messages')
            .delete({ count: 'exact' })
            .eq('status', 'pending')
            .limit(batchSize);

          if (error) {
            console.error(`[cleanup] Batch ${i + 1} delete error:`, error.message);
            await new Promise(resolve => setTimeout(resolve, delayMs * 3));
            continue;
          }

          const deleted = count || 0;
          totalDeleted += deleted;
          console.log(`[cleanup] Batch ${i + 1}: deleted ${deleted} messages. Total: ${totalDeleted}`);

          // Si no eliminamos nada, terminamos
          if (deleted === 0) {
            console.log('[cleanup] No more messages to delete');
            break;
          }

          // Si eliminamos menos del límite, casi terminamos
          if (deleted < batchSize) {
            console.log('[cleanup] Approaching end of pending messages');
          }

          // Pausa entre lotes
          await new Promise(resolve => setTimeout(resolve, delayMs));
          
        } catch (batchError) {
          console.error(`[cleanup] Exception in batch ${i + 1}:`, batchError);
          await new Promise(resolve => setTimeout(resolve, delayMs * 3));
        }
      }

      console.log(`[cleanup] ✅ Cleanup finished. Total deleted: ${totalDeleted} messages`);
      
    } catch (error) {
      console.error('[cleanup] Fatal error:', error);
    }
  }

  // Iniciar la limpieza en background (sin esperar)
  performCleanup().catch(err => console.error('[cleanup] Background error:', err));

  // Responder inmediatamente
  return new Response(
    JSON.stringify({ 
      success: true, 
      message: 'Cleanup process started in background' 
    }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200 
    }
  );
});
