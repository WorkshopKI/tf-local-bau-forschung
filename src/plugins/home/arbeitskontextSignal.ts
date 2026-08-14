/**
 * Ein Zähler, der sagt: „das Arbeitskontext-Log hat sich geändert".
 *
 * `useWeitermachenRows` liest das Log in einem Effekt mit den Abhängigkeiten
 * IDB + Antrags-Store — beides bleibt gleich, wenn jemand den Verlauf LÖSCHT.
 * Ohne dieses Signal stünde die Karte „Weiter, wo du aufgehört hast" nach dem
 * Löschen unverändert da, bis die Seite neu mountet: eine Aktion ohne sichtbare
 * Wirkung (vgl. [[toter-cta-ist-symptom]]).
 *
 * Bewusst ein Zähler statt der Daten selbst — dasselbe Muster wie
 * `csv-sources-signal`: die Wahrheit bleibt die IDB, hier steht nur der Anlass,
 * sie neu zu lesen.
 */
import { create } from 'zustand';

interface ArbeitskontextSignalState {
  stand: number;
  /** Nach jedem Schreiben/Löschen des Logs aufrufen. */
  bump: () => void;
}

export const useArbeitskontextSignal = create<ArbeitskontextSignalState>(set => ({
  stand: 0,
  bump: () => set(s => ({ stand: s.stand + 1 })),
}));
