import { ChevronDown, ChevronRight } from 'lucide-react';
import type { ArbeitsvorratSection } from './arbeitsvorrat';
import { ARBEITSVORRAT_LABEL } from './arbeitsvorrat';

/**
 * Section-Header für den Arbeitsvorrat/Archiv-Split im „Alle"-Tab
 * (Journey-Paket 2 Phase 5). Wird sowohl in der Tabelle (im `<td colSpan>` der
 * `SortableTable`-Section-Zeile) als auch in der List-View (als Block)
 * gerendert — die Komponente ist layout-neutral (nur die innere Flex-Zeile).
 *
 * - `in_arbeit`: statisches Band (kein Toggle) — der Arbeitsvorrat ist immer
 *   offen.
 * - `archiv`: einklappbarer Button (Chevron), rechts die Kurz-Aufschlüsselung
 *   („Schlussvermerk 12 · abgelehnt/zurückgez. 3"). `collapsed` ist der
 *   *effektive* Zustand (bei aktiver Suche mit Archiv-Treffern zwangs-offen).
 *
 * Farben/Typo spiegeln `StatusSectionHeader`/`StatusBand` — keine neuen Tokens.
 */
interface Props {
  section: ArbeitsvorratSection;
  count: number;
  /** Nur für `archiv`: effektiver Collapsed-Zustand (Chevron-Richtung + aria). */
  collapsed?: boolean;
  /** Toggle (nur `archiv`). */
  onToggle?: () => void;
  /** Kurz-Aufschlüsselung rechts (nur `archiv`). Leerstring = nichts anzeigen. */
  breakdown?: string;
}

const LABEL_CLASS =
  'text-[11px] tracking-[0.08em] uppercase font-medium text-[var(--tf-text-tertiary)]';
const COUNT_CLASS = 'text-[10.5px] font-mono text-[var(--tf-text-tertiary)]';

export function ArbeitsvorratSectionHeader({
  section,
  count,
  collapsed,
  onToggle,
  breakdown,
}: Props): React.ReactElement {
  const label = ARBEITSVORRAT_LABEL[section];
  const countStr = count.toLocaleString('de-DE');

  if (section === 'in_arbeit') {
    return (
      <div className="w-full flex items-center gap-2">
        <span className={LABEL_CLASS}>{label}</span>
        <span className={COUNT_CLASS}>{countStr}</span>
        <div className="flex-1 h-px bg-[var(--tf-border)]" />
      </div>
    );
  }

  const Icon = collapsed ? ChevronRight : ChevronDown;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!collapsed}
      aria-label={`Abgeschlossene Anträge ${collapsed ? 'ausklappen' : 'einklappen'}`}
      className="w-full flex items-center gap-2 cursor-pointer bg-transparent border-0 p-0 text-left hover:opacity-80 transition-opacity"
    >
      <Icon size={12} className="text-[var(--tf-text-tertiary)] shrink-0" />
      <span className={LABEL_CLASS}>{label}</span>
      <span className={COUNT_CLASS}>{countStr}</span>
      <div className="flex-1 h-px bg-[var(--tf-border)]" />
      {breakdown ? (
        <span className="shrink-0 text-[10.5px] text-[var(--tf-text-tertiary)] normal-case tracking-normal tabular-nums">
          {breakdown}
        </span>
      ) : null}
    </button>
  );
}
