import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { LogIn, BookOpen } from "lucide-react";
import { BudgetDialog } from "@/components/BudgetDialog";
import { PlaygroundContent } from "@/components/playground/PlaygroundContent";
import { PlaygroundHeader } from "@/components/playground/PlaygroundHeader";
import { PromptBrowser } from "@/components/playground/PromptBrowser";
import { ACTABuilder } from "@/components/playground/ACTABuilder";
import { useChat } from "@/hooks/useChat";
import { useConversations } from "@/hooks/useConversations";
import { usePlaygroundSettings } from "@/hooks/usePlaygroundSettings";
import { LS_KEYS } from "@/lib/constants";
import { loadStringFromStorage } from "@/lib/storage";
import { promptLibrary } from "@/data/prompts";
import { splitPromptToACTA } from "@/lib/promptUtils";
import type { ACTAFields } from "@/components/playground/ACTATemplates";
import type { AgentConfig } from "@/components/playground/AgentKnobs";
import { toast } from "sonner";
import { useTour } from "@/hooks/useTour";
import { getStepsForMode } from "@/components/playground/tourSteps";
import { TourOverlay } from "@/components/playground/TourOverlay";

const Playground = () => {
  const { isLoggedIn, isLoading, profile } = useAuthContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefilledPrompt = searchParams.get("prompt") ?? undefined;
  const libraryTitle = searchParams.get("libraryTitle");
  const skillId = searchParams.get("skillId");
  const skillTitle = searchParams.get("skillTitle");
  const requestedModel = searchParams.get("model");
  const isNew = searchParams.get("new") === "true";

  // --- Confidentiality state (drives routing) ---
  const [promptConfidentiality, setPromptConfidentiality] = useState<"open" | "internal" | "confidential">("open");

  // --- Model & routing state (extracted hook) ---
  const settings = usePlaygroundSettings({
    profileModel: profile?.preferred_model,
    requestedModel,
    promptConfidentiality,
  });

  const [systemPrompt, setSystemPrompt] = useState("");

  // --- UI state ---
  const [showBudgetDialog, setShowBudgetDialog] = useState(false);
  const [actaFields, setActaFields] = useState<ACTAFields>({ act: "", context: "", task: "", ausgabe: "" });
  const [sourcePromptTitle, setSourcePromptTitle] = useState<string | null>(null);
  const [agentConfig, setAgentConfig] = useState<AgentConfig>({
    habitat: "", hands: ["read", "write", "web"], leash: 50, proof: "sources", task: "",
  });
  const [chatMode, setChatMode] = useState<"chat" | "compare">("chat");
  const [lastAssembledPrompt, setLastAssembledPrompt] = useState("");
  const [actaExpanded, setActaExpanded] = useState(true);

  // --- Playground mode ---
  const [playgroundMode, setPlaygroundMode] = useState<"einsteiger" | "experte">(() =>
    loadStringFromStorage(LS_KEYS.PLAYGROUND_MODE, "einsteiger") as "einsteiger" | "experte"
  );

  const handleModeChange = (mode: "einsteiger" | "experte") => {
    setPlaygroundMode(mode);
    localStorage.setItem(LS_KEYS.PLAYGROUND_MODE, mode);
    if (mode === "experte" && !localStorage.getItem("rakete_intro_shown")) {
      toast.info(
        "ACTA → RAKETE: Deine 4 Felder sind jetzt deutsch benannt. Neu dazu: Teste (Selbstprüfung) + Einschränkungen (Was die KI NICHT tun soll)",
        { duration: 6000 }
      );
      localStorage.setItem("rakete_intro_shown", "true");
    }
  };

  // --- Guided tour ---
  const tourSteps = useMemo(() => getStepsForMode(playgroundMode), [playgroundMode]);
  const tour = useTour(tourSteps.length);

  useEffect(() => {
    if (!tour.hasCompleted && isLoggedIn && !isLoading) {
      const timer = setTimeout(() => tour.start(), 800);
      return () => clearTimeout(timer);
    }
  }, [isLoggedIn, isLoading]);

  // --- Custom hooks ---
  const chat = useChat({
    systemPrompt,
    selectedModel: settings.selectedModel,
    thinkingEnabled: settings.thinkingEnabled,
    onBudgetExhausted: () => setShowBudgetDialog(true),
  });

  const convos = useConversations();

  // --- Prefilled prompt confidentiality ---
  useEffect(() => {
    if (prefilledPrompt) {
      const match = promptLibrary.find((p) => p.prompt === prefilledPrompt);
      if (match?.confidentiality) setPromptConfidentiality(match.confidentiality);
    }
  }, [prefilledPrompt]);

  // --- Library prompt → ACTA pre-fill ---
  useEffect(() => {
    if (!libraryTitle) return;
    const match = promptLibrary.find(p => p.title === libraryTitle);
    if (!match) return;

    setSourcePromptTitle(match.title);

    if (match.actaFields) {
      setActaFields({
        act: match.actaFields.act || "",
        context: match.actaFields.context || "",
        task: match.actaFields.task || "",
        ausgabe: match.actaFields.ausgabe || "",
        extensions: match.actaFields.extensions ? { ...match.actaFields.extensions } : undefined,
      });
    } else {
      const fallback = splitPromptToACTA(match.prompt, match.title);
      setActaFields({ act: fallback.act, context: fallback.context, task: fallback.task, ausgabe: fallback.ausgabe, extensions: undefined });
    }

    if (match.confidentiality) {
      setPromptConfidentiality(match.confidentiality);
    }
  }, [libraryTitle]);

  // --- Restore active conversation on mount ---
  useEffect(() => {
    if (prefilledPrompt) return;
    const restored = convos.restoreActiveConversation();
    if (restored) {
      chat.setMessages(restored.messages);
      setSystemPrompt(restored.systemPrompt);
      settings.setSelectedModel(settings.validModel(restored.model));
    }
  }, []);

  // --- "Neuer Prompt" flow from Library ---
  useEffect(() => {
    if (isNew && !prefilledPrompt && !libraryTitle && !skillId) {
      toast("Neuer Prompt", {
        description: "Wähle eine Vorlage aus der Sammlung (links) oder fülle die Felder im Baukasten aus.",
        duration: 6000,
      });
      // Clean up URL param
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("new");
      const qs = newParams.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Persist conversation on message change ---
  useEffect(() => {
    convos.persistMessages(chat.messages, systemPrompt, settings.selectedModel, chat.isStreaming);
  }, [chat.messages, chat.isStreaming]);

  // --- Handlers ---
  const handleSelectConversation = (conv: Parameters<typeof convos.selectConversation>[0]) => {
    const data = convos.selectConversation(conv);
    chat.setMessages(data.messages);
    setSystemPrompt(data.systemPrompt);
    settings.setSelectedModel(settings.validModel(data.model));
    chat.setStreamingContent("");
    chat.resetThinking();
  };

  const handleNewConversation = () => {
    chat.setMessages([]);
    chat.setStreamingContent("");
    chat.resetThinking();
    setSystemPrompt("");
    convos.newConversation();
  };

  const handleDeleteConversation = (id: string) => {
    const wasActive = convos.deleteConversation(id);
    if (wasActive) {
      chat.setMessages([]);
      chat.setStreamingContent("");
      chat.resetThinking();
    }
  };

  const handleClearChat = () => {
    chat.setMessages([]);
    chat.setStreamingContent("");
    chat.resetThinking();
    convos.clearActiveConversation();
    setActaExpanded(true);
  };

  // --- ACTA Reset handler ---
  const handleACTAReset = () => {
    setActaFields({ act: "", context: "", task: "", ausgabe: "", extensions: undefined });
    setSourcePromptTitle(null);
    setPromptConfidentiality("open");
  };

  // --- Prompt Browser selection handler ---
  const handleBrowserSelect = (title: string) => {
    const found = promptLibrary.find(p => p.title === title);
    if (!found) return;
    setSourcePromptTitle(title);
    if (found.actaFields) {
      setActaFields({
        act: found.actaFields.act || "",
        context: found.actaFields.context || "",
        task: found.actaFields.task || "",
        ausgabe: found.actaFields.ausgabe || "",
        extensions: found.actaFields.extensions ? { ...found.actaFields.extensions } : undefined,
      });
    } else {
      const fallback = splitPromptToACTA(found.prompt, found.title);
      setActaFields({ act: fallback.act, context: fallback.context, task: fallback.task, ausgabe: fallback.ausgabe, extensions: undefined });
    }
    if (found.confidentiality) setPromptConfidentiality(found.confidentiality);
    setActaExpanded(true);
  };

  // Route "An KI senden" based on active mode
  const handleSendToPlayground = (assembledPrompt: string) => {
    setLastAssembledPrompt(assembledPrompt);
    if (chatMode === "compare") {
      // In compare mode: just store the prompt, ComparisonSplitView picks it up via initialPrompt
      return;
    }
    chat.sendMessage(assembledPrompt);
  };

  const lastUserPrompt = [...chat.messages].reverse().find((m) => m.role === "user")?.content ?? "";

  if (isLoading) return null;

  // ⚠️ LAYOUT-KETTE: h-screen + overflow-hidden verhindert Body-Scroll.
  return (
    <div className="playground-root">
      <PlaygroundHeader
        mode={playgroundMode}
        onModeChange={handleModeChange}
        onStartTour={tour.start}
        canUseExternal={settings.canUseExternal}
        promptConfidentiality={promptConfidentiality}
        aiTier={settings.aiTier}
        aiRouting={settings.aiRouting}
      />

      {/* ⚠️ flex-1 + overflow-hidden: Nimmt Resthöhe (screen − header), kein Scroll auf dieser Ebene */}
      <div className="flex-1 overflow-hidden">
        {!isLoggedIn ? (
          <div className="px-4 py-4 max-w-[1380px] mx-auto">
            <Card className="max-w-md mx-auto mt-16 rounded-xl border border-border shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LogIn className="w-5 h-5" />
                  Anmeldung erforderlich
                </CardTitle>
                <CardDescription>
                  Melde dich an, um die Prompt Werkstatt zu nutzen und KI-Modelle
                  direkt auszuprobieren.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => navigate("/login")} className="w-full">
                  Zur Anmeldung
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <>
            {/* Desktop layout (≥ lg): 3-Panel, resizable */}
            <ResizablePanelGroup direction="horizontal" className="hidden lg:flex h-full">
              <ResizablePanel defaultSize={24} minSize={14} maxSize={35} className="min-w-0 overflow-hidden">
                <PromptBrowser
                  onSelectPrompt={handleBrowserSelect}
                  activePromptTitle={sourcePromptTitle}
                  conversations={convos.conversations}
                  activeConversationId={convos.activeConversationId}
                  onSelectConversation={handleSelectConversation}
                  onNewConversation={handleNewConversation}
                  onDeleteConversation={handleDeleteConversation}
                  onRenameConversation={convos.renameConversation}
                />
              </ResizablePanel>

              <ResizableHandle />

              <ResizablePanel defaultSize={78} minSize={50} className="min-w-0 flex flex-col">
                {/* ⚠️ Builder nimmt natürliche Höhe ein (shrink-0), Chat füllt den Rest (flex-1 min-h-0) */}
                <div className="shrink-0">
                  <ACTABuilder
                    fields={actaFields}
                    onFieldsChange={setActaFields}
                    onSendToPlayground={handleSendToPlayground}
                    layout="horizontal"
                    mode={playgroundMode}
                    selectedModel={settings.selectedModel}
                    sourceTitle={sourcePromptTitle}
                    isExpanded={actaExpanded}
                    onExpandedChange={setActaExpanded}
                    confidentiality={promptConfidentiality}
                    onReset={handleACTAReset}
                  />
                </div>

                <div className="flex-1 min-h-0 bg-secondary/15 dark:bg-muted/5">
                  <div className="h-full px-0 pt-0 pb-0">
                    <PlaygroundContent
                        messages={chat.messages}
                        onSendMessage={chat.sendMessage}
                        isStreaming={chat.isStreaming}
                        streamingContent={chat.streamingContent}
                        thinkingContent={chat.thinkingContent}
                        thinkingEnabled={settings.thinkingEnabled}
                        onThinkingChange={settings.handleThinkingChange}
                        systemPrompt={systemPrompt}
                        onSystemPromptChange={setSystemPrompt}
                        onClearChat={handleClearChat}
                        onStop={chat.handleStop}
                        onBudgetExhausted={() => setShowBudgetDialog(true)}
                        prefilledPrompt={prefilledPrompt}
                        skillId={skillId}
                        skillTitle={skillTitle}
                        requestedModel={requestedModel}
                        mode={playgroundMode}
                        lastUserPrompt={lastUserPrompt}
                        selectedModel={settings.selectedModel}
                        onModelChange={settings.setSelectedModel}
                        aiTier={settings.aiTier}
                        onAiTierChange={settings.setAiTier}
                        canUseExternal={settings.canUseExternal}
                        aiRouting={settings.aiRouting}
                        agentConfig={agentConfig}
                        onAgentConfigChange={setAgentConfig}
                        onStartAgent={chat.sendMessage}
                        chatMode={chatMode}
                        onChatModeChange={setChatMode}
                        assembledPrompt={lastAssembledPrompt}
                      />
                  </div>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>

            {/* Mobile layout (< lg) */}
            <div className="lg:hidden h-full flex flex-col">
              <ACTABuilder
                fields={actaFields}
                onFieldsChange={setActaFields}
                onSendToPlayground={handleSendToPlayground}
                layout="horizontal"
                mode={playgroundMode}
                selectedModel={settings.selectedModel}
                sourceTitle={sourcePromptTitle}
                isExpanded={actaExpanded}
                onExpandedChange={setActaExpanded}
                confidentiality={promptConfidentiality}
                onReset={handleACTAReset}
              />

              <div className="flex-1 min-h-0 px-0 pt-0 pb-0">
                <PlaygroundContent
                  messages={chat.messages}
                  onSendMessage={chat.sendMessage}
                  isStreaming={chat.isStreaming}
                  streamingContent={chat.streamingContent}
                  thinkingContent={chat.thinkingContent}
                  thinkingEnabled={settings.thinkingEnabled}
                  systemPrompt={systemPrompt}
                  onSystemPromptChange={setSystemPrompt}
                  onClearChat={handleClearChat}
                  onStop={chat.handleStop}
                  onBudgetExhausted={() => setShowBudgetDialog(true)}
                  prefilledPrompt={prefilledPrompt}
                  skillId={skillId}
                  skillTitle={skillTitle}
                  requestedModel={requestedModel}
                  mode={playgroundMode}
                  lastUserPrompt={lastUserPrompt}
                  selectedModel={settings.selectedModel}
                  onModelChange={settings.setSelectedModel}
                  onThinkingChange={settings.handleThinkingChange}
                  aiTier={settings.aiTier}
                  onAiTierChange={settings.setAiTier}
                  canUseExternal={settings.canUseExternal}
                  aiRouting={settings.aiRouting}
                  agentConfig={agentConfig}
                  onAgentConfigChange={setAgentConfig}
                  onStartAgent={chat.sendMessage}
                  chatMode={chatMode}
                  onChatModeChange={setChatMode}
                  assembledPrompt={lastAssembledPrompt}
                />
              </div>

              <Sheet>
                <SheetTrigger asChild>
                  <Button size="icon" className="fixed bottom-4 left-4 z-40 rounded-full shadow-lg h-12 w-12">
                    <BookOpen className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 p-0">
                  <SheetTitle className="sr-only">Vorlagen</SheetTitle>
                  <PromptBrowser
                    onSelectPrompt={handleBrowserSelect}
                    activePromptTitle={sourcePromptTitle}
                    conversations={convos.conversations}
                    activeConversationId={convos.activeConversationId}
                    onSelectConversation={handleSelectConversation}
                    onNewConversation={handleNewConversation}
                    onDeleteConversation={handleDeleteConversation}
                    onRenameConversation={convos.renameConversation}
                  />
                </SheetContent>
              </Sheet>
            </div>
          </>
        )}
      </div>

      <BudgetDialog open={showBudgetDialog} onOpenChange={setShowBudgetDialog} />

      {tour.isActive && tour.activeStep !== null && tourSteps[tour.activeStep] && (
        <TourOverlay
          step={tourSteps[tour.activeStep]}
          stepIndex={tour.activeStep}
          totalSteps={tourSteps.length}
          onNext={tour.next}
          onPrev={tour.prev}
          onFinish={tour.finish}
        />
      )}
    </div>
  );
};

export default Playground;