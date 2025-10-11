import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Handle POST requests for getting auth URL
    if (req.method === 'POST') {
      const { action, app_key, fb_app_id } = await req.json();
      
      if (action === 'get-auth-url') {
        const redirectUri = `https://ejkndamjsfjdkithuqrj.supabase.co/functions/v1/oauth-callback`;
        const scope = "pages_manage_metadata,pages_messaging,pages_read_engagement";
        const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${fb_app_id}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${app_key}&scope=${scope}&response_type=code`;
        
        console.log('[oauth-callback] Generated auth URL for app:', app_key);
        
        return new Response(
          JSON.stringify({ authUrl }),
          { 
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Invalid action' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Handle GET requests from Facebook OAuth callback
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state'); // app_key
    const error = url.searchParams.get('error');

    console.log('[oauth-callback] Received OAuth callback:', {
      method: req.method,
      code: code ? 'present' : 'missing',
      state: state || 'missing',
      error: error || 'none'
    });

    if (error) {
      console.error('[oauth-callback] OAuth error from Facebook:', error);
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          'Location': `https://app-pivot-send.lovable.app/accounts?error=${encodeURIComponent(`Facebook error: ${error}`)}`,
        },
      });
    }

    if (!code || !state) {
      console.error('[oauth-callback] Missing parameters:', { code: !!code, state: !!state });
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          'Location': `https://app-pivot-send.lovable.app/accounts?error=${encodeURIComponent('Invalid OAuth callback - missing code or app key')}`,
        },
      });
    }

    // Get app details
    const { data: app, error: appError } = await supabaseClient
      .from('apps')
      .select('*')
      .eq('key', state)
      .single();

    if (appError || !app) {
      throw new Error('App not found');
    }

    console.log(`[oauth-callback] Processing OAuth for app: ${app.key}`);

    // Exchange code for access token
    const redirectUri = `https://ejkndamjsfjdkithuqrj.supabase.co/functions/v1/oauth-callback`;
    const tokenUrl = `https://graph.facebook.com/v18.0/oauth/access_token?client_id=${app.fb_app_id}&client_secret=${atob(app.fb_app_secret_encrypted)}&code=${code}&redirect_uri=${encodeURIComponent(redirectUri)}`;

    const tokenResponse = await fetch(tokenUrl);
    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      throw new Error('Failed to get access token: ' + JSON.stringify(tokenData));
    }

    console.log('[oauth-callback] Got short-lived token');

    // Exchange for long-lived token
    const longLivedUrl = `https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${app.fb_app_id}&client_secret=${atob(app.fb_app_secret_encrypted)}&fb_exchange_token=${tokenData.access_token}`;

    const longLivedResponse = await fetch(longLivedUrl);
    const longLivedData = await longLivedResponse.json();

    const userAccessToken = longLivedData.access_token || tokenData.access_token;
    console.log('[oauth-callback] Got long-lived token');

    // Get user info
    const userInfoResponse = await fetch(`https://graph.facebook.com/v18.0/me?fields=id,name,picture&access_token=${userAccessToken}`);
    const userInfo = await userInfoResponse.json();

    console.log('[oauth-callback] Got user info:', userInfo.id);

    // Save account
    const { data: account, error: accountError } = await supabaseClient
      .from('accounts')
      .upsert({
        fb_user_id: userInfo.id,
        name: userInfo.name,
        photo_url: userInfo.picture?.data?.url || null,
        app_key: app.key,
        access_token_encrypted: btoa(userAccessToken),
      }, {
        onConflict: 'fb_user_id',
      })
      .select()
      .single();

    if (accountError) {
      console.error('[oauth-callback] Error saving account:', accountError);
      throw accountError;
    }

    console.log('[oauth-callback] Saved account');

    // Get fanpages
    const pagesResponse = await fetch(`https://graph.facebook.com/v18.0/me/accounts?fields=id,name,access_token,picture&access_token=${userAccessToken}`);
    const pagesData = await pagesResponse.json();

    if (pagesData.data && pagesData.data.length > 0) {
      console.log(`[oauth-callback] Found ${pagesData.data.length} fanpages`);

      // Save fanpages
      for (const page of pagesData.data) {
        // Save fanpage
        await supabaseClient.from('fanpages').upsert({
          page_id: page.id,
          name: page.name,
          image_url: page.picture?.data?.url || null,
          account_id: account.id,
          active_app_key: app.key,
        }, {
          onConflict: 'page_id',
        });

        // Save page token for this app
        await supabaseClient.from('fanpage_app_tokens').upsert({
          page_id: page.id,
          app_key: app.key,
          page_access_token_encrypted: btoa(page.access_token),
        }, {
          onConflict: 'page_id,app_key',
        });
      }
    }

    console.log('[oauth-callback] OAuth flow completed successfully');

    // Redirect back to accounts page
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': `https://app-pivot-send.lovable.app/accounts`,
      },
    });
  } catch (error) {
    console.error('[oauth-callback] Error:', error);
    
    // Redirect to accounts page with error
    const url = new URL(req.url);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': `https://app-pivot-send.lovable.app/accounts?error=${encodeURIComponent(message)}`,
      },
    });
  }
});
