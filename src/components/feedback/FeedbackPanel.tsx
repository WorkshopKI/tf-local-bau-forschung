// Feedback-Panel: 2-Step-Flow (Input → Bestätigung) + optional Chatbot + "Mein Feedback"-Tab.
// Slide-in von rechts unten, Schließen via Escape oder X.
// Die Kategorie steht über die Typ-Wahl im Eingabe-Schritt deterministisch fest;
// autoClassifyFeedback() verfeinert nur noch summary/details im Hintergrund.

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStorage } from '@/core/hooks/useStorage';
import { useProfile } from '@/core/hooks/useProfile';
import { useMeinKuerzel } from '@/core/hooks/useMeinKuerzel';
import { useNavigation } from '@/core/hooks/useNavigation';
import { useAIBridge } from '@/core/hooks/useAIBridge';
import { useBridgeStatus } from '@/core/services/ai/bridge-status';
import { enabledPlugins } from '@/plugins.config';
import {
  autoClassifyFeedback,
  captureFeedbackContext,
  improveFeedback,
  submitFeedback,
  updateFeedback,
} from '@/core/services/feedback';
import { getPersoenlichHandle } from '@/core/services/infrastructure/smb-handle';
import { canWriteDatenShare } from '@/config/feature-flags';
import type { FeedbackContext, FeedbackItem, LLMClassification } from '@/core/types/feedback';
import { TEAMFLOW_AREAS } from './constants';
import { FeedbackInputStep, type FeedbackSubmitPayload } from './FeedbackInputStep';
import { FeedbackImproveResult } from './FeedbackImproveResult';
import { MyFeedbackList } from './MyFeedbackList';
import { FeedbackChatbot } from './FeedbackChatbot';

type Verbesserung =
  | { status: 'laeuft' }
  | { status: 'fertig'; ergebnis: LLMClassification }
  | { status: 'fehlgeschlagen' };

interface Props {
  open: boolean;
  onClose: () => void;
  /** true wenn per Shortcut (Strg+Alt+S) geöffnet → Screenshot-Paste-Fläche fokussieren. */
  focusScreenshot?: boolean;
}

type View = 'input' | 'confirm' | 'chatbot' | 'my-feedback';

// Panel-Breite: per Drag-Handle am linken Rand resizable + in localStorage
// persistiert (Pattern gespiegelt von AntraegeMain). Default seit v2.45 breiter
// (war 420). Panel ist rechts verankert → nach links ziehen verbreitert.
const PANEL_WIDTH_KEY = 'teamflow_feedback_panel_width';
const PANEL_DEFAULT_WIDTH = 520;
const PANEL_MIN_WIDTH = 360;
const PANEL_MAX_WIDTH = 900;

function loadPanelWidth(): number {
  try {
    const v = Number(localStorage.getItem(PANEL_WIDTH_KEY));
    if (Number.isFinite(v) && v >= PANEL_MIN_WIDTH) return v;
  } catch { /* ignore */ }
  return PANEL_DEFAULT_WIDTH;
}

