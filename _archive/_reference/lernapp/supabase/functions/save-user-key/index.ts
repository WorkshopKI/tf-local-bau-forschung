import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonRes(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/* ── AES-256-GCM encrypt ── */
async function encrypt(plain: string, keyHex: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const keyBuf = Uint8Array.from(keyHex.match(/.{2}/g)!, (h) => parseInt(h, 16));
  const key = await crypto.subtle.importKey("raw", keyBuf, "AES-GCM", false, ["encrypt"]);
  const encoded = new TextEncoder().encode(plain);
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded));
  const combined = new Uint8Array(iv.length + encrypted.length);
  combined.set(iv);
  combined.set(encrypted, iv.length);
  return btoa(String.fromCharCode(...combined));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    /* ── Auth ── */
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonRes({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) return jsonRes({ error: "Unauthorized" }, 401);
    const userId = user.id;

    /* ── Body ── */
    const { apiKey } = await req.json();
    if (!apiKey || typeof apiKey !== "string" || apiKey.length < 10) {
      return jsonRes({ error: "Ungültiger API-Key" }, 400);
    }

    /* ── Validate key with OpenRouter ── */
    const testRes = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!testRes.ok) {
      return jsonRes({ error: "Der API-Key ist ungültig oder hat keine Berechtigung." }, 400);
    }

    /* ── Encrypt & store ── */
    const encKeyRaw = Deno.env.get("ENCRYPTION_KEY");
    const encKey = encKeyRaw?.trim();
    if (!encKey || encKey.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(encKey)) {
      console.error("ENCRYPTION_KEY length:", encKey?.length ?? 0);
      return jsonRes({ error: "Server encryption key misconfigured (expected 64 hex chars)" }, 500);
    }

    const encrypted = await encrypt(apiKey, encKey);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Upsert: update if exists, insert if not
    const { data: existing } = await admin
      .from("user_api_keys")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      await admin
        .from("user_api_keys")
        .update({
          custom_key_encrypted: encrypted,
          custom_key_active: true,
          active_key_source: "custom",
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);
    } else {
      await admin.from("user_api_keys").insert({
        user_id: userId,
        custom_key_encrypted: encrypted,
        custom_key_active: true,
        active_key_source: "custom",
      });
    }

    return jsonRes({ success: true, message: "API-Key gespeichert und aktiviert." });
  } catch (e) {
    console.error("save-user-key error:", e);
    return jsonRes({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
