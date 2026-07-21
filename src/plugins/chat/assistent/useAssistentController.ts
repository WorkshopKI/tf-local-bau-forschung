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
import { useStorage } from '@/core/hooks/useStorage';
import { getOramaDB } from '@/core/services/search/orama-store';
import { isAssistentGedaechtnisEnabled } from '@/config/feature-flags';
import { istProtokollAktiv } from '@/core/services/assistent/protokoll';
import { istGedaechtnisAktiv, ladeAktiveEintraege } from '@/core/services/assistent/gedaechtnis';
import { baueVorhabenDokumente, type RohDokument } from '@/core/services/assistent/vorhaben-dokumente';
import type { KontextEntitaet, VorhabenDokument } from '@/core/services/assistent/kontext';
import type { IDBStore } from '@/core/services/storage';
import type { DocumentFull } from '@/plugins/dokumente/store';
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

/**
 * Dem aktuellen Vorhaben (Verbund) zugeordnete Dokumente über die Tag-Relation
 * (Verbund-ID = `entitaet.id`) laden: `doc:*`-Scan → nur passende → newest-first →
 * deterministisch formatiert (`baueVorhabenDokumente`). Wirft NIE (Turn läuft sonst
 * ohne Dokument-Block). Der Assistent-Transport ist ohnehin intern-only (DSGVO ok).
 */
export async function ladeVorhabenDokumente(
  idb: IDBStore, entitaet: KontextEntitaet | null,
): Promise<ReadonlyArray<VorhabenDokument>> {
  if (!entitaet) return [];
  try {
    const keys = await idb.keys('doc:');
    const roh: Array<RohDokument & { created: string }> = [];
    for (const key of keys) {
      const doc = await idb.get<DocumentFull>(key);
      if (!doc || !Array.isArray(doc.tags) || !doc.tags.includes(entitaet.id)) continue;
      roh.push({ filename: doc.filename, markdown: doc.markdown, tags: doc.tags, created: doc.created ?? '' });
    }
    roh.sort((a, b) => b.created.localeCompare(a.created)); // neueste zuerst (Kappung behält die frischesten)
    return baueVorhabenDokumente(roh, entitaet.id);
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
  /** Bricht den laufenden Turn ab (Bridge kennt kein maxTokens, es gibt keinen Timeout). */
  abbrechen: () => void;
  neueUnterhaltung: () => void;
  clearError: () => void;
  setFeedback: (mid: string, fb: 'up' | 'down') => void;
}

export function useAssistentController(): AssistentController {
  const bridge = useAIBridge();
  const { search } = useSearch();
  const storage = useStorage();
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
      getVorhabenDokumente: (entitaet) => ladeVorhabenDokumente(storage.idb, entitaet),
    };
    await assistentSessionStore.getState().send(frage, deps);
  }, [bridge, search, storage]);

  return {
    messages: state.messages,
    busy: state.busy,
    error: state.error,
    resetWarnung: state.resetWarnung,
    letzteFehlerFrage: state.letzteFehlerFrage,
    send,
    abbrechen: () => assistentSessionStore.getState().abbrechen(),
    neueUnterhaltung: () => assistentSessionStore.getState().neueUnterhaltung(),
    clearError: () => assistentSessionStore.getState().clearError(),
    setFeedback: (mid, fb) => assistentSessionStore.getState().setFeedback(mid, fb),
  };
}
