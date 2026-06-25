/**
 * Bridge-Verbindungsstatus (interne KI / Streamlit-Bridge).
 *
 * Zentrale Status-Quelle fuer die Anzeige „verbunden / getrennt" der internen KI.
 * Der `StreamlitBridgeTransport` aktualisiert den Store bei jedem Inbound-Signal
 * (tf-bridge-ready / tf-pong / tf-app-ping / tf-stream / tf-response → `markActivity`)
 * und bei Ping-Timeout / geschlossenem Tab (`setConnected(false)`). Homepage-Karte,
 * Sidebar-Indikator und der Trennungs-Hinweis lesen daraus — kein manueller
 * „Verbindung testen"-Klick mehr noetig.
 *
 * Importiert NUR `zustand` → keine Kante zurueck nach `ai/` (kein Import-Zyklus
 * mit dem Transport, der diesen Store importiert).
 */

import { create } from 'zustand';

export type BridgeStatus = 'connected' | 'disconnected' | 'unknown';

export interface BridgeStatusState {
  /** `'unknown'` = Boot-Zustand bevor je ein KI-Tab offen war (grau, kein falsches Rot). */
  status: BridgeStatus;
  /** Timestamp (Date.now()) des letzten Inbound-Signals. null = nie gesehen. */
  lastSeen: number | null;
}

const INITIAL: BridgeStatusState = { status: 'unknown', lastSeen: null };

interface BridgeStatusStore extends BridgeStatusState {
  /** Inbound-Signal vom Bookmarklet (ready/pong/app-ping/stream/response) → verbunden. */
  markActivity: () => void;
  /** Aktiv festgelegter Verbindungszustand (Heartbeat / Ping-Timeout). */
  setConnected: (connected: boolean) => void;
  /** Reset auf `'unknown'` (URL-Wechsel: alte Verbindung gilt nicht mehr). */
  reset: () => void;
}

export const useBridgeStatus = create<BridgeStatusStore>((set) => ({
  ...INITIAL,

  markActivity: () => set({ status: 'connected', lastSeen: Date.now() }),

  // Bei `false` `lastSeen` bewusst NICHT anfassen (haelt „zuletzt gesehen vor …"
  // fuer einen spaeteren Tooltip).
  setConnected: (connected) =>
    set(connected
      ? { status: 'connected', lastSeen: Date.now() }
      : { status: 'disconnected' }),

  reset: () => set({ ...INITIAL }),
}));
