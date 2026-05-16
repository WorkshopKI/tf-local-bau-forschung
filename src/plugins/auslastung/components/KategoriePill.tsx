/** Farbcodierter Kategorie-Pill. Farb-Palette gemaess DESIGN_GUIDE. */
import type { KategorieFarbe, UeberKategorie } from '../types';

const COLOR_CLASSES: Record<KategorieFarbe, string> = {
  blue:    'bg-blue-100 text-blue-900 ring-blue-300',
  amber:   'bg-amber-100 text-amber-900 ring-amber-300',
  emerald: 'bg-emerald-100 text-emerald-900 ring-emerald-300',
  rose:    'bg-rose-100 text-rose-900 ring-rose-300',
  violet:  'bg-violet-100 text-violet-900 ring-violet-300',
  sky:     'bg-sky-100 text-sky-900 ring-sky-300',
  slate:   'bg-slate-100 text-slate-900 ring-slate-300',
};

/** Inactive-Variante: nur Outline, blasser Text, kein Hintergrund — fuer Toggle-Buttons. */
const INACTIVE_CLASSES =
  'bg-transparent text-[var(--tf-text-tertiary)] ring-[var(--tf-border)] hover:ring-[var(--tf-text-tertiary)] hover:text-[var(--tf-text-secondary)]';

interface Props {
  kategorie: Pick<UeberKategorie, 'id' | 'name' | 'farbe'>;
  onRemove?: () => void;
  size?: 'sm' | 'md';
  /** Wenn false: Outline-Only-Variante (z.B. fuer Toggle-Buttons). Default true. */
  active?: boolean;
}

export function KategoriePill({ kategorie, onRemove, size = 'sm', active = true }: Props): React.ReactElement {
  const cls = active
    ? (COLOR_CLASSES[kategorie.farbe] ?? COLOR_CLASSES.slate)
    : INACTIVE_CLASSES;
  const fontSize = size === 'md' ? 'text-[12px]' : 'text-[11px]';
  return (
    <span
      className={`inline-flex items-center gap-1 ${cls} ${fontSize} px-2 py-0.5 rounded-full ring-1 ring-inset transition-colors`}
      title={kategorie.name}
    >
      {active && <span aria-hidden className="text-[9px] leading-none">✓</span>}
      <span className="font-medium">{kategorie.id}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="hover:opacity-60 cursor-pointer ml-0.5"
          aria-label={`Kategorie ${kategorie.id} entfernen`}
        >
          ×
        </button>
      )}
    </span>
  );
}

export function getKategorieColorClass(farbe: KategorieFarbe): string {
  return COLOR_CLASSES[farbe] ?? COLOR_CLASSES.slate;
}
