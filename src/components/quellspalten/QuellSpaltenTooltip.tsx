/**
 * Tooltip mit den **Quellspalten** eines abgeleiteten Wertes — Code und Label
 * jeder CSV-Spalte, aus der eine Bedingung, ein Status oder ein Termin liest.
 *
 * Der Aufrufer sagt nur, WAS zu erklären ist (`erklaere`), der Index kommt beim
 * Überfahren: der Inhalt ist eine eigene Komponente und hängt sich erst ein,
 * wenn der Tooltip sichtbar wird. So kostet eine Liste mit tausend Zeilen nichts,
 * und keine Seite muss Schemas durch fünf Ebenen reichen.
 *
 * Gerendert wird mit `SpaltenHilfeInhalt` — derselben Darstellung wie am Kopf
 * der Fördertabelle, damit „Speist sich aus" überall gleich aussieht.
 */
import { Tooltip } from '@/components/ui/Tooltip';
import { SpaltenHilfeInhalt } from '@/components/data-table/SpaltenHilfeInhalt';
import { useQuellSpaltenIndex } from '@/core/hooks/useQuellSpaltenIndex';
import type { QuellSpaltenIndex } from '@/core/services/csv/spalten-inventar';
import type { QuellSpaltenErklaerung } from '@/core/status/bedingung-quellen';

/** Baut die Erklärung, sobald der Index da ist. */
export type Erklaerer = (index: QuellSpaltenIndex) => QuellSpaltenErklaerung;

function Inhalt({ erklaere }: { erklaere: Erklaerer }): React.ReactElement {
  const { index, fehler } = useQuellSpaltenIndex();
  if (fehler !== null) {
    return <p className="text-[11px] text-[var(--tf-warning-text)]">Quellspalten nicht lesbar: {fehler}</p>;
  }
  if (index === null) {
    return <p className="text-[11px] text-[var(--tf-text-secondary)]">Quellspalten werden geladen …</p>;
  }
  return <SpaltenHilfeInhalt hilfe={erklaere(index)} />;
}

export function QuellSpaltenTooltip({ erklaere, children, wrapperClassName = 'inline' }: {
  erklaere: Erklaerer;
  children: React.ReactNode;
  /** Hülle des Auslösers; `min-w-0 truncate` für gekürzte Zeilen im Flex-Layout. */
  wrapperClassName?: string;
}): React.ReactElement {
  return (
    <Tooltip content={<Inhalt erklaere={erklaere} />} maxWidth={380} wrapperClassName={wrapperClassName}>
      {children}
    </Tooltip>
  );
}
