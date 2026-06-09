/**
 * Matching-Engine — Orchestrator fuer das dreistufige MA-Matching pro Antrag.
 *
 * Einstieg: `runMatchingWithContext` liefert Haupt-Vorschläge, getrennte
 * Nebenkompetenz-Vorschläge und die ausgeschlossenen MAs (mit Grund).
 * `runMatching` ist der dünne Backwards-Kompat-Wrapper (nur Haupt-Vorschläge).
 *
 * Reihenfolge (pro Pool, haupt + neben getrennt normalisiert):
 *  1. Eligible MAs = Pool deren hauptKategorie == primaer (haupt) bzw. primaer
 *     in den Nebenkategorien (neben).
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
  AusgeschlossenerMa,
  AuslastungConfig,
  MatchKontext,
  MatchResult,
  Zuweisung,
} from '../types';
import {
  CANONICAL_TITEL,
  CANONICAL_VERBUND_TITEL,
  FIELD_PROJEKTBESCHREIBUNG,
  FIELD_AST_TYP,
  stundenProTVFor,
  type AstTyp,
} from '../types';
import { runBm25Matching, type Bm25Result } from './bm25-matcher';
import { runEmbeddingMatching, type EmbeddingMatchResult } from './embedding-matcher';
import { kapazitaetsScore, tageImQuartal } from './kapazitaet';
import { effektiveJahresStunden } from './kapazitaet-pro-typ';
import { matchesAntragstyp } from './antragstyp-praeferenz';
import { normLevelForUeber, matrixScoreForUeber } from './kompetenz-derivation';
import { computeKontingentVerbrauch, kontingentInfoFor, verbrauchFromAuslastung } from './kontingent';
import { getKategorieLabel } from '@/plugins/antraege/filter/kategorieQuickfilter';
import type { AnonymMap } from './anonym-map';
import type { MaQuartalsAuslastung } from './quartals-auslastung';

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
  /** @deprecated v2.31 — der „wenig Historie → Kompetenz-Matrix staerker
   *  gewichten"-Boost ist entfallen, seit die Tabelle additiv-parallel zur
   *  Historie zaehlt (50/50-Blend, `kompetenzMatrixMatchGewicht`). Das Feld wird
   *  von der Engine nicht mehr gelesen; Aufrufer duerfen es weiter mitgeben. */
  historischeAntraegeCountByAnon?: Map<string, number>;
  anonymMap: AnonymMap;
  /** Optional Stage-2: wenn null/leer, laeuft nur BM25. */
  queryEmbedding?: number[];
  corpusEmbeddings?: Map<string, number[]>;
  antraegeIndex?: Map<string, { aktenzeichen: string; tib_kuerz?: unknown; titel?: unknown; verbund_titel?: unknown; vb_phase?: unknown }>;
  /** Anzahl Teilvorhaben fuer Stundenberechnung. Default 1. */
  anzahlTV?: number;
  /** Verbleibende Tage im Quartal. Default: aus `config.aktuellesQuartal`
   *  + `new Date()` berechnet. */
  tageImQuartal?: number;
  /** Wieviele Top-Ergebnisse zurueckgegeben werden. Default 3. */
  topN?: number;
  /** v2.4: Aggregierte Quartals-Auslastung pro MA (fest+pending). Wenn
   *  gesetzt, wird der "verbraucht"-Wert daraus gelesen statt aus dem
   *  Zuweisungs-Store. Bei `undefined` (Tests, Backwards-Kompat) faellt
   *  die Engine auf `computeVerbrauchByAnon(zuweisungen)` zurueck — das
   *  ignoriert dann die CSV-Buchungen. Aufrufer (ZuweisungsCockpit) sollten
   *  den Index per `computeQuartalsAuslastung` aufbauen und mitgeben. */
  auslastungByAnon?: Map<string, MaQuartalsAuslastung>;
}

/**
 * Backwards-kompatibler Einstieg: liefert nur die Haupt-Vorschläge (Top-N).
 * Bestehende Aufrufer/Tests bleiben unverändert; der reichhaltige Kontext
 * (Nebenkompetenz + ausgeschlossene MAs + Score-Breakdown) steht über
 * `runMatchingWithContext` zur Verfügung.
 */
export function runMatching(input: MatchInput): MatchResult[] {
  return runMatchingWithContext(input).vorschlaege;
}

