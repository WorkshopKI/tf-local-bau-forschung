// Feedback-Panel: 2-Step-Flow (Input → Bestätigung) + optional Chatbot + "Mein Feedback"-Tab.
// Slide-in von rechts unten, Schließen via Escape oder X.
// Die Kategorie steht über die Typ-Wahl im Eingabe-Schritt deterministisch fest;
// autoClassifyFeedback() verfeinert nur noch summary/details im Hintergrund.

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Check, X } from 'lucide-react';
import { useStorage } from '@/core/hooks/useStorage';
import { useProfile } from '@/core/hooks/useProfile';
import { useMeinKuerzel } from '@/core/hooks/useMeinKuerzel';
import { useNavigation } from '@/core/hooks/useNavigation';
import { useAIBridge } from '@/core/hooks/useAIBridge';
import { enabledPlugins } from '@/plugins.config';
import {
  autoClassifyFeedback,
  captureFeedbackContext,
  submitFeedback,
  updateFeedback,
} from '@/core/services/feedback';
import { getPersoenlichHandle } from '@/core/services/infrastructure/smb-handle';
import { canWriteDatenShare } from '@/config/feature-flags';
import type { FeedbackContext, FeedbackItem } from '@/core/types/feedback';
import { TEAMFLOW_AREAS } from './constants';
import { FeedbackInputStep, type FeedbackSubmitPayload } from './FeedbackInputStep';
import { MyFeedbackList } from './MyFeedbackList';
import { FeedbackChatbot } from './FeedbackChatbot';

interface Props {
  open: boolean;
  onClose: () => void;
  /** true wenn per Shortcut (Strg+Alt+S) geöffnet → Screenshot-Paste-Fläche fokussieren. */
  focusScreenshot?: boolean;
}

type View = 'input' | 'confirm' | 'chatbot' | 'my-feedback';

export function FeedbackPanel({ open, onClose, focusScreenshot }: Props): React.ReactElement | null {
  const storage = useStorage();
  const { profile } = useProfile();
  const meinKuerzel = useMeinKuerzel();
  const { activeId } = useNavigation();
  const bridge = useAIBridge();

  const [view, setView] = useState<View>('input');
  const [areaRef, setAreaRef] = useState('');
  const [showContext, setShowContext] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedItem, setSubmittedItem] = useState<FeedbackItem | null>(null);
  const [context, setContext] = useState<FeedbackContext | null>(null);

  const activePluginName = enabledPlugins.find(p => p.id === activeId)?.name ?? activeId ?? 'Unbekannt';

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
      setContext(captureFeedbackContext(activeId, activePluginName));
    }
  }, [open, activeId, activePluginName]);

  const handleSubmit = useCallback(async (payload: FeedbackSubmitPayload) => {
    if (!payload.text.trim() || !context) return;
    setSubmitting(true);
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

      // Fire-and-forget Hintergrund-Verfeinerung (blockiert UI nicht). Überschreibt
      // die per Typ-Wahl gesetzte category NICHT — nur summary/Klassifikations-Meta.
      const transport = bridge.getActiveTransport();
      void autoClassifyFeedback(transport, payload.text, fullContext, areaRef || undefined, payload.llmHint)
        .then((classification) => {
          if (!classification) return;
          return updateFeedback(storage, item.id, {
            llm_classification: classification,
            llm_summary: classification.summary,
          });
        });
    } catch (err) {
      console.error('[FeedbackPanel] submit failed', err);
    } finally {
      setSubmitting(false);
    }
  }, [areaRef, context, profile, meinKuerzel, storage, bridge]);

  if (!open) return null;

  return (
    <div
      className="fixed bottom-20 right-4 z-40 w-[420px] max-w-[calc(100vw-2rem)] rounded-[12px] bg-[var(--tf-bg)] shadow-2xl flex flex-col overflow-hidden"
      style={{ border: '0.5px solid var(--tf-border)', maxHeight: 'calc(100vh - 6rem)' }}
      role="dialog"
      aria-label="Feedback"
    >
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
            onSubmit={handleSubmit}
            onShowMyFeedback={() => setView('my-feedback')}
            autoFocusScreenshot={focusScreenshot}
          />
        )}

        {view === 'confirm' && submittedItem && (
          <ConfirmStep
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

function ConfirmStep({ onChatbot, onDone }: { onChatbot: () => void; onDone: () => void }): React.ReactElement {
  return (
    <div className="p-4 text-center space-y-3">
      <div className="w-12 h-12 mx-auto rounded-full bg-[var(--tf-success-bg)] flex items-center justify-center">
        <Check size={22} className="text-[var(--tf-success-text)]" />
      </div>
      <p className="text-[14px] font-medium text-[var(--tf-text)]">Danke für dein Feedback!</p>
      <p className="text-[12.5px] text-[var(--tf-text-secondary)]">Möchtest du Details ergänzen?</p>
      <div className="flex gap-2 justify-center pt-1">
        <button
          type="button"
          onClick={onChatbot}
          className="px-3 py-1.5 rounded-[var(--tf-radius)] text-[12.5px] bg-[var(--tf-primary)] text-white hover:opacity-90 cursor-pointer"
        >
          Details ergänzen
        </button>
        <button
          type="button"
          onClick={onDone}
          className="px-3 py-1.5 rounded-[var(--tf-radius)] text-[12.5px] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] cursor-pointer"
          style={{ border: '0.5px solid var(--tf-border)' }}
        >
          Fertig
        </button>
      </div>
    </div>
  );
}
