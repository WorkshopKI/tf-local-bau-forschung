/**
 * Pure, datenagnostische Logik für das Einklappen der Antrags-Liste im
 * Detail-Modus — bewusst ohne React ausgelagert, damit sie unter
 * `environment: 'node'` unit-testbar ist (vgl. masterDetailLayout-logic.ts).
 *
 * Die Förderanträge-Seite nutzt einen eigenen 3-Pane-Split (kein
 * MasterDetailLayout). Der Collapse-Zustand liegt additiv NEBEN der
 * persistierten Listenbreite (`teamflow_antraege_narrow_width`).
 */

/** localStorage-Key für das Collapse-Flag der Antrags-Liste. */
export const ANTRAEGE_LIST_COLLAPSED_KEY = 'teamflow_antraege_list_collapsed';

/** Rohwert aus localStorage → Bool. Default (unbekannt/leer) = ausgeklappt. */
export function parseCollapsedFlag(raw: string | null): boolean {
  return raw === '1';
}

/** Bool → persistierbarer Rohwert. */
export function serializeCollapsedFlag(collapsed: boolean): string {
  return collapsed ? '1' : '0';
}

/**
 * Soll die Liste gerendert werden? Eingeklappt wird nur im Detail-Modus —
 * ohne Detail füllt die Liste ohnehin die volle Breite, da gibt es nichts
 * einzuklappen.
 */
export function shouldShowList(hasDetail: boolean, collapsed: boolean): boolean {
  return !hasDetail || !collapsed;
}
