/**
 * Die persistente Filterleiste als Spalte der Liste — samt ihrer Breite.
 *
 * Sie sass bis v4.76 als Geschwister von `AntraegeMain` in der Flex-Zeile der
 * `AntraegePage`. Damit lag die Werkzeug-Zeile der Liste ZWANGSLÄUFIG neben der
 * Leiste statt über ihr, und der Tabellenkopf begann rund 90 px tiefer als der
 * Kopf der Leiste. Jetzt gehört die Spalte zur Liste: `AntraegeMain` setzt die
 * Werkzeug-Zeile darüber, und Leistenkopf und Tabellenkopf können ein Band
 * bilden (`bandHoehe`).
 *
 * Die Breite lebt hier, nicht in der Seite: sie ist eine Eigenschaft dieser
 * Spalte, und niemand sonst liest sie.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { KopfHoehen } from '@/components/data-table';
import { useAntraegeStore } from '../store';
import { FilterSidebar } from './FilterSidebar';

const FILTER_WIDTH_KEY = 'teamflow_antraege_filter_width';
const FILTER_DEFAULT_WIDTH = 460;
const FILTER_MIN_WIDTH = 280;
const FILTER_MAX_WIDTH = 720;

function loadFilterWidth(): number {
  try {
    const v = Number(localStorage.getItem(FILTER_WIDTH_KEY));
    if (Number.isFinite(v) && v >= FILTER_MIN_WIDTH && v <= FILTER_MAX_WIDTH) return v;
  } catch { /* ignore */ }
  return FILTER_DEFAULT_WIDTH;
}

interface Props {
  /** Ausgeklappt? Bei `false` rendert die Spalte nichts. */
  open: boolean;
  /** Einklappen aus der Leiste heraus (derselbe Schalter wie im Seitenkopf). */
  onCollapse: () => void;
  /**
   * Gemessene Höhen des Tabellenkopfes, sofern die Liste gerade einen hat und
   * er am Anfang dieser Zeile steht — dann wird der Kopf der Leiste zu seinem
   * ersten Abschnitt. `null` (Liste/Karten, Leerzustände) heisst: die Leiste
   * trägt ihren gewohnten Kopf.
   */
  band?: KopfHoehen | null;
}

export function FilterSpalte({ open, onCollapse, band = null }: Props): React.ReactElement | null {
  const antraege = useAntraegeStore(s => s.antraege);
  const search = useAntraegeStore(s => s.search);
  const setSearch = useAntraegeStore(s => s.setSearch);
  const [width, setWidth] = useState(loadFilterWidth);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const onResizeMouseDown = useCallback((e: React.MouseEvent): void => {
    dragRef.current = { startX: e.clientX, startWidth: width };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const onMove = (ev: MouseEvent): void => {
      const drag = dragRef.current;
      if (!drag) return;
      // Leiste links: nach rechts ziehen → breiter. (Bis v4.62 stand sie rechts
      // und das Vorzeichen war umgekehrt.)
      const delta = ev.clientX - drag.startX;
      const next = Math.min(FILTER_MAX_WIDTH, Math.max(FILTER_MIN_WIDTH, drag.startWidth + delta));
      setWidth(next);
    };
    const onUp = (): void => {
      dragRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [width]);

  useEffect(() => {
    try { localStorage.setItem(FILTER_WIDTH_KEY, String(width)); } catch { /* ignore */ }
  }, [width]);

  if (!open) return null;

  return (
    <aside className="shrink-0 h-full overflow-hidden flex" style={{ width }}>
      <div className="flex-1 min-w-0 h-full">
        <FilterSidebar
          antraege={antraege}
          search={search}
          onSearchChange={setSearch}
          onCollapse={onCollapse}
          band={band}
          hideSearch
        />
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Filter-Panel-Breite ändern"
        onMouseDown={onResizeMouseDown}
        // Kein Trennstrich mehr (v4.64): die Leiste steht auf der leichten
        // Grundfläche, die Liste auf Weiß — der Farbwechsel IST die Kante.
        // Der Griff bleibt fühlbar (Cursor) und zeigt sich beim Überfahren.
        className="shrink-0 w-[4px] h-full cursor-col-resize bg-[var(--tf-bg-secondary)] hover:bg-[var(--tf-border-hover)] transition-colors"
      />
    </aside>
  );
}
