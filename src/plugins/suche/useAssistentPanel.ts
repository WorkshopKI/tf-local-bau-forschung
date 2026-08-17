/**
 * Die Geometrie des andockenden Assistenten-Panels der Suche — Breite, Ziehen,
 * Fensterbreite, Deep-Link.
 *
 * Stand bis v4.86 mitten in `SuchSeite`: rund fünfzig Zeilen Maus- und
 * Fenster-Buchführung zwischen Suchlauf und Trefferaufbereitung. Sie beantworten
 * eine andere Frage als alles andere in dieser Datei („wie breit ist das Panel"
 * statt „was wird gefunden") und ziehen deshalb hierher — die Suchseite reichte
 * beim Wachsen als erstes über die LOC-Schwelle, und das war der Anlass, nicht
 * der Grund.
 *
 * **Nicht in [assistentPanel.ts](./assistentPanel.ts)**: das Modul ist
 * ausdrücklich React-frei, damit seine Klemm- und Parse-Helfer unter
 * `environment:'node'` testbar bleiben. Ein Hook darin nähme ihm genau das.
 * Dort wohnt die Rechnung, hier ihre Verdrahtung.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStore } from 'zustand';
import { clampAssistentWidth, sucheAssistentUiStore } from './assistentPanel';

export interface AssistentPanelGeometrie {
  open: boolean;
  /** ROH gemerkte Breite — gegen das Fenster klemmt erst `effectiveAssistentWidth`. */
  width: number;
  /** Aktuelle Fensterbreite, damit die Render-Klemme mitwandert. */
  viewportWidth: number;
  close: () => void;
  /** `onMouseDown` des senkrechten Ziehgriffs. */
  onResize: (e: React.MouseEvent) => void;
}

export function useAssistentPanel(): AssistentPanelGeometrie {
  const [searchParams, setSearchParams] = useSearchParams();
  const open = useStore(sucheAssistentUiStore, s => s.open);
  const width = useStore(sucheAssistentUiStore, s => s.width);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1440);

  useEffect(() => {
    const handler = (): void => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // `?assistent=1` öffnet das Panel und räumt sich danach aus der Adresse: der
  // Parameter ist ein Auftrag, kein Zustand — bliebe er stehen, ginge das Panel
  // bei jedem Zurück wieder auf.
  useEffect(() => {
    if (searchParams.get('assistent') !== '1') return;
    sucheAssistentUiStore.getState().setOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete('assistent');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const close = useCallback((): void => {
    sucheAssistentUiStore.getState().setOpen(false);
  }, []);

  const onResize = useCallback((e: React.MouseEvent): void => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startWidth: width };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const onMove = (ev: MouseEvent): void => {
      const drag = dragRef.current;
      if (!drag) return;
      sucheAssistentUiStore.getState().setWidth(
        clampAssistentWidth(drag.startWidth + (drag.startX - ev.clientX), window.innerWidth),
      );
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

  return { open, width, viewportWidth, close, onResize };
}
