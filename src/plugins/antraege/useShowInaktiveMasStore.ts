/**
 * Geteilter, persistenter Schalter „Inaktive MAs einblenden".
 *
 * Wirkt im „alle"-Modus (kein Kürzel-Filter) der pl/dev-Variante auf die
 * **Antragsmengen**: Förderanträge-Liste + Home blenden die Anträge inaktiver
 * MAs ein (`applyInaktiveExclusion`). Bedient wird er an zwei Oberflächen
 * (Einstellungen → Profil, Suchzeile der Liste), die denselben State reaktiv
 * teilen müssen.
 *
 * **Nicht** mehr an der Kürzel-Auswahl im Profil (bis v4.46): die führt ehemalige
 * Kolleg:innen seither immer mit — sonst fand sich, wer als inaktiv geführt ist,
 * dort selbst nicht wieder.
 *
 * Persistenz: localStorage `teamflow_show_inaktive_mas`. Muster 1:1 aus
 * `useAntraegeColumnsStore` / `viewModes`.
 */
import { create } from 'zustand';

const KEY = 'teamflow_show_inaktive_mas';

function loadShowInaktive(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

function saveShowInaktive(v: boolean): void {
  try {
    localStorage.setItem(KEY, v ? '1' : '0');
  } catch {
    /* ignore */
  }
}

interface ShowInaktiveMasState {
  showInaktive: boolean;
  setShowInaktive: (v: boolean) => void;
}

export const useShowInaktiveMasStore = create<ShowInaktiveMasState>((set) => ({
  showInaktive: loadShowInaktive(),
  setShowInaktive: (v: boolean) => {
    saveShowInaktive(v);
    set({ showInaktive: v });
  },
}));
