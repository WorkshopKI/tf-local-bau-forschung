// Strukturierter Feedback-Eingabe-Schritt: erst Typ-Wahl, dann typspezifische
// Felder. Deterministisch + LLM-unabhängig (die Kategorie steht über die Typ-Wahl
// fest). Ausgelagert aus FeedbackPanel.tsx (300-Zeilen-Regel).

import { useRef, useState } from 'react';
import * as Icons from 'lucide-react';
import { ChevronDown, ChevronRight, MessageSquare } from 'lucide-react';
import type { FeedbackCategory, FeedbackContext } from '@/core/types/feedback';
import {
  FEEDBACK_TYPES,
  TEAMFLOW_AREAS,
  composeFeedbackText,
  type FeedbackTypeDef,
} from './constants';
import { FaqSuggestions } from './FaqSuggestions';
import { FeedbackScreenshotInput } from './FeedbackScreenshotInput';
import type { PendingAttachment } from './feedbackAttachments';

export interface FeedbackSubmitPayload {
  category: FeedbackCategory;
  /** Strukturierte Felder; undefined bei Ein-Feld-Typen (Lob/Frage). */
  structured?: Record<string, string>;
  /** Lesbarer Fließtext (Board/Liste/Suche rendern darauf). */
  text: string;
  /** LLM-Hint für die fire-and-forget-Verfeinerung (falls ein LLM läuft). */
  llmHint?: string;
  /** Beigefügte (ggf. annotierte) Screenshots — Blobs, noch nicht persistiert. */
  attachments?: PendingAttachment[];
}

interface Props {
  areaRef: string;
  setAreaRef: (v: string) => void;
  context: FeedbackContext;
  showContext: boolean;
  setShowContext: (v: boolean) => void;
  submitting: boolean;
  onSubmit: (payload: FeedbackSubmitPayload) => void;
  onShowMyFeedback: () => void;
  /** true wenn das Panel per Shortcut (Strg+Alt+S) geöffnet wurde → Paste-Fläche fokussieren. */
  autoFocusScreenshot?: boolean;
}

type IconComponent = React.ComponentType<{ size?: number; className?: string }>;
function getIcon(name: string): IconComponent {
  const icon = (Icons as Record<string, unknown>)[name];
  if (typeof icon === 'object' && icon !== null) return icon as IconComponent;
  return Icons.MessageCircle;
}

