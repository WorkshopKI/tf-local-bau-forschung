import { useCallback, useEffect, useRef, useState } from 'react';
import { PanelLeftOpen } from 'lucide-react';
import {
  effectiveListWidth,
  clampDragWidth,
  keyboardWidthStep,
  listPaneClass,
  listPaneStyle,
  maxListWidth,
  shouldCloseOnEscape,
  parseCollapsedFlag,
  serializeCollapsedFlag,
  shouldShowList,
} from './masterDetailLayout-logic';

/** Steuer-API, die `list` als Render-Funktion bekommt — damit ein Collapse-
 *  Trigger (z.B. `PanelLeftClose`) in der Listen-Toolbar des Konsumenten sitzen
 *  kann, ohne dass das Shell dessen internes Layout kennt. */
export interface MasterDetailListApi {
  collapsed: boolean;
  toggleCollapsed: () => void;
}

export interface MasterDetailLayoutProps {
  /** Die Listen-/Tabellen-Ansicht (Master). Füllt die volle Breite, solange
   *  kein Detail offen ist. Render-Funktions-Form bekommt die Collapse-API. */
  list: React.ReactNode | ((api: MasterDetailListApi) => React.ReactNode);
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
  /** Opt-in: erlaubt das vollständige Einklappen der Liste auf eine schmale
   *  vertikale Leiste im Detail-Modus (additiv neben dem Resize). Default aus —
   *  bestehende Konsumenten bleiben unverändert. Der Collapse-Trigger gehört in
   *  die `list`-Toolbar (via `api.toggleCollapsed`); das Wieder-Einblenden
   *  besorgt die Leiste. */
  collapsible?: boolean;
  /** localStorage-Key für das Collapse-Flag (nur mit `collapsible`). */
  listCollapsedKey?: string;
  /** Beschriftung der eingeklappten Leiste (z.B. „Anfragen einblenden"). */
  collapsedRailLabel?: string;
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
 * (sichtbarer Griff: ziehen, ←/→, Doppelklick setzt auf `narrowDefaultWidth`
 * zurück; Breite persistiert), das Detail-Panel behält `detailMinWidth`.
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
  collapsible = false,
  listCollapsedKey,
  collapsedRailLabel = 'Einblenden',
}: MasterDetailLayoutProps): React.ReactElement {
  const hasDetail = detail != null;

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (!collapsible || !listCollapsedKey) return false;
    try { return parseCollapsedFlag(localStorage.getItem(listCollapsedKey)); } catch { return false; }
  });
  useEffect(() => {
    if (!listCollapsedKey) return;
    try { localStorage.setItem(listCollapsedKey, serializeCollapsedFlag(collapsed)); } catch { /* ignore */ }
  }, [collapsed, listCollapsedKey]);
  const toggleCollapsed = useCallback(() => setCollapsed(c => !c), []);

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

  const effectiveWidth = effectiveListWidth(listWidth, viewportWidth, narrowMinWidth, detailMinWidth);

  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const onResizePointerDown = useCallback((e: React.PointerEvent): void => {
    e.preventDefault(); // kein Textselektieren/Fokus-Flackern während des Ziehens
    dragRef.current = { startX: e.clientX, startWidth: listWidth };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const onMove = (ev: PointerEvent): void => {
      const drag = dragRef.current;
      if (!drag) return;
      const delta = ev.clientX - drag.startX;
      setListWidth(clampDragWidth(drag.startWidth + delta, window.innerWidth, narrowMinWidth, detailMinWidth));
    };
    const onUp = (): void => {
      dragRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [listWidth, narrowMinWidth, detailMinWidth]);

  // Tastatur-Alternative zum Ziehen: Basis ist die ANGEZEIGTE (geklemmte) Breite,
  // sonst liefen erste Tastendrücke an einem gekappten Wert ins Leere.
  const onResizeKeyDown = useCallback((e: React.KeyboardEvent): void => {
    const step = keyboardWidthStep(e.key);
    if (step === null) return;
    e.preventDefault();
    setListWidth(clampDragWidth(effectiveWidth + step, window.innerWidth, narrowMinWidth, detailMinWidth));
  }, [effectiveWidth, narrowMinWidth, detailMinWidth]);

  const railShown = collapsible && hasDetail && !shouldShowList(hasDetail, collapsed);
  const listNode = typeof list === 'function' ? list({ collapsed, toggleCollapsed }) : list;

  return (
    <div className="flex-1 min-h-0 flex overflow-hidden">
      {railShown ? (
        // Eingeklappt (nur im Detail-Modus): schmale Leiste zum Wiedereinblenden.
        // Das Detail-Panel daneben (flex-1) nimmt den frei werdenden Platz.
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsedRailLabel}
          title={collapsedRailLabel}
          className="shrink-0 w-8 h-full flex flex-col items-center gap-3 py-3 cursor-pointer bg-[var(--tf-bg)] hover:bg-[var(--tf-bg-secondary)] transition-colors"
          style={{ borderRight: '0.5px solid var(--tf-border)' }}
        >
          <PanelLeftOpen size={16} className="text-[var(--tf-text-tertiary)]" />
          <span className="text-[11px] text-[var(--tf-text-secondary)] tracking-wide [writing-mode:vertical-rl] rotate-180">
            {collapsedRailLabel}
          </span>
        </button>
      ) : (
        <div className={listPaneClass(hasDetail)} style={listPaneStyle(hasDetail, effectiveWidth)}>
          <div className="flex-1 min-w-0 h-full overflow-y-auto">{listNode}</div>
          {hasDetail && (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Listenbreite ändern"
              aria-valuenow={effectiveWidth}
              aria-valuemin={narrowMinWidth}
              aria-valuemax={maxListWidth(viewportWidth, narrowMinWidth, detailMinWidth)}
              tabIndex={0}
              onPointerDown={onResizePointerDown}
              onKeyDown={onResizeKeyDown}
              onDoubleClick={() => setListWidth(narrowDefaultWidth)}
              title="Ziehen zum Anpassen · Doppelklick setzt zurück"
              className="group relative shrink-0 w-[4px] h-full cursor-col-resize hover:bg-[var(--tf-border-hover)] transition-colors focus:outline-none"
              style={{ borderLeft: '0.5px solid var(--tf-border)' }}
            >
              {/* Trefferzone greift über den 4px-Streifen hinaus, ohne den Fluss
                  zu verschieben (absolut, daher ohne Layout-Wirkung). */}
              <span className="absolute -inset-x-1.5 inset-y-0" />
              {/* Dauerhaft sichtbare Griff-Marke — dieselbe Sprache wie
                  ZweiSpaltenResizable: erst dadurch ist der Resize auffindbar. */}
              <span
                aria-hidden
                className="absolute left-1/2 top-1/2 h-10 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--tf-border)] transition-colors group-hover:bg-[var(--tf-primary)] group-focus-visible:bg-[var(--tf-primary)]"
              />
            </div>
          )}
        </div>
      )}
      {hasDetail && (
        <div className="flex-1 min-w-0 h-full overflow-hidden">{detail}</div>
      )}
    </div>
  );
}
