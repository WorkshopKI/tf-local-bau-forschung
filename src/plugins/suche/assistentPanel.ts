/**
 * Reine Persistenz-Helfer für das andockende Assistenten-Panel der Suche
 * (Phase 4). Analog zu [listCollapse.ts](../antraege/listCollapse.ts): Parser/
 * Serializer ohne React/localStorage, damit sie unter `environment:'node'`
 * unit-testbar sind. Die Seite hält den State und persistiert selbst.
 */

export const ASSISTENT_OPEN_KEY = 'teamflow_suche_assistent_open';
export const ASSISTENT_WIDTH_KEY = 'teamflow_suche_assistent_width';

export const ASSISTENT_DEFAULT_WIDTH = 380;
export const ASSISTENT_MIN_WIDTH = 300;
export const ASSISTENT_MAX_WIDTH = 560;

/** Rohwert aus localStorage → Bool. Default (unbekannt/leer) = zu. */
export function parseAssistentOpen(raw: string | null): boolean {
  return raw === '1';
}

/** Bool → persistierbarer Rohwert. */
export function serializeAssistentOpen(open: boolean): string {
  return open ? '1' : '0';
}

/** Breite in den erlaubten Bereich klemmen. */
export function clampAssistentWidth(v: number): number {
  return Math.min(ASSISTENT_MAX_WIDTH, Math.max(ASSISTENT_MIN_WIDTH, v));
}

/** Rohwert → gültige Breite; ungültig/außerhalb → Default. */
export function parseAssistentWidth(raw: string | null): number {
  const v = Number(raw);
  if (!Number.isFinite(v) || v < ASSISTENT_MIN_WIDTH || v > ASSISTENT_MAX_WIDTH) {
    return ASSISTENT_DEFAULT_WIDTH;
  }
  return v;
}
