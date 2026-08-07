/**
 * Der Draht vom Herleitungs-Popover zum aufgeklappten Bereich.
 *
 * Das Info-Icon steckt tief in einer Zell-Renderfunktion der statischen
 * Spaltenregistry ([tableColumns.tsx](../tableColumns.tsx)) — dort gibt es
 * keinen Zeilen-Zustand und keine Hooks. Ein Context spart das Durchreichen
 * durch die Registry, ohne sie zu verbiegen.
 *
 * **Kein Provider heißt: kein Verweis.** Auf der Verbund-Detailseite steht die
 * Verlaufs-Sektion ohnehin auf der Seite; ein Knopf „Ganzen Verlauf zeigen"
 * hätte dort kein Ziel und würde ins Leere führen.
 */
import { createContext, useContext } from 'react';
import type { ReiterId } from './ausklappZustand';

export interface AusklappSteuerung {
  /** Öffnet den Bereich dieser Zeile mit dem gegebenen Reiter. */
  oeffne: (zeilenKey: string, reiter: ReiterId) => void;
}

export const AusklappKontext = createContext<AusklappSteuerung | null>(null);

/** `null` = keine Tabelle mit Ausklappbereich in der Umgebung. */
export function useAusklappSteuerung(): AusklappSteuerung | null {
  return useContext(AusklappKontext);
}
