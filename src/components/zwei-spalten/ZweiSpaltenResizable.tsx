/**
 * Geteilte, ziehbare Zwei-Spalten-Layout-Komponente: eine flexible Hauptspalte
 * (`1fr`) links + eine breiten-variable Seitenspalte rechts, deren linke Kante
 * per Griff verschoben wird. Ziehen nach rechts verschmälert die Seitenspalte →
 * die Hauptspalte wird breiter. Nur ab `lg` aktiv; darunter einspaltig gestapelt
 * und der Griff ausgeblendet.
 *
 * Persistenz: die Seitenspalten-Breite ist eine reine Darstellungs-Präferenz →
 * gerätelokal in localStorage (`storageKey`). KEIN Daten-Share, KEIN Snapshot,
 * KEIN Schema — analog der Widget-Config-Invariante.
 *
 * Performance: während des Ziehens wird NUR die CSS-Variable am Grid-Element
 * imperativ gesetzt (kein React-Re-Render pro Frame — Konsumenten wie die Home
 * tragen große Aggregationen); erst beim Loslassen committen State + localStorage.
 *
 * Die CSS-Variable `--zs-seite-breite` (KEIN `--tf-`-Präfix) ist eine lokale
 * Layout-Variable, kein Theme-Token, und wird inline am Grid-Node gesetzt →
 * instanz-lokal, kollidiert nie zwischen mehreren Instanzen/Seiten.
 */
import { useCallback, useRef, useState } from 'react';
import { clampBreite } from './zweiSpaltenResize-logic';

const TASTEN_SCHRITT = 16;

export interface ZweiSpaltenResizableProps {
  /** Linke Hauptspalte (`1fr`, füllt den verbleibenden Platz). */
  haupt: React.ReactNode;
  /** Rechte Seitenspalte (breiten-variabel, per Griff resizable). */
  seite: React.ReactNode;
  /** localStorage-Schlüssel für die gerätelokale Breiten-Präferenz. */
  storageKey: string;
  defaultBreite: number;
  minBreite: number;
  maxBreite: number;
  ariaLabel?: string;
  /** Tailwind-Gap-Klasse für die Grid-Lücke (Default `gap-8`). */
  gapClassName?: string;
  /**
   * Zusätzliche Klassen am Grid-Element. Gedacht für Konsumenten in einem Container
   * mit fester Höhe (z.B. Dialog), die `h-full min-h-0` brauchen, damit beide Spalten
   * die volle Höhe füllen und für sich scrollen. Ohne Angabe unverändert (Auto-Höhe).
   */
  className?: string;
}

export function ZweiSpaltenResizable({
  haupt,
  seite,
  storageKey,
  defaultBreite,
  minBreite,
  maxBreite,
  ariaLabel = 'Breite der Seitenspalte anpassen',
  gapClassName = 'gap-8',
  className = '',
}: ZweiSpaltenResizableProps): React.ReactElement {
  const klemme = useCallback(
    (px: number): number => clampBreite(px, minBreite, maxBreite, defaultBreite),
    [minBreite, maxBreite, defaultBreite],
  );

  const speichere = useCallback(
    (px: number): void => {
      try {
        localStorage.setItem(storageKey, String(px));
      } catch {
        /* localStorage evtl. gesperrt — Breite bleibt dann nur für die Session. */
      }
    },
    [storageKey],
  );

  const [breite, setBreite] = useState<number>(() => {
    try {
      const roh = localStorage.getItem(storageKey);
      if (roh === null) return defaultBreite;
      return clampBreite(Number(roh), minBreite, maxBreite, defaultBreite);
    } catch {
      return defaultBreite;
    }
  });

  const gridRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startBreite: number } | null>(null);

  const setzeVar = useCallback((px: number): void => {
    gridRef.current?.style.setProperty('--zs-seite-breite', `${px}px`);
  }, []);

  const onPointerMove = useCallback(
    (e: PointerEvent): void => {
      const d = dragRef.current;
      if (!d) return;
      // Griff sitzt an der LINKEN Kante der Seitenspalte: nach rechts ziehen
      // (positives deltaX) verschmälert die Seite → Haupt wird breiter.
      setzeVar(klemme(d.startBreite - (e.clientX - d.startX)));
    },
    [setzeVar, klemme],
  );

  const beendeDrag = useCallback(
    (e: PointerEvent): void => {
      const d = dragRef.current;
      dragRef.current = null;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', beendeDrag);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      if (!d) return;
      const final = klemme(d.startBreite - (e.clientX - d.startX));
      setBreite(final); // React-State + Inline-Style wieder in Sync
      speichere(final);
    },
    [onPointerMove, klemme, speichere],
  );

  const starteDrag = useCallback(
    (e: React.PointerEvent): void => {
      e.preventDefault();
      dragRef.current = { startX: e.clientX, startBreite: breite };
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', beendeDrag);
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
    },
    [breite, onPointerMove, beendeDrag],
  );

  const aufTaste = (e: React.KeyboardEvent): void => {
    // ← macht die Seite breiter, → schmaler (= Haupt breiter).
    let next: number | null = null;
    if (e.key === 'ArrowLeft') next = klemme(breite + TASTEN_SCHRITT);
    else if (e.key === 'ArrowRight') next = klemme(breite - TASTEN_SCHRITT);
    if (next === null) return;
    e.preventDefault();
    setBreite(next);
    speichere(next);
  };

  const zuruecksetzen = (): void => {
    setBreite(defaultBreite);
    speichere(defaultBreite);
  };

  return (
    <div
      ref={gridRef}
      className={`grid grid-cols-1 lg:grid-cols-[1fr_var(--zs-seite-breite,320px)] ${gapClassName} ${className}`}
      style={{ '--zs-seite-breite': `${breite}px` } as React.CSSProperties}
    >
      {haupt}
      <div className="relative min-w-0">
        {/* Trenn-Griff: sitzt in der Lücke an der linken Kante der Seite.
            Nur ab lg sichtbar/bedienbar (darunter gestapeltes Ein-Spalten-Layout). */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={ariaLabel}
          aria-valuenow={breite}
          aria-valuemin={minBreite}
          aria-valuemax={maxBreite}
          tabIndex={0}
          onPointerDown={starteDrag}
          onKeyDown={aufTaste}
          onDoubleClick={zuruecksetzen}
          title="Ziehen zum Anpassen · Doppelklick setzt zurück"
          className="group absolute -left-4 top-0 bottom-0 z-10 hidden w-6 -translate-x-1/2 cursor-col-resize items-center justify-center focus:outline-none lg:flex"
        >
          <span className="h-10 w-[3px] rounded-full bg-[var(--tf-border)] transition-colors group-hover:bg-[var(--tf-primary)] group-focus-visible:bg-[var(--tf-primary)]" />
        </div>
        {seite}
      </div>
    </div>
  );
}
