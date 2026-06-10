/**
 * Embedding-Matcher — Stage 2 fuer das MA-Matching.
 *
 * Kernidee: NICHT MA-Profile embedden (waeren bei breitem MA verwaschen),
 * sondern die historischen Antraege einzeln als Corpus. Pro Top-K-Treffer
 * (Cosine-Similarity gegen Query) wird der jeweilige Bearbeiter-TIB gehyped.
 *
 * Output pro MA:
 *  - embeddingScore = sum(similarity * project_confidence) / max
 *    (max ueber alle MAs zur Normalisierung auf [0,1])
 *  - aehnlicheProjekte: Top-3 aktenzeichen + titel + similarity
 *
 * Virtuelle Projekte (aus Onboarding-Swipe, kommt in Prompt 2): MA hat
 * `virtuelleProjekte[]` mit confidence 0.3..1.0. Im Score wird similarity ×
 * confidence multipliziert (echte Projekte = 1.0, virtuelle weniger).
 */
import type { Antrag, AntragOderSlim } from '@/core/services/csv/types';
import type {
  AehnlichesProjekt,
  AnonymerMitarbeiter,
  VirtuellesProjekt,
} from '../types';
import { CANONICAL_TITEL, CANONICAL_TIB_KUERZ, CANONICAL_VERBUND_TITEL } from '../types';
import { cosineSimilarity } from '@/core/services/embedding-corpus';
import type { AnonymMap } from './anonym-map';
import { normalizeKuerzel } from './anonym-map';
import { istDlVbPhase } from './profil-aggregator';

export interface EmbeddingMatchResult {
  anonId: string;
  embeddingScore: number;     // 0..1
  aehnlicheProjekte: AehnlichesProjekt[];
}

export interface RunEmbeddingMatchInput {
  queryEmbedding: number[];
  /** Pro hist. Antrag: aktenzeichen -> embedding. */
  corpusEmbeddings: Map<string, number[]>;
  /** Pro hist. Antrag: aktenzeichen -> {tib_kuerz, titel, verbund_titel, vb_phase}. */
  antraegeIndex: Map<string, Pick<Antrag, 'aktenzeichen'> & { tib_kuerz?: unknown; titel?: unknown; verbund_titel?: unknown; vb_phase?: unknown }>;
  /** AnonymMap fuer Kuerzel -> anonId. */
  anonymMap: AnonymMap;
  /** Nur diese MAs werden gemattched (gefiltert nach Ueberkategorie). */
  eligibleAnonIds: Set<string>;
  /** Pro MA: virtuelle Projekte (aktenzeichen + confidence). Optional. */
  mitarbeiter: Record<string, AnonymerMitarbeiter>;
  /** Wieviele Top-K Antraege werden betrachtet. Default 20. */
  topK?: number;
}

/**
 * Liefert eine sortierte Liste von MA-Scores plus Top-3-Aehnliche-Projekte
 * pro MA. Normalisiert auf [0, 1].
 */
