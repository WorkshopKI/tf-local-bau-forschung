/**
 * Persistenter Collapsed-Zustand des Archiv-Abschnitts („Abgeschlossen") im
 * „Alle"-Tab (Journey-Paket 2 Phase 5).
 *
 * Genau EIN Boolean: der Arbeitsvorrat („In Arbeit") ist immer offen, nur das
 * Archiv klappt ein. Default = eingeklappt (der aktive Workflow steht oben,
 * das Archiv ist bei Bedarf einen Klick entfernt). Sobald der User es
 * aufklappt, gewinnt sein Wille beim nächsten Load.
 *
 * Bewusst ein eigener Store statt `useStatusSectionCollapsed`: Letzterer ist
 * per `StatusPhaseLabel` (Offen/NF/Bewilligt/… ) gekeyt und trägt eine
 * Phase-spezifische Migration — der binäre Arbeitsvorrat/Archiv-Split hat eine
 * andere Semantik und würde das Label „Abgeschlossen" kollidieren lassen.
 *
 * Persistenz: localStorage `teamflow_antraege_archiv_collapsed` ('1'|'0').
 */
import { create } from 'zustand';

const STORAGE_KEY = 'teamflow_antraege_archiv_collapsed';

function loadCollapsed(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return true; // Default: Archiv eingeklappt
    return raw === '1';
  } catch {
    return true;
  }
}

function saveCollapsed(v: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, v ? '1' : '0');
  } catch {
    /* ignore quota / unavailable */
  }
}

interface ArbeitsvorratCollapsedState {
  archivCollapsed: boolean;
  toggle: () => void;
  setCollapsed: (v: boolean) => void;
}

export const useArbeitsvorratCollapsed = create<ArbeitsvorratCollapsedState>((set, get) => ({
  archivCollapsed: loadCollapsed(),
  toggle: () => {
    const next = !get().archivCollapsed;
    saveCollapsed(next);
    set({ archivCollapsed: next });
  },
  setCollapsed: (v) => {
    saveCollapsed(v);
    set({ archivCollapsed: v });
  },
}));
