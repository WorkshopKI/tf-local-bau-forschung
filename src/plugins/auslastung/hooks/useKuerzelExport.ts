/**
 * useKuerzelExport (v2.18) — erzeugt den „Export (mit Kürzeln)" als XLSX mit
 * echten TIB-Kürzeln, inkl. der Top-5 alternativen Bearbeiter pro Verbund.
 *
 * Die Alternativen kommen aus der Matching-Engine (wie das Cockpit-Detail), die
 * pro zugewiesenem Verbund einmal laeuft. Stage 2 (Embeddings) braucht den
 * Korpus + ein Query-Embedding pro Verbund → der Export ist asynchron (ein paar
 * Sekunden). Von beiden Export-Buttons genutzt (Zuweisungs-Tab + Admin-Panel),
 * beide liegen im `AuslastungIndexProvider`.
 *
 * Reuse: `buildExportRows` liefert die Liste der zugewiesenen Verbünde (eine
 * Zeile pro Verbund, `aktenzeichen` = Buchungs-Lead, `ma` = anonId) — dieselbe
 * Gruppierung, die der Export danach formatiert. So bleibt „welche Verbünde +
 * welcher Lead" eine einzige Quelle der Wahrheit.
 */
import { useStorage } from '@/core/hooks/useStorage';
import { useAsyncAction, type UseAsyncActionResult } from '@/core/hooks/useAsyncAction';
import { embedText, ensureEmbeddingReady } from '@/core/services/embedding-corpus';
import { useAuslastungData } from './useAuslastungData';
import { useAntraegeCache } from './useAntraegeCache';
import { useAuslastungIndex } from './useAuslastungIndex';
import { useMatchingCorpus, type MatchingCorpus } from './useMatchingCorpus';
import { runMatching } from '../services/matching-engine';
import { getTVCount } from '../services/quartals-auslastung';
import { buildExportRows, exportDeAnonymizedXlsx } from '../services/export-service';
import {
  CANONICAL_TITEL,
  CANONICAL_VERBUND_TITEL,
  FIELD_PROJEKTBESCHREIBUNG,
  type MatchResult,
} from '../types';

export function useKuerzelExport(): UseAsyncActionResult<[]> {
  const storage = useStorage();
  const data = useAuslastungData(s => s.data);
  const cache = useAntraegeCache();
  const { auslastungByAnon } = useAuslastungIndex();
  const loadCorpus = useMatchingCorpus(cache.antraege, storage.idb);

  return useAsyncAction(async () => {
    const config = data.config;
    // 1) Zugewiesene Verbünde (eine Zeile pro Verbund, aktenzeichen = Buchungs-Lead).
    const baseRows = buildExportRows({
      data,
      antraege: cache.antraege,
      verbuendeById: cache.verbuendeById,
    });

    const indexAz = new Map(cache.antraege.map(a => [a.aktenzeichen, a]));
    const klByAntrag = new Map(data.klassifizierungen.map(k => [k.antragId, k]));

    // 2) Korpus + Embedding-Modell (nur bei Stage 2) einmal vorbereiten.
    let corpus: MatchingCorpus | undefined;
    if (config.stage2Aktiv) {
      await ensureEmbeddingReady(storage.idb);
      corpus = await loadCorpus();
    }

    // 3) Pro Verbund matchen → vollstaendig gescorte Kandidaten (topN gross).
    const matchesByLead = new Map<string, MatchResult[]>();
    for (const row of baseRows) {
      const lead = indexAz.get(row.aktenzeichen);
      if (!lead) continue;
      const kl = klByAntrag.get(row.aktenzeichen);
      let queryEmbedding: number[] | undefined;
      if (config.stage2Aktiv) {
        const text = [
          lead[CANONICAL_VERBUND_TITEL],
          lead[CANONICAL_TITEL],
          lead[FIELD_PROJEKTBESCHREIBUNG],
        ].filter(s => typeof s === 'string').join(' ');
        queryEmbedding = await embedText(text, 'query');
      }
      const verbundId = (lead as { verbund_id?: string }).verbund_id;
      const tvCount = getTVCount(cache.antraege, verbundId, lead.aktenzeichen);
      const result = runMatching({
        antrag: lead,
        primaerKategorie: kl?.freigegebenePrimaer,
        aspekte: kl?.freigegebeneAspekte,
        config,
        mitarbeiter: data.mitarbeiter,
        zuweisungen: data.zuweisungen,
        historischeDeskriptorenByAnon: cache.historischeDeskriptorenByAnon,
        historischeAstByAnon: cache.historischeAstByAnon,
        historischeAntraegeCountByAnon: cache.historischeAntraegeCountByAnon,
        anonymMap: cache.anonymMap,
        queryEmbedding,
        corpusEmbeddings: corpus?.corpusEmbeddings,
        antraegeIndex: corpus?.antraegeIndex,
        anzahlTV: tvCount,
        auslastungByAnon,
        topN: 9999, // alle gescort → Score des zugewiesenen MA + Top-5-Alternativen
      });
      matchesByLead.set(row.aktenzeichen, result);
    }

    // 4) Export mit echten Kürzeln + Alternativen.
    exportDeAnonymizedXlsx({
      data,
      antraege: cache.antraege,
      anonymMap: cache.anonymMap,
      verbuendeById: cache.verbuendeById,
      matchesByLead,
    });
  });
}