export function runEmbeddingMatching(input: RunEmbeddingMatchInput): EmbeddingMatchResult[] {
  const topK = input.topK ?? 20;

  // Pro hist. Antrag: similarity berechnen, Top-K behalten.
  // DL-Antraege werden VOR dem Top-K-Slice ausgefiltert (nicht kompetenz-
  // repraesentativ), damit Top-K mit Nicht-DL-Antraegen gefuellt wird. Der
  // Korpus bleibt unveraendert — kein Rebuild noetig (analog inaktive Bearbeiter).
  const scored: Array<{ aktenzeichen: string; sim: number }> = [];
  for (const [az, vec] of input.corpusEmbeddings.entries()) {
    if (istDlVbPhase(input.antraegeIndex.get(az)?.vb_phase)) continue;
    const sim = cosineSimilarity(input.queryEmbedding, vec);
    if (sim > 0) scored.push({ aktenzeichen: az, sim });
  }
  scored.sort((a, b) => b.sim - a.sim);
  const top = scored.slice(0, topK);

  // Pro MA aggregieren: Score-Sum (similarity * virtuell-confidence)
  // + aehnliche Projekte sammeln
  const perMa = new Map<string, { score: number; projekte: AehnlichesProjekt[] }>();

  // Index der virtuellen Projekte pro MA: aktenzeichen -> confidence.
  // Inaktive MAs werden ausgeschlossen — ihre virtuellen Projekte erzeugen
  // keinen Score, auch wenn sie in eligibleAnonIds steckten.
  const virtuelleByMa = new Map<string, Map<string, number>>();
  for (const anonId of input.eligibleAnonIds) {
    const ma = input.mitarbeiter[anonId];
    if (!ma || !ma.aktiv) continue;
    const inner = new Map<string, number>();
    for (const vp of ma.virtuelleProjekte ?? []) {
      inner.set(vp.antragId, vp.confidence);
    }
    virtuelleByMa.set(anonId, inner);
  }

  for (const t of top) {
    const a = input.antraegeIndex.get(t.aktenzeichen);
    if (!a) continue;

    // 1) Echter Bearbeiter (TIB) -> anonId, score gewichtet mit 1.0.
    // Wichtig: corpusEmbeddings/antraegeIndex enthalten weiterhin ALLE hist.
    // Antraege (auch von inaktiven Bearbeitern) — wir ueberspringen nur den
    // Score-Credit, nicht den Top-K-Slot. Das laesst Centroids stabil.
    const tibKuerz = normalizeKuerzel(a.tib_kuerz);
    const tibAnonId = tibKuerz ? input.anonymMap.toAnon.get(tibKuerz) : undefined;
    if (tibAnonId
      && input.eligibleAnonIds.has(tibAnonId)
      && input.mitarbeiter[tibAnonId]?.aktiv) {
      addToMa(perMa, tibAnonId, t.sim * 1.0, t.aktenzeichen, a, t.sim);
    }

    // 2) MAs mit virtuellem Projekt fuer diesen Antrag -> gewichtet mit ihrer confidence
    for (const [anonId, virtMap] of virtuelleByMa.entries()) {
      if (anonId === tibAnonId) continue; // schon oben gezaehlt
      const conf = virtMap.get(t.aktenzeichen);
      if (conf != null && conf > 0) {
        addToMa(perMa, anonId, t.sim * conf, t.aktenzeichen, a, t.sim);
      }
    }
  }

  // Score auf [0,1] normalisieren via Max
  let max = 0;
  for (const v of perMa.values()) if (v.score > max) max = v.score;
  if (max === 0) return [];

  const results: EmbeddingMatchResult[] = [];
  for (const [anonId, val] of perMa.entries()) {
    val.projekte.sort((a, b) => b.similarity - a.similarity);
    results.push({
      anonId,
      embeddingScore: val.score / max,
      aehnlicheProjekte: val.projekte.slice(0, 3),
    });
  }
  results.sort((a, b) => b.embeddingScore - a.embeddingScore);
  return results;
}

function addToMa(
  perMa: Map<string, { score: number; projekte: AehnlichesProjekt[] }>,
  anonId: string,
  scoreContribution: number,
  aktenzeichen: string,
  antrag: { titel?: unknown; verbund_titel?: unknown },
  similarity: number,
): void {
  let entry = perMa.get(anonId);
  if (!entry) {
    entry = { score: 0, projekte: [] };
    perMa.set(anonId, entry);
  }
  entry.score += scoreContribution;
  const titel = typeof antrag.titel === 'string' && antrag.titel.trim()
    ? antrag.titel
    : (typeof antrag.verbund_titel === 'string' ? antrag.verbund_titel : undefined);
  entry.projekte.push({ aktenzeichen, titel, similarity });
}

/**
 * Helfer: aus einer `Antrag[]`-Liste einen Lookup-Index fuer
 * `runEmbeddingMatching.antraegeIndex` bauen.
 */
export function buildAntraegeIndexForMatching(
  antraege: ReadonlyArray<AntragOderSlim>,
): Map<string, Pick<Antrag, 'aktenzeichen'> & { tib_kuerz?: unknown; titel?: unknown; verbund_titel?: unknown; vb_phase?: unknown }> {
  const m = new Map<string, { aktenzeichen: string; tib_kuerz?: unknown; titel?: unknown; verbund_titel?: unknown; vb_phase?: unknown }>();
  for (const a of antraege) {
    m.set(a.aktenzeichen, {
      aktenzeichen: a.aktenzeichen,
      tib_kuerz: (a as Record<string, unknown>)[CANONICAL_TIB_KUERZ],
      titel: (a as Record<string, unknown>)[CANONICAL_TITEL],
      verbund_titel: (a as Record<string, unknown>)[CANONICAL_VERBUND_TITEL],
      // v2.15: Antragstyp-Kontingent braucht vb_phase, um Zuweisungen → Bucket
      // (FuE/DS/DL/NW) zu zaehlen.
      vb_phase: (a as Record<string, unknown>)['vb_phase'],
    });
  }
  return m;
}

/**
 * Test-Helfer: fuer Unit-Tests kann man `VirtuellesProjekt`-Listen direkt
 * konstruieren — exportiert hier nur fuer Type-Sichtbarkeit in Test-Files.
 */
export type { VirtuellesProjekt };
