/**
 * Griff für die GESAMT-Breite der Tabelle (opt-in über `onTotalWidthChange`).
 *
 * Ziehen pinnt die Tabelle live auf eine explizite Pixelbreite;
 * `table-layout: fixed` skaliert alle Spalten proportional mit. Doppelklick
 * setzt zurück auf „Container füllen".
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
 * die Container-Breite zurück).
 */
import { useCallback, type ReactNode } from 'react';

export interface TotalWidthGripProps {
  /** Commit on mouseup (Pixel) bzw. `null` bei Doppelklick (Reset auf Default). */
  onTotalWidthChange: (width: number | null) => void;
  minTotalWidth: number;
  maxTotalWidth: number;
  tableRef: { current: HTMLTableElement | null };
}

export function TotalWidthGrip({
  onTotalWidthChange,
  minTotalWidth,
  maxTotalWidth,
  tableRef,
}: TotalWidthGripProps): React.ReactElement {
  const startTotalResize = useCallback(
    (e: React.MouseEvent<HTMLDivElement>): void => {
      e.preventDefault();
      e.stopPropagation();
      const table = tableRef.current;
      const startWidth = table ? table.offsetWidth : minTotalWidth;
      const startX = e.clientX;
      let latestWidth = startWidth;
      if (table) {
        table.style.minWidth = '0px';
        table.style.flex = '0 0 auto';
        table.style.width = `${startWidth}px`;
      }
      function onMove(ev: MouseEvent): void {
        const next = Math.min(maxTotalWidth, Math.max(minTotalWidth, startWidth + (ev.clientX - startX)));
        latestWidth = next;
        if (table) table.style.width = `${next}px`;
      }
      function onUp(): void {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        onTotalWidthChange(Math.round(latestWidth));
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [onTotalWidthChange, minTotalWidth, maxTotalWidth, tableRef],
  );

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Tabellenbreite ändern (Doppelklick: zurücksetzen)"
      title="Ziehen: Tabelle breiter/schmaler · Doppelklick: auf Fensterbreite zurücksetzen"
      onMouseDown={startTotalResize}
      onDoubleClick={() => onTotalWidthChange(null)}
      // KEIN `h-full`: als Flex-Kind eines `items-stretch`-Wrappers ohne feste
      // Höhe löst `height:100%` auf `auto` auf — der Griff war damit 15px hoch
      // (die Höhe seiner drei Punkte) statt so hoch wie die Tabelle. Das
      // Strecken macht `align-items: stretch` von selbst.
      className="shrink-0 w-[12px] flex items-center justify-center cursor-col-resize bg-[var(--tf-bg-secondary)] hover:bg-[var(--tf-border-hover)]"
      style={{ borderLeft: '0.5px solid var(--tf-border)', touchAction: 'none' }}
    >
      <GriffPunkte />
    </div>
  );
}

function GriffPunkte(): ReactNode {
  return (
    <span className="flex flex-col gap-[3px]" aria-hidden="true">
      <span className="w-[3px] h-[3px] rounded-full bg-[var(--tf-text-tertiary)]" />
      <span className="w-[3px] h-[3px] rounded-full bg-[var(--tf-text-tertiary)]" />
      <span className="w-[3px] h-[3px] rounded-full bg-[var(--tf-text-tertiary)]" />
    </span>
  );
}
