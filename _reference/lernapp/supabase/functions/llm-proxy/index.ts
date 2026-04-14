import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

/* ── Grobe Kosten-Schätzung pro 1M Tokens (input/output) ── */
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  "google/gemini-3-flash-preview":     { input: 0.10, output: 0.40 },
  "google/gemini-3.1-pro-preview":     { input: 1.25, output: 5.00 },
  "google/gemini-2.5-pro":            { input: 1.25, output: 5.00 },
  "google/gemini-2.5-flash":          { input: 0.15, output: 0.60 },
  "google/gemini-2.5-flash-lite":     { input: 0.08, output: 0.30 },
  "openai/gpt-5":                     { input: 2.50, output: 10.00 },
  "openai/gpt-5.4":                   { input: 3.00, output: 12.00 },
  "openai/gpt-5-mini":               { input: 0.40, output: 1.60 },
  "openai/gpt-5-nano":               { input: 0.10, output: 0.40 },
  "anthropic/claude-sonnet-4.6":   { input: 3.00, output: 15.00 },
  "anthropic/claude-opus-4.6":     { input: 15.00, output: 75.00 },
  "anthropic/claude-haiku-3.5":      { input: 0.80, output: 4.00 },
  "mistral/mistral-large":           { input: 2.00, output: 6.00 },
  "mistral/mistral-small":           { input: 0.10, output: 0.30 },
  "mistral/codestral":               { input: 0.30, output: 0.90 },
};
const DEFAULT_COST = { input: 1.00, output: 4.00 }; // konservativer Fallback

function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  const costs = MODEL_COSTS[model] ?? DEFAULT_COST;
  return (promptTokens * costs.input + completionTokens * costs.output) / 1_000_000;
}

function jsonRes(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/* ── AES-256-GCM decrypt ── */
async function decrypt(encrypted: string, keyHex: string): Promise<string> {
  const raw = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
  const iv = raw.slice(0, 12);
  const data = raw.slice(12);
  const keyBuf = Uint8Array.from(keyHex.match(/.{2}/g)!, (h) => parseInt(h, 16));
  const key = await crypto.subtle.importKey("raw", keyBuf, "AES-GCM", false, ["decrypt"]);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return new TextDecoder().decode(plain);
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

    /* ── Request body ── */
    const { messages, model, reasoning } = await req.json();
    if (!messages || !Array.isArray(messages)) return jsonRes({ error: "messages required" }, 400);

    /* ── Load user API key config ── */
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: keyRow } = await admin
      .from("user_api_keys")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    // If no key row exists, create one with course-specific budget
    if (!keyRow) {
      const { data: profileData } = await admin
        .from("user_profiles")
        .select("course_id")
        .eq("id", userId)
        .maybeSingle();

      let defaultBudget = 5.0;
      if (profileData?.course_id) {
        const { data: course } = await admin
          .from("courses")
          .select("default_key_budget")
          .eq("id", profileData.course_id)
          .maybeSingle();
        if (course?.default_key_budget) defaultBudget = Number(course.default_key_budget);
      }

      await admin.from("user_api_keys").insert({
        user_id: userId,
        provisioned_key_budget: defaultBudget,
      });
    }

    const activeSource = keyRow?.active_key_source ?? "provisioned";
    const budget = keyRow?.provisioned_key_budget ?? 5.0;

    /* ── Determine which key to use ── */
    let apiKey: string;
    let isCustomKey = false;

    if (activeSource === "custom" && keyRow?.custom_key_active && keyRow?.custom_key_encrypted) {
      // Custom OpenRouter key
      const encKeyRaw = Deno.env.get("ENCRYPTION_KEY");
      const encKey = encKeyRaw?.trim();
      if (!encKey || encKey.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(encKey)) {
        return jsonRes({ error: "Server encryption key misconfigured (expected 64 hex chars)" }, 500);
      }
      try {
        apiKey = await decrypt(keyRow.custom_key_encrypted, encKey);
      } catch {
        return jsonRes({ error: "Eigener API-Key konnte nicht entschlüsselt werden." }, 400);
      }
      isCustomKey = true;
    } else {
      // Provisioned: use central OpenRouter key
      if (budget <= 0) {
        return jsonRes({
          error: "budget_exhausted",
          message: "Dein KI-Budget ist aufgebraucht. Hinterlege einen eigenen API-Key, um weiterzumachen.",
        }, 402);
      }
      apiKey = Deno.env.get("OPENROUTER_API_KEY")!;
      if (!apiKey) return jsonRes({ error: "OPENROUTER_API_KEY not configured" }, 500);
    }

    /* ── Call LLM (always OpenRouter) ── */
    const llmModel = model || "google/gemini-3-flash-preview";
    const llmBody: Record<string, unknown> = {
      model: llmModel,
      messages,
      stream: true,
    };
    if (reasoning && typeof reasoning === "object") {
      llmBody.reasoning = reasoning;
    }
    const response = await fetch(OPENROUTER_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://prompting.studio",
        "X-Title": "KI-Werkstatt",
      },
      body: JSON.stringify(llmBody),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return jsonRes({ error: "Zu viele Anfragen. Bitte warte kurz." }, 429);
      }
      if (response.status === 402) {
        return jsonRes({ error: "AI-Kontingent erschöpft." }, 402);
      }
      const text = await response.text();
      console.error("LLM error:", response.status, text);
      return jsonRes({ error: "LLM-Anfrage fehlgeschlagen" }, 500);
    }

    /* ── Stream response with usage capture via TransformStream ── */
    let lastDataChunk = "";
    const decoder = new TextDecoder();

    const transform = new TransformStream({
      transform(chunk, controller) {
        controller.enqueue(chunk);
        // Parse SSE chunks to capture the last data line (contains usage)
        const text = decoder.decode(chunk, { stream: true });
        const lines = text.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const payload = line.slice(6).trim();
            if (payload && payload !== "[DONE]") {
              lastDataChunk = payload;
            }
          }
        }
      },
    });

    // Pipe upstream response through transform, log usage after completion
    const pipePromise = response.body!.pipeTo(transform.writable);
    pipePromise.then(async () => {
      try {
        let promptTokens = 0;
        let completionTokens = 0;
        let totalTokens = 0;

        if (lastDataChunk) {
          const parsed = JSON.parse(lastDataChunk);
          const usage = parsed.usage;
          if (usage) {
            promptTokens = usage.prompt_tokens ?? 0;
            completionTokens = usage.completion_tokens ?? 0;
            totalTokens = usage.total_tokens ?? (promptTokens + completionTokens);
          }
        }

        const cost = estimateCost(llmModel, promptTokens, completionTokens);

        // Log usage to api_usage_log
        await admin.from("api_usage_log").insert({
          user_id: userId,
          model: llmModel,
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: totalTokens,
          estimated_cost: cost,
          request_type: "chat",
        });

        // Deduct budget (provisioned key only)
        if (!isCustomKey && keyRow) {
          const newBudget = Math.max(0, budget - cost);
          await admin
            .from("user_api_keys")
            .update({
              provisioned_key_budget: newBudget,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId);
        }
      } catch (e) {
        console.error("Usage logging error:", e);
      }
    }).catch((e) => {
      console.error("Stream pipe error:", e);
    });

    return new Response(transform.readable, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("llm-proxy error:", e);
    return jsonRes({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
