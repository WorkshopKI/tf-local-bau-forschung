/**
 * Assistent-Panel (Phase 1) — React-Hülle um den session-only Store + Turn-
 * Orchestrator. Verdrahtet die unreinen Abhängigkeiten (gegateter Transport,
 * Kontext-Snapshot, Orama-Retrieval) und exponiert einen schlanken Controller
 * für das Panel. Präsentation + Historien-/Transport-Logik bleiben getrennt.
 */
import { useCallback } from 'react';
import { useStore } from 'zustand';
import { useAIBridge } from '@/core/hooks/useAIBridge';
import { useSearch } from '@/core/hooks/useSearch';
import { getOramaDB } from '@/core/services/search/orama-store';
import { isAssistentGedaechtnisEnabled } from '@/config/feature-flags';
import { istProtokollAktiv } from '@/core/services/assistent/protokoll';
import { istGedaechtnisAktiv, ladeAktiveEintraege } from '@/core/services/assistent/gedaechtnis';
import type { ChatMessage } from '../types';
import { assistentSessionStore } from './sessionStore';
import { baueKontextSnapshot } from './kontextSnapshot';
import type { AssistentTurnDeps } from './turn';

/** Aktive Gedächtnis-Einträge nur bei Flag + BEIDEN Opt-ins (sonst leer). */
export async function ladeAssistentGedaechtnis(): Promise<ReadonlyArray<{ text: string }>> {
  if (!isAssistentGedaechtnisEnabled() || !istProtokollAktiv() || !istGedaechtnisAktiv()) return [];
  try {
    return (await ladeAktiveEintraege()).map(e => ({ text: e.text }));
  } catch {
    return [];
  }
}

export interface AssistentController {
  messages: ChatMessage[];
  busy: boolean;
  error: string | null;
  resetWarnung: boolean;
  letzteFehlerFrage: string | null;
  send: (frage: string) => Promise<void>;
  neueUnterhaltung: () => void;
  clearError: () => void;
  setFeedback: (mid: string, fb: 'up' | 'down') => void;
}

export function useAssistentController(): AssistentController {
  const bridge = useAIBridge();
  const { search } = useSearch();
  const state = useStore(assistentSessionStore);

  const send = useCallback(async (frage: string): Promise<void> => {
    const deps: AssistentTurnDeps = {
      // DSGVO-Gate: intern-only, wirft bei externem Provider (→ Degradation).
      getTransport: () => bridge.getTransportForAssistent(),
      getKontext: () => baueKontextSnapshot(),
      retrieve: async (f) => {
        if (getOramaDB() === null) return null; // Index (noch) nicht geladen → kein Retrieval
        try {
          return await search(f);
        } catch {
          return null; // Retrieval-Fehler degradiert zu „kein Auszug", nicht zum Turn-Fehler
        }
      },
      getGedaechtnis: ladeAssistentGedaechtnis,
    };
    await assistentSessionStore.getState().send(frage, deps);
  }, [bridge, search]);

  return {
    messages: state.messages,
    busy: state.busy,
    error: state.error,
    resetWarnung: state.resetWarnung,
    letzteFehlerFrage: state.letzteFehlerFrage,
    send,
    neueUnterhaltung: () => assistentSessionStore.getState().neueUnterhaltung(),
    clearError: () => assistentSessionStore.getState().clearError(),
    setFeedback: (mid, fb) => assistentSessionStore.getState().setFeedback(mid, fb),
  };
}
