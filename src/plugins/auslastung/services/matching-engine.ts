/**
 * Matching-Engine — Orchestrator fuer das dreistufige MA-Matching pro Antrag.
 *
 * Reihenfolge:
 *  1. Eligible MAs = aus den freigegebenen Ueberkategorien des Antrags.
 *  2. BM25-Scores fuer alle eligible.
 *  3. Dynamisches Alpha basierend auf BM25-Confidence-Verteilung:
 *     - mind. 1 high (>= 0.5)  -> α = 1.0  (kein Embedding)
 *     - mind. 1 medium         -> α = 0.5
 *     - alle low / 0           -> α = 0.2  (Embedding dominiert)
 *  4. Wenn α < 1.0 AND stage2Aktiv: Embedding-Scores berechnen.
 *  5. kompetenzScore = α * bm25 + (1-α) * embedding
 *  6. Kapazitaets-Filter (verbrauchte Stunden + Abmeldung + freie Kapazitaet).
 *  7. balanceScore = rest / quartalsKap
 *  8. finalScore = kompetenz × gewichtungKompetenz + balance × gewichtungBalance
 *  9. Top-3 nach finalScore, mit matchStufe + Confidence + aehnliche Projekte.
 */
import type { Antrag } from '@/core/services/csv/types';
import type {
  AehnlichesProjekt,
  AnonymerMitarbeiter,
  AuslastungConfig,
  MatchResult,
  Zuweisung,
} from '../types';
import {
  CANONICAL_TITEL,
  CANONICAL_VERBUND_TITEL,
  FIELD_PROJEKTBESCHREIBUNG,
  FIELD_AST_TYP,
  type AstTyp,
} from '../types';
import { runBm25Matching, type Bm25Result } from './bm25-matcher';
import { runEmbeddingMatching, type EmbeddingMatchResult } from './embedding-matcher';
import { kapazitaetsScore, tageImQuartal } from './kapazitaet';
import type { AnonymMap } from './anonym-map';

export interface MatchInput {
  antrag: Antrag;
  /** @deprecated 1.17 — nutze `primaerKategorie` + `aspekte` getrennt.
   *  Falls noch gesetzt: erstes Element = primaer, Rest = aspekte. */
  kategorieIds?: string[];
  /** Freigegebene Primaerkategorie. Bestimmt den eligible-Pool. */
  primaerKategorie?: string;
  /** Freigegebene Aspekte (Querschnittstechnologien). Triggern Aspekt-Bonus
   *  fuer MAs mit passenden Nebenkategorien. */
  aspekte?: string[];
  config: AuslastungConfig;
  mitarbeiter: Record<string, AnonymerMitarbeiter>;
  /** Aktuelle Zuweisungen (fuer Kapazitaets-Score). */
  zuweisungen: Zuweisung[];
  /** Pro MA aggregierte hist. Deskriptoren — fuer BM25-Profile-Doc. */
  historischeDeskriptorenByAnon: Map<string, string[]>;
  /** Pro MA: AST-Name (normalisiert) → Count. Optional; wenn nicht gesetzt,
   *  laeuft das Matching ohne AST-Boost (Backwards-Kompat fuer Tests). */
  historischeAstByAnon?: Map<string, Map<string, number>>;
  anonymMap: AnonymMap;
  /** Optional Stage-2: wenn null/leer, laeuft nur BM25. */
  queryEmbedding?: number[];
  corpusEmbeddings?: Map<string, number[]>;
  antraegeIndex?: Map<string, { aktenzeichen: string; tib_kuerz?: unknown; titel?: unknown; verbund_titel?: unknown }>;
  /** Anzahl Teilvorhaben fuer Stundenberechnung. Default 1. */
  anzahlTV?: number;
  /** Verbleibende Tage im Quartal. Default: aus `config.aktuellesQuartal`
   *  + `new Date()` berechnet. */
  tageImQuartal?: number;
  /** Wieviele Top-Ergebnisse zurueckgegeben werden. Default 3. */
  topN?: number;
}

