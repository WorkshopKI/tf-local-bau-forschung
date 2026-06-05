/**
 * Geteilter, persistenter Schalter „Inaktive MAs einblenden".
 *
 * Wirkt im „alle"-Modus (kein Kürzel-Filter) der pl/dev-Variante an zwei
 * Stellen, die denselben State reaktiv teilen müssen:
 * - Einstellungen → Profil: blendet inaktive MAs als Dropdown-Optionen ein
 *   (`useKuerzelFilterOptions`-Caller).
 * - Förderanträge-Liste + Home: blendet Anträge inaktiver MAs ein
 *   (`applyInaktiveExclusion`).
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
