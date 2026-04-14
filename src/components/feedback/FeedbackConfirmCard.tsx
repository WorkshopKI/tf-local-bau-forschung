// Bestätigungs-Karte mit LLM-generierter Zusammenfassung + Ja/Nein-Buttons.
// Erscheint im Chatbot wenn ein ```json-Summary erkannt wurde.

import { Check, X } from 'lucide-react';
import type { LLMClassification } from '@/core/types/feedback';
import { CATEGORY_LABELS, CATEGORY_COLORS, LLM_CATEGORY_MAP } from './constants';

interface Props {
  classification: LLMClassification;
  onConfirm: () => void;
  onReject: () => void;
}

export function FeedbackConfirmCard({ classification, onConfirm, onReject }: Props): React.ReactElement {
  const mappedCategory = LLM_CATEGORY_MAP[classification.category] ?? 'idea';
  const badgeClass = CATEGORY_COLORS[mappedCategory];

  return (
    <div className="rounded-xl p-3.5 space-y-2 bg-[var(--tf-bg-secondary)]" style={{ border: '0.5px solid var(--tf-border)' }}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--tf-primary)]">
          Zusammenfassung
        </span>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${badgeClass}`}>
          {CATEGORY_LABELS[mappedCategory]}
        </span>
        {classification.affectedArea && (
          <code className="rounded bg-[var(--tf-bg-secondary)] px-1.5 py-0.5 text-[10px] font-mono text-[var(--tf-text-tertiary)]">
            {classification.affectedArea}
          </code>
        )}
      </div>
      <p className="text-[13px] leading-[1.55] text-[var(--tf-text)]">{classification.summary}</p>
      {classification.details && classification.details !== classification.summary && (
        <p className="text-[12px] text-[var(--tf-text-secondary)]">{classification.details}</p>
      )}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onConfirm}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--tf-radius)] text-[12px] font-medium bg-[var(--tf-primary)] text-white hover:opacity-90 cursor-pointer"
        >
          <Check size={14} /> Ja, genau das meine ich
        </button>
        <button
          type="button"
          onClick={onReject}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--tf-radius)] text-[12px] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] cursor-pointer"
          style={{ border: '0.5px solid var(--tf-border)' }}
        >
          <X size={14} /> Nein, korrigieren
        </button>
      </div>
    </div>
  );
}
