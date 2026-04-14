// Feedback-Panel: 3 Steps (Kategorie → Details → Bestätigung) + optional Chatbot + "Mein Feedback"-Tab.
// Slide-in von rechts unten, Schließen via Escape oder X.

import { useCallback, useEffect, useMemo, useState } from 'react';
import * as Icons from 'lucide-react';
import { ArrowLeft, Check, ChevronDown, ChevronRight, MessageSquare, Star, X } from 'lucide-react';
import { useStorage } from '@/core/hooks/useStorage';
import { useProfile } from '@/core/hooks/useProfile';
import { useNavigation } from '@/core/hooks/useNavigation';
import { enabledPlugins } from '@/plugins.config';
import { captureFeedbackContext, submitFeedback } from '@/core/services/feedback';
import type { FeedbackCategory, FeedbackContext, FeedbackItem } from '@/core/types/feedback';
import { CATEGORY_ICONS, CATEGORY_LABELS, TEAMFLOW_AREAS } from './constants';
import { FaqSuggestions } from './FaqSuggestions';
import { MyFeedbackList } from './MyFeedbackList';
import { FeedbackChatbot } from './FeedbackChatbot';

type IconComponent = React.ComponentType<{ size?: number; className?: string }>;
function getIcon(name: string): IconComponent {
  const icon = (Icons as Record<string, unknown>)[name];
  if (typeof icon === 'object' && icon !== null) return icon as IconComponent;
  return Icons.MessageCircle;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

type View = 'category' | 'details' | 'confirm' | 'chatbot' | 'my-feedback';

const CATEGORIES: FeedbackCategory[] = ['praise', 'problem', 'idea', 'question'];

export function FeedbackPanel({ open, onClose }: Props): React.ReactElement | null {
  const storage = useStorage();
  const { profile } = useProfile();
  const { activeId } = useNavigation();

  const [view, setView] = useState<View>('category');
  const [category, setCategory] = useState<FeedbackCategory | null>(null);
  const [text, setText] = useState('');
  const [stars, setStars] = useState(0);
  const [areaRef, setAreaRef] = useState('');
  const [showContext, setShowContext] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedItem, setSubmittedItem] = useState<FeedbackItem | null>(null);
  const [context, setContext] = useState<FeedbackContext | null>(null);

  const activePluginName = useMemo(() => {
    return enabledPlugins.find(p => p.id === activeId)?.name ?? activeId ?? 'Unbekannt';
  }, [activeId]);

  // ESC-Handler
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Reset beim Öffnen
  useEffect(() => {
    if (open) {
      setView('category');
      setCategory(null);
      setText('');
      setStars(0);
      setAreaRef('');
      setShowContext(false);
      setSubmittedItem(null);
      setContext(null);
    }
  }, [open]);

  const handleCategorySelect = useCallback((cat: FeedbackCategory) => {
    setCategory(cat);
    setContext(captureFeedbackContext(activeId, activePluginName));
    setView('details');
  }, [activeId, activePluginName]);

  const handleSubmit = useCallback(async () => {
    if (!category || !text.trim() || !context) return;
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
        category,
        stars: category === 'praise' && stars > 0 ? stars : undefined,
        text: text.trim(),
        context: fullContext,
      });
      setSubmittedItem(item);
      setView('confirm');
    } catch (err) {
      console.error('[FeedbackPanel] submit failed', err);
    } finally {
      setSubmitting(false);
    }
  }, [category, text, stars, areaRef, context, profile, storage]);

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
          {view !== 'category' && view !== 'my-feedback' && (
            <button
              type="button"
              onClick={() => setView('category')}
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
        {view === 'category' && (
          <CategoryStep
            onSelect={handleCategorySelect}
            onShowMyFeedback={() => setView('my-feedback')}
          />
        )}

        {view === 'details' && category && context && (
          <DetailsStep
            category={category}
            text={text}
            setText={setText}
            stars={stars}
            setStars={setStars}
            areaRef={areaRef}
            setAreaRef={setAreaRef}
            context={context}
            showContext={showContext}
            setShowContext={setShowContext}
            submitting={submitting}
            onSubmit={handleSubmit}
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
              onClick={() => setView('category')}
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

function CategoryStep({ onSelect, onShowMyFeedback }: { onSelect: (c: FeedbackCategory) => void; onShowMyFeedback: () => void }): React.ReactElement {
  return (
    <div className="p-3.5 space-y-3">
      <p className="text-[12.5px] text-[var(--tf-text-secondary)]">Was möchtest du teilen?</p>
      <div className="grid grid-cols-2 gap-2">
        {CATEGORIES.map(cat => {
          const Icon = getIcon(CATEGORY_ICONS[cat]);
          return (
            <button
              key={cat}
              type="button"
              onClick={() => onSelect(cat)}
              className="flex flex-col items-center gap-1.5 py-3 rounded-[var(--tf-radius)] hover:bg-[var(--tf-hover)] hover:border-[var(--tf-primary)] transition-colors cursor-pointer"
              style={{ border: '0.5px solid var(--tf-border)' }}
            >
              <Icon size={18} className="text-[var(--tf-primary)]" />
              <span className="text-[12.5px] text-[var(--tf-text)]">{CATEGORY_LABELS[cat]}</span>
            </button>
          );
        })}
      </div>
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

interface DetailsProps {
  category: FeedbackCategory;
  text: string;
  setText: (v: string) => void;
  stars: number;
  setStars: (v: number) => void;
  areaRef: string;
  setAreaRef: (v: string) => void;
  context: FeedbackContext;
  showContext: boolean;
  setShowContext: (v: boolean) => void;
  submitting: boolean;
  onSubmit: () => void;
}

function DetailsStep(props: DetailsProps): React.ReactElement {
  const { category, text, setText, stars, setStars, areaRef, setAreaRef, context, showContext, setShowContext, submitting, onSubmit } = props;
  return (
    <div className="p-3.5 space-y-3">
      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)]">
        {CATEGORY_LABELS[category]}
      </div>

      {category === 'praise' && (
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              type="button"
              onClick={() => setStars(n)}
              className="cursor-pointer"
              aria-label={`${n} Sterne`}
            >
              <Star
                size={20}
                className={n <= stars ? 'fill-amber-400 text-amber-400' : 'text-[var(--tf-text-tertiary)]'}
              />
            </button>
          ))}
        </div>
      )}

      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Beschreibe kurz…"
        rows={4}
        className="w-full px-2.5 py-2 text-[12.5px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none resize-none placeholder:text-[var(--tf-text-tertiary)] focus:border-[var(--tf-primary)]"
        style={{ border: '0.5px solid var(--tf-border)' }}
      />

      {category === 'question' && <FaqSuggestions input={text} />}

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
    </div>
  );
}

function ConfirmStep({ onChatbot, onDone }: { onChatbot: () => void; onDone: () => void }): React.ReactElement {
  return (
    <div className="p-4 text-center space-y-3">
      <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center">
        <Check size={22} className="text-emerald-600 dark:text-emerald-400" />
      </div>
      <p className="text-[14px] font-medium text-[var(--tf-text)]">Danke für dein Feedback!</p>
      <p className="text-[12.5px] text-[var(--tf-text-secondary)]">Möchtest du es im Chat noch präzisieren?</p>
      <div className="flex gap-2 justify-center pt-1">
        <button
          type="button"
          onClick={onChatbot}
          className="px-3 py-1.5 rounded-[var(--tf-radius)] text-[12.5px] bg-[var(--tf-primary)] text-white hover:opacity-90 cursor-pointer"
        >
          Zum Chatbot
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
