import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Square, Brain } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { Msg } from "@/types";
import { ComparisonColumn, type ComparisonResult } from "./ComparisonColumn";
import { ModelSelect } from "./ModelSelect";
import { getModelLabel } from "@/data/models";
import { LS_KEYS, DEFAULT_MODEL, SECONDARY_MODEL } from "@/lib/constants";
import { loadStringFromStorage } from "@/lib/storage";
import { useComparisonStreaming } from "@/hooks/useComparisonStreaming";

export interface ComparisonViewProps {
  systemPrompt: string;
  onBudgetExhausted: () => void;
}

export const ComparisonView = ({ systemPrompt, onBudgetExhausted }: ComparisonViewProps) => {
  const [thinkingEnabled, setThinkingEnabled] = useState(
    () => loadStringFromStorage(LS_KEYS.THINKING_ENABLED, "false") === "true"
  );
  const [modelA, setModelA] = useState(DEFAULT_MODEL);
  const [modelB, setModelB] = useState(SECONDARY_MODEL);
  const [prompt, setPrompt] = useState("");
  const [resultA, setResultA] = useState<ComparisonResult | null>(null);
  const [resultB, setResultB] = useState<ComparisonResult | null>(null);

  const { streamAll, stopAll, isRunning } = useComparisonStreaming({ onBudgetExhausted });

  const handleCompare = useCallback(() => {
    if (!prompt.trim() || isRunning) return;

    setResultA({ model: modelA, content: "", isStreaming: true });
    setResultB({ model: modelB, content: "", isStreaming: true });

    const apiMessages: Msg[] = [];
    if (systemPrompt.trim()) {
      apiMessages.push({ role: "system", content: systemPrompt });
    }
    apiMessages.push({ role: "user", content: prompt });

    const reasoningParam = thinkingEnabled ? { effort: "high" } : undefined;

    streamAll([
      {
        model: modelA,
        messages: apiMessages,
        label: "Modell A",
        onUpdate: (content, streaming) =>
          setResultA({ model: modelA, content, isStreaming: streaming }),
      },
      {
        model: modelB,
        messages: apiMessages,
        label: "Modell B",
        onUpdate: (content, streaming) =>
          setResultB({ model: modelB, content, isStreaming: streaming }),
      },
    ], { reasoning: reasoningParam });
  }, [prompt, isRunning, modelA, modelB, systemPrompt, thinkingEnabled, streamAll]);

  const handleStop = () => {
    stopAll();
    setResultA((prev) => prev ? { ...prev, isStreaming: false } : null);
    setResultB((prev) => prev ? { ...prev, isStreaming: false } : null);
  };

  const modelLabelA = getModelLabel(modelA);
  const modelLabelB = getModelLabel(modelB);

  return (
    <div className="space-y-4">
      {/* Model selectors */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Modell A</label>
          <ModelSelect value={modelA} onValueChange={setModelA} disabled={isRunning} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Modell B</label>
          <ModelSelect value={modelB} onValueChange={setModelB} disabled={isRunning} />
        </div>
      </div>

      {/* Thinking toggle */}
      <div className="flex items-center gap-1.5">
        <Switch
          id="comparison-thinking-toggle"
          checked={thinkingEnabled}
          onCheckedChange={(checked) => {
            setThinkingEnabled(checked);
            localStorage.setItem(LS_KEYS.THINKING_ENABLED, String(checked));
          }}
        />
        <Label htmlFor="comparison-thinking-toggle" className="text-xs flex items-center gap-1 cursor-pointer" title="Erweiterte Denkfähigkeit aktivieren (Reasoning/Thinking)">
          <Brain className="h-3.5 w-3.5" /> Thinking
        </Label>
      </div>

      {/* Prompt input */}
      <div className="flex gap-2 items-end">
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Prompt zum Vergleichen eingeben..."
          className="min-h-[44px] max-h-[120px] resize-none text-sm"
          rows={2}
          disabled={isRunning}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleCompare();
            }
          }}
        />
        {isRunning ? (
          <Button onClick={handleStop} variant="destructive" size="icon" className="shrink-0 h-11 w-11">
            <Square className="w-4 h-4" />
          </Button>
        ) : (
          <Button
            onClick={handleCompare}
            disabled={!prompt.trim()}
            size="icon"
            className="shrink-0 h-11 w-11"
          >
            <Send className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Results side by side */}
      {(resultA || resultB) && (
        <div className="grid grid-cols-2 gap-3">
          <ComparisonColumn
            label={modelLabelA}
            result={resultA}
          />
          <ComparisonColumn
            label={modelLabelB}
            result={resultB}
          />
        </div>
      )}
    </div>
  );
};
