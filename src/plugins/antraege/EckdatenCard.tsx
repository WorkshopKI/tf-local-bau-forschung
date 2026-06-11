import { useState } from 'react';
import { Pencil } from 'lucide-react';
import type { Antrag } from '@/core/services/csv/types';
import { EckdatenEditor } from './EckdatenEditor';
import {
  loadEckdatenFields,
  saveEckdatenFields,
  getFieldDisplayInfo,
  type FieldDisplay,
} from './eckdatenConfig';
import { useUnterprogrammLabels } from './useUnterprogrammLabels';

interface Props {
  antrag: Antrag;
}

function strOrNull(v: unknown): string | null {
  if (typeof v === 'string') {
    const t = v.trim();
    return t.length === 0 ? null : t;
  }
  if (typeof v === 'number') return String(v);
  return null;
}

export function EckdatenCard({ antrag }: Props): React.ReactElement {
  const [fields, setFields] = useState<string[]>(loadEckdatenFields);
  const [editorOpen, setEditorOpen] = useState(false);
  const unterprogrammLabels = useUnterprogrammLabels(antrag.programm_id);

  const name = strOrNull(antrag.antragsteller);
  const branche = strOrNull(antrag.branche);
  const foerdergeber = strOrNull(antrag.foerdergeber);
  const subline = branche && foerdergeber
    ? `${branche} · ${foerdergeber}`
    : branche ?? foerdergeber;

  const cells: FieldDisplay[] = fields
    .map(f => getFieldDisplayInfo(f, antrag, { unterprogrammLabels }))
    .filter((c): c is FieldDisplay => c !== null);

  const handleSave = (next: string[]): void => {
    setFields(next);
    saveEckdatenFields(next);
  };

  return (
    <div>
      {/* Header (Label + Pen-Icon) ausserhalb der Card, parallel zum VORHABEN-INHALT-Pattern. */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[11px] uppercase tracking-wider text-[var(--tf-text-tertiary)]">
          Eckdaten
        </h3>
        <button
          type="button"
          onClick={() => setEditorOpen(true)}
          className="text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer p-0.5"
          aria-label="Eckdaten anpassen"
          title="Eckdaten anpassen"
        >
          <Pencil size={12} />
        </button>
      </div>

      <aside
        className="rounded-[var(--tf-radius)] p-4"
        style={{ background: 'var(--tf-bg)', border: '0.5px solid var(--tf-border)' }}
      >
        {name ? (
          <div className="text-[14px] font-medium text-[var(--tf-text)] leading-snug">{name}</div>
        ) : null}
        {subline ? (
          <div className="mt-0.5 text-[12px] text-[var(--tf-text-secondary)]">{subline}</div>
        ) : null}

        {cells.length > 0 ? (
          <div
            className={`${name || subline ? 'mt-3 pt-3' : ''} grid grid-cols-2 gap-x-4 gap-y-3`}
            style={name || subline ? { borderTop: '0.5px solid var(--tf-border)' } : undefined}
          >
            {cells.map(c => (
              <div key={c.label} className="min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-[var(--tf-text-tertiary)] mb-0.5">
                  {c.label}
                </div>
                <div
                  className={`text-[12.5px] text-[var(--tf-text)] truncate ${c.mono ? 'font-mono' : ''}`}
                  title={c.value}
                >
                  {c.value}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </aside>

      <EckdatenEditor
        open={editorOpen}
        initial={fields}
        onSave={handleSave}
        onClose={() => setEditorOpen(false)}
      />
    </div>
  );
}
