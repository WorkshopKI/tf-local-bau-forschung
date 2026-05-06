/**
 * Pill-Toggle für den Mapping-Kind-Filter im CSV-Wizard Step 2.
 *
 * Drei Modi: alle Spalten / nur Standardfeld-Mappings (oder Confidence-≥-60%-
 * Vorschläge) / nur Eigene Felder. Filter steuert nur die Sichtbarkeit der
 * Tabellen-Zeilen — die Decisions selbst bleiben unverändert.
 */

import type { MappingKindFilter } from './useCsvWizardState';

interface Props {
  value: MappingKindFilter;
  onChange: (v: MappingKindFilter) => void;
}

export function Step2KindFilterToggle({ value, onChange }: Props): React.ReactElement {
  const options: { key: MappingKindFilter; label: string; title: string }[] = [
    { key: 'all', label: 'Alle', title: 'Alle Spalten anzeigen' },
    { key: 'standard', label: 'Nur Standard', title: 'Nur Spalten, die auf ein Standardfeld mappen oder als Vorschlag (≥60%) gelten' },
    { key: 'custom', label: 'Nur Eigene', title: 'Nur Spalten, die als Eigenes Feld durchgereicht werden' },
  ];
  return (
    <div className="inline-flex rounded border-[0.5px] border-[var(--tf-border)] overflow-hidden">
      {options.map((opt, i) => {
        const active = opt.key === value;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            title={opt.title}
            className="px-2 py-1 text-[11.5px] transition"
            style={{
              background: active ? 'var(--tf-primary)' : 'transparent',
              color: active ? 'var(--tf-primary-foreground, white)' : 'var(--tf-text-secondary)',
              borderLeft: i === 0 ? undefined : '0.5px solid var(--tf-border)',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
