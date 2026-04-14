import { useState, useCallback, useEffect, useRef } from "react";
import { Sparkles, Zap, Lightbulb, HelpCircle, Star, ChevronDown, Check, ArrowLeft, X, Crosshair } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useLocation } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { captureFeedbackContext } from "@/lib/feedbackContext";
import { submitFeedback } from "@/services/feedbackService";
import { useIsMobile } from "@/hooks/use-mobile";
import { FEEDBACK_CATEGORY_LABELS } from "@/types";
import type { FeedbackCategory, FeedbackContext as FeedbackContextType } from "@/types";
import { toast } from "sonner";
import { FeedbackChatbot } from "./FeedbackChatbot";
import { ScreenRefPicker } from "./ScreenRefPicker";
import type { ScreenRef } from "./ScreenRefPicker";

interface Props {
  open: boolean;
  onClose: () => void;
  preselectedCategory?: FeedbackCategory;
}

const CATEGORIES: { key: FeedbackCategory; icon: typeof Sparkles; colorClass: string }[] = [
  { key: "praise", icon: Sparkles, colorClass: "text-emerald-600 dark:text-emerald-400" },
  { key: "problem", icon: Zap, colorClass: "text-red-500 dark:text-red-400" },
  { key: "idea", icon: Lightbulb, colorClass: "text-primary" },
  { key: "question", icon: HelpCircle, colorClass: "text-amber-500 dark:text-amber-400" },
];

const CATEGORY_HOVER: Record<FeedbackCategory, string> = {
  praise: "hover:border-emerald-400 hover:bg-emerald-500/5 dark:hover:border-emerald-500 dark:hover:bg-emerald-500/10",
  problem: "hover:border-red-400 hover:bg-red-500/5 dark:hover:border-red-500 dark:hover:bg-red-500/10",
  idea: "hover:border-primary hover:bg-primary/5",
  question: "hover:border-amber-400 hover:bg-amber-500/5 dark:hover:border-amber-500 dark:hover:bg-amber-500/10",
};

const CATEGORY_PILL: Record<FeedbackCategory, string> = {
  praise: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  problem: "bg-red-500/10 text-red-600 dark:text-red-400",
  idea: "bg-primary/10 text-primary",
  question: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
};

const MIN_W = 340;
const MIN_H = 400;
const MAX_W = 700;

