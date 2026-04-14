import { useState } from "react";
import { Scale, Lightbulb, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { hasApiKey, getApiKey, getEndpoint } from "@/services/apiKeyService";
import { DEFAULT_MODEL } from "@/lib/constants";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface DimensionScore {
  scoreA: number;
  scoreB: number;
  note: string;
}

interface ComparativeResult {
  scoreA: number;
  scoreB: number;
  dimensions: {
    structure: DimensionScore;
    completeness: DimensionScore;
    compliance: DimensionScore;
    quality: DimensionScore;
  };
  gaps: string[];
  promptSuggestion: string;
}

interface Props {
  prompt: string;
  outputA: string;
  outputB: string;
  labelA: string;
  labelB: string;
  model?: string;
}

const dimensionLabels: Record<string, string> = {
  structure: "Struktur & Format",
  completeness: "Vollständigkeit",
  compliance: "Einhaltung der Vorgaben",
  quality: "Sprachliche Qualität",
};

function scoreColor(score: number) {
  if (score >= 80) return "text-primary";
  if (score >= 60) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function DualBar({ label, scoreA, scoreB, note }: { label: string; scoreA: number; scoreB: number; note: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
        <div className="flex items-center gap-2">
          <span className={cn("text-[10px] font-bold", scoreColor(scoreA))}>{scoreA}</span>
          <span className="text-[10px] text-muted-foreground">vs</span>
          <span className={cn("text-[10px] font-bold", scoreColor(scoreB))}>{scoreB}</span>
        </div>
      </div>
      <div className="flex gap-1">
        <div className="flex-1">
          <Progress value={scoreA} className="h-1.5" />
        </div>
        <div className="flex-1">
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-violet-500 transition-all duration-500"
              style={{ width: `${scoreB}%` }}
            />
          </div>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground">{note}</p>
    </div>
  );
}

export const ComparativeJudge = ({ prompt, outputA, outputB, labelA, labelB, model }: Props) => {
  const [result, setResult] = useState<ComparativeResult | null>(null);
  const [loading, setLoading] = useState(false);

  const evaluate = async () => {
    if (!outputA.trim() || !outputB.trim()) return;
    setLoading(true);
    setResult(null);

    const systemPrompt = `Du bist ein KI-Output-Bewerter. Vergleiche zwei KI-Antworten auf denselben oder ähnlichen Prompt.
Bewerte jede Antwort in 4 Dimensionen (0-100):
- structure: Struktur & Format
- completeness: Vollständigkeit
- compliance: Einhaltung der Vorgaben
- quality: Sprachliche Qualität
Antworte NUR mit JSON:
{
  "scoreA": <0-100>,
  "scoreB": <0-100>,
  "dimensions": {
    "structure": {"scoreA": <n>, "scoreB": <n>, "note": "Vergleichende Beobachtung"},
    "completeness": {"scoreA": <n>, "scoreB": <n>, "note": "..."},
    "compliance": {"scoreA": <n>, "scoreB": <n>, "note": "..."},
    "quality": {"scoreA": <n>, "scoreB": <n>, "note": "..."}
  },
  "gaps": ["Hauptlücke 1 von A gegenüber B", "..."],
  "promptSuggestion": "Konkreter Verbesserungsvorschlag für den Prompt an Modell A, um die Lücken zu B zu schließen"
}`;

    const userMsg = `Prompt: "${prompt}"

Antwort A (${labelA}):
"${outputA}"

Antwort B (${labelB}):
"${outputB}"

Bewerte jetzt.`;

    try {
      let text = "";

      if (hasApiKey()) {
        const apiKey = getApiKey();
        const endpoint = getEndpoint();

        const resp = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            "HTTP-Referer": window.location.origin,
          },
          body: JSON.stringify({
            model: model || DEFAULT_MODEL,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userMsg },
            ],
            temperature: 0.3,
          }),
        });

        if (!resp.ok) throw new Error("Bewertung fehlgeschlagen");

        const respData = await resp.json();
        text = respData.choices?.[0]?.message?.content || "";
      } else {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          toast.error("Bitte melde dich an.");
          setLoading(false);
          return;
        }

        const proxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/llm-proxy`;
        const resp = await fetch(proxyUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userMsg },
            ],
            model: model || DEFAULT_MODEL,
            stream: false,
          }),
        });

        if (!resp.ok) throw new Error("Bewertung fehlgeschlagen");

        const respData = await resp.json();
        text = respData.choices?.[0]?.message?.content || "";
      }

      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      setResult(parsed);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Vergleichende Bewertung fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  };

  if (!result && !loading) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-2">
          <Scale className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">Vergleichende Bewertung</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Lass eine Referenz-KI beide Antworten gegeneinander bewerten.
        </p>
        <Button onClick={evaluate} size="sm" className="gap-1.5 text-xs w-full">
          <Scale className="w-3 h-3" /> Vergleich bewerten
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-xs">Vergleich wird bewertet...</span>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="space-y-4">
      {/* Overall scores */}
      <div className="flex items-center justify-center gap-6">
        <div className="text-center">
          <span className="text-[10px] text-muted-foreground font-medium block mb-0.5">
            {labelA}
          </span>
          <span className={cn("text-2xl font-bold", scoreColor(result.scoreA))}>
            {result.scoreA}
          </span>
        </div>
        <span className="text-muted-foreground text-sm">vs</span>
        <div className="text-center">
          <span className="text-[10px] text-muted-foreground font-medium block mb-0.5">
            {labelB}
          </span>
          <span className={cn("text-2xl font-bold", scoreColor(result.scoreB))}>
            {result.scoreB}
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-4 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-primary" /> {labelA}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-violet-500" /> {labelB}
        </span>
      </div>

      {/* Dimensions */}
      <div className="space-y-3">
        {Object.entries(result.dimensions).map(([key, dim]) => (
          <DualBar
            key={key}
            label={dimensionLabels[key] || key}
            scoreA={dim.scoreA}
            scoreB={dim.scoreB}
            note={dim.note}
          />
        ))}
      </div>

      {/* Gaps */}
      {result.gaps.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3 space-y-1">
          <span className="text-[10px] font-semibold text-amber-800 dark:text-amber-400">
            Hauptlücken Modell A
          </span>
          {result.gaps.map((gap, i) => (
            <p key={i} className="text-[10px] text-amber-700 dark:text-amber-300">
              • {gap}
            </p>
          ))}
        </div>
      )}

      {/* Prompt suggestion */}
      {result.promptSuggestion && (
        <div className="bg-primary/5 border border-primary/15 rounded-lg p-3 flex items-start gap-2">
          <Lightbulb className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
          <div>
            <span className="text-[10px] font-semibold text-primary block mb-0.5">
              Prompt-Empfehlung
            </span>
            <p className="text-[10px] text-muted-foreground">{result.promptSuggestion}</p>
          </div>
        </div>
      )}

      {/* Re-evaluate */}
      <Button variant="outline" size="sm" onClick={evaluate} className="text-xs gap-1.5 w-full">
        <RefreshCw className="w-3 h-3" /> Erneut bewerten
      </Button>
    </div>
  );
};
