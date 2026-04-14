import { useState } from "react";
import { Download, Copy, Trash2, Scale, Bookmark, Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { ChatPlayground } from "./ChatPlayground";
import { ComparisonSplitView } from "./ComparisonSplitView";
import { JudgePanel } from "./JudgePanel";
import { AgentKnobs, type AgentConfig } from "./AgentKnobs";
import { cn } from "@/lib/utils";
import { exportChatAsMarkdown, exportChatAsDocx } from "@/lib/exportChat";
import type { Msg, AIRoutingConfig } from "@/types";

export interface PlaygroundContentProps {
  messages: Msg[];
  onSendMessage: (content: string) => void;
  isStreaming: boolean;
  streamingContent: string;
  thinkingContent?: string;
  thinkingEnabled?: boolean;
  systemPrompt: string;
  onSystemPromptChange: (v: string) => void;
  onClearChat: () => void;
  onStop: () => void;
  onBudgetExhausted: () => void;
  prefilledPrompt?: string;
  skillId?: string | null;
  skillTitle?: string | null;
  requestedModel?: string | null;
  mode?: "einsteiger" | "experte";
  lastUserPrompt?: string;
  // KI-Controls (moved from header)
  selectedModel: string;
  onModelChange: (model: string) => void;
  onThinkingChange: (enabled: boolean) => void;
  aiTier: "internal" | "external";
  onAiTierChange: (tier: "internal" | "external") => void;
  canUseExternal: boolean;
  aiRouting: AIRoutingConfig;
  // Agent
  agentConfig: AgentConfig;
  onAgentConfigChange: (config: AgentConfig) => void;
  onStartAgent: (prompt: string) => void;
  // Chat/Compare mode (lifted to Playground.tsx)
  chatMode: "chat" | "compare";
  onChatModeChange: (mode: "chat" | "compare") => void;
  assembledPrompt?: string;
}

export const PlaygroundContent = ({
  messages,
  onSendMessage,
  isStreaming,
  streamingContent,
  thinkingContent,
  thinkingEnabled,
  systemPrompt,
  onSystemPromptChange,
  onClearChat,
  onStop,
  onBudgetExhausted,
  prefilledPrompt,
  skillId,
  skillTitle,
  requestedModel,
  mode = "experte",
  lastUserPrompt,
  selectedModel,
  onModelChange,
  onThinkingChange,
  aiTier,
  onAiTierChange,
  canUseExternal,
  aiRouting,
  agentConfig,
  onAgentConfigChange,
  onStartAgent,
  chatMode,
  onChatModeChange,
  assembledPrompt,
}: PlaygroundContentProps) => {
  const isExperte = mode === "experte";
  const setChatMode = onChatModeChange;
  const [agentEnabled, setAgentEnabled] = useState(false);

  const lastAssistantContent =
    messages.length >= 2 && messages[messages.length - 1].role === "assistant"
      ? messages[messages.length - 1].content
      : "";
  const hasAssistantResponse = lastAssistantContent.length > 0;
  const hasMessages = messages.length > 0;
  const hasAssistantMessage = messages.some(m => m.role === "assistant");

  const copyLastResponse = () => {
    const lastAssistant = [...messages].reverse().find(m => m.role === "assistant");
    if (lastAssistant) {
      navigator.clipboard.writeText(lastAssistant.content);
      toast.success("Antwort kopiert!");
    }
  };

  // ⚠️ min-h-0 + min-w-0: Erlaubt Flex-Children zu schrumpfen statt zu überlaufen
  return (
    <main className="h-full flex flex-col min-h-0 min-w-0">
      {/* Skill-Banner */}
      {skillId && (
        <div className="bg-primary/5 border border-primary/15 rounded-lg px-4 py-2 mb-3 flex items-center gap-2 text-sm">
          <Bookmark className="w-4 h-4 text-primary shrink-0" />
          <span>
            Skill testen: <strong>{skillTitle}</strong>
            {requestedModel && (
              <>
                {" "}· Ziel-Modell:{" "}
                <Badge variant="outline" className="text-[10px] ml-1">
                  {requestedModel.split("/").pop()}
                </Badge>
              </>
            )}
          </span>
        </div>
      )}

      {/* ═══ TOOLBAR — Icon-only + kontextuelle Buttons ═══ */}
      <div className="flex items-center px-3 py-1.5 border-b border-border border-t-2 border-t-border bg-secondary/50 dark:bg-muted/30 gap-1">
        {/* Zonen-Label */}
        <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest mr-2 hidden sm:inline">Ergebnis</span>
        {/* Modus-Toggle */}
        <div className="flex gap-0.5 bg-card rounded-md p-0.5 mr-1 shadow-sm border border-border/60">
          <button
            onClick={() => setChatMode("chat")}
            className={cn(
              "px-2 py-0.5 rounded text-[11px] font-medium transition-colors",
              chatMode === "chat" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Chat
          </button>
          {isExperte && (
            <button
              onClick={() => setChatMode("compare")}
              className={cn(
                "px-2 py-0.5 rounded text-[11px] font-medium transition-colors",
                chatMode === "compare" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Vergleich
            </button>
          )}
        </div>

        {/* KI-Bewertung — nur Experte + Chat + Antwort vorhanden */}
        {isExperte && hasAssistantResponse && chatMode === "chat" && lastUserPrompt && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 text-muted-foreground" title="KI bewertet die Qualität und Vollständigkeit der Antwort">
                <Scale className="w-3 h-3" /> Antwort bewerten
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[400px] max-h-[500px] overflow-y-auto p-4">
              <JudgePanel prompt={lastUserPrompt} output={lastAssistantContent} model={selectedModel || ""} />
            </PopoverContent>
          </Popover>
        )}

        <div className="flex-1" />

        {/* Icon-only actions */}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive"
          title="Chat Verlauf löschen"
          onClick={onClearChat}
          disabled={!hasMessages}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" title="KI Antwort in Zwischenablage" disabled={!hasAssistantMessage}>
              <Copy className="w-3.5 h-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-auto p-1.5">
            <button
              onClick={copyLastResponse}
              className="block w-full text-left px-3 py-1.5 text-[11px] rounded-md hover:bg-muted transition-colors"
            >
              Letzte KI-Antwort
            </button>
            <button
              onClick={() => {
                const full = messages.map(m => `${m.role === "user" ? "Du" : "KI"}:\n${m.content}`).join("\n\n---\n\n");
                navigator.clipboard.writeText(full);
                toast.success("Ganzen Chat kopiert!");
              }}
              className="block w-full text-left px-3 py-1.5 text-[11px] rounded-md hover:bg-muted transition-colors"
            >
              Ganzen Chat
            </button>
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" title="Exportieren" disabled={!hasMessages}>
              <Download className="w-3.5 h-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-auto p-1.5">
            <button
              onClick={() => { exportChatAsMarkdown(messages); toast.success("Als Markdown exportiert!"); }}
              className="block w-full text-left px-3 py-1.5 text-[11px] rounded-md hover:bg-muted transition-colors"
            >
              Export als Markdown
            </button>
            <button
              onClick={() => { exportChatAsDocx(messages); toast.success("Als Word exportiert!"); }}
              className="block w-full text-left px-3 py-1.5 text-[11px] rounded-md hover:bg-muted transition-colors"
            >
              Export als Word
            </button>
          </PopoverContent>
        </Popover>

        {/* Settings — nur Experte */}
        {isExperte && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <Settings className="w-3.5 h-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-3 space-y-3">
              <h4 className="text-xs font-semibold">Einstellungen</h4>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">System-Prompt</label>
                <Textarea
                  value={systemPrompt}
                  onChange={(e) => onSystemPromptChange(e.target.value)}
                  placeholder="Optionaler System-Prompt..."
                  className="text-xs min-h-[48px] resize-y"
                  rows={2}
                />
              </div>
              <Separator />
              <label className="flex items-center justify-between">
                <span className="text-[11px]">🤖 Agenten-Modus</span>
                <Switch checked={agentEnabled} onCheckedChange={setAgentEnabled} />
              </label>
              {agentEnabled && (
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full text-[11px] h-7 gap-1">
                      🤖 Agent konfigurieren
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-[380px] sm:w-[420px] overflow-y-auto">
                    <SheetTitle className="text-base font-bold mb-4">🤖 Agenten-Modus</SheetTitle>
                    <AgentKnobs
                      config={agentConfig}
                      onConfigChange={onAgentConfigChange}
                      onStartAgent={onStartAgent}
                      bare
                    />
                  </SheetContent>
                </Sheet>
              )}
              <Separator />
              <p className="text-[10px] text-muted-foreground">
                Einstellungen gelten für diese Session.
              </p>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* ═══ CONTENT — Chat oder Vergleich ═══ */}
      {chatMode === "compare" ? (
        <ComparisonSplitView
          systemPrompt={systemPrompt}
          onBudgetExhausted={onBudgetExhausted}
          selectedModel={selectedModel}
          onBackToChat={() => setChatMode("chat")}
          initialPrompt={lastUserPrompt || assembledPrompt}
          internalModel={aiRouting?.internalModel}
        />
      ) : (
        <div data-tour="chat-area" className="flex-1 min-h-0">
          <ChatPlayground
            messages={messages}
            onSendMessage={onSendMessage}
            isStreaming={isStreaming}
            streamingContent={streamingContent}
            thinkingContent={thinkingContent}
            thinkingEnabled={thinkingEnabled}
            systemPrompt={systemPrompt}
            onSystemPromptChange={onSystemPromptChange}
            onClearChat={onClearChat}
            onStop={onStop}
            initialPrompt={prefilledPrompt}
            hideSystemPrompt
            selectedModel={selectedModel}
            onModelChange={onModelChange}
            onThinkingChange={onThinkingChange}
            aiTier={aiTier}
            onAiTierChange={onAiTierChange}
            canUseExternal={canUseExternal}
            aiRouting={aiRouting}
            isExperte={isExperte}
          />
        </div>
      )}
    </main>
  );
};