export function FeedbackPanel({ open, onClose, preselectedCategory }: Props) {
  const { profile } = useAuthContext();
  const location = useLocation();
  const isMobile = useIsMobile();
  const panelRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<1 | 2 | 3 | "chatbot">(preselectedCategory ? 2 : 1);
  const [category, setCategory] = useState<FeedbackCategory | undefined>(preselectedCategory);
  const [text, setText] = useState("");
  const [stars, setStars] = useState(0);
  const [context, setContext] = useState<FeedbackContextType | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | undefined>();
  const [panelSize, setPanelSize] = useState<{ width: number; height: number } | null>(null);
  const [screenRef, setScreenRef] = useState<ScreenRef | null>(null);
  const [showRefPicker, setShowRefPicker] = useState(false);

  const reset = useCallback(() => {
    setStep(1);
    setCategory(undefined);
    setText("");
    setStars(0);
    setContext(null);
    setSubmitting(false);
    setSubmittedId(undefined);
    setPanelSize(null);
    setScreenRef(null);
    setShowRefPicker(false);
  }, []);

  const handleClose = useCallback(() => {
    onClose();
    setTimeout(reset, 300);
  }, [onClose, reset]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, handleClose]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handler);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handler);
    };
  }, [open, handleClose]);

  const handleCategorySelect = useCallback((cat: FeedbackCategory) => {
    setCategory(cat);
    setContext(captureFeedbackContext());
    setStep(2);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!category || !context) return;
    setSubmitting(true);
    try {
      const submitContext = screenRef
        ? { ...context, screenRef: screenRef.ref, screenRefLabel: screenRef.label }
        : context;
      const item = await submitFeedback({
        category,
        stars: category === "praise" && stars > 0 ? stars : undefined,
        text,
        context: submitContext,
        user_id: profile?.id ?? "anonymous",
        user_display_name: profile?.display_name ?? undefined,
      });
      setSubmittedId(item.id);
      setStep(3);
      toast.success("Feedback gesendet!");
    } catch {
      toast.error("Feedback konnte nicht gespeichert werden.");
    } finally {
      setSubmitting(false);
    }
  }, [category, context, text, stars, profile]);

  // Manual resize handler — panel grows left/up from bottom-right anchor
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const el = panelRef.current;
    if (!el) return;

    const startW = el.offsetWidth;
    const startH = el.offsetHeight;
    const maxH = window.innerHeight * 0.8;

    const onMove = (ev: MouseEvent) => {
      setPanelSize({
        width: Math.max(MIN_W, Math.min(MAX_W, startW - (ev.clientX - startX))),
        height: Math.max(MIN_H, Math.min(maxH, startH - (ev.clientY - startY))),
      });
    };

    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, []);

  const isPlayground = location.pathname === "/playground";
  const isChatbot = step === "chatbot";

  if (!open) return null;

  const panelStyle: React.CSSProperties = panelSize
    ? { width: panelSize.width, height: panelSize.height }
    : {};

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/10 dark:bg-black/20 sm:bg-transparent" />

      {/* Panel */}
      <div
        ref={panelRef}
        className={`
          fixed z-50 right-6 flex flex-col
          ${isPlayground ? "bottom-[calc(5rem+0.75rem)]" : "bottom-[calc(3rem+0.75rem)]"}
          ${panelSize ? "" : `w-[calc(100vw-3rem)] ${isChatbot ? "max-w-[540px]" : "max-w-[340px]"}`}
          rounded-2xl border border-border bg-card text-card-foreground
          shadow-xl dark:shadow-2xl dark:shadow-black/30
          animate-in slide-in-from-bottom-4 fade-in duration-200
          transition-[max-width] duration-200
        `}
        style={panelStyle}
      >
        {/* Resize grip — top-left corner, only for chatbot step on desktop */}
        {isChatbot && !isMobile && (
          <div
            onMouseDown={handleResizeStart}
            className="absolute top-1.5 left-1.5 z-10 flex h-5 w-5 cursor-nw-resize items-center justify-center rounded text-muted-foreground opacity-40 transition-all hover:opacity-100 hover:bg-accent"
            title="Größe ändern"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <circle cx="3" cy="3" r="1.2"/>
              <circle cx="7" cy="3" r="1.2"/>
              <circle cx="3" cy="7" r="1.2"/>
              <circle cx="7" cy="7" r="1.2"/>
            </svg>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
          <span className="text-[13px] font-semibold pl-4">Feedback geben</span>
          <button
            onClick={handleClose}
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Body */}
        <div className={`p-4 ${isChatbot ? "flex-1 min-h-0 flex flex-col" : ""}`}>
          {step === 1 && (
            <CategoryStep onSelect={handleCategorySelect} />
          )}

          {step === 2 && category && (
            <DetailsStep
              category={category}
              text={text}
              stars={stars}
              context={context}
              submitting={submitting}
              screenRef={screenRef}
              onBack={() => setStep(1)}
              onTextChange={setText}
              onStarsChange={setStars}
              onSubmit={handleSubmit}
              onMarkArea={() => setShowRefPicker(true)}
              onClearRef={() => setScreenRef(null)}
            />
          )}

          {step === 3 && (
            <ConfirmStep
              onClose={handleClose}
              onChatbot={() => setStep("chatbot")}
            />
          )}

          {isChatbot && submittedId && context && (
            <div className={`${panelSize ? "flex-1 min-h-0" : "h-[420px] max-h-[520px] min-h-[400px]"}`}>
              <FeedbackChatbot
                feedbackId={submittedId}
                initialText={text}
                context={context}
                screenRef={screenRef}
                onClose={handleClose}
              />
            </div>
          )}
        </div>
      </div>

      {/* Screen-Ref Picker Overlay */}
      {showRefPicker && (
        <ScreenRefPicker
          onSelect={(ref) => {
            setScreenRef(ref);
            setShowRefPicker(false);
          }}
          onCancel={() => setShowRefPicker(false)}
        />
      )}
    </>
  );
}

// ═══ Sub-Komponenten ═══

