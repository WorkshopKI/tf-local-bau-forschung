// Editierbares Ergebnis des geführten „verbessern"-Ablaufs (Phase 3):
// klarer Feedback-Text + strukturierte Anforderung (Ist/Soll + Akzeptanzkriterien).
// Der Nutzer passt beides an und speichert. Ersetzt die frühere read-only
// FeedbackImproveResult-Karte.

import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { GuidedImproveResult } from '@/core/services/feedback';
import { CATEGORY_LABELS, CATEGORY_COLORS, LLM_CATEGORY_MAP } from './constants';

export interface FeedbackImproveEdits {
  verbesserterText: string;
  anforderung: string;
  /** Ein Kriterium pro Eintrag (bereits getrimmt/gefiltert). */
  akzeptanzkriterien: string[];
}

interface Props {
  result: GuidedImproveResult;
  saving: boolean;
  error?: string | null;
  onSave: (edits: FeedbackImproveEdits) => void;
  onDiscard: () => void;
}

export function FeedbackImproveEditor({ result, saving, error, onSave, onDiscard }: Props): React.ReactElement {
  const { classification } = result;
  const mappedCategory = LLM_CATEGORY_MAP[classification.category] ?? 'idea';
  const badgeClass = CATEGORY_COLORS[mappedCategory];

  const [text, setText] = useState(result.verbesserterText);
  const [anforderung, setAnforderung] = useState(classification.anforderung ?? '');
  // Akzeptanzkriterien als eine-Zeile-pro-Kriterium (einfacher als dynamische Liste).
  const [kriterienText, setKriterienText] = useState((classification.akzeptanzkriterien ?? []).join('\n'));

  const submit = (): void => {
    onSave({
      verbesserterText: text,
      anforderung,
      akzeptanzkriterien: kriterienText
        .split('\n')
        .map(k => k.trim())
        .filter(k => k.length > 0)
        .slice(0, 5),
    });
  };

  return (
    <div className="p-3.5 space-y-3 text-left">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--tf-primary)]">
          Verbesserte Fassung
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
      <p className="text-[11.5px] text-[var(--tf-text-tertiary)]">
        Pass die Fassung an und speichere sie — sie ersetzt dein Feedback, dein Original bleibt erhalten.
      </p>

      <div className="flex flex-col gap-1">
        <label className="text-[11.5px] text-[var(--tf-text-secondary)]">Feedback (verbessert)</label>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          rows={5}
          className="w-full px-2.5 py-2 text-[12.5px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none resize-none placeholder:text-[var(--tf-text-tertiary)] focus:border-[var(--tf-primary)]"
          style={{ border: '0.5px solid var(--tf-border)' }}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[11.5px] text-[var(--tf-text-secondary)]">Anforderung (Ist / Soll)</label>
        <textarea
          value={anforderung}
          onChange={e => setAnforderung(e.target.value)}
          rows={3}
          placeholder="IST: … SOLL: …"
          className="w-full px-2.5 py-2 text-[12px] bg-transparent text-[var(--tf-text-secondary)] rounded-[var(--tf-radius)] outline-none resize-none placeholder:text-[var(--tf-text-tertiary)] focus:border-[var(--tf-primary)]"
          style={{ border: '0.5px solid var(--tf-border)' }}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[11.5px] text-[var(--tf-text-secondary)]">Akzeptanzkriterien (ein Kriterium pro Zeile)</label>
        <textarea
          value={kriterienText}
          onChange={e => setKriterienText(e.target.value)}
          rows={3}
          placeholder="Was muss erfüllt sein, damit es als umgesetzt gilt?"
          className="w-full px-2.5 py-2 text-[12px] bg-transparent text-[var(--tf-text-secondary)] rounded-[var(--tf-radius)] outline-none resize-none placeholder:text-[var(--tf-text-tertiary)] focus:border-[var(--tf-primary)]"
          style={{ border: '0.5px solid var(--tf-border)' }}
        />
      </div>

      {error && (
        <div className="rounded-[var(--tf-radius)] p-2 bg-[var(--tf-danger-bg)] text-[var(--tf-danger-text)] text-[12px]" style={{ border: '0.5px solid var(--tf-danger-border)' }}>
          Speichern fehlgeschlagen: {error}
        </div>
      )}

      <div className="flex gap-2 pt-0.5">
        <Button type="button" onClick={submit} loading={saving} variant="primary" icon={Check} className="flex-1">
          Speichern
        </Button>
        <Button type="button" onClick={onDiscard} disabled={saving} variant="secondary" icon={X}>
          Verwerfen
        </Button>
      </div>
    </div>
  );
}
