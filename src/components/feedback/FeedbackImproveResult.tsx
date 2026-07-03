// Anzeige des improveFeedback()-Ergebnisses im Confirm-Schritt nach "Feedback
// speichern & verbessern". Anders als FeedbackConfirmCard (Chatbot-Ja/Nein-Flow)
// gibt es hier nichts zu bestätigen — das Ticket ist bereits gespeichert, die
// Karte zeigt nur das Ergebnis + einen stillen Hinweis.

import { Check } from 'lucide-react';
import type { LLMClassification } from '@/core/types/feedback';
import { CATEGORY_LABELS, CATEGORY_COLORS, LLM_CATEGORY_MAP } from './constants';

interface Props {
  classification: LLMClassification;
}

export function FeedbackImproveResult({ classification }: Props): React.ReactElement {
  const mappedCategory = LLM_CATEGORY_MAP[classification.category] ?? 'idea';
  const badgeClass = CATEGORY_COLORS[mappedCategory];

  return (
    <div className="rounded-xl p-3.5 space-y-2 text-left bg-[var(--tf-bg-secondary)]" style={{ border: '0.5px solid var(--tf-border)' }}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--tf-primary)]">
          Verbesserte Anforderung
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
      {classification.anforderung && (
        <p className="text-[12px] leading-[1.5] text-[var(--tf-text-secondary)] whitespace-pre-wrap">{classification.anforderung}</p>
      )}
      {classification.akzeptanzkriterien && classification.akzeptanzkriterien.length > 0 && (
        <ul className="list-disc list-inside space-y-0.5 text-[12px] text-[var(--tf-text-secondary)]">
          {classification.akzeptanzkriterien.map((k, i) => <li key={i}>{k}</li>)}
        </ul>
      )}
      <div className="flex items-center gap-1.5 pt-1 text-[11.5px] text-[var(--tf-text-tertiary)]">
        <Check size={12} className="text-[var(--tf-success-text)]" />
        Gespeichert — sichtbar unter Mein Feedback
      </div>
    </div>
  );
}
