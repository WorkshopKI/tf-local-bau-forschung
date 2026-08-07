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
  // Der Boden wird MIT geklemmt (bis v3.19 nur das Cap): mit einer Vorgabe von
  // rechts (`startListWidth`) kann die Rechnung „Fenster − Detailbreite" an
  // einem engen Fenster unter `narrowMinWidth` fallen. Für die bisherigen
  // Aufrufer ändert sich nichts — deren Werte lagen schon immer darüber.
  const cap = maxListWidth(viewportWidth, narrowMinWidth, detailMinWidth);
  return Math.min(Math.max(width, narrowMinWidth), cap);
}

/**
 * Startbreite der Liste, solange niemand am Trenner gezogen hat.
 *
 * Zwei Vorgabe-RICHTUNGEN, weil es zwei Sorten Seiten gibt:
 * - von LINKS (`narrowDefaultWidth`): die Liste ist eine schmale Sidebar, das
 *   Detail bekommt den Rest — der Normalfall (Tabelle + Editor).
 * - von RECHTS (`detailDefaultWidth`): das Detail ist die schmale Spur, die
 *   Liste bekommt den Rest — für Master-Ansichten, die selbst Platz brauchen
 *   (Board mit Spalten). Ohne gespeicherte Breite wächst die Liste dann mit dem
 *   Fenster, statt bei einem einmal gesetzten Pixelwert stehenzubleiben.
 *
 * Das Ergebnis geht durch `effectiveListWidth` und wird dort geklemmt.
 */
export function startListWidth(
  stored: number | null,
  viewportWidth: number,
  narrowDefaultWidth: number,
  detailDefaultWidth?: number,
): number {
  if (stored !== null) return stored;
  if (detailDefaultWidth === undefined) return narrowDefaultWidth;
  return viewportWidth - detailDefaultWidth;
}

/**
 * Oberes Limit der Listenbreite: dem Detail-Panel bleibt immer `detailMinWidth`
 * — außer der Viewport ist so schmal, dass schon `narrowMinWidth` mehr fordert.
 */
export function maxListWidth(
  viewportWidth: number,
  narrowMinWidth: number,
  detailMinWidth: number,
): number {
  return Math.max(narrowMinWidth, viewportWidth - detailMinWidth);
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
  const dynMax = maxListWidth(viewportWidth, narrowMinWidth, detailMinWidth);
  return Math.min(dynMax, Math.max(narrowMinWidth, rawWidth));
}

/**
 * Breiten-Schritt einer Pfeiltaste am Trenn-Griff (px), `null` für jede andere
 * Taste (= Event nicht abfangen).
 *
 * Richtung beachten: der Griff sitzt an der RECHTEN Kante der Liste → `→` macht
 * die Liste breiter, `←` schmaler. In `ZweiSpaltenResizable` ist es genau
 * andersherum, weil der Griff dort links der Seitenspalte sitzt.
 */
export function keyboardWidthStep(key: string): number | null {
  if (key === 'ArrowRight') return 16;
  if (key === 'ArrowLeft') return -16;
  return null;
}

/** Container-Klasse der Listen-Spalte: fixe Sidebar im Detail-Modus, sonst voll. */
export function listPaneClass(hasDetail: boolean): string {
  return hasDetail ? 'h-full flex' : 'flex-1 min-w-0 h-full flex';
}

/** Container-Style der Listen-Spalte: feste Breite (shrink 0) nur im Detail-Modus. */
export function listPaneStyle(hasDetail: boolean, effectiveWidth: number): CSSProperties | undefined {
  return hasDetail ? { width: effectiveWidth, flexShrink: 0, position: 'relative' } : undefined;
}

/**
 * Opt-in Collapse-to-Rail (Liste vollständig auf eine schmale Leiste einklappen,
 * additiv neben dem Resize). Reine Helfer wie in `antraege/listCollapse.ts` —
 * node-testbar.
 */

/** Rohwert aus localStorage → Bool. Default (unbekannt/leer) = ausgeklappt. */
export function parseCollapsedFlag(raw: string | null): boolean {
  return raw === '1';
}

/** Bool → persistierbarer Rohwert. */
export function serializeCollapsedFlag(collapsed: boolean): string {
  return collapsed ? '1' : '0';
}

/**
 * Soll die Liste gerendert werden (statt der schmalen Leiste)? Eingeklappt wird
 * nur im Detail-Modus — ohne Detail füllt die Liste ohnehin die volle Breite.
 */
export function shouldShowList(hasDetail: boolean, collapsed: boolean): boolean {
  return !hasDetail || !collapsed;
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
