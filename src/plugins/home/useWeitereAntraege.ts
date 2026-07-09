/**
 * useWeitereAntraege — Tier 2 der Homepage-Sektion „Neue Anträge für dich".
 *
 * Tier 1 zeigt offene Anträge der **Hauptkategorie** des Users. Tier 2 blendet
 * auf Wunsch die Anträge ein, für die der User ein **schwächerer Match** ist —
 * die vom User genannte Situation „nichts 100%-Passendes gerade frei". Fachlich
 * sind das die Anträge, deren freigegebene Primärkategorie in den
 * **Nebenkategorien** des Users liegt (dort ist er strukturell nicht der
 * Primär-Pick). Die konkrete Reihenfolge liefert das echte Matching:
 *
 *  - Der Aufrufer reicht die günstig vorgefilterten `kandidaten` (Neben-Verbünde,
 *    ohne Tier-1-Überschneidung) herein.
 *  - `suchen()` läuft die Matching-Engine (BM25-only — kein Query-Embedding pro
 *    Antrag) einmal pro Kandidat-Verbund, liest die **eigene** Passung
 *    (`kompetenzScore`) und sortiert danach absteigend.
 *
 * Weil pro Kandidat ein Point-Read (volle Projektbeschreibung) + ein
 * Engine-Lauf anfällt, ist die Suche eine asynchrone Aktion mit Spinner (analog
 * `useKuerzelExport`) — nichts davon läuft im Render.
 *
 * Datenschutz: zurückgegeben wird ausschließlich die eigene Passung, nie andere
 * MAs oder deren Rang.
 */
import { useEffect, useRef, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { getAntrag } from '@/core/services/csv/idb-csv';
import { useAuslastungData } from '@/plugins/auslastung/hooks/useAuslastungData';
import { useAntraegeCache } from '@/plugins/auslastung/hooks/useAntraegeCache';
import { runMatchingWithContext } from '@/plugins/auslastung/services/matching';
import type { MaQuartalsAuslastung } from '@/plugins/auslastung/services/kapazitaet';
import type { VerbundEintrag } from './neueAntraegeVerbund';

/**
 * Ein Ranking-Eintrag: verbundId + eigene Passung — bewusst NUR die IDs, nicht
 * das ganze `VerbundEintrag`-Objekt. Das Ranking ist ein stabiler Schnappschuss
 * der letzten Suche; die AKTUELLE Verbund-Sicht (offen/vorgemerkt) löst der
 * Aufrufer beim Rendern frisch auf. So spiegelt ein „Kann ich übernehmen"-Klick
 * sofort auf die Zeile, ohne das Ranking zu verwerfen.
 */
export interface WeitereRanking {
  verbundId: string;
  /** Eigene fachliche Passung (kompetenzScore 0..1) für diesen Antrag. */
  passung: number;
}

export interface UseWeitereAntraege {
  /** 'idle' = noch nicht gesucht, 'loading' = Engine läuft, 'ready' = Ergebnis da. */
  status: 'idle' | 'loading' | 'ready';
  /** Nach Passung absteigend sortiertes Ranking (leer bis `suchen()` lief). */
  ranking: readonly WeitereRanking[];
  /** Startet die Suche (idempotent während sie läuft). */
  suchen: () => void;
  error: string | null;
}

/** Obergrenze der pro Suche gescorten Verbünde — Engine-Läufe sind teuer. */
const MAX_KANDIDATEN = 50;

/** Stabile leere Referenz — vermeidet Render-Churn, wenn noch nicht gesucht wurde. */
const EMPTY_RANKING: readonly WeitereRanking[] = [];

export function useWeitereAntraege(input: {
  kandidaten: readonly VerbundEintrag[];
  myAnonId: string | null;
  auslastungByAnon: Map<string, MaQuartalsAuslastung>;
}): UseWeitereAntraege {
  const { kandidaten, myAnonId, auslastungByAnon } = input;
  const storage = useStorage();
  const config = useAuslastungData(s => s.data.config);
  const mitarbeiter = useAuslastungData(s => s.data.mitarbeiter);
  const zuweisungen = useAuslastungData(s => s.data.zuweisungen);
  const cache = useAntraegeCache();

  const [ranking, setRanking] = useState<WeitereRanking[] | null>(null);

  // Ranking NUR bei echtem Daten-Refresh verwerfen — also wenn NEUE Kandidaten
  // auftauchen (dann könnte „Passung" zu veralteten Anträgen gehören). Ein reines
  // SCHRUMPFEN der Menge (der User hat gerade einen Antrag vorgemerkt → er fällt
  // aus `kandidaten`) darf das Ranking NICHT verwerfen — sonst klappte der Block
  // bei jedem „Kann ich übernehmen" auf idle zurück. `seen` wächst deshalb nur;
  // Vormerken/Rückgängig fügen keine neuen IDs hinzu und lösen keinen Reset aus.
  const seen = useRef<Set<string>>(new Set(kandidaten.map(k => k.verbundId)));
  useEffect(() => {
    let neu = false;
    for (const k of kandidaten) {
      if (!seen.current.has(k.verbundId)) {
        seen.current.add(k.verbundId);
        neu = true;
      }
    }
    if (neu) setRanking(null);
  }, [kandidaten]);

  const action = useAsyncAction(async () => {
    const capped = kandidaten.slice(0, MAX_KANDIDATEN);
    const out: WeitereRanking[] = [];
    for (const v of capped) {
      // Volle Projektbeschreibung per Point-Read (Slim-Cache hält sie nicht) —
      // BM25-Query-Text braucht sie. N Point-Reads in einer Async-Action sind ok.
      const lead = await getAntrag(storage.idb, v.leadAktenzeichen);
      if (!lead) continue;
      const kl = v.klassifizierung;
      const result = runMatchingWithContext({
        antrag: lead,
        primaerKategorie: kl.freigegebenePrimaer,
        aspekte: kl.freigegebeneAspekte,
        config,
        mitarbeiter,
        zuweisungen,
        historischeDeskriptorenByAnon: cache.historischeDeskriptorenByAnon,
        historischeAstByAnon: cache.historischeAstByAnon,
        historischeAntraegeCountByAnon: cache.historischeAntraegeCountByAnon,
        anonymMap: cache.anonymMap,
        anzahlTV: v.tvCount,
        auslastungByAnon,
        // BM25-only: kein queryEmbedding/corpusEmbeddings → Stage 2 bleibt aus.
        topN: 9999, // alle gescort → eigene Position sicher enthalten
      });
      // Kandidat-Kategorie ∈ Nebenkategorien → wir stehen im Nebenkompetenz-Pool.
      // Fallback vorschlaege (falls es zu der Kategorie keinen Haupt-MA gibt).
      const mine = result.nebenkompetenz.find(m => m.anonId === myAnonId)
        ?? result.vorschlaege.find(m => m.anonId === myAnonId);
      // Kein Treffer = Engine schließt uns aus (Onboarding/Stunden/abgemeldet) →
      // nicht anbieten.
      if (!mine) continue;
      out.push({ verbundId: v.verbundId, passung: mine.kompetenzScore });
      // An den Event-Loop yielden, damit der Spinner flüssig bleibt.
      await new Promise<void>(r => setTimeout(r, 0));
    }
    out.sort((a, b) => b.passung - a.passung);
    setRanking(out);
  });

  const status: UseWeitereAntraege['status'] = action.busy
    ? 'loading'
    : ranking !== null
      ? 'ready'
      : 'idle';

  return {
    status,
    ranking: ranking ?? EMPTY_RANKING,
    suchen: () => void action.run(),
    error: action.error,
  };
}