export function FeedbackInputStep(props: Props): React.ReactElement {
  const { areaRef, setAreaRef, context, showContext, setShowContext, submitting, onSubmit, onShowMyFeedback, autoFocusScreenshot } = props;
  const [selectedType, setSelectedType] = useState<FeedbackTypeDef | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  // Screenshots sind typ-unabhängig → überleben einen Typ-Wechsel (kein Reset in changeType).
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const firstFieldRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);

  const chooseType = (type: FeedbackTypeDef): void => {
    setSelectedType(type);
    setFieldValues({});
    requestAnimationFrame(() => firstFieldRef.current?.focus());
  };

  const changeType = (): void => {
    setSelectedType(null);
    setFieldValues({});
  };

  const setField = (key: string, value: string): void => {
    setFieldValues(prev => ({ ...prev, [key]: value }));
  };

  // Typ-Auswahl ─────────────────────────────────────────────────────────────
  if (!selectedType) {
    return (
      <div className="p-3.5 space-y-3">
        <label className="text-[12.5px] text-[var(--tf-text-secondary)] block">
          Was möchtest du uns mitteilen?
        </label>
        <div className="flex flex-col gap-1.5">
          {FEEDBACK_TYPES.filter(t => t.primary).map(type => (
            <TypeButton key={type.category} type={type} prominent onClick={() => chooseType(type)} />
          ))}
          <div className="flex flex-row gap-1.5 pt-0.5">
            {FEEDBACK_TYPES.filter(t => !t.primary).map(type => (
              <TypeButton key={type.category} type={type} onClick={() => chooseType(type)} />
            ))}
          </div>
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

  // Feld-Set ──────────────────────────────────────────────────────────────────
  const canSubmit = selectedType.fields
    .filter(f => f.required)
    .every(f => (fieldValues[f.key] ?? '').trim().length > 0);

  const handleSubmit = (): void => {
    const isSingleText = selectedType.fields.length === 1 && selectedType.fields[0]?.key === 'text';
    const structured = isSingleText
      ? undefined
      : Object.fromEntries(
          selectedType.fields
            .map(f => [f.key, (fieldValues[f.key] ?? '').trim()] as const)
            .filter(([, v]) => v.length > 0),
        );
    onSubmit({
      category: selectedType.category,
      structured: structured && Object.keys(structured).length > 0 ? structured : undefined,
      text: composeFeedbackText(selectedType, fieldValues),
      llmHint: selectedType.llmHint,
      attachments: attachments.length > 0 ? attachments : undefined,
    });
  };

  const TypeIcon = getIcon(selectedType.icon);

  return (
    <div className="p-3.5 space-y-3">
      <button
        type="button"
        onClick={changeType}
        className="inline-flex items-center gap-1 text-[11.5px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] cursor-pointer"
      >
        <ChevronRight size={12} className="rotate-180" /> Typ ändern
      </button>

      <div className="flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--tf-text)]">
        <TypeIcon size={14} className="text-[var(--tf-text-secondary)]" />
        {selectedType.label}
      </div>

      {selectedType.fields.map((field, idx) => (
        <div key={field.key} className="flex flex-col gap-1">
          <label className="text-[11.5px] text-[var(--tf-text-secondary)]">
            {field.label}{field.required && <span className="text-[var(--tf-danger-text)]"> *</span>}
          </label>
          {field.multiline === false ? (
            <input
              ref={idx === 0 ? (el => { firstFieldRef.current = el; }) : undefined}
              value={fieldValues[field.key] ?? ''}
              onChange={e => setField(field.key, e.target.value)}
              placeholder={field.placeholder}
              className="w-full px-2.5 py-1.5 text-[12.5px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none placeholder:text-[var(--tf-text-tertiary)] focus:border-[var(--tf-primary)]"
              style={{ border: '0.5px solid var(--tf-border)' }}
            />
          ) : (
            <textarea
              ref={idx === 0 ? (el => { firstFieldRef.current = el; }) : undefined}
              value={fieldValues[field.key] ?? ''}
              onChange={e => setField(field.key, e.target.value)}
              placeholder={field.placeholder}
              rows={3}
              className="w-full px-2.5 py-2 text-[12.5px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none resize-none placeholder:text-[var(--tf-text-tertiary)] focus:border-[var(--tf-primary)]"
              style={{ border: '0.5px solid var(--tf-border)' }}
            />
          )}
        </div>
      ))}

      <FaqSuggestions input={composeFeedbackText(selectedType, fieldValues)} />

      <FeedbackScreenshotInput attachments={attachments} onChange={setAttachments} autoFocus={autoFocusScreenshot} />

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
        onClick={handleSubmit}
        disabled={!canSubmit || submitting}
        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-[var(--tf-radius)] text-[12.5px] font-medium bg-[var(--tf-primary)] text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
      >
        {submitting ? 'Wird gesendet…' : 'Absenden'}
      </button>
    </div>
  );
}

function TypeButton({ type, prominent, onClick }: { type: FeedbackTypeDef; prominent?: boolean; onClick: () => void }): React.ReactElement {
  const Icon = getIcon(type.icon);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full cursor-pointer transition-colors whitespace-nowrap ${
        prominent
          ? 'px-3 py-2 text-[12.5px] text-[var(--tf-text)] hover:bg-[var(--tf-hover)]'
          : 'px-2.5 py-1.5 text-[11.5px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)]'
      }`}
      style={{ border: '0.5px solid var(--tf-border)' }}
    >
      <Icon size={prominent ? 14 : 12} className="text-[var(--tf-text-secondary)] shrink-0" />
      {type.label}
    </button>
  );
}
