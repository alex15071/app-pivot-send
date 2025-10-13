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

  // Función de limpieza en background
  async function performCleanup() {
    try {
      let totalDeleted = 0;
      const batchSize = 10000;
      const maxBatches = 100; // Máximo 1M registros por llamada
      
      console.log('[cleanup] Pausing running campaigns first');
      
      // Primero pausar las campañas para detener la generación
      const { error: pauseError } = await supabase
        .from('campaigns')
        .update({ status: 'paused' })
        .eq('status', 'running');
      
      if (pauseError) {
        console.error('[cleanup] Error pausing campaigns:', pauseError);
      } else {
        console.log('[cleanup] All campaigns paused successfully');
      }

      // Luego eliminar mensajes programados en lotes
      for (let i = 0; i < maxBatches; i++) {
        console.log(`[cleanup] Batch ${i + 1}/${maxBatches} - Deleting up to ${batchSize} messages`);
        
        // Obtener IDs de mensajes pendientes
        const { data: messages } = await supabase
          .from('scheduled_messages')
          .select('id')
          .eq('status', 'pending')
          .limit(batchSize);

        if (!messages || messages.length === 0) {
          console.log('[cleanup] No more pending messages to delete');
          break;
        }

        // Eliminar este lote
        const ids = messages.map(m => m.id);
        const { error: deleteError } = await supabase
          .from('scheduled_messages')
          .delete()
          .in('id', ids);

        if (deleteError) {
          console.error(`[cleanup] Error deleting batch ${i + 1}:`, deleteError);
          break;
        }

        totalDeleted += messages.length;
        console.log(`[cleanup] Batch ${i + 1} complete. Total deleted: ${totalDeleted}`);

        // Si eliminamos menos del límite, ya no hay más
        if (messages.length < batchSize) {
          console.log('[cleanup] Reached end of pending messages');
          break;
        }

        // Pequeña pausa entre lotes para no sobrecargar la DB
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log(`[cleanup] Cleanup complete. Total messages deleted: ${totalDeleted}`);
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
