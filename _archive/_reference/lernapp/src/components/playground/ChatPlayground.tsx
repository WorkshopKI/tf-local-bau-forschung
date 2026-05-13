import { useRef, useEffect, useMemo } from "react";
import { Bot, Brain } from "lucide-react";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { SystemPromptEditor } from "./SystemPromptEditor";
import { IterationNudge } from "./IterationNudge";
import { RejectionNudge } from "./RejectionNudge";
import { ThinkingBlock } from "./ThinkingBlock";
import { useOrgContext } from "@/contexts/OrgContext";
import type { OrgScope, Msg, AIRoutingConfig } from "@/types";

interface Suggestion {
  title: string;
  prompt: string;
}

const GENERAL_SUGGESTIONS: Suggestion[] = [
  { title: "Text erstellen", prompt: "Schreibe einen professionellen LinkedIn-Post über künstliche Intelligenz im Mittelstand." },
  { title: "Analysieren", prompt: "Vergleiche die Vor- und Nachteile von Remote-Arbeit für ein Team mit 15 Personen." },
  { title: "Ideen sammeln", prompt: "Generiere 10 kreative Marketingideen für ein nachhaltiges Mode-Label mit Budget unter 5.000 Euro." },
  { title: "Strukturieren", prompt: "Erstelle eine Checkliste für die Einführung eines neuen CRM-Systems in einem KMU." },
  { title: "E-Mail formulieren", prompt: "Formuliere eine professionelle Antwort auf eine Kundenbeschwerde wegen verspäteter Lieferung." },
  { title: "Zusammenfassen", prompt: "Fasse einen 10-seitigen Quartalsbericht auf die 5 wichtigsten Erkenntnisse und Handlungsempfehlungen zusammen." },
];

const DEPARTMENT_SUGGESTIONS: Partial<Record<OrgScope, Suggestion[]>> = {
  legal: [
    { title: "Vertragsklauseln prüfen", prompt: "Prüfe die folgenden Vertragsklauseln auf potenzielle Risiken und schlage Alternativformulierungen vor. [JURIST:IN PRÜFEN]" },
    { title: "DSGVO-Checkliste", prompt: "Erstelle eine DSGVO-Prüfcheckliste für die Einführung eines neuen Cloud-Dienstes mit Bezug auf Art. 28 und Art. 32 DSGVO." },
    { title: "Rechtliche Stellungnahme", prompt: "Entwirf eine Gliederung für eine rechtliche Stellungnahme zum Thema Haftung bei KI-generierten Inhalten. [JURIST:IN PRÜFEN]" },
  ],
  oeffentlichkeitsarbeit: [
    { title: "Pressemitteilung", prompt: "Erstelle eine Pressemitteilung im Format Headline – Lead – Zitat – Hintergrund für die Eröffnung eines neuen Bürgerservice-Zentrums." },
    { title: "Social-Media-Post", prompt: "Schreibe einen barrierefreien Social-Media-Post für eine kommunale Informationskampagne zum Thema Digitalisierung." },
    { title: "Bürgerinformation", prompt: "Verfasse eine verständliche Bürgerinformation (Sprachniveau B1) zu geänderten Öffnungszeiten als FAQ-Format." },
  ],
  hr: [
    { title: "Stellenausschreibung", prompt: "Erstelle eine AGG-konforme Stellenausschreibung für eine Projektmanager-Position mit Fokus auf Diversität und Benefits." },
    { title: "Interview-Leitfaden", prompt: "Erstelle einen strukturierten Interview-Leitfaden nach der STAR-Methode für eine Teamleiter-Position mit Bewertungsskala 1–5." },
    { title: "Fortbildungsplan", prompt: "Erstelle einen Quartals-Fortbildungsplan für eine Abteilung mit 20 Mitarbeitenden, inklusive Pflichtschulungen und optionaler Weiterbildung." },
  ],
  it: [
    { title: "Störungsmeldung", prompt: "Strukturiere eine IT-Störungsmeldung mit Severity-Level (P1–P4), Symptombeschreibung, Auswirkung und nächsten Schritten." },
    { title: "Anforderungsdokument", prompt: "Erstelle ein Anforderungsdokument mit 10 User Stories inkl. Akzeptanzkriterien und MoSCoW-Priorisierung für ein internes Ticketsystem." },
    { title: "Migrationsleitfaden", prompt: "Erstelle einen Migrationsleitfaden für den Umzug eines On-Premise-Systems in die Cloud, inkl. Phasenplan und Rollback-Strategie." },
  ],
  bauverfahren: [
    { title: "Baugenehmigung prüfen", prompt: "Erstelle eine Prüfcheckliste für einen Baugenehmigungsantrag nach der jeweiligen Landesbauordnung mit allen erforderlichen Unterlagen." },
    { title: "Ausschreibungstext", prompt: "Entwirf einen Ausschreibungstext für Tiefbauarbeiten mit technischen Anforderungen, Eignungskriterien und Zuschlagskriterien." },
    { title: "Projektstatusbericht", prompt: "Erstelle eine Vorlage für einen Projektstatusbericht eines Bauvorhabens mit Meilensteinen, Kostenübersicht und Risikobewertung." },
  ],
};

