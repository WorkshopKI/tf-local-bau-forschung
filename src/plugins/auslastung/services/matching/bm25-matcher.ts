/**
 * Mini-BM25 fuer das MA-Matching.
 *
 * Pro MA wird ein "Dokument" zusammengebaut aus seinen aggregierten
 * historischen Deskriptoren + `manuelleTechnologien`. Der Antrag-Query ist
 * `verbund_titel + ' ' + titel + ' ' + projektbeschreibung_text`. Score per
 * BM25 Term-Overlap.
 *
 * Filter: Nur MAs der gleichen Ueberkategorie(n) wie der Antrag werden
 * matched.
 *
 * Confidence-Bands:
 *  - high   > 0.5
 *  - medium 0.2 - 0.5
 *  - low    < 0.2
 *
 * 30 MAs ist klein genug fuer eine eigene Mini-Impl. ~50 LOC, debug-bar.
 */
import type { AnonymerMitarbeiter } from '../../types';
import { kompetenzTokens } from '../klassifizierung/kompetenz-derivation';

// BM25-Parameter — Standard-Defaults.
const K1 = 1.5;
const B = 0.75;

/** Minimaler deutscher Stoppwortbestand. Embeddings spaeter spielen Semantik aus. */
const STOPWORDS = new Set([
  'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'eines', 'einem',
  'einer', 'einen', 'und', 'oder', 'aber', 'mit', 'ohne', 'von', 'vom', 'zu',
  'zum', 'zur', 'auf', 'an', 'im', 'in', 'um', 'fuer', 'für', 'bei', 'aus',
  'durch', 'sich', 'er', 'sie', 'es', 'wir', 'ihr', 'sich', 'auch', 'noch',
  'ist', 'sind', 'war', 'waren', 'sein', 'als', 'wie', 'wenn', 'dann', 'so',
  'nicht', 'kein', 'keine', 'doch', 'mehr', 'sehr', 'nur', 'schon', 'beim',
  'this', 'the', 'and', 'or', 'of', 'for', 'with', 'a', 'an', 'on', 'in',
]);

/** Tokenizer: lowercase, split auf nicht-alphanumerische Zeichen, Stoppwoerter raus. */
export function tokenize(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(t => t.length >= 2 && !STOPWORDS.has(t));
}

export interface MaDocument {
  anonId: string;
  /** Tokens + Tags des MA-Profils — fuer BM25. */
  tokens: string[];
  /** Set fuer "matchende Technologien" Anzeige. */
  technologien: string[];
}

export interface Bm25Result {
  anonId: string;
  score: number;
  /** Eingangs-Tokens des MAs die im Query waren (fuer UI-Anzeige). */
  matchendeTechnologien: string[];
  confidence: 'high' | 'medium' | 'low';
}

/** Baut Pro-MA-Dokument aus Profile-Deskriptoren + manuellen Tags.
 *
 *  v2.15: zusätzlich die level-gewichteten Unterkategorie-Labels der
 *  PL-Kompetenz-Matrix (`kompetenzTokens`: Level 3 ⇒ Token 3×). Diese fließen
 *  in die `tokens` (BM25-Termfrequenz, gewichtet Experten höher), aber NICHT in
 *  `technologien` (das treibt die „matchende Technologien"-Anzeige; dort sollen
 *  weiterhin nur echte Tags stehen). MAs ohne Matrix bleiben unverändert.
 *
 *  PL-Technologien: hat die PL die manuellen Tags eingetragen
 *  (`technologienQuelle === 'pl'`), werden sie mit `plTechnologieGewicht`-facher
 *  Term-Frequenz eingewoben (jedes Tag insgesamt N× in `tokens`) — kuratiertes
 *  Signal stärker gewichten, bis der MA es selbst pflegt. `technologien`
 *  (Anzeige) bleibt 1×. Default-Gewicht 1 = kein Boost (Backwards-Kompat für
 *  Direkt-Aufrufer/Tests; den Prod-Wert reicht `runBm25Matching` durch). */
export function buildMaDocument(
  ma: AnonymerMitarbeiter,
  historischeDeskriptoren: string[],
  plTechnologieGewicht = 1,
): MaDocument {
  const technologien = uniqueLower([
    ...historischeDeskriptoren,
    ...ma.manuelleTechnologien,
  ]);
  // Zusätzliche Kopien der PL-gesetzten manuellen Tags (über das eine Vorkommen
  // in `technologien` hinaus), um auf insgesamt N× Term-Frequenz zu kommen.
  const plBoost = ma.technologienQuelle === 'pl'
    ? Math.max(1, Math.floor(plTechnologieGewicht))
    : 1;
  const extraManuelleTokens: string[] = [];
  if (plBoost > 1) {
    for (const t of ma.manuelleTechnologien) {
      if (typeof t !== 'string') continue;
      const norm = t.trim().toLowerCase();
      if (!norm) continue;
      for (let i = 1; i < plBoost; i++) extraManuelleTokens.push(norm);
    }
  }
  const matrixTokens = kompetenzTokens(ma.kompetenzMatrix);
  const tokens = tokenize([...technologien, ...extraManuelleTokens, ...matrixTokens].join(' '));
  return {
    anonId: ma.anonId,
    tokens,
    technologien,
  };
}

