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
import {
  baueVorhabenDokumente, traegtKennung, trefferGehoertZumVorhaben, type RohDokument,
} from '@/core/services/assistent/vorhaben-dokumente';
import type { ZeilenAufgaben } from '@/core/hooks/useBestandsAufgaben';
import type { KontextEntitaet, NutzerRolle, VorgangsAkte } from '@/core/services/assistent/kontext';
import { waehleModellFuerLauf } from '@/core/services/ai/modell-wahl';
import type { BlockId, ZusatzBlock } from './zusatzBloecke';
import type { IDBStore } from '@/core/services/storage';
import type { DocumentFull } from '@/plugins/dokumente/store';
import type { ChatMessage } from '../types';
import { useKiConnectPrompt } from '@/core/services/ai/ki-guard';
import { assistentSessionStore } from './sessionStore';
import { baueKontextSnapshot } from './kontextSnapshot';
import { DEGRADATION_MELDUNG, type AssistentTurnDeps } from './turn';

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
 * Kandidaten der ersten Suchstufe, wenn auf einen Vorgang zugeschnitten wird. Die
 * Vorgabe von 10 reicht dafür nicht: Die globale Suche füllt sie mit den stärksten
 * Treffern des GANZEN Bestands, und nach dem Zuschnitt bliebe fast immer keiner übrig.
 */
const VORGANG_SUCHE_LIMIT = 50;

/** Ein über den Tag zugeordnetes Dokument des Vorgangs, wie es der `doc:`-Scan liefert. */
interface VorhabenScanDokument extends RohDokument {
  id: string;
  created: string;
}

/** Die Kennungen einer Entität — ohne Snapshot-Feld mindestens ihre Id. */
function kennungenDer(entitaet: KontextEntitaet): string[] {
  return [...new Set([entitaet.id, ...(entitaet.kennungen ?? [])])];
}

/**
 * Die über den Tag zugeordneten Dokumente eines Vorgangs, neueste zuerst. Ein
 * `doc:`-Scan je Turn, den zwei Stellen lesen: der Block „Dokumente zum Vorhaben"
 * und der Zuschnitt des Retrievals. Wirft NIE, der Turn läuft sonst ohne beides
 * weiter. Der Assistent-Transport ist ohnehin intern-only (DSGVO ok).
 */
