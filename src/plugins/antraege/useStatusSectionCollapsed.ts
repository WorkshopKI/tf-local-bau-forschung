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
/** Sentinel-Marker fuer die einmalige Migration auf das neue Phase-Set
 *  (Einfuehrung von 'Abgelehnt/Zurückgezogen'). Existierende User haben
 *  bereits einen STORAGE_KEY-Wert, koennen aber das neue Label dort nicht
 *  drinhaben — wir mergen es einmal beim ersten Load nach Update, danach
 *  greift der normale Toggle-Pfad. Marker bleibt gesetzt = keine Re-Migration. */
const MIGRATION_MARKER_KEY = 'teamflow_antraege_status_collapsed_v2_migrated';

/** Sections, die beim ersten App-Start fuer einen frischen User
 *  default-collapsed sind. Reihenfolge irrelevant (Set). */
const FIRST_LOAD_DEFAULTS: StatusPhaseLabel[] = [
  'Abgeschlossen',
  'Abgelehnt/Zurückgezogen',
];

function loadCollapsed(): Set<StatusPhaseLabel> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      // Erst-Initialisierung: defaultmaessig zugeklappte Sections. Die
      // Sektionen enthalten bei typischer Datenmenge 100+ Antraege und sind
      // fuer den aktiven Workflow selten relevant. Sobald der User sie
      // aufklappt, wird sein Wille via saveCollapsed() persistiert und
      // gewinnt beim naechsten Load.
      const initial = new Set<StatusPhaseLabel>(FIRST_LOAD_DEFAULTS);
      try { localStorage.setItem(MIGRATION_MARKER_KEY, '1'); } catch { /* ignore */ }
      return initial;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    const existing = new Set(parsed.filter((v): v is StatusPhaseLabel => typeof v === 'string'));
    // Einmal-Migration: bestehender User mit gefuelltem STORAGE_KEY hat
    // die neue Phase noch nie gesehen — einmal default-collapsen, damit
    // sie auch nach dem Update zugeklappt erscheint.
    const migrated = localStorage.getItem(MIGRATION_MARKER_KEY) === '1';
    if (!migrated) {
      existing.add('Abgelehnt/Zurückgezogen');
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...existing]));
        localStorage.setItem(MIGRATION_MARKER_KEY, '1');
      } catch { /* ignore */ }
    }
    return existing;
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