export function FeedbackPanel({ open, onClose, focusScreenshot }: Props): React.ReactElement | null {
  const storage = useStorage();
  const { profile } = useProfile();
  const meinKuerzel = useMeinKuerzel();
  const { activeId } = useNavigation();
  const bridge = useAIBridge();
  const kiVerfuegbar = useBridgeStatus(s => s.status) === 'connected';

  const [view, setView] = useState<View>('input');
  const [areaRef, setAreaRef] = useState('');
  const [showContext, setShowContext] = useState(false);
  const [submitting, setSubmitting] = useState<'speichern' | 'verbessern' | null>(null);
  const [submittedItem, setSubmittedItem] = useState<FeedbackItem | null>(null);
  const [verbesserung, setVerbesserung] = useState<Verbesserung | null>(null);
  const [context, setContext] = useState<FeedbackContext | null>(null);
  const [panelWidth, setPanelWidth] = useState(loadPanelWidth);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const activePluginName = enabledPlugins.find(p => p.id === activeId)?.name ?? activeId ?? 'Unbekannt';

  const onResizeMouseDown = useCallback((e: React.MouseEvent): void => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startWidth: panelWidth };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const onMove = (ev: MouseEvent): void => {
      const drag = dragRef.current;
      if (!drag) return;
      // Rechts verankert: nach links ziehen (negativer Delta) verbreitert.
      const delta = ev.clientX - drag.startX;
      const dynMax = Math.min(PANEL_MAX_WIDTH, window.innerWidth - 32);
      setPanelWidth(Math.min(dynMax, Math.max(PANEL_MIN_WIDTH, drag.startWidth - delta)));
    };
    const onUp = (): void => {
      dragRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [panelWidth]);

  useEffect(() => {
    try { localStorage.setItem(PANEL_WIDTH_KEY, String(panelWidth)); } catch { /* ignore */ }
  }, [panelWidth]);

  // ESC-Handler
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Reset + Context-Capture beim Öffnen
  useEffect(() => {
    if (open) {
      setView('input');
      setAreaRef('');
      setShowContext(false);
      setSubmittedItem(null);
      setVerbesserung(null);
      setContext(captureFeedbackContext(activeId, activePluginName));
    }
  }, [open, activeId, activePluginName]);

  const handleSubmit = useCallback(async (payload: FeedbackSubmitPayload) => {
    if (!payload.text.trim() || !context) return;
    setSubmitting(payload.verbessern ? 'verbessern' : 'speichern');
    try {
      const userId = profile?.name ?? 'anonymous';
      const areaInfo = TEAMFLOW_AREAS.find(a => a.ref === areaRef);
      const fullContext: FeedbackContext = {
        ...context,
        screenRef: areaRef || undefined,
        screenRefLabel: areaInfo?.label,
      };
      // Dispatch: Clients mit Daten-Share-Schreibrecht (Kurator / PL via
      // datenShareSchreibrecht / dev) schreiben direkt ins geteilte Feedback-File
      // (sofort für alle sichtbar); read-only-Clients (prod-Enduser) in die
      // pers. Outbox, die der Kurator einsammelt.
      const isKurator = profile?.is_kurator === true || profile?.is_admin === true;
      const canWriteShared = canWriteDatenShare(isKurator);
      const persHandle = canWriteShared ? null : await getPersoenlichHandle(storage.idb).catch(() => null);
      // Kategorie steht deterministisch aus der Typ-Wahl fest (kein LLM nötig).
      const item = await submitFeedback(storage, {
        user_id: userId,
        user_display_name: profile?.name,
        category: payload.category,
        structured: payload.structured,
        text: payload.text,
        context: fullContext,
      }, {
        isKurator,
        writeToShared: canWriteShared,
        persHandle,
        kuerzel: meinKuerzel,
      }, payload.attachments);
      setSubmittedItem(item);
      setView('confirm');

      const transport = bridge.getActiveTransport();
      if (payload.verbessern) {
        // Fire-and-forget KI-Verbesserung (blockiert UI nicht, laeuft auch nach
        // Panel-Schliessen weiter — FeedbackPanel unmounted bei !open nicht,
        // siehe `if (!open) return null` unten).
        setVerbesserung({ status: 'laeuft' });
        void improveFeedback(transport, payload, fullContext, activeId)
          .then(async (classification) => {
            if (!classification) {
              setVerbesserung({ status: 'fehlgeschlagen' });
              return;
            }
            await updateFeedback(storage, item.id, {
              llm_classification: classification,
              llm_summary: classification.summary,
            });
            setVerbesserung({ status: 'fertig', ergebnis: classification });
          });
      } else {
        // Fire-and-forget Hintergrund-Verfeinerung (blockiert UI nicht). Überschreibt
        // die per Typ-Wahl gesetzte category NICHT — nur summary/Klassifikations-Meta.
        void autoClassifyFeedback(transport, payload.text, fullContext, areaRef || undefined, payload.llmHint)
          .then((classification) => {
            if (!classification) return;
            return updateFeedback(storage, item.id, {
              llm_classification: classification,
              llm_summary: classification.summary,
            });
          });
      }
    } catch (err) {
      console.error('[FeedbackPanel] submit failed', err);
    } finally {
      setSubmitting(null);
    }
  }, [activeId, areaRef, context, profile, meinKuerzel, storage, bridge]);

  if (!open) return null;

  return (
    <div
      className="fixed bottom-20 right-4 z-40 max-w-[calc(100vw-2rem)] rounded-[12px] bg-[var(--tf-bg)] shadow-2xl flex flex-col overflow-hidden"
      style={{ width: panelWidth, border: '0.5px solid var(--tf-border)', maxHeight: 'calc(100vh - 6rem)' }}
      role="dialog"
      aria-label="Feedback"
    >
      {/* Resize-Handle am linken Rand (Panel ist rechts verankert → links ziehen verbreitert) */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Breite ändern"
        onMouseDown={onResizeMouseDown}
        className="absolute left-0 top-0 h-full w-[6px] cursor-col-resize hover:bg-[var(--tf-border-hover)] z-10"
        style={{ touchAction: 'none' }}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5" style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
        <div className="flex items-center gap-2">
          {view !== 'input' && view !== 'my-feedback' && (
            <button
              type="button"
              onClick={() => setView('input')}
              className="p-1 rounded hover:bg-[var(--tf-hover)] cursor-pointer text-[var(--tf-text-tertiary)]"
              aria-label="Zurück"
            >
              <ArrowLeft size={14} />
            </button>
          )}
          <span className="text-[13px] font-medium text-[var(--tf-text)]">
            {view === 'my-feedback' ? 'Mein Feedback' : 'Feedback'}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded hover:bg-[var(--tf-hover)] cursor-pointer text-[var(--tf-text-tertiary)]"
          aria-label="Schließen"
        >
          <X size={14} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {view === 'input' && context && (
          <FeedbackInputStep
            areaRef={areaRef}
            setAreaRef={setAreaRef}
            context={context}
            showContext={showContext}
            setShowContext={setShowContext}
            submitting={submitting}
            kiVerfuegbar={kiVerfuegbar}
            onSubmit={handleSubmit}
            onShowMyFeedback={() => setView('my-feedback')}
            autoFocusScreenshot={focusScreenshot}
          />
        )}

        {view === 'confirm' && submittedItem && (
          <ConfirmStep
            verbesserung={verbesserung}
            onChatbot={() => setView('chatbot')}
            onDone={onClose}
          />
        )}

        {view === 'chatbot' && submittedItem && context && (
          <FeedbackChatbot
            feedbackId={submittedItem.id}
            initialText={submittedItem.text}
            context={{ ...context, screenRef: areaRef || undefined }}
            onClose={onClose}
          />
        )}

        {view === 'my-feedback' && (
          <div className="p-3">
            <button
              type="button"
              onClick={() => setView('input')}
              className="text-[12px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] mb-3 inline-flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft size={12} /> Neues Feedback
            </button>
            <MyFeedbackList />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-Komponenten ──────────────────────────────────────────────────────────

function ConfirmStep({ verbesserung, onChatbot, onDone }: {
  verbesserung: Verbesserung | null;
  onChatbot: () => void;
  onDone: () => void;
}): React.ReactElement {
  return (
    <div className="p-4 text-center space-y-3">
      <div className="w-12 h-12 mx-auto rounded-full bg-[var(--tf-success-bg)] flex items-center justify-center">
        <Check size={22} className="text-[var(--tf-success-text)]" />
      </div>
      <p className="text-[14px] font-medium text-[var(--tf-text)]">Danke für dein Feedback!</p>
      <p className="text-[12.5px] text-[var(--tf-text-secondary)]">Möchtest du Details ergänzen?</p>
      <div className="flex gap-2 justify-center pt-1">
        <Button type="button" onClick={onChatbot} variant="primary">
          Details ergänzen
        </Button>
        <Button type="button" onClick={onDone} variant="secondary">
          Fertig
        </Button>
      </div>

      {verbesserung?.status === 'laeuft' && (
        <div className="flex items-center justify-center gap-2 pt-2 text-[12px] text-[var(--tf-text-secondary)]">
          <Loader2 size={14} className="animate-spin" />
          KI verbessert dein Feedback … (kann bis zu einer Minute dauern — du kannst das Fenster schließen)
        </div>
      )}
      {verbesserung?.status === 'fertig' && (
        <div className="pt-2">
          <FeedbackImproveResult classification={verbesserung.ergebnis} />
        </div>
      )}
      {verbesserung?.status === 'fehlgeschlagen' && (
        <p className="pt-2 text-[12px] text-[var(--tf-text-tertiary)]">
          Gespeichert — die Verbesserung ist diesmal nicht gelungen.
        </p>
      )}
    </div>
  );
}
