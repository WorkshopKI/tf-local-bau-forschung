/**
 * HauptkatChip (v2.16) — live abgeleitete Haupt-/Nebenkategorie einer Zeile.
 *
 * Reine View-Ableitung aus der (effektiven) Matrix via `deriveHauptNeben` —
 * nichts wird persistiert. Punkt in Kategorie-Farbe + Haupt-ID, dahinter die
 * Nebenkategorien in Tertiärfarbe. Leere Matrix → „—".
 */
import type { KategorieFarbe, KompetenzMatrix } from '../../types';
import { deriveHauptNeben } from '../../services/kompetenz-derivation';
import { dotColor } from '../../views/uebersicht/kategorie-colors';

interface Props {
  matrix: KompetenzMatrix;
  farbeByUeber: Record<string, KategorieFarbe>;
}

export function HauptkatChip({ matrix, farbeByUeber }: Props): React.ReactElement {
  const { hauptKategorie, nebenKategorien } = deriveHauptNeben(matrix);
  if (!hauptKategorie) {
    return <span className="text-[11px] text-[var(--tf-text-tertiary)]">—</span>;
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium whitespace-nowrap overflow-hidden">
      <span
        className="inline-block w-2 h-2 rounded-full shrink-0"
        style={{ background: dotColor(farbeByUeber[hauptKategorie]) }}
      />
      <span className="font-mono">{hauptKategorie}</span>
      {nebenKategorien.length > 0 && (
        <span className="font-mono text-[var(--tf-text-tertiary)] truncate">+{nebenKategorien.join(' ')}</span>
      )}
    </span>
  );
}
