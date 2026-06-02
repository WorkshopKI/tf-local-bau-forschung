/**
 * MatrixControls (v2.16) — Steuerzeile zwischen Toolbar und Reveal-Bar.
 *
 * Dezenter Text-Link „Kapazitäten ausblenden/einblenden" (kein gefüllter
 * Button), „Inaktive einblenden"-Checkbox (+Zähler), Level-Legende. Toggles
 * sind `aria-pressed`-gelabelt.
 */
import { Columns3, Pencil } from 'lucide-react';
import type { KompetenzMatrixModel } from '../../hooks/useKompetenzMatrixModel';

interface Props {
  model: KompetenzMatrixModel;
}

const LEGEND: { lvl: 1 | 2 | 3; text: string }[] = [
  { lvl: 1, text: 'Grund' },
  { lvl: 2, text: 'vertieft' },
  { lvl: 3, text: 'Experte' },
];

export function MatrixControls({ model }: Props): React.ReactElement {
  const { kapHidden, toggleKap, editMode, setEditMode, showInactive, setShowInactive, inactiveCount } = model;
  return (
    <div className="flex items-center gap-5 flex-wrap text-[11.5px]">
      <label
        className={`flex items-center gap-1.5 cursor-pointer select-none ${editMode ? 'text-[var(--tf-text)]' : 'text-[var(--tf-text-secondary)]'}`}
        title="Werte schreibgeschützt, bis Bearbeiten aktiviert ist — schützt vor versehentlichem Ändern."
      >
        <input type="checkbox" checked={editMode} onChange={e => setEditMode(e.target.checked)} className="cursor-pointer" />
        <Pencil size={13} /> Bearbeiten
      </label>

      <button
        type="button"
        onClick={toggleKap}
        aria-pressed={kapHidden}
        className="flex items-center gap-1.5 cursor-pointer text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)]"
      >
        <Columns3 size={13} /> Kapazitäten {kapHidden ? 'einblenden' : 'ausblenden'}
      </button>

      {inactiveCount > 0 && (
        <label className="flex items-center gap-1.5 cursor-pointer select-none text-[var(--tf-text-secondary)]">
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} className="cursor-pointer" />
          Inaktive einblenden ({inactiveCount})
        </label>
      )}

      <span className="flex items-center gap-2 ml-auto text-[var(--tf-text-tertiary)]">
        Level:
        {LEGEND.map(({ lvl, text }) => (
          <span key={lvl} className="flex items-center gap-1">
            <span
              className="inline-flex items-center justify-center w-4 h-4 rounded-[3px] text-[9px] font-medium"
              style={{ background: `var(--tf-level-${lvl}-bg)`, color: `var(--tf-level-${lvl}-text)` }}
            >
              {lvl}
            </span>
            {text}
          </span>
        ))}
      </span>
    </div>
  );
}