async function scanneVorhabenDokumente(
  idb: IDBStore, entitaet: KontextEntitaet | null,
): Promise<VorhabenScanDokument[]> {
  if (!entitaet) return [];
  const kennungen = kennungenDer(entitaet);
  try {
    const keys = await idb.keys('doc:');
    const out: VorhabenScanDokument[] = [];
    for (const key of keys) {
      const doc = await idb.get<DocumentFull>(key);
      if (!doc || !Array.isArray(doc.tags) || !traegtKennung(doc.tags, kennungen)) continue;
      // Der Schlüssel IST die docId (`doc:<id>`); Index-Chunks heißen `<id>-…`.
      out.push({
        id: key.slice('doc:'.length), filename: doc.filename, markdown: doc.markdown,
        tags: doc.tags, created: doc.created ?? '',
      });
    }
    out.sort((a, b) => b.created.localeCompare(a.created)); // neueste zuerst (Kappung behält die frischesten)
    return out;
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
  /** @param bloecke Die zugeschalteten Blöcke dieses Turns (Verlauf, Journal). */
  send: (frage: string, bloecke?: readonly BlockId[]) => Promise<void>;
  /** Bricht den laufenden Turn ab (Bridge kennt kein maxTokens, es gibt keinen Timeout). */
  abbrechen: () => void;
  neueUnterhaltung: () => void;
  clearError: () => void;
  setFeedback: (mid: string, fb: 'up' | 'down') => void;
}

/**
 * @param scopeSchluessel Ausdrücklich mitgegebener Vorgang (Verbund-Nummer oder
 *   Aktenzeichen), der die Store-Selektion für diesen Turn übersteuert — gesetzt,
 *   wenn eine Karte die Frage samt Subjekt vorgelegt hat.
 * @param zeilen Reiner Leser der To-do-Kaskade (`useZeilenAufgaben('nie', …)`)
 *   für den Faktenblock. Ohne ihn spricht der Assistent die alte Status-Formel
 *   und widerspricht damit den Karten der App.
 * @param zusatz Die Vorgangsakte der gesehenen Entität und wer fragt. Die Akte
 *   reist nur mit, wenn sie zur Entität des Turns passt — der Snapshot wird beim
 *   Senden neu gebaut, und eine Akte des vorigen Vorgangs spräche über den falschen.
 */
export function useAssistentController(
  scopeSchluessel?: string | null,
  zeilen?: ZeilenAufgaben | null,
  zusatz?: {
    akte: VorgangsAkte | null;
    nutzer: NutzerRolle;
    /** Die zuschaltbaren Blöcke derselben Akte. */
    bloecke?: Partial<Record<BlockId, ZusatzBlock>>;
  },
): AssistentController {
  const bridge = useAIBridge();
  const { search } = useSearch();
  const storage = useStorage();
  const state = useStore(assistentSessionStore);

  const send = useCallback(async (frage: string, bloeckeIds: readonly BlockId[] = []): Promise<void> => {
    // EIN `doc:`-Scan je Turn: Retrieval und Dokument-Block bekommen dieselbe
    // Entität aus demselben Snapshot, der zweite Leser wartet auf den ersten.
    let scan: Promise<VorhabenScanDokument[]> | null = null;
    const scanFuer = (e: KontextEntitaet | null): Promise<VorhabenScanDokument[]> =>
      (scan ??= scanneVorhabenDokumente(storage.idb, e));

    const deps: AssistentTurnDeps = {
      // DSGVO-Gate: intern-only, wirft bei externem Provider (→ Degradation).
      getTransport: () => bridge.getTransportForAssistent(),
      getKontext: () => {
        const k = baueKontextSnapshot(Date.now(), scopeSchluessel, zeilen);
        const akte = zusatz?.akte ?? null;
        const passt = akte !== null && k.entitaet !== null && akte.fuer === k.entitaet.id;
        // Die Blöcke eines Vorgangs gehören seiner Akte — gilt sie nicht, gelten
        // sie auch nicht. Der Bestand gehört keinem Vorgang und reist immer mit.
        const bloecke = bloeckeIds
          .map(b => zusatz?.bloecke?.[b])
          .filter((b): b is ZusatzBlock => b !== undefined && (b.id === 'bestand' || passt));
        return {
          ...k,
          akte: passt ? akte : null,
          ...(zusatz ? { nutzer: zusatz.nutzer } : {}),
          ...(bloecke.length > 0 ? { bloecke } : {}),
        };
      },
      // Standard-Modell, Aufstieg nur bei Überlänge (Spec 3.7).
      modellFuer: zeichen => waehleModellFuerLauf('standard', zeichen).modell,
      retrieve: async (f, entitaet) => {
        if (getOramaDB() === null) return null; // Index (noch) nicht geladen → kein Retrieval
        try {
          if (!entitaet) return await search(f);
          // Mit Vorgang nur seine eigenen Dokumente. Global gesucht landete bei
          // „Was ist bei CALYPSO zu tun?" die Anlage 4 von KITED als Beleg [1] im Prompt.
          // Findet sich nichts Eigenes, gibt es keinen Auszug statt eines fremden.
          const kennungen = kennungenDer(entitaet);
          const docIds = (await scanFuer(entitaet)).map(d => d.id);
          return await search(f, {
            limit: VORGANG_SUCHE_LIMIT,
            nur: t => trefferGehoertZumVorhaben(t, kennungen, docIds),
          });
        } catch {
          return null; // Retrieval-Fehler degradiert zu „kein Auszug", nicht zum Turn-Fehler
        }
      },
      getGedaechtnis: ladeAssistentGedaechtnis,
      getVorhabenDokumente: async (entitaet) =>
        (entitaet ? baueVorhabenDokumente(await scanFuer(entitaet), entitaet.id) : []),
    };
    await assistentSessionStore.getState().send(frage, deps);

    // Nicht erreichbar? Dann den app-weiten Verbinden-Dialog anbieten — dieselbe
    // Antwort wie bei jedem anderen KI-CTA (`ki-guard.ts`). Bewusst NACH dem
    // Turn statt als Vorschaltung: der Store hat die Frage dann bereits ins
    // Eingabefeld zurückgelegt (`letzteFehlerFrage`), und der passive Ping des
    // Turns hat die Frage „verbunden?" schon beantwortet — ein zweiter Ping
    // davor kostete nur Wartezeit.
    if (assistentSessionStore.getState().error === DEGRADATION_MELDUNG) {
      useKiConnectPrompt.getState().oeffnen();
    }
  }, [bridge, search, storage, scopeSchluessel, zeilen, zusatz?.akte, zusatz?.nutzer, zusatz?.bloecke]);

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
