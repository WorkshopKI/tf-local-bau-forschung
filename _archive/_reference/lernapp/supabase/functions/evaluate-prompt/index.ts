import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

/* ── Usage-Logging Helper (fire-and-forget, kein Budget-Abzug) ── */
// deno-lint-ignore no-explicit-any
async function logUsage(
  admin: any,
  userId: string,
  model: string,
  usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined,
  requestType: string,
) {
  try {
    const promptTokens = usage?.prompt_tokens ?? 0;
    const completionTokens = usage?.completion_tokens ?? 0;
    const totalTokens = usage?.total_tokens ?? (promptTokens + completionTokens);
    // Grobe Kostenschätzung: Gemini Flash ist günstig
    const cost = (promptTokens * 0.10 + completionTokens * 0.40) / 1_000_000;

    await admin.from("api_usage_log").insert({
      user_id: userId,
      model,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens,
      estimated_cost: cost,
      request_type: requestType,
    });
  } catch (e) {
    console.error("Usage logging error:", e);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is not configured");

    /* ── Auth (REQUIRED) ── */
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId: string = user.id;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();

    // --- Judge-Output Mode ---
    if (body.mode === "judge-output") {
      const { prompt, output, criteria, model } = body;
      if (!prompt || !output) {
        return new Response(
          JSON.stringify({ error: "prompt and output are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const judgeSystem = `Du bist ein strenger aber fairer Qualitätsprüfer für KI-Outputs.
Bewerte den folgenden Output anhand der gegebenen Kriterien.
Antworte AUSSCHLIESSLICH mit einem JSON-Objekt (kein Markdown, kein Preamble).
JSON-Format:
{
  "overallScore": <0-100>,
  "dimensions": {
    "structure": { "score": <0-100>, "feedback": "<1 Satz>" },
    "completeness": { "score": <0-100>, "feedback": "<1 Satz>" },
    "compliance": { "score": <0-100>, "feedback": "<1 Satz>" },
    "quality": { "score": <0-100>, "feedback": "<1 Satz>" }
  },
  "issues": ["<Problem 1>", "<Problem 2>"],
  "suggestion": "<1 konkreter Verbesserungstipp für den Prompt>"
}`;

      const judgeUser = `## Prompt der an die KI gesendet wurde:\n${prompt}\n\n## Output der KI (Modell: ${model || "unbekannt"}):\n${output}${criteria ? `\n\n## Zusätzliche Bewertungskriterien:\n${criteria}` : ""}\n\nBewerte jetzt.`;

      const judgeModel = "google/gemini-3-flash-preview";
      const judgeResponse = await fetch(OPENROUTER_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://prompting.studio",
          "X-Title": "KI-Werkstatt",
        },
        body: JSON.stringify({
          model: judgeModel,
          messages: [
            { role: "system", content: judgeSystem },
            { role: "user", content: judgeUser },
          ],
        }),
      });

      if (!judgeResponse.ok) {
        if (judgeResponse.status === 429) {
          return new Response(JSON.stringify({ error: "Zu viele Anfragen. Bitte versuche es in einer Minute erneut." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (judgeResponse.status === 402) {
          return new Response(JSON.stringify({ error: "AI-Kontingent erschöpft. Bitte später erneut versuchen." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const errText = await judgeResponse.text();
        console.error("Judge AI error:", judgeResponse.status, errText);
        return new Response(JSON.stringify({ error: "Judge-Bewertung fehlgeschlagen" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const judgeData = await judgeResponse.json();

      // Log usage (kein Budget-Abzug)
      logUsage(admin, userId, judgeModel, judgeData.usage, "judge");

      const rawContent = judgeData.choices?.[0]?.message?.content || "";
      if (!rawContent) {
        console.error("Judge AI returned empty content:", JSON.stringify(judgeData));
        return new Response(JSON.stringify({ error: "Die Referenz-KI hat keine Bewertung zurückgegeben. Bitte erneut versuchen." }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Strip markdown fences if present
      const cleaned = rawContent.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      let parsed;
      try {
        parsed = JSON.parse(cleaned);
      } catch (parseErr) {
        console.error("Judge AI returned invalid JSON:", cleaned);
        return new Response(JSON.stringify({ error: "Die Referenz-KI hat ein ungültiges Format zurückgegeben. Bitte erneut versuchen." }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Original Prompt-Evaluation Mode ---
    const { userPrompt, badPrompt, context, goodExample, improvementHints, model } = body;
    const selectedModel = model || "google/gemini-3-flash-preview";

    if (!userPrompt || !badPrompt) {
      return new Response(
        JSON.stringify({ error: "userPrompt and badPrompt are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `Du bist ein KI-Prompting-Tutor. Der Benutzer übt, schlechte Prompts zu verbessern.

Originaler schlechter Prompt: "${badPrompt}"
Kontext der Übung: "${context}"
Verbesserungshinweise: ${JSON.stringify(improvementHints)}
Musterlösung: "${goodExample}"

Bewerte den verbesserten Prompt des Benutzers anhand von drei Kriterien:
1. hasContext - Hat der Prompt ausreichend Kontext (Situation, Zielgruppe, Hintergrund)?
2. isSpecific - Ist der Prompt spezifisch genug (konkrete Details, Zahlen, Anforderungen)?
3. hasConstraints - Definiert der Prompt Rahmenbedingungen (Einschränkungen, Format, Stil, Grenzen)?

Gib konstruktives Feedback auf Deutsch. Sei ermutigend aber ehrlich.`;

    const response = await fetch(OPENROUTER_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://prompting.studio",
        "X-Title": "KI-Werkstatt",
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Bewerte diesen verbesserten Prompt:\n\n"${userPrompt}"` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "evaluate_prompt",
              description: "Return structured evaluation of the user's improved prompt",
              parameters: {
                type: "object",
                properties: {
                  hasContext: { type: "boolean", description: "Whether the prompt provides sufficient context" },
                  isSpecific: { type: "boolean", description: "Whether the prompt is specific enough" },
                  hasConstraints: { type: "boolean", description: "Whether the prompt defines constraints" },
                  feedback: { type: "string", description: "Constructive feedback in German, 2-3 sentences" },
                },
                required: ["hasContext", "isSpecific", "hasConstraints", "feedback"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "evaluate_prompt" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Zu viele Anfragen. Bitte versuche es in einer Minute erneut." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI-Kontingent erschöpft. Bitte später erneut versuchen." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI error:", response.status, text);
      return new Response(JSON.stringify({ error: "AI-Bewertung fehlgeschlagen" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();

      // Log usage (kein Budget-Abzug)
      logUsage(admin, userId, selectedModel, data.usage, "evaluation");

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      console.error("No tool call in response:", JSON.stringify(data));
      return new Response(JSON.stringify({ error: "Unerwartete AI-Antwort" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const evaluation = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(evaluation), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("evaluate-prompt error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unbekannter Fehler" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
