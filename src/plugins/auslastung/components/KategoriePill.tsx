/** Farbcodierter Kategorie-Pill. Farb-Palette gemaess DESIGN_GUIDE. */
import type { KategorieFarbe, UeberKategorie } from '../types';

const COLOR_CLASSES: Record<KategorieFarbe, string> = {
  blue:    'bg-blue-50 text-blue-800 ring-blue-200',
  amber:   'bg-amber-50 text-amber-800 ring-amber-200',
  emerald: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  rose:    'bg-rose-50 text-rose-800 ring-rose-200',
  violet:  'bg-violet-50 text-violet-800 ring-violet-200',
  sky:     'bg-sky-50 text-sky-800 ring-sky-200',
  slate:   'bg-slate-50 text-slate-800 ring-slate-200',
};

interface Props {
  kategorie: Pick<UeberKategorie, 'id' | 'name' | 'farbe'>;
  onRemove?: () => void;
  size?: 'sm' | 'md';
}

export function KategoriePill({ kategorie, onRemove, size = 'sm' }: Props): React.ReactElement {
  const cls = COLOR_CLASSES[kategorie.farbe] ?? COLOR_CLASSES.slate;
  const fontSize = size === 'md' ? 'text-[12px]' : 'text-[11px]';
  return (
    <span
      className={`inline-flex items-center gap-1 ${cls} ${fontSize} px-2 py-0.5 rounded-full ring-1 ring-inset`}
      title={kategorie.name}
    >
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
