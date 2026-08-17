/**
 * Griff für die GESAMT-Breite der Tabelle (opt-in über `onTotalWidthChange`).
 *
 * Zwei Gesten, ein Griff:
 *
 * - **Ziehen** pinnt den KASTEN live auf eine explizite Pixelbreite. Die Tabelle
 *   darin bleibt in ihrem Modus und füllt ihn aus — `table-layout: fixed`
 *   skaliert alle Spalten proportional mit, unter dem Lesbarkeits-Boden greift
 *   der waagerechte Scrollbalken. Gepinnt wird also, wo die Tabelle AUFHÖRT,
 *   nicht wie breit sie innerhalb eines gleich breiten Rahmens ist (vorher blieb
 *   rechts der Rest des Rahmens als leere Fläche stehen).
 * - **Klick** löst `onKlick` aus. Was das bedeutet, entscheidet der Aufrufer
 *   (`SortableTable`): gepinnte Breite verwerfen bzw. zwischen „Spalten teilen
 *   sich die Breite" und „Spalten auf Inhaltsbreite" umschalten.
 *
 * Der frühere Doppelklick-Reset ist darin aufgegangen — mit Klick UND Doppelklick
 * auf demselben Griff hätte jede Umschaltung erst den Doppelklick abwarten müssen.
 *
 * **Klick ist nicht Ziehen.** Ohne Schwelle committet jeder Mouseup auf dem Griff
 * eine Breite — ein bloßer Klick pinnte den Kasten dann auf seine aktuelle Breite,
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
 * Der Startwert kommt aus der aktuell GERENDERTEN Kastenbreite (`offsetWidth`) —
 * kein Sprung beim Greifen, egal ob vorher ungepinnt, gepinnt oder auf `100%`
 * gedeckelt. Mehr als diese eine Zahl braucht das Ziehen nicht: der Kasten trägt
 * die Breite, alles darin ist Folge.
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
  /** Der äußere Kasten (Rahmen + Scroller + Griff) — er trägt die Breite. */
  kastenRef: { current: HTMLDivElement | null };
}

export function TotalWidthGrip({
  onTotalWidthChange,
  onKlick,
  titel,
  minTotalWidth,
  maxTotalWidth,
  kastenRef,
}: TotalWidthGripProps): React.ReactElement {
  // Überlebt den Mouseup, damit das nachfolgende `click` weiß, dass es zu einem
  // Ziehen gehörte. Ein Ref, kein State: eine Zustandsänderung mitten in der
  // Geste würde nur Renderrunden auslösen, die nichts bewegen.
  const gezogenRef = useRef(false);

  const startTotalResize = useCallback(
    (e: React.MouseEvent<HTMLDivElement>): void => {
      e.preventDefault();
      e.stopPropagation();
      const kasten = kastenRef.current;
      const startWidth = kasten ? kasten.offsetWidth : minTotalWidth;
      const startX = e.clientX;
      let latestWidth = startWidth;
      let bewegt = false;
      gezogenRef.current = false;

      function onMove(ev: MouseEvent): void {
        const dx = ev.clientX - startX;
        if (!bewegt) {
          // Erst ab der Schwelle überhaupt anfassen — vor ihr wäre ein bloßer
          // Klick als sichtbares Zucken zu sehen.
          if (Math.abs(dx) < DRAG_SCHWELLE) return;
          bewegt = true;
          gezogenRef.current = true;
          // Denselben Deckel wie der Commit (`leiteKastenStil`) schon während
          // des Zugs: sonst schöbe ein Ziehen über den verfügbaren Platz hinaus
          // die Seite auf und der Kasten spränge beim Loslassen zurück.
          if (kasten) kasten.style.maxWidth = '100%';
        }
        const next = Math.min(maxTotalWidth, Math.max(minTotalWidth, startWidth + dx));
        latestWidth = next;
        // Der Kasten ist im ungepinnten Zustand `w-full`; eine Inline-Breite
        // schlägt die Klasse, der Commit rendert sie danach als Stil-Prop
        // derselben Eigenschaft — kein Zwischenbild, kein Aufräumen nötig.
        if (kasten) kasten.style.width = `${next}px`;
      }
      function onUp(): void {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        if (!bewegt) return;
        onTotalWidthChange(Math.round(latestWidth));
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [onTotalWidthChange, minTotalWidth, maxTotalWidth, kastenRef],
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
      // `self-start` + feste Höhe: nur drei Punkte oben rechts, KEIN Streifen
      // über die ganze Kastenhöhe. Der `items-stretch`-Kasten würde ihn sonst
      // von selbst strecken — und ein senkrechter Streifen direkt neben dem
      // senkrechten Scrollbalken liest sich als zweiter Balken.
      // Die 6px-Spalte bleibt trotzdem über die volle Höhe reserviert (Breite
      // eines Flex-Kindes, unabhängig von seiner Höhe): so liegt der Griff nie
      // über dem Scrollbalken. 6px ist zugleich die Breite der Spaltengriffe
      // (`TableHeadRows`).
      // Sichtbar UND anfassbar nur oben — was man sieht, ist die Geste.
      className="shrink-0 self-start w-[6px] h-[30px] flex items-center justify-center cursor-col-resize bg-[var(--tf-bg-secondary)] hover:bg-[var(--tf-border-hover)]"
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
