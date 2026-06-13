import { useCallback, useEffect, useRef, useState } from 'react';
import {
  effectiveListWidth,
  clampDragWidth,
  listPaneClass,
  listPaneStyle,
  shouldCloseOnEscape,
} from './masterDetailLayout-logic';

export interface MasterDetailLayoutProps {
  /** Die Listen-/Tabellen-Ansicht (Master). Füllt die volle Breite, solange
   *  kein Detail offen ist. */
  list: React.ReactNode;
  /** Detail-Panel (Slave). `undefined`/`null` = kein Detail offen → Liste voll. */
  detail?: React.ReactNode;
  /** Wird bei Escape (außerhalb von Eingabefeldern) aufgerufen; der Detail-
   *  Inhalt verdrahtet typischerweise auch seinen eigenen Close/Back-Button
   *  darauf. */
  onCloseDetail?: () => void;
  /** localStorage-Key für die resizable Listenbreite im Detail-Modus. */
  listWidthKey?: string;
  /** Start-/Mindestbreite der Liste-Sidebar + Mindestbreite des Detail-Panels. */
  narrowDefaultWidth?: number;
  narrowMinWidth?: number;
  detailMinWidth?: number;
}

function loadStoredWidth(key: string | undefined, defaultWidth: number, minWidth: number): number {
  if (!key) return defaultWidth;
  try {
    const v = Number(localStorage.getItem(key));
    if (Number.isFinite(v) && v >= minWidth) return v;
  } catch { /* ignore */ }
  return defaultWidth;
}

/**
 * Kanonisches, datenagnostisches Master-Detail-Shell (Split-View): Liste links,
 * Detail rechts. Im Detail-Modus schrumpft die Liste auf eine resizable Sidebar
 * (Drag-Handle, Breite persistiert), das Detail-Panel behält `detailMinWidth`.
 * Erwartet einen Flex-Spalten-Höhenkontext vom Aufrufer (Header außerhalb).
 * KEIN Wissen über Anträge/Suche/Filter — destilliert aus dem Förderanträge-
 * Muster (Referenz: AntraegePage/AntraegeMain), nicht kopiert.
 */
export function MasterDetailLayout({
  list,
  detail,
  onCloseDetail,
  listWidthKey,
  narrowDefaultWidth = 460,
  narrowMinWidth = 320,
  detailMinWidth = 300,
}: MasterDetailLayoutProps): React.ReactElement {
  const hasDetail = detail != null;

  const [listWidth, setListWidth] = useState(() =>
    loadStoredWidth(listWidthKey, narrowDefaultWidth, narrowMinWidth),
  );
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1440,
  );

  useEffect(() => {
    const handler = (): void => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  useEffect(() => {
    if (!listWidthKey) return;
    try { localStorage.setItem(listWidthKey, String(listWidth)); } catch { /* ignore */ }
  }, [listWidth, listWidthKey]);

  // Escape schließt das Detail — außer der Fokus liegt in einem Eingabefeld.
  // onCloseDetail via Ref, damit der Listener nur bei hasDetail-Wechsel (de)abonniert.
  const onCloseRef = useRef(onCloseDetail);
  onCloseRef.current = onCloseDetail;
  useEffect(() => {
    if (!hasDetail) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      const el = document.activeElement as HTMLElement | null;
      if (!shouldCloseOnEscape(el?.tagName, !!el?.isContentEditable)) return;
      onCloseRef.current?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hasDetail]);

  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const onResizeMouseDown = useCallback((e: React.MouseEvent): void => {
    dragRef.current = { startX: e.clientX, startWidth: listWidth };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const onMove = (ev: MouseEvent): void => {
      const drag = dragRef.current;
      if (!drag) return;
      const delta = ev.clientX - drag.startX;
      setListWidth(clampDragWidth(drag.startWidth + delta, window.innerWidth, narrowMinWidth, detailMinWidth));
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
  }, [listWidth, narrowMinWidth, detailMinWidth]);

  const effectiveWidth = effectiveListWidth(listWidth, viewportWidth, narrowMinWidth, detailMinWidth);

  return (
    <div className="flex-1 min-h-0 flex overflow-hidden">
      <div className={listPaneClass(hasDetail)} style={listPaneStyle(hasDetail, effectiveWidth)}>
        <div className="flex-1 min-w-0 h-full overflow-y-auto">{list}</div>
        {hasDetail && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Listenbreite ändern"
            onMouseDown={onResizeMouseDown}
            className="shrink-0 w-[4px] h-full cursor-col-resize hover:bg-[var(--tf-border-hover)] transition-colors"
            style={{ borderLeft: '0.5px solid var(--tf-border)' }}
          />
        )}
      </div>
      {hasDetail && (
        <div className="flex-1 min-w-0 h-full overflow-hidden">{detail}</div>
      )}
    </div>
  );
}
