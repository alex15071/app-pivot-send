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

  // Función de limpieza en background - optimizada para DB sobrecargada
  async function performCleanup() {
    try {
      let totalDeleted = 0;
      const batchSize = 500; // Lotes más pequeños para evitar timeouts
      const maxBatches = 200; // Más iteraciones pero más pequeñas
      const delayBetweenBatches = 500; // Más tiempo entre lotes
      
      console.log('[cleanup] Starting aggressive cleanup with small batches');

      // Intentar eliminar mensajes directamente sin pausar campañas primero
      // (pausar campañas está fallando por timeout)
      for (let i = 0; i < maxBatches; i++) {
        try {
          console.log(`[cleanup] Batch ${i + 1}/${maxBatches} - Attempting to delete up to ${batchSize} messages`);
          
          // Intentar obtener y eliminar en una operación más simple
          const { data: messages, error: selectError } = await supabase
            .from('scheduled_messages')
            .select('id')
            .eq('status', 'pending')
            .limit(batchSize);

          if (selectError) {
            console.error(`[cleanup] Error selecting batch ${i + 1}:`, selectError.message);
            // Continuar intentando con el siguiente lote
            await new Promise(resolve => setTimeout(resolve, delayBetweenBatches * 2));
            continue;
          }

          if (!messages || messages.length === 0) {
            console.log('[cleanup] No more pending messages found');
            break;
          }

          // Eliminar este lote
          const ids = messages.map(m => m.id);
          const { error: deleteError } = await supabase
            .from('scheduled_messages')
            .delete()
            .in('id', ids);

          if (deleteError) {
            console.error(`[cleanup] Error deleting batch ${i + 1}:`, deleteError.message);
            // No romper, seguir intentando
            await new Promise(resolve => setTimeout(resolve, delayBetweenBatches * 2));
            continue;
          }

          totalDeleted += messages.length;
          console.log(`[cleanup] Batch ${i + 1} complete. Deleted: ${messages.length}. Total deleted: ${totalDeleted}`);

          // Si eliminamos menos del límite, ya no hay más
          if (messages.length < batchSize) {
            console.log('[cleanup] Reached end of pending messages');
            break;
          }

          // Pausa entre lotes para no sobrecargar la DB
          await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
          
        } catch (batchError) {
          console.error(`[cleanup] Exception in batch ${i + 1}:`, batchError);
          // Continuar con el siguiente lote
          await new Promise(resolve => setTimeout(resolve, delayBetweenBatches * 2));
        }
      }

      console.log(`[cleanup] Cleanup complete. Total messages deleted: ${totalDeleted}`);
      
      // Intentar pausar campañas al final si logramos limpiar algo
      if (totalDeleted > 0) {
        console.log('[cleanup] Attempting to pause campaigns after cleanup');
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
        } catch (pauseException) {
          console.error('[cleanup] Exception pausing campaigns:', pauseException);
        }
      }
      
    } catch (error) {
      console.error('[cleanup] Fatal error during cleanup:', error);
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
