import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Send, Square, Scale } from "lucide-react";
import type { Msg } from "@/types";
import { ComparisonColumn, type ComparisonResult } from "./ComparisonColumn";
import { ModelSelect } from "./ModelSelect";
import { ComparativeJudge } from "./ComparativeJudge";
import { getModelLabel } from "@/data/models";
import { DEFAULT_MODEL, SECONDARY_MODEL } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useComparisonStreaming, type StreamSlot } from "@/hooks/useComparisonStreaming";

interface ComparisonRound {
  promptA: string;
  promptB: string;
  promptC?: string;
  resultA: ComparisonResult;
  resultB: ComparisonResult;
  resultC?: ComparisonResult;
}

interface Props {
  systemPrompt: string;
  onBudgetExhausted: () => void;
  selectedModel?: string;
  onBackToChat?: () => void;
  initialPrompt?: string;
  internalModel?: string | null;
}

export const ComparisonSplitView = ({ systemPrompt, onBudgetExhausted, selectedModel, onBackToChat, initialPrompt, internalModel }: Props) => {
  const [modelA, setModelA] = useState(DEFAULT_MODEL);
  const [modelB, setModelB] = useState(SECONDARY_MODEL);
  const [modelC, setModelC] = useState<string | null>(null);
  const [threeWay, setThreeWay] = useState(false);
  const [promptText, setPromptText] = useState("");
  const [promptA, setPromptA] = useState("");
  const [promptB, setPromptB] = useState("");
  const [decoupled, setDecoupled] = useState(false);
  const [rounds, setRounds] = useState<ComparisonRound[]>([]);
  const [currentA, setCurrentA] = useState<ComparisonResult | null>(null);
  const [currentB, setCurrentB] = useState<ComparisonResult | null>(null);
  const [currentC, setCurrentC] = useState<ComparisonResult | null>(null);

  const { streamAll, stopAll, isRunning, getContent } = useComparisonStreaming({ onBudgetExhausted });

  // Set default model C when three-way is activated
  useEffect(() => {
    if (threeWay && !modelC) {
      setModelC(internalModel || "openai/gpt-oss-120b");
    }
  }, [threeWay, internalModel]);

  // Pre-fill prompt from ACTA builder
  useEffect(() => {
    if (initialPrompt && !promptText && rounds.length === 0) {
      setPromptText(initialPrompt);
    }
  }, [initialPrompt]);

  const threeWayRef = useRef(threeWay);
  const modelCRef = useRef(modelC);
  threeWayRef.current = threeWay;
  modelCRef.current = modelC;

  // Auto-resize textarea refs (match ChatInput pattern)
  const textareaMainRef = useRef<HTMLTextAreaElement>(null);
  const textareaARef = useRef<HTMLTextAreaElement>(null);
  const textareaBRef = useRef<HTMLTextAreaElement>(null);

  const autoResize = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  };

  useEffect(() => { autoResize(textareaMainRef.current); }, [promptText]);
  useEffect(() => { autoResize(textareaARef.current); }, [promptA]);
  useEffect(() => { autoResize(textareaBRef.current); }, [promptB]);

  const handleCompare = useCallback(() => {
    const pA = decoupled ? promptA.trim() : promptText.trim();
    const pB = decoupled ? promptB.trim() : promptText.trim();
    if (!pA || !pB || isRunning) return;

    const isThreeWay = threeWayRef.current;
    const currentModelC = modelCRef.current;

    setCurrentA({ model: modelA, content: "", isStreaming: true });
    setCurrentB({ model: modelB, content: "", isStreaming: true });
    if (isThreeWay && currentModelC) {
      setCurrentC({ model: currentModelC, content: "", isStreaming: true });
    }

    const buildMessages = (userContent: string): Msg[] => {
      const msgs: Msg[] = [];
      if (systemPrompt.trim()) msgs.push({ role: "system", content: systemPrompt });
      msgs.push({ role: "user", content: userContent });
      return msgs;
    };

    const slots: StreamSlot[] = [
      {
        model: modelA,
        messages: buildMessages(pA),
        label: "Modell A",
        onUpdate: (content, streaming) =>
          setCurrentA({ model: modelA, content, isStreaming: streaming }),
      },
      {
        model: modelB,
        messages: buildMessages(pB),
        label: "Modell B",
        onUpdate: (content, streaming) =>
          setCurrentB({ model: modelB, content, isStreaming: streaming }),
      },
    ];

    if (isThreeWay && currentModelC) {
      slots.push({
        model: currentModelC,
        messages: buildMessages(pA),
        label: "Modell C",
        onUpdate: (content, streaming) =>
          setCurrentC({ model: currentModelC!, content, isStreaming: streaming }),
      });
    }

    streamAll(slots, {
      onAllDone: () => {
        setRounds(prev => [
          ...prev,
          {
            promptA: pA,
            promptB: pB,
            promptC: isThreeWay ? pA : undefined,
            resultA: { model: modelA, content: getContent(0), isStreaming: false },
            resultB: { model: modelB, content: getContent(1), isStreaming: false },
            resultC: isThreeWay && currentModelC
              ? { model: currentModelC, content: getContent(2), isStreaming: false }
              : undefined,
          },
        ]);
        setCurrentA(null);
        setCurrentB(null);
        setCurrentC(null);
      },
    });
  }, [promptText, promptA, promptB, decoupled, isRunning, modelA, modelB, systemPrompt, streamAll, getContent]);

  const handleStop = () => {
    stopAll();
    setCurrentA(prev => prev ? { ...prev, isStreaming: false } : null);
    setCurrentB(prev => prev ? { ...prev, isStreaming: false } : null);
    setCurrentC(prev => prev ? { ...prev, isStreaming: false } : null);
  };

  const canSend = decoupled
    ? promptA.trim() && promptB.trim()
    : promptText.trim();

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Split header: Model selectors */}
      <div className="flex border-b border-border shrink-0">
        <div className="flex-1 px-3 py-1.5 border-r border-border flex items-center gap-2">
          <span className="text-[10px] font-bold text-primary">A</span>
          <ModelSelect value={modelA} onValueChange={setModelA} disabled={isRunning} />
        </div>
        <div className={cn("flex-1 px-3 py-1.5 flex items-center gap-2", threeWay ? "border-r border-border" : "")}>
          <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400">B</span>
          <ModelSelect value={modelB} onValueChange={setModelB} disabled={isRunning} />
        </div>
        {threeWay ? (
          <div className="flex-1 px-3 py-1.5 flex items-center gap-2">
            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">C</span>
            <ModelSelect value={modelC || ""} onValueChange={setModelC} disabled={isRunning} />
            <button
              onClick={() => { setThreeWay(false); setModelC(null); }}
              className="text-[10px] text-muted-foreground hover:text-foreground ml-auto"
              title="Spalte C entfernen"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            onClick={() => setThreeWay(true)}
            className="px-3 py-1.5 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors border-l border-border"
            title="Drittes Modell hinzufügen"
          >
            <span className="text-sm">+</span> Modell C
          </button>
        )}
      </div>

      {/* Split results — scrollable */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Column A */}
        <div className={cn("flex-1 overflow-y-auto border-r border-border p-3 space-y-3")}>
          {rounds.map((r, i) => (
            <div key={i} className="space-y-1">
              <span className="text-[9px] text-muted-foreground font-medium">Runde {i + 1}</span>
              {decoupled && (
                <p className="text-[10px] text-muted-foreground font-mono bg-muted/50 rounded px-2 py-1 line-clamp-2">
                  {r.promptA}
                </p>
              )}
              <ComparisonColumn label="" result={r.resultA} />
            </div>
          ))}
          {currentA && <ComparisonColumn label="..." result={currentA} />}
          {rounds.length === 0 && !currentA && (
            <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
              Prompt eingeben und vergleichen
            </div>
          )}
        </div>

        {/* Column B */}
        <div className={cn("flex-1 overflow-y-auto p-3 space-y-3", threeWay ? "border-r border-border" : "")}>
          {rounds.map((r, i) => (
            <div key={i} className="space-y-1">
              <span className="text-[9px] text-muted-foreground font-medium">Runde {i + 1}</span>
              {decoupled && (
                <p className="text-[10px] text-muted-foreground font-mono bg-muted/50 rounded px-2 py-1 line-clamp-2">
                  {r.promptB}
                </p>
              )}
              <ComparisonColumn label="" result={r.resultB} />
            </div>
          ))}
          {currentB && <ComparisonColumn label="..." result={currentB} />}
          {rounds.length === 0 && !currentB && (
            <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
              Prompt eingeben und vergleichen
            </div>
          )}
        </div>

        {/* Column C — nur wenn threeWay */}
        {threeWay && (
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {rounds.map((r, i) => (
              <div key={i} className="space-y-1">
                <span className="text-[9px] text-muted-foreground font-medium">Runde {i + 1}</span>
                {r.resultC && <ComparisonColumn label="" result={r.resultC} />}
              </div>
            ))}
            {currentC && <ComparisonColumn label="..." result={currentC} />}
            {rounds.length === 0 && !currentC && (
              <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
                Prompt eingeben und vergleichen
              </div>
            )}
          </div>
        )}
      </div>

      {/* Comparative evaluation — after completed round */}
      {rounds.length > 0 && !isRunning && (
        <div className="border-t border-border px-3 py-1.5 flex items-center gap-2 shrink-0">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 text-muted-foreground">
                <Scale className="w-3 h-3" /> Vergleichende Bewertung
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[480px] max-h-[500px] overflow-y-auto p-4">
              <ComparativeJudge
                prompt={rounds[rounds.length - 1].promptA}
                outputA={rounds[rounds.length - 1].resultA.content}
                outputB={rounds[rounds.length - 1].resultB.content}
                labelA={getModelLabel(modelA)}
                labelB={getModelLabel(modelB)}
                model={selectedModel}
              />
            </PopoverContent>
          </Popover>
          <span className="text-[10px] text-muted-foreground ml-auto">
            {rounds.length} Runde{rounds.length > 1 ? "n" : ""}
          </span>
        </div>
      )}

      {/* Input area with decouple toggle */}
      <div className="border-t border-border px-3 py-2 space-y-2 shrink-0">
        <div className="flex items-center gap-2">
          {/* Back to chat */}
          {onBackToChat && (
            <button
              onClick={onBackToChat}
              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Chat
            </button>
          )}
          {onBackToChat && <div className="w-px h-3 bg-border" />}

          {/* Decouple toggle */}
          <button
            onClick={() => {
              if (!decoupled) {
                setPromptA(promptText);
                setPromptB(promptText);
              } else {
                setPromptText(promptA || promptB);
              }
              setDecoupled(!decoupled);
            }}
            className={cn(
              "text-[10px] px-2 py-0.5 rounded-full border font-medium transition-colors flex items-center gap-1",
              decoupled
                ? "bg-primary/10 border-primary/30 text-primary"
                : "border-border text-muted-foreground hover:border-primary/30"
            )}
          >
            {decoupled ? "✓ Entkoppelt" : "Entkoppeln"}
          </button>
          <span className="text-[10px] text-muted-foreground flex-1 truncate">
            {decoupled ? "Verschiedene Prompts pro Modell" : "Gleicher Prompt an alle"}
          </span>
          {isRunning && (
            <Button onClick={handleStop} variant="destructive" size="sm" className="h-6 text-[10px] gap-1">
              <Square className="w-3 h-3" /> Stopp
            </Button>
          )}
        </div>

        {/* Prompt input */}
        {decoupled ? (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold text-primary mb-1 block">Prompt A</label>
              <div className="border border-border rounded-xl bg-card shadow-sm focus-within:border-primary/40 focus-within:shadow-md transition-all">
                <textarea
                  ref={textareaARef}
                  value={promptA}
                  onChange={(e) => setPromptA(e.target.value)}
                  placeholder="Prompt für Modell A…"
                  className="w-full text-sm resize-none border-none bg-transparent px-3 py-2.5 focus:outline-none placeholder:text-muted-foreground/60"
                  rows={1}
                  disabled={isRunning}
                  style={{ minHeight: 36, maxHeight: 160 }}
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-violet-600 dark:text-violet-400 mb-1 block">
                Prompt B
              </label>
              <div className="border border-border rounded-xl bg-card shadow-sm focus-within:border-primary/40 focus-within:shadow-md transition-all">
                <textarea
                  ref={textareaBRef}
                  value={promptB}
                  onChange={(e) => setPromptB(e.target.value)}
                  placeholder="Prompt für Modell B…"
                  className="w-full text-sm resize-none border-none bg-transparent px-3 py-2.5 focus:outline-none placeholder:text-muted-foreground/60"
                  rows={1}
                  disabled={isRunning}
                  style={{ minHeight: 36, maxHeight: 160 }}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="border border-border rounded-xl bg-card shadow-sm focus-within:border-primary/40 focus-within:shadow-md transition-all">
            <textarea
              ref={textareaMainRef}
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="Prompt zum Vergleichen eingeben…"
              className="w-full text-sm resize-none border-none bg-transparent px-3 py-2.5 focus:outline-none placeholder:text-muted-foreground/60"
              rows={1}
              disabled={isRunning}
              style={{ minHeight: 36, maxHeight: 160 }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleCompare();
                }
              }}
            />
          </div>
        )}

        <div className="flex justify-end mt-1">
          <Button
            onClick={handleCompare}
            disabled={isRunning || !canSend}
            size="sm"
            className="h-8 text-xs gap-1.5 rounded-lg"
          >
            <Send className="w-3.5 h-3.5" /> {decoupled ? "Alle senden" : "Vergleichen"}
          </Button>
        </div>
      </div>
    </div>
  );
};