function uniqueLower(arr: string[]): string[] {
  const set = new Set<string>();
  for (const v of arr) {
    if (typeof v !== 'string') continue;
    const t = v.trim().toLowerCase();
    if (t) set.add(t);
  }
  return [...set];
}

/**
 * Klassischer BM25-Score gegen ein Korpus.
 *
 * Konstanten: K1=1.5, B=0.75 (Standard).
 * Korpus-Durchschnitt wird aus den uebergebenen Dokumenten berechnet.
 */
export function bm25Score(
  queryTokens: string[],
  doc: MaDocument,
  allDocs: MaDocument[],
): number {
  if (doc.tokens.length === 0 || queryTokens.length === 0) return 0;
  const docFreq = new Map<string, number>();
  for (const d of allDocs) {
    const seen = new Set(d.tokens);
    for (const t of seen) docFreq.set(t, (docFreq.get(t) ?? 0) + 1);
  }
  const N = allDocs.length;
  const avgDl = allDocs.reduce((s, d) => s + d.tokens.length, 0) / Math.max(1, N);

  // Term-Frequenz im Dokument
  const tf = new Map<string, number>();
  for (const t of doc.tokens) tf.set(t, (tf.get(t) ?? 0) + 1);

  let score = 0;
  const dl = doc.tokens.length;
  for (const qt of queryTokens) {
    const df = docFreq.get(qt) ?? 0;
    if (df === 0) continue;
    const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
    const f = tf.get(qt) ?? 0;
    if (f === 0) continue;
    const denom = f + K1 * (1 - B + B * (dl / avgDl));
    score += idf * ((f * (K1 + 1)) / denom);
  }
  return score;
}

export interface RunBm25Input {
  queryText: string;
  eligibleAnonIds: Set<string>;       // bereits gefiltert nach Ueberkategorie
  mitarbeiter: Record<string, AnonymerMitarbeiter>;
  historischeDeskriptorenByAnon: Map<string, string[]>;
  /** Token-Multiplikator für PL-gesetzte manuelle Technologien
   *  (`technologienQuelle === 'pl'`). Default 1 = kein Boost. */
  plTechnologieGewicht?: number;
}

/**
 * Hauptfunktion: ermittelt BM25-Scores fuer alle eligible MAs.
 * Normalisiert auf [0, 1] indem durch Max-Score geteilt wird.
 */
export function runBm25Matching(input: RunBm25Input): Bm25Result[] {
  const queryTokens = tokenize(input.queryText);
  const queryTokenSet = new Set(queryTokens);

  const plTechnologieGewicht = input.plTechnologieGewicht ?? 1;
  const docs: MaDocument[] = [];
  for (const anonId of input.eligibleAnonIds) {
    const ma = input.mitarbeiter[anonId];
    if (!ma) continue;
    const desk = input.historischeDeskriptorenByAnon.get(anonId) ?? [];
    docs.push(buildMaDocument(ma, desk, plTechnologieGewicht));
  }

  if (docs.length === 0 || queryTokens.length === 0) return [];

  const raw: Array<{ anonId: string; score: number; tech: string[] }> = [];
  for (const doc of docs) {
    const score = bm25Score(queryTokens, doc, docs);
    // Matchende Technologien: Tags des MAs die mindestens ein Query-Token enthalten
    const matched: string[] = [];
    for (const tech of doc.technologien) {
      const techTokens = tokenize(tech);
      if (techTokens.some(t => queryTokenSet.has(t))) matched.push(tech);
    }
    raw.push({ anonId: doc.anonId, score, tech: matched });
  }

  // Normalize: durch max teilen -> [0, 1]
  const max = raw.reduce((m, r) => Math.max(m, r.score), 0);
  if (max === 0) return [];

  return raw.map(r => {
    const score = r.score / max;
    return {
      anonId: r.anonId,
      score,
      matchendeTechnologien: r.tech,
      confidence: bm25Confidence(score),
    };
  }).sort((a, b) => b.score - a.score);
}

function bm25Confidence(s: number): 'high' | 'medium' | 'low' {
  if (s >= 0.5) return 'high';
  if (s >= 0.2) return 'medium';
  return 'low';
}
