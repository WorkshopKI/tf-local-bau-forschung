// Feedback-Panel: 2-Step-Flow (Input → Bestätigung) + optional Chatbot + "Mein Feedback"-Tab.
// Slide-in von rechts unten, Schließen via Escape oder X.
// Kategorie-Klassifikation erfolgt stumm im Hintergrund via autoClassifyFeedback() nach Absenden.

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, ChevronDown, ChevronRight, MessageSquare, X } from 'lucide-react';
import { useStorage } from '@/core/hooks/useStorage';
import { useProfile } from '@/core/hooks/useProfile';
import { useNavigation } from '@/core/hooks/useNavigation';
import { useAIBridge } from '@/core/hooks/useAIBridge';
import { enabledPlugins } from '@/plugins.config';
import {
  autoClassifyFeedback,
  captureFeedbackContext,
  submitFeedback,
  updateFeedback,
} from '@/core/services/feedback';
import type { FeedbackContext, FeedbackItem } from '@/core/types/feedback';
import { LLM_CATEGORY_MAP, QUICK_TAGS, TEAMFLOW_AREAS, type QuickTag } from './constants';
import { FaqSuggestions } from './FaqSuggestions';
import { MyFeedbackList } from './MyFeedbackList';
import { FeedbackChatbot } from './FeedbackChatbot';

interface Props {
  open: boolean;
  onClose: () => void;
}

type View = 'input' | 'confirm' | 'chatbot' | 'my-feedback';

