/**
 * Reine Persistenz-Helfer für das andockende Assistenten-Panel der Suche
 * (Phase 4). Analog zu [listCollapse.ts](../antraege/listCollapse.ts): Parser/
 * Serializer ohne React/localStorage, damit sie unter `environment:'node'`
 * unit-testbar sind. Die Seite hält den State und persistiert selbst.
 */

import { clampDragWidth, effectiveListWidth } from '@/components/master-detail';

export const ASSISTENT_OPEN_KEY = 'teamflow_suche_assistent_open';
export const ASSISTENT_WIDTH_KEY = 'teamflow_suche_assistent_width';

export const ASSISTENT_DEFAULT_WIDTH = 380;
export const ASSISTENT_MIN_WIDTH = 300;
/**
 * Mindestbreite, die der Ergebnis-Tabelle beim Aufziehen des Panels erhalten
 * bleibt (analog `detailMinWidth` in Förderanträge). Der Panel-Max ist damit
 * dynamisch `viewport − ASSISTENT_TABELLE_MIN` statt eines festen Deckels —
 * das Panel lässt sich fast bis zum Rand ziehen, die Tabelle verschwindet nie.
 */
export const ASSISTENT_TABELLE_MIN = 360;

/** Rohwert aus localStorage → Bool. Default (unbekannt/leer) = zu. */
export function parseAssistentOpen(raw: string | null): boolean {
  return raw === '1';
}

/** Bool → persistierbarer Rohwert. */
export function serializeAssistentOpen(open: boolean): string {
  return open ? '1' : '0';
}

/** Roh erdraggte Breite klemmen: `[MIN, viewport − TABELLE_MIN]` (dynamischer Max). */
export function clampAssistentWidth(v: number, viewportWidth: number): number {
  return clampDragWidth(v, viewportWidth, ASSISTENT_MIN_WIDTH, ASSISTENT_TABELLE_MIN);
}

/** Persistierte Breite beim Rendern gegen das aktuelle Fenster klemmen. */
export function effectiveAssistentWidth(width: number, viewportWidth: number): number {
  return effectiveListWidth(width, viewportWidth, ASSISTENT_MIN_WIDTH, ASSISTENT_TABELLE_MIN);
}

/**
 * Rohwert → gültige Breite; ungültig/zu klein → Default. Kein fester Oberbound
 * mehr — eine zu breite gespeicherte Breite deckelt die Render-Klemme
 * (`effectiveAssistentWidth`) gegen das aktuelle Fenster.
 */
export function parseAssistentWidth(raw: string | null): number {
  const v = Number(raw);
  if (!Number.isFinite(v) || v < ASSISTENT_MIN_WIDTH) {
    return ASSISTENT_DEFAULT_WIDTH;
  }
  return v;
}