export interface ChatPlaygroundProps {
  messages: Msg[];
  onSendMessage: (content: string) => void;
  isStreaming: boolean;
  streamingContent: string;
  thinkingContent?: string;
  thinkingEnabled?: boolean;
  systemPrompt: string;
  onSystemPromptChange: (value: string) => void;
  onClearChat: () => void;
  onStop: () => void;
  initialPrompt?: string;
  hideSystemPrompt?: boolean;
  // KI-Controls passed through to ChatInput
  selectedModel?: string;
  onModelChange?: (model: string) => void;
  onThinkingChange?: (enabled: boolean) => void;
  aiTier?: "internal" | "external";
  onAiTierChange?: (tier: "internal" | "external") => void;
  canUseExternal?: boolean;
  aiRouting?: AIRoutingConfig;
  isExperte?: boolean;
}

export const ChatPlayground = ({
  messages,
  onSendMessage,
  isStreaming,
  streamingContent,
  thinkingContent = "",
  thinkingEnabled = false,
  systemPrompt,
  onSystemPromptChange,
  onClearChat,
  onStop,
  initialPrompt,
  hideSystemPrompt,
  selectedModel,
  onModelChange,
  onThinkingChange,
  aiTier,
  onAiTierChange,
  canUseExternal,
  aiRouting,
  isExperte,
}: ChatPlaygroundProps) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const { scope, isDepartment } = useOrgContext();

  const suggestions = useMemo(() => {
    const deptCards = isDepartment ? (DEPARTMENT_SUGGESTIONS[scope] ?? []) : [];
    if (deptCards.length > 0) {
      return [...deptCards, ...GENERAL_SUGGESTIONS.slice(0, 3)];
    }
    return GENERAL_SUGGESTIONS;
  }, [scope, isDepartment]);

  useEffect(() => {
    if (isAtBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, streamingContent, thinkingContent]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const threshold = 100;
    isAtBottomRef.current =
      target.scrollHeight - target.scrollTop - target.clientHeight < threshold;
  };

  const hasMessages = messages.length > 0 || isStreaming;
  const turnCount = messages.filter((m) => m.role === "user").length;

  return (
    <div className="flex flex-col h-full min-w-0" data-feedback-ref="prompt-labor.chat-bereich" data-feedback-label="Chat-Bereich">
      {/* System Prompt */}
      {!hideSystemPrompt && (
        <div className="px-4 pt-4">
          <SystemPromptEditor value={systemPrompt} onChange={onSystemPromptChange} />
        </div>
      )}

      {/* ⚠️ EINZIGER vertikaler Scroll-Container im Chat. */}
      <div
        className="flex-1 px-4 py-4 space-y-4 min-h-0 overflow-y-auto scrollbar-thin"
        onScroll={handleScroll}
      >
        {!hasMessages && (
          <div className="flex items-center justify-center h-full">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-w-2xl w-full">
              {suggestions.map((s) => (
                <button
                  key={s.title}
                  onClick={() => onSendMessage(s.prompt)}
                  className="bg-card border border-border rounded-lg p-4 hover:border-primary/50 cursor-pointer transition-colors text-left"
                >
                  <p className="text-sm font-medium mb-1">{s.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{s.prompt}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) =>
          msg.role === "user" || msg.role === "assistant" ? (
            <ChatMessage key={i} role={msg.role} content={msg.content} />
          ) : null
        )}

        {/* Thinking Block */}
        {thinkingContent && (
          <ThinkingBlock
            content={thinkingContent}
            isStreaming={isStreaming}
          />
        )}

        {/* Lade-Indikator — zwischen Senden und erstem Token */}
        {isStreaming && !streamingContent && (
          <div className="flex items-start gap-3 px-4 py-3">
            <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
              {thinkingEnabled && thinkingContent ? (
                <Brain className="w-4 h-4 text-primary/60 animate-pulse" />
              ) : (
                <Bot className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
            <div className="flex items-center gap-2 pt-1.5">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
              <span className="text-xs text-muted-foreground ml-1">
                {thinkingEnabled ? "Denkt nach\u2026" : "Antwortet\u2026"}
              </span>
            </div>
          </div>
        )}

        {/* Streaming Content */}
        {isStreaming && streamingContent && (
          <ChatMessage role="assistant" content={streamingContent} isStreaming />
        )}

        {/* Iteration Nudge — inside scroll, directly under output */}
        {!isStreaming && turnCount > 0 && (
          <IterationNudge
            turnCount={turnCount}
            onSendSuggestion={(text) => onSendMessage(text)}
          />
        )}

        {/* Rejection Nudge — nach dem 2. Turn */}
        {!isStreaming && turnCount >= 2 && (
          <RejectionNudge
            turnCount={turnCount}
            recentMessages={messages.slice(-4)}
          />
        )}

        {hasMessages && <div ref={bottomRef} />}
      </div>

      {/* Input */}
      <div className="px-4 pb-4 pt-2 border-t border-border">
        <ChatInput
          onSend={onSendMessage}
          disabled={isStreaming}
          isStreaming={isStreaming}
          onStop={onStop}
          initialValue={initialPrompt}
          selectedModel={selectedModel}
          onModelChange={onModelChange}
          thinkingEnabled={thinkingEnabled}
          onThinkingChange={onThinkingChange}
          aiTier={aiTier}
          onAiTierChange={onAiTierChange}
          canUseExternal={canUseExternal}
          aiRouting={aiRouting}
          isExperte={isExperte}
        />
      </div>
    </div>
  );
};