export function runMatching(input: MatchInput): MatchResult[] {
  const {
    antrag, config, mitarbeiter, zuweisungen,
    historischeDeskriptorenByAnon, anonymMap,
  } = input;

  // 1.17: Primaer + Aspekte aufloesen — kategorieIds-Backwards-Kompat zuerst.
  const primaer = input.primaerKategorie
    ?? input.kategorieIds?.[0]
    ?? '';
  const aspekte = input.aspekte
    ?? input.kategorieIds?.slice(1)
    ?? [];
  if (!primaer) return [];

  // 1) Eligible MAs: Pool = MAs deren hauptKategorie == primaer.
  //    Fallback fuer noch nicht migrierte MAs: ueberKategorien enthaelt primaer.
  const eligibleAnonIds = new Set<string>();
  for (const ma of Object.values(mitarbeiter)) {
    if (!ma.aktiv) continue;
    const matchesHaupt = ma.hauptKategorie ? ma.hauptKategorie === primaer : false;
    const matchesLegacy = !ma.hauptKategorie && (ma.ueberKategorien?.includes(primaer) ?? false);
    if (matchesHaupt || matchesLegacy) {
      eligibleAnonIds.add(ma.anonId);
    }
  }
  if (eligibleAnonIds.size === 0) return [];

  // 2) BM25-Scores
  const queryText = buildQueryText(antrag);
  const bm25Results = runBm25Matching({
    queryText,
    eligibleAnonIds,
    mitarbeiter,
    historischeDeskriptorenByAnon,
  });
  const bm25ByAnon = new Map(bm25Results.map(r => [r.anonId, r]));

  // 3) Alpha bestimmen
  const alpha = computeAlpha(bm25Results);

  // 4) Embedding-Stage falls noetig + verfuegbar
  let embeddingByAnon = new Map<string, EmbeddingMatchResult>();
  if (alpha < 1.0
    && config.stage2Aktiv
    && input.queryEmbedding
    && input.corpusEmbeddings
    && input.antraegeIndex
  ) {
    const embResults = runEmbeddingMatching({
      queryEmbedding: input.queryEmbedding,
      corpusEmbeddings: input.corpusEmbeddings,
      antraegeIndex: input.antraegeIndex,
      anonymMap,
      eligibleAnonIds,
      mitarbeiter,
    });
    embeddingByAnon = new Map(embResults.map(r => [r.anonId, r]));
  }

  // 5)-7) Score + weicher Filter + Balance pro MA
  const stundenProTV = config.stundenProTV ?? 9;
  const anzahlTV = input.anzahlTV ?? 1;
  const benoetigt = stundenProTV * anzahlTV;
  const quartalsVerbrauchByAnon = computeVerbrauchByAnon(zuweisungen, config.aktuellesQuartal);
  const restTageImQuartal = input.tageImQuartal ?? tageImQuartal(config.aktuellesQuartal);
  const aspektBonusPerMatch = config.aspektBonus ?? 0.10;
  const quartalsEndeBonusTage = config.quartalsEndeBonusTage ?? 21;

  const out: MatchResult[] = [];
  for (const anonId of eligibleAnonIds) {
    const ma = mitarbeiter[anonId]!;
    if (!ma.aktiv) continue;  // defensiv: eligible-Sammlung filtert schon, doppelt schadet nicht
    if (ma.abgemeldet.includes(config.aktuellesQuartal)) continue;
    // MA ohne Onboarding UND ohne hist. Antraege: ueberspringen
    if (!ma.onboardingAbgeschlossen && (historischeDeskriptorenByAnon.get(anonId) ?? []).length === 0) continue;

    // Kapazitaet inkl. Abschlag — weiches Modell, kein harter Filter mehr.
    const abschlag = Math.max(0, Math.min(100, ma.abschlagProzent ?? 0));
    const quartalsKap = (ma.jahresKapazitaet * (1 - abschlag / 100)) / 4;
    const verbraucht = quartalsVerbrauchByAnon.get(anonId) ?? 0;
    const rest = quartalsKap - verbraucht;
    const ueberbuchung = rest < 0 ? -rest : 0;

    const bm25 = bm25ByAnon.get(anonId)?.score ?? 0;
    const embRes = embeddingByAnon.get(anonId);
    const emb = embRes?.embeddingScore ?? 0;
    const aehnlich: AehnlichesProjekt[] = embRes?.aehnlicheProjekte ?? [];

    const { boost: astBoost, count: astMatchCount } = computeAstBoost(
      antrag,
      input.historischeAstByAnon?.get(anonId),
    );

    // 1.17: Aspekt-Bonus — Antrag-Aspekte ∩ MA-Nebenkategorien.
    const nebenSet = new Set(ma.nebenKategorien ?? []);
    const aspektMatchIds = aspekte.filter(a => nebenSet.has(a));
    const aspektBonusValue = aspektMatchIds.length * aspektBonusPerMatch;

    const kompetenz = clamp01(alpha * bm25 + (1 - alpha) * emb + astBoost + aspektBonusValue);
    const balance = quartalsKap > 0 ? Math.max(0, rest) / quartalsKap : 0;
    const kapScore = kapazitaetsScore(rest, benoetigt, restTageImQuartal, quartalsEndeBonusTage);
    // Balance + KapScore werden gemeinsam in die `gewichtungBalance`-Komponente
    // eingewogen (je zur Haelfte). Behaelt das alte Verhalten bei voller
    // Kapazitaet (balance≈1.0, kapScore≈1.0 → gewichtungBalance × 1.0), aber
    // ueberbuchte MAs rutschen sanft ab statt rauszufallen.
    const finalScore =
      kompetenz * config.gewichtungKompetenz
      + (balance * 0.5 + kapScore * 0.5) * config.gewichtungBalance;

    out.push({
      anonId,
      bm25Score: bm25,
      embeddingScore: emb,
      kompetenzScore: kompetenz,
      restKapazitaet: rest,
      quartalsKapazitaet: quartalsKap,
      balanceScore: clamp01(balance),
      finalScore: clamp01(finalScore),
      matchendeTechnologien: bm25ByAnon.get(anonId)?.matchendeTechnologien ?? [],
      aehnlicheProjekte: aehnlich,
      matchStufe: matchStufeFor(alpha),
      confidence: confidenceFor(kompetenz),
      benoetigteStunden: benoetigt,
      astMatchCount,
      astBoost,
      // 1.17: neue Felder
      kapazitaetsScore: kapScore,
      aspektBonus: aspektBonusValue,
      aspektMatchIds,
      ueberbuchung,
    });
  }

  out.sort((a, b) => b.finalScore - a.finalScore);
  return out.slice(0, input.topN ?? 3);
}

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/**
 * AST-Wiederholungs-Boost: hat der MA den AST des aktuellen Antrags schon
 * mal bearbeitet? Boost-Staerke abhaengig vom Antragsteller-Typ:
 *
 *  - `U` (Unternehmen, typ. KMU): +0.20 — thematisch sehr konsistent
 *  - `F` (Forschungseinrichtung): +0.05 — Hochschulen breit aufgestellt,
 *    AST-Identitaet allein ist schwaches Signal
 *  - `''` (leer/unbekannt): +0.10 — mittlerer Boost
 *
 * Count-Multiplikator (sanft): 1 Match = 1×, 2–3 = 1.2×, 4+ = 1.5×.
 */
