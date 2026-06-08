import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function decryptPassword(encryptedBase64: string, keyStr: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyBytes = encoder.encode(keyStr.padEnd(32, "0").slice(0, 32));
  const cryptoKey = await crypto.subtle.importKey(
    "raw", keyBytes, { name: "AES-GCM" }, false, ["decrypt"]
  );
  const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, cryptoKey, data);
  return new TextDecoder().decode(decrypted);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const jsonResponse = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonResponse({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return jsonResponse({ error: "Unauthorized" }, 401);

    const body = await req.json();
    // Support testing with plaintext (new credentials before save) OR encrypted (saved credentials)
    let { wpUrl, wpUsername, wpAppPassword } = body;

    // If no plaintext password provided, load from DB and decrypt
    if (!wpAppPassword) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("wp_url, wp_username, wp_app_password_enc, wp_app_password")
        .eq("user_id", user.id)
        .single();

      if (!profile) return jsonResponse({ error: "Profile not found" }, 404);

      wpUrl = wpUrl || profile.wp_url;
      wpUsername = wpUsername || profile.wp_username;

      if (profile.wp_app_password_enc) {
        const encryptionKey = Deno.env.get("WP_ENCRYPTION_KEY");
        if (!encryptionKey) return jsonResponse({ error: "WP_ENCRYPTION_KEY not configured" }, 500);
        try {
          wpAppPassword = await decryptPassword(profile.wp_app_password_enc, encryptionKey);
        } catch {
          return jsonResponse({ success: false, message: "Failed to decrypt stored password. Please re-enter your credentials." });
        }
      } else if (profile.wp_app_password) {
        // Legacy plaintext fallback
        wpAppPassword = profile.wp_app_password;
      }
    }

    if (!wpUrl || !wpUsername || !wpAppPassword) {
      return jsonResponse({ success: false, message: "WordPress credentials are not fully configured." });
    }

    const apiUrl = `${wpUrl.replace(/\/$/, "")}/wp-json/wp/v2/users/me`;
    const authString = btoa(`${wpUsername}:${wpAppPassword}`);

    const response = await fetch(apiUrl, {
      headers: { Authorization: `Basic ${authString}` },
      signal: AbortSignal.timeout(10000),
    });

    if (response.ok) {
      const userData = await response.json();
      return jsonResponse({
        success: true,
        message: `Connected as ${userData.name || wpUsername}`,
      });
    } else {
      const errorText = await response.text().catch(() => "");
      return jsonResponse({
        success: false,
        message: `Connection failed: HTTP ${response.status}${errorText ? " — " + errorText.slice(0, 100) : ""}`,
      });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[test-wordpress-connection] Error:", msg);
    return jsonResponse({ success: false, message: msg });
  }
});
