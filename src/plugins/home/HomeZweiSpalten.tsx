/**
 * Zwei-Spalten-Layout der Startseite mit ZIEHBAREM Trenn-Griff zwischen Haupt-
 * und Seitenspalte. Ziehen nach rechts verschmälert die Seitenspalte → die
 * Hauptspalte (mit dem breiten Kanban) wird breiter. Nur ab `lg` aktiv;
 * darunter ist das Layout einspaltig gestapelt und der Griff ausgeblendet.
 *
 * Persistenz: die Seitenspalten-Breite ist eine reine Darstellungs-Präferenz →
 * gerätelokal in localStorage (wie `teamflow_settings_*`). KEIN Daten-Share,
 * KEIN Snapshot, KEIN Schema — analog der Widget-Config-Invariante.
 *
 * Performance: während des Ziehens wird NUR die CSS-Variable am Grid-Element
 * imperativ gesetzt (kein React-Re-Render pro Frame — die Home trägt die
 * 13k-Anträge-Aggregation); erst beim Loslassen committen State + localStorage.
 *
 * Die CSS-Variable heißt bewusst `--home-seite-breite` (KEIN `--tf-`-Präfix):
 * sie ist eine lokale Layout-Variable, kein Theme-Token — analog `--lane-c` im
 * Kanban (kein `theme-token-contract`-Vertrag).
 */
import { useCallback, useRef, useState } from 'react';

const LS_KEY = 'teamflow_home_seite_breite';
const DEFAULT_BREITE = 260;
const MIN_BREITE = 200;
const MAX_BREITE = 480;
const TASTEN_SCHRITT = 16;

/** Klemmt die Seitenspalten-Breite auf den erlaubten Bereich (rein, testbar). */
export function clampSeiteBreite(px: number): number {
  if (!Number.isFinite(px)) return DEFAULT_BREITE;
  return Math.max(MIN_BREITE, Math.min(MAX_BREITE, Math.round(px)));
}

function ladeBreite(): number {
  try {
    const roh = localStorage.getItem(LS_KEY);
    if (roh === null) return DEFAULT_BREITE;
    return clampSeiteBreite(Number(roh));
  } catch {
    return DEFAULT_BREITE;
  }
}

function speichereBreite(px: number): void {
  try {
    localStorage.setItem(LS_KEY, String(px));
  } catch {
    /* localStorage evtl. gesperrt — Breite bleibt dann nur für die Session. */
  }
}

export interface HomeZweiSpaltenProps {
  main: React.ReactNode;
  seite: React.ReactNode;
}

export function HomeZweiSpalten({ main, seite }: HomeZweiSpaltenProps): React.ReactElement {
  const [breite, setBreite] = useState<number>(ladeBreite);
  const gridRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startBreite: number } | null>(null);

  const setzeVar = useCallback((px: number): void => {
    gridRef.current?.style.setProperty('--home-seite-breite', `${px}px`);
  }, []);

  const onPointerMove = useCallback(
    (e: PointerEvent): void => {
      const d = dragRef.current;
      if (!d) return;
      // Griff sitzt an der LINKEN Kante der Seitenspalte: nach rechts ziehen
      // (positives deltaX) verschmälert die Seite → Haupt wird breiter.
      setzeVar(clampSeiteBreite(d.startBreite - (e.clientX - d.startX)));
    },
    [setzeVar],
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
      const final = clampSeiteBreite(d.startBreite - (e.clientX - d.startX));
      setBreite(final); // React-State + Inline-Style wieder in Sync
      speichereBreite(final);
    },
    [onPointerMove],
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
    if (e.key === 'ArrowLeft') next = clampSeiteBreite(breite + TASTEN_SCHRITT);
    else if (e.key === 'ArrowRight') next = clampSeiteBreite(breite - TASTEN_SCHRITT);
    if (next === null) return;
    e.preventDefault();
    setBreite(next);
    speichereBreite(next);
  };

  const zuruecksetzen = (): void => {
    setBreite(DEFAULT_BREITE);
    speichereBreite(DEFAULT_BREITE);
  };

  return (
    <div
      ref={gridRef}
      className="grid grid-cols-1 lg:grid-cols-[1fr_var(--home-seite-breite,260px)] gap-8"
      style={{ '--home-seite-breite': `${breite}px` } as React.CSSProperties}
    >
      {main}
      <div className="relative min-w-0">
        {/* Trenn-Griff: sitzt in der 32px-Lücke an der linken Kante der Seite.
            Nur ab lg sichtbar/bedienbar (darunter gestapeltes Ein-Spalten-Layout). */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Breite der Seitenspalte anpassen"
          aria-valuenow={breite}
          aria-valuemin={MIN_BREITE}
          aria-valuemax={MAX_BREITE}
          tabIndex={0}
          onPointerDown={starteDrag}
          onKeyDown={aufTaste}
          onDoubleClick={zuruecksetzen}
          title="Ziehen zum Anpassen · Doppelklick setzt zurück"
          className="group hidden lg:flex absolute -left-4 top-0 bottom-0 z-10 w-6 -translate-x-1/2 cursor-col-resize items-center justify-center focus:outline-none"
        >
          <span className="h-10 w-[3px] rounded-full bg-[var(--tf-border)] transition-colors group-hover:bg-[var(--tf-primary)] group-focus-visible:bg-[var(--tf-primary)]" />
        </div>
        {seite}
      </div>
    </div>
  );
}
