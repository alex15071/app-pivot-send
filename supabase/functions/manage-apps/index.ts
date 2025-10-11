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
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { action, id, key, name, fb_app_id, fb_app_secret } = await req.json();

    console.log(`[manage-apps] Action: ${action}`, { user_id: user.id });

    if (action === 'create') {
      // Encrypt app secret (in production, use proper encryption)
      const encrypted_secret = btoa(fb_app_secret);

      const { data, error } = await supabaseClient
        .from('apps')
        .insert({
          key,
          name,
          fb_app_id,
          fb_app_secret_encrypted: encrypted_secret,
          is_default: false,
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'update') {
      const updateData: any = { key, name, fb_app_id };
      if (fb_app_secret) {
        updateData.fb_app_secret_encrypted = btoa(fb_app_secret);
      }

      const { data, error } = await supabaseClient
        .from('apps')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'set_default') {
      // Remove default from all apps
      await supabaseClient.from('apps').update({ is_default: false }).neq('id', '00000000-0000-0000-0000-000000000000');

      // Set new default
      const { data, error } = await supabaseClient
        .from('apps')
        .update({ is_default: true })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error('Invalid action');
  } catch (error) {
    console.error('[manage-apps] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
