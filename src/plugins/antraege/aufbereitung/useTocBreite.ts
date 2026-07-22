/**
 * Ziehbare Breite der Lesemodus-Gliederungsspalte. Griff sitzt an der RECHTEN Kante
 * der Spalte: nach rechts ziehen macht die Gliederung breiter.
 *
 * Persistenz: reine Darstellungs-Präferenz → gerätelokal in localStorage.
 * KEIN Daten-Share, KEIN Snapshot, KEIN Schema (analog `ZweiSpaltenResizable`).
 *
 * Performance: während des Ziehens wird NUR die CSS-Variable `--lm-toc-breite` am
 * Flex-Row-Node imperativ gesetzt (kein React-Re-Render pro Frame — der Lesepane
 * rendert bis zu ~60 Markdown-Abschnitte); erst beim Loslassen committen State +
 * localStorage. Klemm-Logik geteilt mit dem Zwei-Spalten-Splitter (`clampBreite`).
 */
import { useCallback, useRef, useState } from 'react';
import { clampBreite } from '@/components/zwei-spalten';

export const TOC_STORAGE_KEY = 'tf-lesemodus-toc-breite';
export const TOC_DEFAULT_BREITE = 208; // entspricht der früheren festen `w-52`
export const TOC_MIN_BREITE = 150;
export const TOC_MAX_BREITE = 560;
const TASTEN_SCHRITT = 16;

export interface TocGriffProps {
  role: 'separator';
  'aria-orientation': 'vertical';
  'aria-label': string;
  'aria-valuenow': number;
  'aria-valuemin': number;
  'aria-valuemax': number;
  tabIndex: number;
  title: string;
  onPointerDown: (e: React.PointerEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onDoubleClick: () => void;
}

export interface TocBreite {
  /** Committete Breite in px (State — nur beim Loslassen aktualisiert). */
  breite: number;
  /** Ref auf die Flex-Row, an der `--lm-toc-breite` gesetzt wird. */
  rowRef: React.RefObject<HTMLDivElement | null>;
  griffProps: TocGriffProps;
}

export function useTocBreite(): TocBreite {
  const speichere = useCallback((px: number): void => {
    try {
      localStorage.setItem(TOC_STORAGE_KEY, String(px));
    } catch {
      /* localStorage evtl. gesperrt — Breite bleibt dann nur für die Session. */
    }
  }, []);

  const [breite, setBreite] = useState<number>(() => {
    try {
      const roh = localStorage.getItem(TOC_STORAGE_KEY);
      if (roh === null) return TOC_DEFAULT_BREITE;
      return clampBreite(Number(roh), TOC_MIN_BREITE, TOC_MAX_BREITE, TOC_DEFAULT_BREITE);
    } catch {
      return TOC_DEFAULT_BREITE;
    }
  });

  const rowRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startBreite: number } | null>(null);

  const klemme = (px: number): number =>
    clampBreite(px, TOC_MIN_BREITE, TOC_MAX_BREITE, TOC_DEFAULT_BREITE);

  const onPointerMove = useCallback((e: PointerEvent): void => {
    const d = dragRef.current;
    if (!d) return;
    // Griff an der RECHTEN Kante: nach rechts ziehen (positives deltaX) = breiter.
    rowRef.current?.style.setProperty(
      '--lm-toc-breite',
      `${klemme(d.startBreite + (e.clientX - d.startX))}px`,
    );
  }, []);

  const beendeDrag = useCallback(
    (e: PointerEvent): void => {
      const d = dragRef.current;
      dragRef.current = null;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', beendeDrag);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      if (!d) return;
      const final = klemme(d.startBreite + (e.clientX - d.startX));
      setBreite(final); // React-State + Inline-Style wieder in Sync
      speichere(final);
    },
    [onPointerMove, speichere],
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
    let next: number | null = null;
    if (e.key === 'ArrowRight') next = klemme(breite + TASTEN_SCHRITT);
    else if (e.key === 'ArrowLeft') next = klemme(breite - TASTEN_SCHRITT);
    if (next === null) return;
    e.preventDefault();
    setBreite(next);
    speichere(next);
  };

  const zuruecksetzen = (): void => {
    setBreite(TOC_DEFAULT_BREITE);
    speichere(TOC_DEFAULT_BREITE);
  };

  return {
    breite,
    rowRef,
    griffProps: {
      role: 'separator',
      'aria-orientation': 'vertical',
      'aria-label': 'Breite der Gliederung anpassen',
      'aria-valuenow': breite,
      'aria-valuemin': TOC_MIN_BREITE,
      'aria-valuemax': TOC_MAX_BREITE,
      tabIndex: 0,
      title: 'Ziehen zum Anpassen · Doppelklick setzt zurück',
      onPointerDown: starteDrag,
      onKeyDown: aufTaste,
      onDoubleClick: zuruecksetzen,
    },
  };
}
