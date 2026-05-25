/** Farbcodierter Kategorie-Pill. Farb-Palette gemaess DESIGN_GUIDE.
 *
 *  Workflow-Revision 1.17 — drei Varianten (`mode`):
 *   - `primaer`  : Voller Hintergrund + Haken (= primaere Kategorie/Hauptkat)
 *   - `aspekt`   : Outline + Haken in der Kategorie-Farbe (= Aspekt/Nebenkat)
 *   - `inactive` : Blass + invisible-Haken (= nicht ausgewaehlt, Toggle-State)
 *
 *  Legacy `active`-Prop bleibt erhalten:
 *   - `active=true`  → mode='primaer' (Default — Verhalten wie vorher)
 *   - `active=false` → mode='inactive'
 *  Wenn `mode` explizit gesetzt ist, hat es Vorrang vor `active`.
 */
import type { KategorieFarbe, UeberKategorie } from '../types';

const COLOR_PRIMAER: Record<KategorieFarbe, string> = {
  blue:    'bg-blue-100 text-blue-900 ring-blue-300',
  amber:   'bg-amber-100 text-amber-900 ring-amber-300',
  emerald: 'bg-emerald-100 text-emerald-900 ring-emerald-300',
  rose:    'bg-rose-100 text-rose-900 ring-rose-300',
  violet:  'bg-violet-100 text-violet-900 ring-violet-300',
  sky:     'bg-sky-100 text-sky-900 ring-sky-300',
  slate:   'bg-slate-100 text-slate-900 ring-slate-300',
};

/** Aspekt-Variante: kein Hintergrund, aber farbiger Text + Outline + Haken.
 *  Optisch klar als „dazu, aber nicht das Kernthema" lesbar. */
const COLOR_ASPEKT: Record<KategorieFarbe, string> = {
  blue:    'bg-transparent text-blue-800 ring-blue-300',
  amber:   'bg-transparent text-amber-800 ring-amber-300',
  emerald: 'bg-transparent text-emerald-800 ring-emerald-300',
  rose:    'bg-transparent text-rose-800 ring-rose-300',
  violet:  'bg-transparent text-violet-800 ring-violet-300',
  sky:     'bg-transparent text-sky-800 ring-sky-300',
  slate:   'bg-transparent text-slate-800 ring-slate-300',
};

/** Inactive-Variante: blasser Outline-Only, kein Haken — fuer Toggle-Buttons. */
const INACTIVE_CLASSES =
  'bg-transparent text-[var(--tf-text-tertiary)] ring-[var(--tf-border)] hover:ring-[var(--tf-text-tertiary)] hover:text-[var(--tf-text-secondary)]';

export type KategoriePillMode = 'primaer' | 'aspekt' | 'inactive';

interface Props {
  kategorie: Pick<UeberKategorie, 'id' | 'name' | 'farbe'>;
  onRemove?: () => void;
  size?: 'sm' | 'md';
  /** 1.17-API. Wenn gesetzt: ueberschreibt `active`. */
  mode?: KategoriePillMode;
  /** Legacy: `true` → primaer, `false` → inactive. */
  active?: boolean;
}

function resolveMode(mode: KategoriePillMode | undefined, active: boolean): KategoriePillMode {
  if (mode) return mode;
  return active ? 'primaer' : 'inactive';
}

export function KategoriePill({ kategorie, onRemove, size = 'sm', mode, active = true }: Props): React.ReactElement {
  const resolved = resolveMode(mode, active);
  const farbe = kategorie.farbe ?? 'slate';
  const cls = resolved === 'primaer'
    ? (COLOR_PRIMAER[farbe] ?? COLOR_PRIMAER.slate)
    : resolved === 'aspekt'
      ? (COLOR_ASPEKT[farbe] ?? COLOR_ASPEKT.slate)
      : INACTIVE_CLASSES;
  const fontSize = size === 'md' ? 'text-[12px]' : 'text-[11px]';
  const showHaken = resolved !== 'inactive';
  const titleSuffix = resolved === 'aspekt' ? ' (Aspekt)' : resolved === 'primaer' ? ' (Primär)' : '';
  return (
    <span
      className={`inline-flex items-center gap-1 ${cls} ${fontSize} px-2 py-0.5 rounded-full ring-1 ring-inset transition-colors`}
      title={`${kategorie.name}${titleSuffix}`}
    >
      {/* Haken-Slot immer rendern, damit Pill-Breite konstant bleibt
          (verhindert Layout-Shift in Toggle-Listen). */}
      <span aria-hidden className={`text-[9px] leading-none ${showHaken ? '' : 'invisible'}`}>✓</span>
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

/** Legacy-Export: liefert die Primaer-Farbklasse einer Kategorie. */
export function getKategorieColorClass(farbe: KategorieFarbe): string {
  return COLOR_PRIMAER[farbe] ?? COLOR_PRIMAER.slate;
}
