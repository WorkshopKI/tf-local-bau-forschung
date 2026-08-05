/**
 * Persistenter Zuklapp-Zustand je Status-Abschnitt.
 *
 * Wird vom geteilten `StatusSectionHeader` + den Listen-Renderern (CardGrid,
 * GroupedList) gelesen. Gilt nur bei `Gruppiert: Status` — andere
 * Gruppierungsmodi rendern keine Sections. Globale Wahl, nicht pro View: die
 * Abschnitte sind in allen Sichten dieselben.
 *
 * **Gekeyt wird über die Abschnitts-Id, nicht über den Anzeigenamen** (v2.409).
 * Vorher standen die Namen selbst hier drin („Abgeschlossen",
 * „Abgelehnt/Zurückgezogen"), samt einer Migration, die beim Hinzukommen eines
 * Abschnitts nachrüstete. Namen als Schlüssel zu führen war die eigentliche
 * Ursache dieser Migration — mit stabilen Ids ist eine Umbenennung folgenlos.
 *
 * Der Umstieg selbst läuft **ohne** Migration: alte Einträge tragen Namen, die
 * keiner Id entsprechen, und werden beim Lesen verworfen. Der gespeicherte
 * Zuklapp-Zustand geht damit einmalig verloren und stellt sich auf die Defaults
 * zurück. Bei einer Handvoll Erprobungs-Nutzern ist das die ehrlichere Lösung
 * als eine Migration, die für immer im Code stehen bleibt.
 *
 * Persistenz: localStorage unter `teamflow_antraege_status_collapsed`.
 */
import { create } from 'zustand';
import { STATUS_SECTION_ORDER, type StatusSectionId } from './antragGroups';

const STORAGE_KEY = 'teamflow_antraege_status_collapsed';

/** Abschnitte, die beim ersten Start zugeklappt sind. Reihenfolge egal (Set). */
const FIRST_LOAD_DEFAULTS: StatusSectionId[] = ['beendet', 'abgelehnt-zurueckgezogen'];

function istAbschnittsId(v: unknown): v is StatusSectionId {
  return typeof v === 'string' && (STATUS_SECTION_ORDER as readonly string[]).includes(v);
}

function loadCollapsed(): Set<StatusSectionId> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      // Erst-Initialisierung: die beiden Abschnitte enthalten bei typischer
      // Datenmenge 100+ Anträge und sind für den aktiven Workflow selten
      // relevant. Sobald der User sie aufklappt, gewinnt sein Wille.
      return new Set(FIRST_LOAD_DEFAULTS);
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    const ids = parsed.filter(istAbschnittsId);
    // Nur Namen aus der Zeit vor v2.409 im Speicher: wie einen frischen Start
    // behandeln, statt mit einem leeren Set alles aufgeklappt zu zeigen.
    if (ids.length === 0 && parsed.length > 0) return new Set(FIRST_LOAD_DEFAULTS);
    return new Set(ids);
  } catch {
    return new Set();
  }
}

function saveCollapsed(set: Set<StatusSectionId>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    /* ignore quota / unavailable */
  }
}

interface StatusSectionCollapsedState {
  collapsed: Set<StatusSectionId>;
  toggle: (id: StatusSectionId) => void;
  isCollapsed: (id: StatusSectionId) => boolean;
}

export const useStatusSectionCollapsed = create<StatusSectionCollapsedState>((set, get) => ({
  collapsed: loadCollapsed(),
  toggle: (id) => {
    const next = new Set(get().collapsed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    saveCollapsed(next);
    set({ collapsed: next });
  },
  isCollapsed: (id) => get().collapsed.has(id),
}));