function CategoryStep({ onSelect }: { onSelect: (cat: FeedbackCategory) => void }) {
  return (
    <div className="space-y-3">
      <p className="text-[12px] text-muted-foreground">Was möchtest du mitteilen?</p>
      <div className="grid grid-cols-2 gap-2.5">
        {CATEGORIES.map(({ key, icon: Icon, colorClass }) => (
          <button
            key={key}
            onClick={() => onSelect(key)}
            className={`
              flex items-center gap-2.5 rounded-[10px] border border-border
              px-3 py-3 transition-all duration-150
              ${CATEGORY_HOVER[key]}
            `}
          >
            <Icon className={`h-4 w-4 flex-shrink-0 ${colorClass}`} />
            <span className="text-[12px] font-medium text-foreground">
              {FEEDBACK_CATEGORY_LABELS[key]}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function DetailsStep({
  category,
  text,
  stars,
  context,
  submitting,
  screenRef,
  onBack,
  onTextChange,
  onStarsChange,
  onSubmit,
  onMarkArea,
  onClearRef,
}: {
  category: FeedbackCategory;
  text: string;
  stars: number;
  context: FeedbackContextType | null;
  submitting: boolean;
  screenRef: ScreenRef | null;
  onBack: () => void;
  onTextChange: (v: string) => void;
  onStarsChange: (v: number) => void;
  onSubmit: () => void;
  onMarkArea: () => void;
  onClearRef: () => void;
}) {
  const catInfo = CATEGORIES.find((c) => c.key === category);
  const CatIcon = catInfo?.icon ?? HelpCircle;

  return (
    <div className="space-y-3.5">
      {/* Category pill */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-[11px] font-medium transition-opacity hover:opacity-70"
        style={{ cursor: "pointer" }}
      >
        <ArrowLeft className="h-3 w-3 text-muted-foreground" />
        <span className={`inline-flex items-center gap-1 rounded-xl px-2 py-0.5 ${CATEGORY_PILL[category]}`}>
          <CatIcon className="h-3 w-3" />
          {FEEDBACK_CATEGORY_LABELS[category]}
        </span>
      </button>

      {/* Stars for praise */}
      {category === "praise" && (
        <div className="flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => onStarsChange(n === stars ? 0 : n)}
              className="p-0.5 transition-transform hover:scale-110"
            >
              <Star
                className={`h-5 w-5 transition-colors ${
                  n <= stars
                    ? "fill-amber-400 text-amber-400"
                    : "text-muted-foreground/40 hover:text-muted-foreground"
                }`}
              />
            </button>
          ))}
        </div>
      )}

      {/* Textarea */}
      <Textarea
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder="Beschreibe kurz, was dir aufgefallen ist..."
        rows={3}
        className="resize-none rounded-lg text-[12px]"
        autoFocus
      />

      {/* Bereich markieren */}
      <div className="flex items-center gap-2">
        {screenRef ? (
          <div className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 text-[11px] text-primary">
            <Crosshair className="h-3 w-3" />
            <span className="font-medium">{screenRef.label}</span>
            <button
              onClick={onClearRef}
              className="ml-0.5 rounded p-0.5 hover:bg-primary/10 transition-colors"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={onMarkArea}
            className="text-[12px] gap-1.5 h-7"
          >
            <Crosshair className="h-3.5 w-3.5" />
            Bereich markieren
          </Button>
        )}
      </div>

      {/* Context collapsible */}
      {context && (
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
            <ChevronDown className="h-3 w-3" />
            <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-primary text-[10px]">
              Auto
            </span>
            App-Kontext wird erfasst
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 rounded-lg bg-muted/50 p-2.5 text-[11px] space-y-0.5 text-muted-foreground">
            <div>Seite: {context.page}</div>
            <div>Modus: {context.mode}</div>
            <div>Gerät: {context.device} ({context.viewport})</div>
            <div>Letzte Aktion: {context.lastAction || "–"}</div>
            <div>Session: {Math.round(context.sessionDuration / 60)} Min.</div>
            {context.errors.length > 0 && (
              <div className="text-destructive">Fehler: {context.errors.join(", ")}</div>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 pt-1">
        <Button
          onClick={onSubmit}
          disabled={submitting || !text.trim()}
          className="flex-1 text-[12px]"
          size="sm"
        >
          {submitting ? "Sende..." : "Absenden"}
        </Button>
        <Button variant="ghost" size="sm" onClick={onBack} className="text-[12px]">
          Zurück
        </Button>
      </div>
    </div>
  );
}

function ConfirmStep({ onClose, onChatbot }: { onClose: () => void; onChatbot: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-6">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
        <Check className="h-6 w-6 text-primary animate-in zoom-in duration-300" />
      </div>
      <p className="text-[13px] font-semibold">Danke für dein Feedback!</p>
      <p className="text-[11px] text-muted-foreground text-center">
        Möchtest du mehr erzählen?
      </p>
      <div className="flex gap-2 pt-1 w-full">
        <Button variant="outline" size="sm" onClick={onChatbot} className="flex-1 text-[12px]">
          Zum Chatbot
        </Button>
        <Button size="sm" onClick={onClose} className="flex-1 text-[12px]">
          Fertig
        </Button>
      </div>
    </div>
  );
}
