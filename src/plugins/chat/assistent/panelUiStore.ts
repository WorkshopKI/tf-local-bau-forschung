/**
 * Assistent-Panel (Phase 1) — UI-Zustand des shell-weiten Docks (offen/Breite).
 *
 * Getrennt von der session-only Konversation ([[sessionStore]]): das ist reine
 * UI-Präferenz (wie die Sidebar-Breite) und darf über den Reload persistieren
 * (localStorage) — NICHT die Historie. Vanilla zustand, damit das Suche-Panel und
 * die Command-Palette dasselbe Dock togglen können wie das Shell-Mount.
 */
import { createStore } from 'zustand/vanilla';

const OPEN_KEY = 'teamflow_assistent_panel_open';
const WIDTH_KEY = 'teamflow_assistent_panel_width';
export const PANEL_DEFAULT_WIDTH = 400;
export const PANEL_MIN_WIDTH = 320;
export const PANEL_MAX_WIDTH = 640;

/**
 * Breite der dauerhaften Dock-Spine am rechten Blattrand. Single Source für
 * beide Verbraucher: den reservierten `<main>`-Rand (ShellLayout) und den
 * Overlay-Offset des geöffneten Panels (AssistentPanelHost) — dürfen nie
 * auseinanderlaufen, sonst überlappt die Spine den Inhalt bzw. lässt eine Lücke.
 */
export const SPINE_WIDTH = 28;

export function clampPanelWidth(w: number): number {
  return Math.min(PANEL_MAX_WIDTH, Math.max(PANEL_MIN_WIDTH, Math.round(w)));
}

function loadOpen(): boolean {
  try { return localStorage.getItem(OPEN_KEY) === '1'; } catch { return false; }
}
function loadWidth(): number {
  try {
    const n = Number(localStorage.getItem(WIDTH_KEY));
    return Number.isFinite(n) && n > 0 ? clampPanelWidth(n) : PANEL_DEFAULT_WIDTH;
  } catch { return PANEL_DEFAULT_WIDTH; }
}
function persistOpen(open: boolean): void {
  try { localStorage.setItem(OPEN_KEY, open ? '1' : '0'); } catch { /* ignore */ }
}

export interface AssistentPanelUiState {
  open: boolean;
  width: number;
  /**
   * Eine von aussen mitgegebene Frage, die das Panel beim Öffnen in sein
   * Eingabefeld übernimmt (Tagesbrief: „dazu nachfragen").
   *
   * **Transient und bewusst nicht persistiert** — dasselbe Muster wie der
   * `kategorieQuickfilter` der Fördertabelle: sie beschreibt eine Geste, keinen
   * Zustand. Und sie wird **nicht abgeschickt**: der Nutzer sieht die Frage im
   * Feld und löst den einen Aufruf selbst aus.
   */
  vorgabe: string | null;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  setWidth: (w: number) => void;
  /** Panel öffnen und die Frage vorlegen. */
  oeffneMitFrage: (frage: string) => void;
  /** Vom Panel gerufen, sobald es die Vorgabe übernommen hat. */
  vorgabeVerbraucht: () => void;
}

export const assistentPanelUiStore = createStore<AssistentPanelUiState>((set, get) => ({
  open: loadOpen(),
  width: loadWidth(),
  vorgabe: null,
  setOpen: (open) => { persistOpen(open); set({ open }); },
  toggle: () => { const next = !get().open; persistOpen(next); set({ open: next }); },
  oeffneMitFrage: (frage) => { persistOpen(true); set({ open: true, vorgabe: frage }); },
  vorgabeVerbraucht: () => set({ vorgabe: null }),
  setWidth: (w) => {
    const cw = clampPanelWidth(w);
    try { localStorage.setItem(WIDTH_KEY, String(cw)); } catch { /* ignore */ }
    set({ width: cw });
  },
}));