function computeAstBoost(
  antrag: Antrag,
  historicalAstCounts: Map<string, number> | undefined,
): { boost: number; count: number } {
  if (!historicalAstCounts || historicalAstCounts.size === 0) return { boost: 0, count: 0 };
  const ast = (antrag as { antragsteller?: unknown }).antragsteller;
  if (typeof ast !== 'string') return { boost: 0, count: 0 };
  const normalized = ast.trim().toLowerCase();
  if (!normalized) return { boost: 0, count: 0 };
  const count = historicalAstCounts.get(normalized) ?? 0;
  if (count === 0) return { boost: 0, count: 0 };

  const typRaw = (antrag as Record<string, unknown>)[FIELD_AST_TYP];
  const typ: AstTyp = typRaw === 'U' || typRaw === 'F' ? typRaw : '';
  const baseBoost = typ === 'U' ? 0.20 : typ === 'F' ? 0.05 : 0.10;
  const multiplier = count >= 4 ? 1.5 : count >= 2 ? 1.2 : 1.0;
  return { boost: baseBoost * multiplier, count };
}

function buildQueryText(antrag: Antrag): string {
  const parts: string[] = [];
  for (const k of [CANONICAL_VERBUND_TITEL, CANONICAL_TITEL, FIELD_PROJEKTBESCHREIBUNG]) {
    const v = (antrag as Record<string, unknown>)[k];
    if (typeof v === 'string' && v.trim()) parts.push(v);
  }
  return parts.join(' ');
}

export function computeAlpha(bm25: Bm25Result[]): number {
  if (bm25.length === 0) return 0.2;
  const hasHigh = bm25.some(r => r.score >= 0.5);
  if (hasHigh) return 1.0;
  const hasMedium = bm25.some(r => r.score >= 0.2);
  if (hasMedium) return 0.5;
  return 0.2;
}

function matchStufeFor(alpha: number): 1 | 2 | 3 {
  if (alpha >= 1.0) return 1;
  if (alpha <= 0.2) return 2;
  return 3;
}

function confidenceFor(kompetenzScore: number): 'high' | 'medium' | 'low' {
  if (kompetenzScore >= 0.5) return 'high';
  if (kompetenzScore >= 0.2) return 'medium';
  return 'low';
}

/** Summiert verbrauchte Stunden pro MA fuer ein gegebenes Quartal. */
export function computeVerbrauchByAnon(
  zuweisungen: Zuweisung[],
  quartal: string,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const z of zuweisungen) {
    if (z.quartal !== quartal) continue;
    if (z.status !== 'freigegeben' && z.status !== 'selbst') continue;
    map.set(z.anonId, (map.get(z.anonId) ?? 0) + z.stunden);
  }
  return map;
}

/**
 * Hilfsfunktion fuer den Service-Layer: nimmt eine Liste von Antraegen +
 * deren Klassifizierungen + den Auslastungs-State und gibt Top-3 pro Antrag.
 *
 * Wird im UI vom Zuweisungs-Cockpit aufgerufen — typischerweise lazy/
 * memoisiert pro selektiertem Antrag.
 */
export function rememberInputForReuse<T extends MatchInput>(input: T): T {
  return input;
}
