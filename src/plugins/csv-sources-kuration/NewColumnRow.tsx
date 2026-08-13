import { Input } from '@/components/ui/input';
import { CANONICAL_FIELDS } from '@/core/services/csv/constants';
import type { FieldType } from '@/core/services/csv/types';
import type { PerColumnDecision } from './wizard/useCsvWizardState';

type Mode = 'canonical' | 'custom' | 'ignore';

const MODES: { key: Mode; label: string }[] = [
  { key: 'canonical', label: 'Standardfeld' },
  { key: 'custom', label: 'Eigenes Feld' },
  { key: 'ignore', label: 'Ignorieren' },
];

const TYPES: FieldType[] = ['string', 'date', 'number', 'boolean'];

const PILL_ACTIVE = 'px-2.5 py-1 rounded-full text-[11px] bg-[var(--tf-primary-light)] text-[var(--tf-primary)]';
const PILL_INACTIVE = 'px-2.5 py-1 rounded-full text-[11px] text-[var(--tf-text-secondary)] border-[0.5px] border-[var(--tf-border)] hover:bg-[var(--tf-bg-secondary)]';
const SELECT_CLS = 'h-8 text-[12px] px-1.5 rounded border border-[var(--tf-border)] bg-[var(--tf-bg)]';

interface Props {
  column: string;
  decision: PerColumnDecision;
  /** Canonical-Ziel doppelt belegt (bestehend oder unter den neuen Spalten). */
  conflict?: boolean;
  /** Optionaler Beispielwert aus der CSV — hilft beim Re-Mapping zu entscheiden,
   *  welches Standardfeld passt (z.B. Datum vs. Freitext). */
  sampleHint?: string;
  /** Mapping-Modus gesperrt (z.B. Join-Key-/Master-Pflichtspalte) — read-only. */
  locked?: boolean;
  onChange: (patch: Partial<PerColumnDecision>) => void;
}

/**
 * Eine Zeile im `CsvAddColumnsDialog` / `RemapCsvColumnsDialog`: Spaltenname +
 * Mapping-Entscheidung (Standardfeld / Eigenes Feld / Ignorieren) — gleiche
 * Semantik wie der Wizard-Column-Step, aber kompakt.
 */
export function NewColumnRow({ column, decision, conflict, sampleHint, locked, onChange }: Props): React.ReactElement {
  const mode = decision.mode;
  return (
    <div className="flex flex-wrap items-center gap-2 py-2 border-b-[0.5px] border-[var(--tf-border)]">
      <div className="min-w-[150px] max-w-[200px] flex-shrink-0">
        <div className="truncate font-mono text-[12px] text-[var(--tf-text)]" title={column}>
          {column}
        </div>
        {sampleHint ? (
          <div className="truncate text-[10.5px] text-[var(--tf-text-tertiary)]" title={sampleHint}>
            z.B. {sampleHint}
          </div>
        ) : null}
      </div>

      <div className="flex gap-1">
        {MODES.map(m => (
          <button
            key={m.key}
            type="button"
            disabled={locked}
            onClick={() => {
              if (m.key === 'canonical') onChange({ mode: 'canonical' });
              else if (m.key === 'custom') onChange({ mode: 'custom', custom: decision.custom ?? column.toLowerCase() });
              else onChange({ mode: 'ignore' });
            }}
            className={`${mode === m.key ? PILL_ACTIVE : PILL_INACTIVE}${locked ? ' opacity-50 cursor-not-allowed' : ''}`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === 'canonical' ? (
        <select
          value={decision.canonical ?? ''}
          disabled={locked}
          onChange={e => {
            const key = e.target.value;
            const field = CANONICAL_FIELDS.find(f => f.key === key);
            onChange({ mode: 'canonical', canonical: key || undefined, type: field?.type ?? 'string' });
          }}
          className={SELECT_CLS}
        >
          <option value="">— Feld wählen —</option>
          {CANONICAL_FIELDS.map(f => (
            <option key={f.key} value={f.key}>{f.label}</option>
          ))}
        </select>
      ) : null}

      {mode === 'custom' ? (
        <>
          <Input
            value={decision.custom ?? ''}
            onChange={e => onChange({ custom: e.target.value })}
            placeholder={column.toLowerCase()}
            className="h-8 w-[170px] text-[12px]"
          />
          <select
            value={decision.type ?? 'string'}
            onChange={e => onChange({ type: e.target.value as FieldType })}
            className={SELECT_CLS}
          >
            {TYPES.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </>
      ) : null}

      {mode !== 'ignore' ? (
        <label className="flex items-center gap-1 text-[11px] text-[var(--tf-text-tertiary)]" title="Wertänderungen dieser Spalte zwischen Importen als Historie festhalten">
          <input
            type="checkbox"
            checked={!!decision.trackHistory}
            onChange={e => onChange({ trackHistory: e.target.checked })}
          />
          Historie
        </label>
      ) : null}

      {conflict && mode === 'canonical' ? (
        <span className="text-[11px] text-amber-700" title="Dieses Standardfeld ist bereits belegt — beim Import gewinnt die Spalte, die in der Zuordnungs-Liste weiter unten steht (neu übernommene stehen am Ende). Die CSV-Reihenfolge entscheidet nicht.">
          ⚠ doppelt belegt
        </span>
      ) : null}
    </div>
  );
}