export function FeedbackPanel({ open, onClose }: Props): React.ReactElement | null {
  const storage = useStorage();
  const { profile } = useProfile();
  const { activeId } = useNavigation();
  const bridge = useAIBridge();

  const [view, setView] = useState<View>('input');
  const [text, setText] = useState('');
  const [areaRef, setAreaRef] = useState('');
  const [showContext, setShowContext] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedItem, setSubmittedItem] = useState<FeedbackItem | null>(null);
  const [context, setContext] = useState<FeedbackContext | null>(null);
  const [quickTagsVisible, setQuickTagsVisible] = useState(true);
  const [selectedHint, setSelectedHint] = useState<string | null>(null);

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
      setText('');
      setAreaRef('');
      setShowContext(false);
      setSubmittedItem(null);
      setQuickTagsVisible(true);
      setSelectedHint(null);
      setContext(captureFeedbackContext(activeId, activePluginName));
    }
  }, [open, activeId, activePluginName]);

  const handleSubmit = useCallback(async () => {
    if (!text.trim() || !context) return;
    setSubmitting(true);
    try {
      const userId = profile?.name ?? 'anonymous';
      const areaInfo = TEAMFLOW_AREAS.find(a => a.ref === areaRef);
      const fullContext: FeedbackContext = {
        ...context,
        screenRef: areaRef || undefined,
        screenRefLabel: areaInfo?.label,
      };
      const item = await submitFeedback(storage, {
        user_id: userId,
        user_display_name: profile?.name,
        // category bewusst weggelassen — wird vom LLM per autoClassifyFeedback gesetzt
        text: text.trim(),
        context: fullContext,
      });
      setSubmittedItem(item);
      setView('confirm');

      // Fire-and-forget Hintergrund-Klassifikation (blockiert UI nicht)
      const transport = bridge.getActiveTransport();
      void autoClassifyFeedback(transport, text.trim(), fullContext, areaRef || undefined, selectedHint ?? undefined)
        .then((classification) => {
          if (!classification) return;
          const mappedCategory = LLM_CATEGORY_MAP[classification.category];
          return updateFeedback(storage, item.id, {
            llm_classification: classification,
            llm_summary: classification.summary,
            ...(mappedCategory ? { category: mappedCategory } : {}),
          });
        });
    } catch (err) {
      console.error('[FeedbackPanel] submit failed', err);
    } finally {
      setSubmitting(false);
    }
  }, [text, areaRef, context, profile, storage, bridge, selectedHint]);

  if (!open) return null;

  return (
    <div
      className="fixed bottom-20 right-4 z-40 w-[360px] max-w-[calc(100vw-2rem)] rounded-[12px] bg-[var(--tf-bg)] shadow-2xl flex flex-col overflow-hidden"
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
          <InputStep
            text={text}
            setText={setText}
            areaRef={areaRef}
            setAreaRef={setAreaRef}
            context={context}
            showContext={showContext}
            setShowContext={setShowContext}
            submitting={submitting}
            quickTagsVisible={quickTagsVisible}
            setQuickTagsVisible={setQuickTagsVisible}
            onSelectHint={setSelectedHint}
            onSubmit={handleSubmit}
            onShowMyFeedback={() => setView('my-feedback')}
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
            initialText={text}
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

interface InputStepProps {
  text: string;
  setText: (v: string) => void;
  areaRef: string;
  setAreaRef: (v: string) => void;
  context: FeedbackContext;
  showContext: boolean;
  setShowContext: (v: boolean) => void;
  submitting: boolean;
  quickTagsVisible: boolean;
  setQuickTagsVisible: (v: boolean) => void;
  onSelectHint: (hint: string) => void;
  onSubmit: () => void;
  onShowMyFeedback: () => void;
}

function InputStep(props: InputStepProps): React.ReactElement {
  const {
    text, setText, areaRef, setAreaRef, context,
    showContext, setShowContext, submitting,
    quickTagsVisible, setQuickTagsVisible,
    onSelectHint, onSubmit, onShowMyFeedback,
  } = props;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleQuickTag = (tag: QuickTag): void => {
    setText(tag.prefix);
    onSelectHint(tag.hint);
    setQuickTagsVisible(false);
    // Focus + Cursor ans Ende
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(tag.prefix.length, tag.prefix.length);
      }
    });
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    setText(e.target.value);
    if (quickTagsVisible && e.target.value.length > 0) {
      setQuickTagsVisible(false);
    }
  };

  const showQuickTags = quickTagsVisible && !text.trim();

  return (
    <div className="p-3.5 space-y-3">
      <label className="text-[12.5px] text-[var(--tf-text-secondary)] block">
        Was möchtest du uns mitteilen?
      </label>

      <textarea
        ref={textareaRef}
        value={text}
        onChange={handleTextChange}
        placeholder="Schreib einfach los…"
        rows={5}
        className="w-full px-2.5 py-2 text-[12.5px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none resize-none placeholder:text-[var(--tf-text-tertiary)] focus:border-[var(--tf-primary)]"
        style={{ border: '0.5px solid var(--tf-border)' }}
      />

      <FaqSuggestions input={text} />

      {showQuickTags && (
        <div className="flex flex-wrap gap-1.5">
          {QUICK_TAGS.map(tag => (
            <button
              key={tag.label}
              type="button"
              onClick={() => handleQuickTag(tag)}
              className="px-2 py-1 rounded-full text-[11.5px] text-[var(--tf-text-secondary)] bg-transparent hover:bg-[var(--tf-hover)] hover:text-[var(--tf-text)] cursor-pointer transition-colors"
              style={{ border: '0.5px solid var(--tf-border)' }}
            >
              {tag.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label className="text-[11px] text-[var(--tf-text-tertiary)]">Bereich (optional)</label>
        <select
          value={areaRef}
          onChange={e => setAreaRef(e.target.value)}
          className="px-2.5 py-1.5 text-[12.5px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none focus:border-[var(--tf-primary)]"
          style={{ border: '0.5px solid var(--tf-border)' }}
        >
          <option value="">— Auto-erkannt: {context.page} —</option>
          {TEAMFLOW_AREAS.map(a => (
            <option key={a.ref} value={a.ref}>{a.label}</option>
          ))}
        </select>
      </div>

      <button
        type="button"
        onClick={() => setShowContext(!showContext)}
        className="w-full inline-flex items-center gap-1 text-[11px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text-secondary)] cursor-pointer"
      >
        {showContext ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        Auto: App-Kontext wird mitgesendet
      </button>
      {showContext && (
        <div className="px-2.5 py-2 rounded text-[10.5px] text-[var(--tf-text-secondary)] bg-[var(--tf-bg-secondary)] space-y-0.5">
          <div>Seite: {context.page}</div>
          <div>Gerät: {context.device} · {context.viewport}</div>
          <div>Session: {Math.round(context.sessionDuration / 60)} Min.</div>
          {context.errors.length > 0 && <div>Fehler: {context.errors.length}</div>}
        </div>
      )}

      <button
        type="button"
        onClick={onSubmit}
        disabled={!text.trim() || submitting}
        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-[var(--tf-radius)] text-[12.5px] font-medium bg-[var(--tf-primary)] text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
      >
        {submitting ? 'Wird gesendet…' : 'Absenden'}
      </button>

      <button
        type="button"
        onClick={onShowMyFeedback}
        className="w-full inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-[var(--tf-radius)] text-[11.5px] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] cursor-pointer"
      >
        <MessageSquare size={12} /> Mein Feedback ansehen
      </button>
    </div>
  );
}

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