/**
 * Vollständiges Matching (v2.48): trennt den Eligible-Pool in
 *  - `vorschlaege`     — MAs mit hauptKategorie == primaer (wie bisher),
 *  - `nebenkompetenz`  — MAs mit primaer NUR in den Nebenkategorien (bisher
 *                        still aus dem Pool gefiltert) und
 *  - `ausgeschlossen`  — kategorie-relevante MAs, die NICHT vorgeschlagen werden,
 *                        je mit Grund (Antragstyp, Onboarding, abgemeldet,
 *                        inaktiv, Rang-Schnitt) — macht die bisher stillen
 *                        Engine-Filter im UI nachvollziehbar.
 *
 * Haupt- und Nebenpool werden **getrennt** gescort (eigene BM25-/Embedding-
 * Normalisierung) → das Haupt-Ranking ist bit-identisch zur Pre-v2.48-Engine
 * (Test-Parität), der Nebenpool verwässert es nicht.
 */
export function runMatchingWithContext(input: MatchInput): MatchKontext {
  const EMPTY: MatchKontext = { vorschlaege: [], nebenkompetenz: [], ausgeschlossen: [] };
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
  if (!primaer) return EMPTY;

  // 1) Pool-Klassifikation. Kategorie-relevant = hauptKategorie==primaer ODER
  //    primaer in den Nebenkategorien. Nur diese MAs werden überhaupt
  //    betrachtet (Ausschluss-Liste bleibt damit beschränkt). Die bisher
  //    INNERHALB der Score-Schleife stillen Filter (abgemeldet, Onboarding-
  //    Gate) werden hier als Ausschluss-Gründe protokolliert.
  const ausgeschlossen: AusgeschlossenerMa[] = [];
  const hauptIds = new Set<string>();
  const nebenIds = new Set<string>();
  for (const ma of Object.values(mitarbeiter)) {
    const istHaupt = ma.hauptKategorie === primaer;
    const istNeben = !istHaupt && (ma.nebenKategorien ?? []).includes(primaer);
    if (!istHaupt && !istNeben) continue;  // nicht kategorie-relevant → nicht gelistet

    if (!ma.aktiv) {
      ausgeschlossen.push({ anonId: ma.anonId, grund: 'inaktiv', hauptKategorie: ma.hauptKategorie });
      continue;
    }
    // v2.61: Wer kein Stunden-Kontingent gepflegt hat (jahresKapazitaetProTyp
    // leer → effektiveJahresStunden 0), ist keine buchbare Ressource → kein
    // Antrag. Harter Ausschluss (anders als das weiche Modell für >0-aber-
    // ausgelastete MAs); als Grund gelistet, damit die PL die Lücke sieht.
    if (effektiveJahresStunden(ma) <= 0) {
      ausgeschlossen.push({ anonId: ma.anonId, grund: 'keine-stunden', hauptKategorie: ma.hauptKategorie });
      continue;
    }
    // v2.2: Antragstyp-Praeferenz — MAs die diesen Antragstyp gar nicht
    // bearbeiten (FuE/DS/DL/NW) fallen raus.
    if (!matchesAntragstyp(antrag, ma)) {
      ausgeschlossen.push({ anonId: ma.anonId, grund: 'antragstyp', hauptKategorie: ma.hauptKategorie });
      continue;
    }
    if (ma.abgemeldet.includes(config.aktuellesQuartal)) {
      ausgeschlossen.push({ anonId: ma.anonId, grund: 'abgemeldet', hauptKategorie: ma.hauptKategorie });
      continue;
    }
    // MA ohne Onboarding UND ohne hist. Antraege: kein verlaesslicher Score.
    if (!ma.onboardingAbgeschlossen && (historischeDeskriptorenByAnon.get(ma.anonId) ?? []).length === 0) {
      ausgeschlossen.push({ anonId: ma.anonId, grund: 'kein-onboarding', hauptKategorie: ma.hauptKategorie });
      continue;
    }
    (istHaupt ? hauptIds : nebenIds).add(ma.anonId);
  }
  if (hauptIds.size === 0 && nebenIds.size === 0) {
    return { vorschlaege: [], nebenkompetenz: [], ausgeschlossen };
  }

  // 2) Pool-unabhängige Vorberechnungen (einmal für beide Pässe).
  const queryText = buildQueryText(antrag);
  const anzahlTV = input.anzahlTV ?? 1;
  // v2.4: Wenn der Aufrufer einen aggregierten Auslastungs-Index mitgibt,
  // nutzen wir den (fest + pending) — sonst Fallback auf Store-only-Logik.
  const quartalsVerbrauchByAnon = input.auslastungByAnon
    ? mapAuslastungToVerbrauch(input.auslastungByAnon)
    : computeVerbrauchByAnon(zuweisungen, config.aktuellesQuartal);
  const restTageImQuartal = input.tageImQuartal ?? tageImQuartal(config.aktuellesQuartal);
  const aspektBonusPerMatch = config.aspektBonus ?? 0.10;
  const quartalsEndeBonusTage = config.quartalsEndeBonusTage ?? 21;
  // v2.31: Kompetenz-Tabelle wird GLEICH gewichtet wie die Historie (50/50-Blend
  // in der Score-Berechnung unten). Ersetzt den alten multiplikativen Level-Daempfer
  // (kompetenzLevelGewicht) + den Wenig-Historie-Boost (kompetenzMatrixSparse*),
  // der einen ≈0-Historie-Score multiplikativ nicht anheben konnte.
  const kompetenzMatrixMatchGewicht = config.kompetenzMatrixMatchGewicht ?? 0.5;
  const kontingentGewicht = config.kontingentGewicht ?? 0.3;
  // Multiplikativer Kapazitäts-Malus: zieht ausgelastete MAs deutlich nach unten
  // (nicht nur additiv im gewichtungBalance-Term). 0 = aus (altes Verhalten).
  const auslastungMalus = config.auslastungMalus ?? 0.6;
  const antragBucket = getKategorieLabel((antrag as Record<string, unknown>).vb_phase);
  // v2.31: Antragstyp-spezifische Stunden pro TV (Bucket bekannt → per-Typ-Faktor,
  // z.B. DS 4,5 h statt 9 h). Ohne Override → Standard. Speist Stundenbedarf
  // (kapazitaetsScore) UND die Pro-Typ-Kontingent-Deckelung.
  const stundenProTVAntrag = stundenProTVFor(config, antragBucket);
  const benoetigt = stundenProTVAntrag * anzahlTV;
  // v2.16: Verbrauch je Typ aus fest+pending (auslastungByAnon) — derselbe
  // Index wie das per-Typ-Kapazitätsmodell. Fallback (Tests/kein Index): nur
  // Store-Zuweisungen via computeKontingentVerbrauch.
  const kontingentVerbrauch = input.auslastungByAnon
    ? verbrauchFromAuslastung(input.auslastungByAnon)
    : computeKontingentVerbrauch(zuweisungen, input.antraegeIndex, config.aktuellesQuartal);

  // 3) Scoring eines Pools (BM25 + α + Embedding + Kapazität), isoliert
  //    normalisiert. Sortiert absteigend nach finalScore.
  function scorePool(eligibleAnonIds: Set<string>, matchKind: 'haupt' | 'neben'): MatchResult[] {
    if (eligibleAnonIds.size === 0) return [];

    const bm25Results = runBm25Matching({
      queryText,
      eligibleAnonIds,
      mitarbeiter,
      historischeDeskriptorenByAnon,
      plTechnologieGewicht: config.plTechnologieGewicht ?? 2,
    });
    const bm25ByAnon = new Map(bm25Results.map(r => [r.anonId, r]));

    const alpha = computeAlpha(bm25Results);

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

    const out: MatchResult[] = [];
    for (const anonId of eligibleAnonIds) {
      const ma = mitarbeiter[anonId]!;

      // Kapazitaet inkl. Abschlag — weiches Modell, kein harter Filter mehr.
      const abschlag = Math.max(0, Math.min(100, ma.abschlagProzent ?? 0));
      const quartalsKap = (effektiveJahresStunden(ma) * (1 - abschlag / 100)) / 4;
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
      // v2.15: jeder Aspekt-Treffer wird mit dem Kompetenz-Level des MAs in der
      // Aspekt-Ueberkategorie gewichtet (ohne Matrix → Faktor 1.0 = altes Verhalten).
      const nebenSet = new Set(ma.nebenKategorien ?? []);
      const aspektMatchIds = aspekte.filter(a => nebenSet.has(a));
      let aspektBonusValue = 0;
      for (const a of aspektMatchIds) {
        aspektBonusValue += aspektBonusPerMatch * normLevelForUeber(ma.kompetenzMatrix, a);
      }

      // v2.31: Historie-Signal (BM25 + Embedding aus aehnlichen Alt-Antraegen)
      // und PL-Kompetenztabelle werden GLEICH gewichtet (50/50-Blend). Die Tabelle
      // BOOSTET einen MA additiv-parallel (statt nur multiplikativ zu daempfen wie
      // bis v2.15) — ein MA mit wenig aehnlicher Historie aber eingetragener
      // Kompetenz in der Primaerkategorie rutscht so nach oben. Ohne Matrix-Eintrag
      // fuer die Primaerkat. (matrixScore === undefined) zaehlt nur die Historie →
      // keine Regression fuer MAs ohne Tabellen-Bewertung.
      const histScore = clamp01(alpha * bm25 + (1 - alpha) * emb + astBoost);
      const matrixScore = matrixScoreForUeber(ma.kompetenzMatrix, primaer);
      const baseKompetenz = matrixScore === undefined
        ? histScore
        : (1 - kompetenzMatrixMatchGewicht) * histScore
          + kompetenzMatrixMatchGewicht * matrixScore;
      const kompetenz = clamp01(baseKompetenz + aspektBonusValue);
      const balance = quartalsKap > 0 ? Math.max(0, rest) / quartalsKap : 0;
      const kapScore = kapazitaetsScore(rest, benoetigt, restTageImQuartal, quartalsEndeBonusTage);

      // v2.15: Antragstyp-Kontingent — weicher Malus bei erschoepftem Pro-Typ-
      // Kontingent (kein harter Filter). Ohne Kontingent → Score 1.0.
      const kInfo = kontingentInfoFor(ma, antragBucket, kontingentVerbrauch.get(anonId), stundenProTVAntrag);

      // Balance + KapScore werden gemeinsam in die `gewichtungBalance`-Komponente
      // eingewogen (je zur Haelfte). Behaelt das alte Verhalten bei voller
      // Kapazitaet (balance≈1.0, kapScore≈1.0 → gewichtungBalance × 1.0), aber
      // ueberbuchte MAs rutschen sanft ab statt rauszufallen. Das Kontingent
      // skaliert den finalScore multiplikativ (weicher Typ-Deckel).
      // Zusaetzlich ein multiplikativer Kapazitaets-Malus: bei freier Kapazitaet
      // (kapScore≈1.0) Faktor ≈1.0, bei ausgelastet/ueberbucht deutlich <1 — so
      // fallen volle MAs praktisch immer unter freie, bleiben aber im Notfall
      // sichtbar (kein harter Filter). auslastungMalus=0 → Faktor 1.0 (alt).
      const kapMultiplier = (1 - auslastungMalus) + auslastungMalus * kapScore;
      const finalScore =
        (kompetenz * config.gewichtungKompetenz
          + (balance * 0.5 + kapScore * 0.5) * config.gewichtungBalance)
        * ((1 - kontingentGewicht) + kontingentGewicht * kInfo.score)
        * kapMultiplier;

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
        // v2.15: Antragstyp-Kontingent
        kontingentScore: kInfo.score,
        kontingentRest: kInfo.rest ?? undefined,
        // v2.16: Quartals-Kontingent (Anträge) für „v/N frei" im Vorschlag.
        kontingentQuartal: kInfo.kontingentQ ?? undefined,
        // v2.48: Score-Aufschlüsselung für die Transparenz-Anzeige.
        breakdown: {
          matchKind,
          alpha,
          histScore,
          matrixScore: matrixScore ?? null,
          matrixGewicht: kompetenzMatrixMatchGewicht,
        },
      });
    }

    out.sort((a, b) => b.finalScore - a.finalScore);
    return out;
  }

  const topN = input.topN ?? 3;
  const hauptScored = scorePool(hauptIds, 'haupt');
  const nebenScored = scorePool(nebenIds, 'neben');

  // Haupt-MAs jenseits des Top-N-Schnitts werden als Ausschluss „rang"
  // protokolliert — so versteht die PL, dass sie zwar passen, aber knapp
  // unter dem Schnitt liegen. (Neben-MAs werden nicht zusätzlich als „rang"
  // gelistet — sie stehen bereits in ihrem eigenen Block.)
  for (const m of hauptScored.slice(topN)) {
    ausgeschlossen.push({
      anonId: m.anonId,
      grund: 'rang',
      hauptKategorie: mitarbeiter[m.anonId]?.hauptKategorie,
      kompetenzScore: m.kompetenzScore,
    });
  }

  return {
    vorschlaege: hauptScored.slice(0, topN),
    nebenkompetenz: nebenScored.slice(0, topN),
    ausgeschlossen,
  };
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

/** Summiert verbrauchte Stunden pro MA fuer ein gegebenes Quartal aus dem
 *  Zuweisungs-Store. Wird nur noch als Fallback genutzt — die Hauptlogik
 *  fuer v2.4 ist `computeQuartalsAuslastung` (fest+pending). */
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

/** v2.4: Aggregiert `fest+pending`-Stunden pro MA zu einer Verbrauchs-Map.
 *  Wird intern in der Matching-Engine genutzt, wenn der Aufrufer den
 *  Auslastungs-Index liefert. */
function mapAuslastungToVerbrauch(
  byAnon: Map<string, MaQuartalsAuslastung>,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const [anonId, a] of byAnon) {
    map.set(anonId, a.fest.stunden + a.pending.stunden);
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
