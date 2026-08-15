/**
 * Griff für die GESAMT-Breite der Tabelle (opt-in über `onTotalWidthChange`).
 *
 * Zwei Gesten, eine Kante:
 *
 * - **Ziehen** pinnt die Tabelle live auf eine explizite Pixelbreite;
 *   `table-layout: fixed` skaliert alle Spalten proportional mit.
 * - **Klick** löst `onKlick` aus. Was das bedeutet, entscheidet der Aufrufer
 *   (`SortableTable`): gepinnte Breite verwerfen bzw. zwischen „Spalten teilen
 *   sich die Breite" und „Spalten auf Inhaltsbreite" umschalten.
 *
 * Der frühere Doppelklick-Reset ist darin aufgegangen — mit Klick UND Doppelklick
 * auf derselben Kante hätte jede Umschaltung erst den Doppelklick abwarten müssen.
 *
 * **Klick ist nicht Ziehen.** Ohne Schwelle committet jeder Mouseup auf dem Griff
 * eine Breite — ein bloßer Klick pinnte die Tabelle dann auf ihre aktuelle Breite,
 * und die Klick-Geste käme nie durch. Erst ab `DRAG_SCHWELLE` gilt eine Geste als
 * Ziehen; danach schluckt der Griff das nachfolgende `click`-Ereignis. Dieselbe
 * Mechanik wie bei den Spaltengriffen (`useColumnResize`).
 *
 * Er sitzt NEBEN dem Scroll-Container, nicht darin. Innen wandert er mit der
 * Tabelle aus dem Sichtfeld, sobald die Spalten breiter sind als der Container —
 * genau dann, wenn man ihn braucht. Der Preis dieser Entscheidung: der Griff
 * folgt dem Cursor beim Ziehen nicht mehr sichtbar mit. Die Arithmetik
 * (`startWidth + Δx`) bleibt davon unberührt.
 *
 * Der Startwert kommt aus der aktuell GERENDERTEN Tabellenbreite
 * (`offsetWidth`) — kein Sprung beim Greifen, egal ob vorher Default oder schon
 * gepinnt. Beim Greifen schaltet die Tabelle sofort auf eine explizite Breite
 * um: `min-width` weg (sonst kann sie nicht unter ihren Boden schrumpfen) und
 * `flex: 0 0 auto` (sonst staucht die Flex-Zeile sie beim Verbreitern wieder auf
 * die Container-Breite zurück). Die Flex-Zeile selbst geht dabei auf
 * `max-content`: im Einpass-Modus ist sie `w-full`, und darin hätte ein
 * Verbreitern über den Container hinaus keinen Platz zu wachsen.
 */
import { useCallback, useRef, type ReactNode } from 'react';
import { DRAG_SCHWELLE } from './useColumnResize';

export interface TotalWidthGripProps {
  /** Commit on mouseup (Pixel). Wird NUR nach echtem Ziehen gerufen. */
  onTotalWidthChange: (width: number) => void;
  /** Klick ohne Ziehen. Bedeutung legt der Aufrufer fest. */
  onKlick?: () => void;
  /** Titel/Vorlesetext — beschreibt beide Gesten im aktuellen Zustand. */
  titel: string;
  minTotalWidth: number;
  maxTotalWidth: number;
  tableRef: { current: HTMLTableElement | null };
  /** Flex-Zeile, die Tabelle + Griff trägt (siehe Dateikopf). */
  wrapperRef: { current: HTMLDivElement | null };
}

export function TotalWidthGrip({
  onTotalWidthChange,
  onKlick,
  titel,
  minTotalWidth,
  maxTotalWidth,
  tableRef,
  wrapperRef,
}: TotalWidthGripProps): React.ReactElement {
  // Überlebt den Mouseup, damit das nachfolgende `click` weiß, dass es zu einem
  // Ziehen gehörte. Ein Ref, kein State: eine Zustandsänderung mitten in der
  // Geste würde nur Renderrunden auslösen, die nichts bewegen.
  const gezogenRef = useRef(false);

  const startTotalResize = useCallback(
    (e: React.MouseEvent<HTMLDivElement>): void => {
      e.preventDefault();
      e.stopPropagation();
      const table = tableRef.current;
      const wrapper = wrapperRef.current;
      const startWidth = table ? table.offsetWidth : minTotalWidth;
      const startX = e.clientX;
      let latestWidth = startWidth;
      let bewegt = false;
      gezogenRef.current = false;

      function onMove(ev: MouseEvent): void {
        const dx = ev.clientX - startX;
        if (!bewegt) {
          if (Math.abs(dx) < DRAG_SCHWELLE) return;
          bewegt = true;
          gezogenRef.current = true;
          // Erst jetzt aus dem Layout ausklinken — vor der Schwelle wäre ein
          // bloßer Klick sonst als sichtbares Zucken zu sehen.
          if (wrapper) wrapper.style.width = 'max-content';
          if (table) {
            table.style.minWidth = '0px';
            table.style.flex = '0 0 auto';
            table.style.width = `${startWidth}px`;
          }
        }
        const next = Math.min(maxTotalWidth, Math.max(minTotalWidth, startWidth + dx));
        latestWidth = next;
        if (table) table.style.width = `${next}px`;
      }
      function onUp(): void {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        if (!bewegt) return;
        // Erst committen, dann die Zeile zurückgeben: der Commit rendert sie mit
        // `w-max` neu, die Inline-Breite kann also ohne Zwischenbild weichen.
        onTotalWidthChange(Math.round(latestWidth));
        if (wrapper) wrapper.style.width = '';
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [onTotalWidthChange, minTotalWidth, maxTotalWidth, tableRef, wrapperRef],
  );

  const onClick = useCallback((): void => {
    if (gezogenRef.current) {
      gezogenRef.current = false;
      return;
    }
    onKlick?.();
  }, [onKlick]);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={titel}
      title={titel}
      onMouseDown={startTotalResize}
      onClick={onClick}
      // KEIN `h-full`: als Flex-Kind eines `items-stretch`-Wrappers ohne feste
      // Höhe löst `height:100%` auf `auto` auf — der Griff war damit 15px hoch
      // (die Höhe seiner drei Punkte) statt so hoch wie die Tabelle. Das
      // Strecken macht `align-items: stretch` von selbst.
      // 6px: gleich breit wie die Spaltengriffe (`TableHeadRows`). Er trägt
      // jetzt zwei Gesten statt einer — eine Kante, die man auch treffen will,
      // ohne zu zielen.
      className="shrink-0 w-[6px] flex items-center justify-center cursor-col-resize bg-[var(--tf-bg-secondary)] hover:bg-[var(--tf-border-hover)]"
      style={{ borderLeft: '0.5px solid var(--tf-border)', touchAction: 'none' }}
    >
      <GriffPunkte />
    </div>
  );
}

function GriffPunkte(): ReactNode {
  return (
    // 2px auf 5.5px Innenbreite: die Punkte behalten links und rechts Luft und
    // lesen sich als Griff. In der alten 3.5px-Rinne füllten sie sie randlos aus
    // und wirkten als durchgehender Strich — daher damals 1.5px.
    <span className="flex flex-col gap-[3px]" aria-hidden="true">
      <span className="w-[2px] h-[2px] rounded-full bg-[var(--tf-text-tertiary)]" />
      <span className="w-[2px] h-[2px] rounded-full bg-[var(--tf-text-tertiary)]" />
      <span className="w-[2px] h-[2px] rounded-full bg-[var(--tf-text-tertiary)]" />
    </span>
  );
}
