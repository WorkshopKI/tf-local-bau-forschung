/**
 * Reine Persistenz-Helfer für das andockende Assistenten-Panel der Suche
 * (Phase 4). Analog zu [listCollapse.ts](../antraege/listCollapse.ts): Parser/
 * Serializer ohne React/localStorage, damit sie unter `environment:'node'`
 * unit-testbar sind.
 *
 * Seit v3.50 liegt der Offen-/Breiten-Zustand zusätzlich in einem Vanilla-
 * zustand-Store (`sucheAssistentUiStore`, Vorbild
 * [panelUiStore.ts](../chat/assistent/panelUiStore.ts)): die Spine am rechten
 * Blattrand wird vom ShellLayout gerendert, das Panel von der Suchseite — beide
 * brauchen denselben Schalter. Die reinen Helfer bleiben die Quelle der Logik,
 * der Store ruft sie nur auf.
 */

import { createStore } from 'zustand/vanilla';
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

function readLs(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

function writeLs(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

export interface SucheAssistentUiState {
  open: boolean;
  /** ROH gespeicherte Breite — gegen das aktuelle Fenster klemmt erst
   *  `effectiveAssistentWidth` beim Rendern (ein kleineres Fenster darf die
   *  gemerkte Breite nicht dauerhaft schrumpfen). */
  width: number;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  setWidth: (w: number) => void;
}

/**
 * UI-Zustand des Suche-Panels. Vanilla-Store (kein React-Hook), damit ihn das
 * ShellLayout für die Spine lesen kann, ohne von der Suchseite abzuhängen.
 */
export const sucheAssistentUiStore = createStore<SucheAssistentUiState>((set, get) => ({
  open: parseAssistentOpen(readLs(ASSISTENT_OPEN_KEY)),
  width: parseAssistentWidth(readLs(ASSISTENT_WIDTH_KEY)),
  setOpen: (open) => {
    writeLs(ASSISTENT_OPEN_KEY, serializeAssistentOpen(open));
    set({ open });
  },
  toggle: () => {
    const next = !get().open;
    writeLs(ASSISTENT_OPEN_KEY, serializeAssistentOpen(next));
    set({ open: next });
  },
  setWidth: (w) => {
    writeLs(ASSISTENT_WIDTH_KEY, String(w));
    set({ width: w });
  },
}));
