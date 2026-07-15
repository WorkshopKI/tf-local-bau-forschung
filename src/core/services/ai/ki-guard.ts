/**
 * Preflight-Guard für KI-abhängige CTAs + app-weiter „Interne KI verbinden"-Prompt.
 *
 * Problem: Ein KI-CTA (z. B. „KI-Aufbereitung starten") ohne verbundene interne KI
 * öffnete stillschweigend einen KI-Tab und lief in eine lange Retry-Schleife
 * (`submitMessage` → `ensureConnection` → `window.open` + Idle-Timeout). Stattdessen:
 * vor dem Lauf prüfen und — falls nicht erreichbar — EINEN app-weiten Dialog öffnen,
 * der das Verbinden anbietet, und die Aktion sauber abbrechen.
 *
 * Der Dialog-Zustand lebt in einem winzigen Store (ein Dialog, von jedem CTA
 * auslösbar); gerendert wird er einmalig via `KiConnectPromptDialog` im ShellLayout.
 * Importiert nur `zustand` + den Status-Store (keine Kante zurück nach `ai/bridge`).
 */
import { create } from 'zustand';
import type { AIBridge } from './bridge';
import { useBridgeStatus } from './bridge-status';

interface KiConnectPromptStore {
  offen: boolean;
  oeffnen: () => void;
  schliessen: () => void;
}

export const useKiConnectPrompt = create<KiConnectPromptStore>((set) => ({
  offen: false,
  oeffnen: () => set({ offen: true }),
  schliessen: () => set({ offen: false }),
}));

/**
 * Ist die interne KI für einen sofort startenden KI-Lauf bereit? `true` = darf laufen;
 * `false` = nicht erreichbar → app-weiter Verbinden-Prompt geöffnet, Aufrufer bricht ab.
 *
 * Nur der Streamlit-Bridge-Transport braucht einen offenen KI-Tab. Stateless-API-
 * Transporte (OpenRouter/DirectLLM) sind ohne Tab erreichbar → nie blocken. Bei der
 * Bridge: `connected` erlaubt; sonst erlaubt, wenn bereits ein KI-Tab offen ist (Ping
 * folgt), andernfalls Prompt.
 */
export function kiVerbindungBereit(bridge: AIBridge): boolean {
  const transport = bridge.getActiveTransport();
  if (transport.name !== 'Streamlit') return true;
  if (useBridgeStatus.getState().status === 'connected') return true;
  if (transport.hasLiveBridgeWindow?.()) return true;
  useKiConnectPrompt.getState().oeffnen();
  return false;
}
