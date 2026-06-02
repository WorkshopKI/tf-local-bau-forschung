/**
 * RevealBar (v2.16) — schmale Leiste über der Matrix, an die Tabelle angedockt.
 *
 * Beim Überfahren einer Spalte/Gruppe: Farbpunkt (Kategorie-Farbe) + voller
 * Unterkategorie-Name (fett) + Überkategorie-Name. Default nennt die Editier-
 * Geste. Liest den einzigen Hover-State des Modells (keine Per-Zell-Logik).
 */
import type { KategorieFarbe } from '../../types';
import { dotColor } from '../../views/uebersicht/kategorie-colors';
import type { HoverState } from '../../hooks/useKompetenzMatrixModel';

interface Props {
  hover: HoverState;
  farbeByUeber: Record<string, KategorieFarbe>;
}

const DEFAULT_TEXT = 'Spalte oder Zelle überfahren · Zelle klicken zum Ändern (· → 1 → 2 → 3)';

export function RevealBar({ hover, farbeByUeber }: Props): React.ReactElement {
  const farbe = hover ? farbeByUeber[hover.ueberId] : undefined;
  return (
    <div
      className="flex items-center gap-2 px-3 h-[26px] text-[11.5px] text-[var(--tf-text-secondary)]"
      style={{
        background: 'var(--tf-bg-secondary)',
        border: '0.5px solid var(--tf-border)',
        borderBottom: 'none',
        borderRadius: '10px 10px 0 0',
      }}
    >
      <span
        className="inline-block w-2 h-2 rounded-full shrink-0"
        style={{ background: hover ? dotColor(farbe) : 'var(--tf-text-tertiary)' }}
      />
      {hover ? (
        hover.kind === 'col' ? (
          <span className="truncate">
            <span className="font-medium text-[var(--tf-text)]">{hover.label}</span>
            <span className="text-[var(--tf-text-tertiary)]"> · {hover.ueberLabel}</span>
          </span>
        ) : (
          <span className="truncate font-medium text-[var(--tf-text)]">{hover.ueberLabel}</span>
        )
      ) : (
        <span className="truncate">{DEFAULT_TEXT}</span>
      )}
    </div>
  );
}
