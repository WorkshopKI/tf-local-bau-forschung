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
   * Eine von aussen mitgegebene Frage, die das Panel beim Öffnen abschickt
   * (Tagesbrief: „dazu nachfragen") — der Klick auf der Karte ist die Geste.
   * Läuft gerade eine Antwort, landet sie stattdessen im Eingabefeld.
   *
   * **Transient und bewusst nicht persistiert** — dasselbe Muster wie der
   * `kategorieQuickfilter` der Fördertabelle: sie beschreibt eine Geste, keinen
   * Zustand.
   */
  vorgabe: string | null;
  /**
   * Der Vorgang, über den die vorgelegte Frage spricht (Verbund-Nummer,
   * ersatzweise Aktenzeichen) — das Subjekt zur Frage.
   *
   * **Andere Lebensdauer als {@link vorgabe}.** Der Text ist verbraucht, sobald
   * er im Eingabefeld steht; der Schlüssel muss das Absenden ÜBERLEBEN (sonst
   * wäre er beim Turn schon wieder weg) und gilt auch für Nachfragen derselben
   * Unterhaltung. Er endet mit `scopeLoeschen()` — bei Routenwechsel und bei
   * „Neue Unterhaltung".
   *
   * Ebenfalls transient: nichts davon wird persistiert.
   */
  vorgabeScope: string | null;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  setWidth: (w: number) => void;
  /** Panel öffnen und die Frage vorlegen — mit dem Vorgang, um den es geht. */
  oeffneMitFrage: (frage: string, scope?: string | null) => void;
  /** Vom Panel gerufen, sobald es die Vorgabe übernommen hat. */
  vorgabeVerbraucht: () => void;
  /** Die geliehene Entität wieder loslassen (Routenwechsel, neue Unterhaltung). */
  scopeLoeschen: () => void;
}

export const assistentPanelUiStore = createStore<AssistentPanelUiState>((set, get) => ({
  open: loadOpen(),
  width: loadWidth(),
  vorgabe: null,
  vorgabeScope: null,
  setOpen: (open) => { persistOpen(open); set({ open }); },
  toggle: () => { const next = !get().open; persistOpen(next); set({ open: next }); },
  oeffneMitFrage: (frage, scope) => {
    persistOpen(true);
    // Ein neuer Aufruf ersetzt den Schlüssel IMMER — auch mit `undefined`. Sonst
    // hinge an einer Frage ohne Subjekt noch das Subjekt der vorigen.
    set({ open: true, vorgabe: frage, vorgabeScope: scope ?? null });
  },
  vorgabeVerbraucht: () => set({ vorgabe: null }),
  scopeLoeschen: () => set({ vorgabeScope: null }),
  setWidth: (w) => {
    const cw = clampPanelWidth(w);
    try { localStorage.setItem(WIDTH_KEY, String(cw)); } catch { /* ignore */ }
    set({ width: cw });
  },
}));
