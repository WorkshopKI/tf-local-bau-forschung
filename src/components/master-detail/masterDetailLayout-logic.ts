/**
 * Pure, datenagnostische Logik des Master-Detail-Shells — bewusst ohne React-
 * Rendering ausgelagert, damit sie unter `environment: 'node'` (kein RTL/jsdom
 * im Projekt) unit-testbar ist (vgl. core/components/guided-grant-progress.ts).
 * Destilliert aus dem Förderanträge-`narrow`-Muster (AntraegeMain.tsx).
 */
import type { CSSProperties } from 'react';

/**
 * Anzeige-Breite der Listen-Sidebar im Detail-Modus: die persistierte Breite,
 * aber nie so breit, dass dem Detail-Panel weniger als `detailMinWidth` bleibt
 * (oberes Cap = `viewport − detailMinWidth`, Floor = `narrowMinWidth`).
 */
export function effectiveListWidth(
  width: number,
  viewportWidth: number,
  narrowMinWidth: number,
  detailMinWidth: number,
): number {
  return Math.min(width, Math.max(narrowMinWidth, viewportWidth - detailMinWidth));
}

/**
 * Klemmt eine roh erdraggte Breite in die zulässigen Grenzen
 * `[narrowMinWidth, max(narrowMinWidth, viewport − detailMinWidth)]`.
 */
export function clampDragWidth(
  rawWidth: number,
  viewportWidth: number,
  narrowMinWidth: number,
  detailMinWidth: number,
): number {
  const dynMax = Math.max(narrowMinWidth, viewportWidth - detailMinWidth);
  return Math.min(dynMax, Math.max(narrowMinWidth, rawWidth));
}

/** Container-Klasse der Listen-Spalte: fixe Sidebar im Detail-Modus, sonst voll. */
export function listPaneClass(hasDetail: boolean): string {
  return hasDetail ? 'h-full flex' : 'flex-1 min-w-0 h-full flex';
}

/** Container-Style der Listen-Spalte: feste Breite (shrink 0) nur im Detail-Modus. */
export function listPaneStyle(hasDetail: boolean, effectiveWidth: number): CSSProperties | undefined {
  return hasDetail ? { width: effectiveWidth, flexShrink: 0, position: 'relative' } : undefined;
}

const EDITABLE_TAGS: ReadonlySet<string> = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/**
 * Soll ein Escape-Tastendruck das Detail schließen? Nein, wenn der Fokus in
 * einem Eingabefeld liegt (Tippen im Editor soll nicht das ganze Detail
 * zuklappen) — sonst ja.
 */
export function shouldCloseOnEscape(
  targetTagName: string | null | undefined,
  isContentEditable: boolean,
): boolean {
  if (isContentEditable) return false;
  if (targetTagName && EDITABLE_TAGS.has(targetTagName.toUpperCase())) return false;
  return true;
}
