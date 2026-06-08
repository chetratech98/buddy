import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function encryptPassword(plaintext: string, keyStr: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyBytes = encoder.encode(keyStr.padEnd(32, "0").slice(0, 32));
  const cryptoKey = await crypto.subtle.importKey(
    "raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt"]
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, cryptoKey, encoder.encode(plaintext));
  const combined = new Uint8Array(iv.byteLength + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.byteLength);
  return btoa(String.fromCharCode(...combined));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const jsonResponse = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

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

    const { orgId, name, wpUrl, wpUsername, wpAppPassword, isDefault = false } = await req.json();

    if (!name || !wpUrl || !wpUsername || !wpAppPassword) {
      return jsonResponse({ error: "name, wpUrl, wpUsername, and wpAppPassword are required" }, 400);
    }
    if (!wpUrl.match(/^https?:\/\/.+/)) {
      return jsonResponse({ error: "WordPress URL must start with http:// or https://" }, 400);
    }

    const encryptionKey = Deno.env.get("WP_ENCRYPTION_KEY");
    if (!encryptionKey) return jsonResponse({ error: "WP_ENCRYPTION_KEY not configured" }, 500);

    const encryptedPassword = await encryptPassword(wpAppPassword.trim(), encryptionKey);

    const payload: Record<string, unknown> = {
      name: name.trim(),
      wp_url: wpUrl.trim(),
      wp_username: wpUsername.trim(),
      wp_app_password_enc: encryptedPassword,
      is_default: isDefault,
    };

    if (orgId) {
      payload.org_id = orgId;
    } else {
      payload.user_id = user.id;
    }

    const { error } = await supabase.from("wordpress_sites").insert(payload);
    if (error) throw error;

    return jsonResponse({ success: true });
  } catch (e) {
    console.error("[save-site-credentials] Error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
