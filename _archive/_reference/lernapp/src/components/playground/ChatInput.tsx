import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Send, Square, Brain, Plus, Paperclip, Link2, ClipboardPaste, Settings2 } from "lucide-react";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ModelSelectGroups } from "./ModelSelect";
import { getModelLabel } from "@/data/models";
import { cn } from "@/lib/utils";
import { getActiveRuleCount } from "@/lib/contextBuilder";
import { loadKIContext } from "@/services/kiContextService";
import { getActiveConstraints } from "@/services/constraintService";
import type { AIRoutingConfig } from "@/types";

export interface ChatInputProps {
  onSend: (message: string) => void;
  disabled: boolean;
  isStreaming?: boolean;
  onStop?: () => void;
  initialValue?: string;
  // KI-Controls (bisher im Footer)
  selectedModel?: string;
  onModelChange?: (model: string) => void;
  thinkingEnabled?: boolean;
  onThinkingChange?: (enabled: boolean) => void;
  aiTier?: "internal" | "external";
  onAiTierChange?: (tier: "internal" | "external") => void;
  canUseExternal?: boolean;
  aiRouting?: AIRoutingConfig;
  isExperte?: boolean;
}

export const ChatInput = ({
  onSend, disabled, isStreaming, onStop, initialValue,
  selectedModel, onModelChange, thinkingEnabled, onThinkingChange,
  aiTier, onAiTierChange, canUseExternal, aiRouting, isExperte,
}: ChatInputProps) => {
  const [input, setInput] = useState(initialValue ?? "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const initialConsumed = useRef(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (initialValue && !initialConsumed.current) {
      setInput(initialValue);
      initialConsumed.current = true;
    }
  }, [initialValue]);

  useEffect(() => { textareaRef.current?.focus(); }, []);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setInput("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + "px";
    }
  }, [input]);

  const activeRuleCount = getActiveRuleCount();
  const [rulesOpen, setRulesOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="border border-border rounded-xl bg-card shadow-sm focus-within:border-primary/40 focus-within:shadow-md transition-all" data-feedback-ref="prompt-labor.eingabe" data-feedback-label="Chat-Eingabe">
      {/* Active Rules Badge */}
      {activeRuleCount > 0 && (
        <div className="px-3 pt-2 pb-0">
          <Popover open={rulesOpen} onOpenChange={setRulesOpen}>
            <PopoverTrigger asChild>
              <button className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted rounded-full px-2.5 py-0.5 hover:bg-muted/80 transition-colors">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {activeRuleCount} Regeln aktiv
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" side="top" className="w-[300px] p-3 mb-1">
              <ActiveRulesPopover onNavigate={(path) => { setRulesOpen(false); navigate(path); }} />
            </PopoverContent>
          </Popover>
        </div>
      )}
      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Nachricht eingeben…"
        className="w-full px-3 pt-2.5 pb-1 text-sm resize-none border-none bg-transparent focus:outline-none placeholder:text-muted-foreground/60"
        rows={1}
        disabled={disabled}
        style={{ minHeight: 36, maxHeight: 160 }}
      />

      {/* Controls bar — inside the input box */}
      <div className="flex items-center gap-1.5 px-2 pb-2">
        {/* + Menu — nur Experte */}
        {isExperte && (
          <Popover open={plusOpen} onOpenChange={setPlusOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "w-7 h-7 rounded-lg border flex items-center justify-center transition-all",
                  plusOpen ? "bg-primary/10 border-primary/30 text-primary rotate-45" : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                )}
              >
                <Plus className="w-4 h-4 transition-transform" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" side="top" className="w-[200px] p-1.5 mb-1">
              <div className="space-y-0.5">
                <button
                  onClick={() => { setPlusOpen(false); /* TODO: Datei-Dialog */ }}
                  className="flex items-center gap-3 w-full px-3 py-2 text-[13px] rounded-lg hover:bg-muted transition-colors text-left"
                >
                  <Paperclip className="w-4 h-4 text-muted-foreground shrink-0" />
                  Datei anhängen
                </button>
                <button
                  onClick={() => { setPlusOpen(false); /* TODO: URL-Import */ }}
                  className="flex items-center gap-3 w-full px-3 py-2 text-[13px] rounded-lg hover:bg-muted transition-colors text-left"
                >
                  <Link2 className="w-4 h-4 text-muted-foreground shrink-0" />
                  URL importieren
                </button>
                <button
                  onClick={() => {
                    setPlusOpen(false);
                    navigator.clipboard.readText().then(t => { if (t.trim()) setInput(prev => prev + t); });
                  }}
                  className="flex items-center gap-3 w-full px-3 py-2 text-[13px] rounded-lg hover:bg-muted transition-colors text-left"
                >
                  <ClipboardPaste className="w-4 h-4 text-muted-foreground shrink-0" />
                  Aus Zwischenablage
                </button>
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* KI-Settings — nur Experte */}
        {isExperte && (selectedModel || onThinkingChange) && (
          <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
            <PopoverTrigger asChild>
              <button className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] font-medium transition-all",
                settingsOpen
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
              )}>
                {aiTier === "internal" ? "🏢" : "☁️"} {selectedModel ? getModelLabel(selectedModel) : "Modell"}
                {thinkingEnabled && <Brain className="w-3 h-3 text-primary" />}
                <span className="text-[8px]">▾</span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" side="top" className="w-[260px] p-3 mb-1 space-y-3">
              {/* Modell-Auswahl */}
              {selectedModel && onModelChange && (
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Modell</label>
                  <Select value={selectedModel} onValueChange={onModelChange}>
                    <SelectTrigger className="w-full text-xs h-8">
                      <span className="truncate">{getModelLabel(selectedModel)}</span>
                    </SelectTrigger>
                    <SelectContent>
                      {aiTier === "internal" ? (
                        <SelectGroup>
                          <SelectLabel>🏢 Interne KI</SelectLabel>
                          {aiRouting?.internalModel ? (
                            <SelectItem value={aiRouting.internalModel}>{aiRouting.internalModel}</SelectItem>
                          ) : (
                            <SelectItem value="internal-default" disabled>Nicht konfiguriert</SelectItem>
                          )}
                        </SelectGroup>
                      ) : (
                        <ModelSelectGroups />
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {/* Tier-Toggle */}
              {onAiTierChange && (
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">KI-Quelle</label>
                  <div className="flex rounded-lg border border-border overflow-hidden">
                    <button onClick={() => onAiTierChange("internal")}
                      className={cn("flex-1 px-3 py-1.5 text-xs font-medium transition-colors",
                        aiTier === "internal" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50")}>
                      🏢 Intern
                    </button>
                    <button onClick={() => canUseExternal && onAiTierChange("external")}
                      disabled={!canUseExternal}
                      className={cn("flex-1 px-3 py-1.5 text-xs font-medium transition-colors",
                        aiTier === "external" && canUseExternal ? "bg-primary text-primary-foreground"
                          : canUseExternal ? "text-muted-foreground hover:bg-muted/50"
                          : "text-muted-foreground/30 cursor-not-allowed")}>
                      ☁️ Extern
                    </button>
                  </div>
                </div>
              )}
              {/* Denken Toggle */}
              {onThinkingChange && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Brain className="w-4 h-4 text-muted-foreground" />
                    <span className="text-[13px]">Denken</span>
                  </div>
                  <button
                    onClick={() => onThinkingChange(!thinkingEnabled)}
                    className={cn(
                      "relative w-9 h-5 rounded-full transition-colors",
                      thinkingEnabled ? "bg-primary" : "bg-border"
                    )}
                  >
                    <span className={cn(
                      "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform",
                      thinkingEnabled ? "left-[18px]" : "left-0.5"
                    )} />
                  </button>
                </div>
              )}
            </PopoverContent>
          </Popover>
        )}

        <div className="flex-1" />

        {/* Send / Stop */}
        {isStreaming ? (
          <button
            onClick={onStop}
            className="shrink-0 h-8 w-8 relative flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
            title="Stoppen"
          >
            <svg className="absolute inset-0 w-full h-full animate-spin" viewBox="0 0 32 32">
              <circle cx="16" cy="16" r="13" fill="none" strokeWidth="2" stroke="hsl(var(--primary) / 0.15)" />
              <circle cx="16" cy="16" r="13" fill="none" strokeWidth="2.5" stroke="hsl(var(--primary))" strokeDasharray="20 60" strokeLinecap="round" />
            </svg>
            <Square className="w-3 h-3 fill-primary text-primary" />
          </button>
        ) : (
          <Button
            onClick={handleSend}
            disabled={disabled || !input.trim()}
            size="icon"
            className="shrink-0 h-8 w-8 rounded-lg"
          >
            <Send className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
};

function ActiveRulesPopover({ onNavigate }: { onNavigate: (path: string) => void }) {
  const ctx = loadKIContext();
  const activeWorkRules = ctx.workRules.filter((r) => r.active);
  const activeConstraints = getActiveConstraints();

  return (
    <div className="space-y-3">
      {activeWorkRules.length > 0 && (
        <div>
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Arbeitsregeln</p>
          <div className="space-y-1">
            {activeWorkRules.map((r) => (
              <div key={r.id} className="flex items-start gap-2">
                <p className="text-xs leading-relaxed flex-1">{r.text}</p>
                <span className="text-[10px] bg-muted text-muted-foreground rounded px-1.5 py-0.5 shrink-0">{r.domain}</span>
              </div>
            ))}
          </div>
          <button onClick={() => onNavigate("/settings")} className="text-[11px] text-primary hover:underline mt-1.5">
            Regeln bearbeiten
          </button>
        </div>
      )}
      {activeConstraints.length > 0 && (
        <div>
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Qualitätsregeln</p>
          <div className="space-y-1">
            {activeConstraints.map((c) => (
              <div key={c.id} className="flex items-start gap-2">
                <p className="text-xs leading-relaxed flex-1">{c.rule}</p>
                <span className="text-[10px] bg-muted text-muted-foreground rounded px-1.5 py-0.5 shrink-0">{c.domain}</span>
              </div>
            ))}
          </div>
          <button onClick={() => onNavigate("/library?section=constraints")} className="text-[11px] text-primary hover:underline mt-1.5">
            Regeln bearbeiten
          </button>
        </div>
      )}
    </div>
  );
}
