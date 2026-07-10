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
  setOpen: (open: boolean) => void;
  toggle: () => void;
  setWidth: (w: number) => void;
}

export const assistentPanelUiStore = createStore<AssistentPanelUiState>((set, get) => ({
  open: loadOpen(),
  width: loadWidth(),
  setOpen: (open) => { persistOpen(open); set({ open }); },
  toggle: () => { const next = !get().open; persistOpen(next); set({ open: next }); },
  setWidth: (w) => {
    const cw = clampPanelWidth(w);
    try { localStorage.setItem(WIDTH_KEY, String(cw)); } catch { /* ignore */ }
    set({ width: cw });
  },
}));
