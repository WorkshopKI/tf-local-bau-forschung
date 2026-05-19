/**
 * Persistenter Collapsed-State pro Status-Section-Label.
 *
 * Wird vom geteilten `StatusSectionHeader` + den drei Listen-Renderern
 * (CardGrid, CompactList, GroupedList) gelesen. Gilt nur bei
 * `Gruppiert: Status` — andere Gruppierungsmodi rendern keine Sections.
 *
 * Persistenz: localStorage unter `teamflow_antraege_status_collapsed`
 * (analog zu den Sort/View-Persistenz-Pattern in `store.ts`). Globale Wahl —
 * nicht pro View, weil die Labels (Offen / NF / Bewilligt / …) identisch sind.
 */
import { create } from 'zustand';
import type { StatusPhaseLabel } from './antragGroups';

const STORAGE_KEY = 'teamflow_antraege_status_collapsed';

function loadCollapsed(): Set<StatusPhaseLabel> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      // Erst-Initialisierung: "Abgeschlossen" standardmäßig zugeklappt — die
      // Sektion enthält bei typischer Datenmenge 100+ Anträge und ist für
      // den aktiven Workflow selten relevant. Sobald der User sie aufklappt,
      // wird sein Wille via saveCollapsed() persistiert und gewinnt beim
      // nächsten Load.
      return new Set<StatusPhaseLabel>(['Abgeschlossen']);
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((v): v is StatusPhaseLabel => typeof v === 'string'));
  } catch {
    return new Set();
  }
}

function saveCollapsed(set: Set<StatusPhaseLabel>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    /* ignore quota / unavailable */
  }
}

interface StatusSectionCollapsedState {
  collapsed: Set<StatusPhaseLabel>;
  toggle: (label: StatusPhaseLabel) => void;
  isCollapsed: (label: StatusPhaseLabel) => boolean;
}

export const useStatusSectionCollapsed = create<StatusSectionCollapsedState>((set, get) => ({
  collapsed: loadCollapsed(),
  toggle: (label) => {
    const next = new Set(get().collapsed);
    if (next.has(label)) next.delete(label);
    else next.add(label);
    saveCollapsed(next);
    set({ collapsed: next });
  },
  isCollapsed: (label) => get().collapsed.has(label),
}));
