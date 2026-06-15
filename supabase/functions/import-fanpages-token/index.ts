import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function fetchFacebookJson(url: string) {
  const response = await fetch(url);
  const data = await response.json();

  if (!response.ok || data?.error) {
    const message = data?.error?.message || response.statusText || "Facebook API error";
    throw new Error(message);
  }

  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      return jsonResponse({ error: "Backend secrets not configured" }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const { app_key, user_token } = await req.json();
    let appKey = typeof app_key === "string" ? app_key.trim() : "";
    const userToken = typeof user_token === "string" ? user_token.trim() : "";

    if (!userToken) {
      return jsonResponse({ error: "user_token is required" }, 400);
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    if (appKey) {
      // Verify the selected app exists
      const { data: app, error: appError } = await supabaseAdmin
        .from("apps")
        .select("key")
        .eq("key", appKey)
        .maybeSingle();

      if (appError) {
        throw new Error(appError.message);
      }

      if (!app) {
        return jsonResponse({ error: "La app seleccionada no existe" }, 404);
      }
    } else {
      // No app selected: use the default app, or any app, or auto-create a token-only app
      const { data: defaultApp } = await supabaseAdmin
        .from("apps")
        .select("key")
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (defaultApp?.key) {
        appKey = defaultApp.key;
      } else {
        const fallbackKey = "TOKEN";
        const { error: createAppError } = await supabaseAdmin
          .from("apps")
          .upsert(
            {
              key: fallbackKey,
              name: "Token import",
              fb_app_id: "token",
              fb_app_secret_encrypted: "",
              is_default: true,
            },
            { onConflict: "key", ignoreDuplicates: true }
          );

        if (createAppError) {
          throw new Error(createAppError.message);
        }

        appKey = fallbackKey;
      }
    }

    const encodedToken = encodeURIComponent(userToken);

    const userInfo = await fetchFacebookJson(
      `https://graph.facebook.com/v24.0/me?fields=id,name,picture&access_token=${encodedToken}`
    );

    const pagesData = await fetchFacebookJson(
      `https://graph.facebook.com/v24.0/me/accounts?fields=id,name,access_token,picture&limit=200&access_token=${encodedToken}`
    );

    const { data: existingAccount } = await supabaseAdmin
      .from("accounts")
      .select("id")
      .eq("fb_user_id", userInfo.id)
      .eq("app_key", appKey)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let accountId: string;
    if (existingAccount?.id) {
      const { data: updatedAccount, error: updateAccountError } = await supabaseAdmin
        .from("accounts")
        .update({
          name: userInfo.name || null,
          photo_url: userInfo.picture?.data?.url || null,
          access_token_encrypted: btoa(userToken),
        })
        .eq("id", existingAccount.id)
        .select("id")
        .single();

      if (updateAccountError) {
        throw new Error(updateAccountError.message);
      }

      accountId = updatedAccount.id;
    } else {
      const { data: createdAccount, error: createAccountError } = await supabaseAdmin
        .from("accounts")
        .insert({
          fb_user_id: userInfo.id,
          name: userInfo.name || null,
          photo_url: userInfo.picture?.data?.url || null,
          app_key: appKey,
          access_token_encrypted: btoa(userToken),
        })
        .select("id")
        .single();

      if (createAccountError) {
        throw new Error(createAccountError.message);
      }

      accountId = createdAccount.id;
    }

    const pages = Array.isArray(pagesData?.data) ? pagesData.data : [];

    let importedCount = 0;
    let skippedCount = 0;

    for (const page of pages) {
      const pageId = typeof page?.id === "string" ? page.id : "";
      const pageName = typeof page?.name === "string" ? page.name : "Sin nombre";
      const pageToken = typeof page?.access_token === "string" ? page.access_token : "";

      if (!pageId || !pageToken) {
        skippedCount += 1;
        continue;
      }

      const { error: fanpageError } = await supabaseAdmin.from("fanpages").upsert(
        {
          page_id: pageId,
          name: pageName,
          image_url: page?.picture?.data?.url || null,
          account_id: accountId,
          active_app_key: appKey,
          status: "active",
        },
        {
          onConflict: "page_id",
          ignoreDuplicates: false,
        }
      );

      if (fanpageError) {
        throw new Error(fanpageError.message);
      }

      const { error: tokenError } = await supabaseAdmin.from("fanpage_app_tokens").upsert(
        {
          page_id: pageId,
          app_key: appKey,
          page_access_token_encrypted: btoa(pageToken),
        },
        {
          onConflict: "page_id,app_key",
          ignoreDuplicates: false,
        }
      );

      if (tokenError) {
        throw new Error(tokenError.message);
      }

      importedCount += 1;
    }

    return jsonResponse({
      success: true,
      imported_count: importedCount,
      skipped_count: skippedCount,
      account_id: accountId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[import-fanpages-token]", message);
    return jsonResponse({ error: message }, 400);
  }
});
