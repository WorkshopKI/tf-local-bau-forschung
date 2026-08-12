/**
 * Was eine Wurzel gerade ist — und wann der Alt-Ordner nur noch ein Rest ist.
 *
 * Die Auswahl der sichtbaren Zeilen steht hier statt in der Komponente, weil
 * zwei Regeln daran hängen, die man dem JSX nicht ansieht:
 *
 * 1. **Der Alt-Ordner bleibt sichtbar, solange sein Slot belegt ist** — auch
 *    wenn er gerade nutzbar ist. Sonst verschwindet er genau in dem Moment, in
 *    dem „Erneut freigeben" geklappt hat, und mit ihm der einzige Weg, ihn
 *    loszuwerden.
 * 2. **Sind alle konfigurierten Gruppen verbunden, ist er abgelöst.** Dann ist
 *    „bitte neu zuordnen" die falsche Ansage: zugeordnet ist längst, übrig ist
 *    nur noch der Verweis auf den alten Ordner.
 *
 * Die Gruppen dagegen verschwinden, sobald aus ihnen gelesen werden kann — sie
 * sind nur so lange eine Aufgabe, wie sie fehlen.
 */

import type {
  UserFoldersRoot,
  PermStateOrMissing,
} from '@/core/services/infrastructure/smb-handle';

export type WurzelLage =
  /** Kein Handle hinterlegt — der Ordner wurde nie gewählt. */
  | 'nicht-verbunden'
  /** Handle da, Berechtigung verfallen (unter `file://` nach jedem Neustart). */
  | 'freigeben'
  /** Lesbar. */
  | 'verbunden';

export function wurzelLage(
  root: UserFoldersRoot,
  zustaende: Record<string, PermStateOrMissing>,
): WurzelLage {
  if (!root.handle) return 'nicht-verbunden';
  return zustaende[root.id] === 'granted' ? 'verbunden' : 'freigeben';
}

/** Kann aus dieser Wurzel gerade gelesen werden? */
export function istNutzbar(
  root: UserFoldersRoot,
  zustaende: Record<string, PermStateOrMissing>,
): boolean {
  return wurzelLage(root, zustaende) === 'verbunden';
}

/**
 * Ist jede konfigurierte Gruppe verbunden — der Alt-Ordner also abgelöst?
 *
 * Ohne konfigurierte Gruppe `false`: einen Nachfolger, der noch nicht
 * existiert, kann nichts ablösen.
 */
export function alleGruppenVerbunden(
  wurzeln: readonly UserFoldersRoot[],
  zustaende: Record<string, PermStateOrMissing>,
): boolean {
  const gruppen = wurzeln.filter(r => !r.legacy);
  return gruppen.length > 0 && gruppen.every(r => istNutzbar(r, zustaende));
}

/**
 * Die Zeilen, die eine Aufgabe tragen: offene Gruppen — und der Alt-Ordner,
 * solange es ihn gibt (Regel 1 im Modul-Kopf).
 */
export function sichtbareWurzeln(
  wurzeln: readonly UserFoldersRoot[],
  zustaende: Record<string, PermStateOrMissing>,
  nurOffene = true,
): UserFoldersRoot[] {
  if (!nurOffene) return [...wurzeln];
  return wurzeln.filter(r => r.legacy || !istNutzbar(r, zustaende));
}
