/**
 * Onboarding-Kalibrierung — vergleicht zwei Rankings:
 *   A) Ground Truth: nur historische Antraege des MA (echte TIB_KUERZ)
 *   B) Onboarding:   nur virtuelle Projekte aus dem Swipe
 *
 * Liefert Spearman-Rang-Korrelation, Top-3-Overlap und eine Grid-Search
 * ueber die Confidence-Faktoren ("Kann ich"/0.1..1.0 × "Teilweise"/0.1..1.0).
 *
 * Algorithmus-Skizze:
 *  1. Pro Antrag im Scope berechne Score A (nur hist. Antraege als virtuelle
 *     Projekte mit confidence 1.0)
 *  2. Pro Antrag berechne Score B (nur die Onboarding-Bewertungen als
 *     virtuelle Projekte, mit gegebenen Confidence-Faktoren)
 *  3. Score-Vektoren -> Rang-Vektoren -> Spearman
 *  4. Top-3 (hoechste Scores) -> Overlap |A ∩ B| / 3
 *  5. Grid-Search: variiere Confidence-Faktoren, finde Max-Spearman
 */
import type { Antrag } from '@/core/services/csv/types';
import type {
  OnboardingBewertung,
  OnboardingBewertungEintrag,
  UeberKategorie,
  VirtuellesProjekt,
} from '../types';
import { CANONICAL_TIB_KUERZ, ONBOARDING_CONFIDENCE } from '../types';
import { cosineSimilarity } from './embed-wrapper';
import { normalizeKuerzel } from './anonym-map';
import { readAntragDeskriptoren } from './profil-aggregator';

/** Rang-Vektor: gleiche Werte bekommen den durchschnittlichen Rang. */
export function ranks(values: number[]): number[] {
  const n = values.length;
  const indexed = values.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => b.v - a.v);  // descending (hohe Scores = Rang 1)
  const out = new Array<number>(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && indexed[j + 1]!.v === indexed[i]!.v) j++;
    const avgRank = (i + j) / 2 + 1;   // 1-basiert
    for (let k = i; k <= j; k++) out[indexed[k]!.i] = avgRank;
    i = j + 1;
  }
  return out;
}

/** Spearman ueber Rang-Korrelation. -1..1. */
export function spearmanCorrelation(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length < 2) return 0;
  const rA = ranks(a);
  const rB = ranks(b);
  // Pearson ueber die Raenge
  const n = a.length;
  let sumA = 0, sumB = 0;
  for (let i = 0; i < n; i++) { sumA += rA[i]!; sumB += rB[i]!; }
  const meanA = sumA / n, meanB = sumB / n;
  let cov = 0, varA = 0, varB = 0;
  for (let i = 0; i < n; i++) {
    const dA = rA[i]! - meanA;
    const dB = rB[i]! - meanB;
    cov += dA * dB;
    varA += dA * dA;
    varB += dB * dB;
  }
  const denom = Math.sqrt(varA * varB);
  if (denom === 0) return 0;
  return cov / denom;
}

/**
 * Berechnet pro Antrag im Scope einen Score basierend auf einer Liste
 * virtueller Projekte. Logik analog zu `embedding-matcher.runEmbeddingMatching`
 * — aber vereinfacht, weil wir nur EINEN MA betrachten.
 *
 * Score = sum(similarity × confidence) ueber alle virtuellen Projekte
 *         deren Embedding mit dem Antrag-Embedding cosine-aehnlich ist.
 *
 * Da hier die Embeddings ggf. nicht alle verfuegbar sind, fallback: BM25-
 * artiger Deskriptoren-Overlap. Wir nutzen den einfachen Ansatz:
 *
 *   pro Antrag:
 *     score = max ueber alle virt. Projekte (kein Embedding: similarity = 1
 *             wenn Aktenzeichen = virtuelles, sonst 0)
 *
 * Fuer den Kalibrierungs-Use-Case ist das ausreichend, weil Ground-Truth-
 * Vergleich nur die rohe Praesenz/Absenz relevant macht.
 *
 * Wenn Embeddings vorliegen (corpus), nutzen wir sie fuer die Aehnlichkeit.
 */
export interface CalibrationInputBase {
  antraege: Antrag[];                          // alle Antraege im Scope
  corpusEmbeddings?: Map<string, number[]>;    // optional, fuer praezisere Aehnlichkeit
}

interface ScoreInput {
  antraege: Antrag[];
  virtuelleProjekte: VirtuellesProjekt[];
  corpus?: Map<string, number[]>;
}

function computeScores({ antraege, virtuelleProjekte, corpus }: ScoreInput): Map<string, number> {
  const scoresByAz = new Map<string, number>();
  const virtMap = new Map(virtuelleProjekte.map(vp => [vp.antragId, vp.confidence]));

  for (const a of antraege) {
    let score = 0;
    if (corpus) {
      const queryVec = corpus.get(a.aktenzeichen);
      if (queryVec) {
        for (const [virtAz, conf] of virtMap.entries()) {
          const targetVec = corpus.get(virtAz);
          if (!targetVec) continue;
          const sim = cosineSimilarity(queryVec, targetVec);
          if (sim > 0) score += sim * conf;
        }
      }
    } else {
      // Fallback: Deskriptoren-Overlap zaehlen. Score pro virtuellem Projekt:
      // gemeinsame Deskriptoren-Anteil * conf
      const aDesc = new Set(readAntragDeskriptoren(a));
      for (const a2 of antraege) {
        const conf = virtMap.get(a2.aktenzeichen);
        if (conf == null || conf === 0) continue;
        const bDesc = new Set(readAntragDeskriptoren(a2));
        let overlap = 0;
        for (const d of aDesc) if (bDesc.has(d)) overlap++;
        if (overlap > 0) score += (overlap / Math.max(1, aDesc.size)) * conf;
      }
    }
    scoresByAz.set(a.aktenzeichen, score);
  }
  return scoresByAz;
}

/** Konvertiert Onboarding-Bewertungen in virtuelle Projekte mit gegebenen Confidences. */
export function bewertungenToVirtuell(
  bewertungen: OnboardingBewertungEintrag[],
  confKannIch: number,
  confTeilweise: number,
): VirtuellesProjekt[] {
  const out: VirtuellesProjekt[] = [];
  for (const b of bewertungen) {
    if (b.bewertung === 'nicht_meins') continue;
    const conf = b.bewertung === 'kann_ich' ? confKannIch : confTeilweise;
    if (conf <= 0) continue;
    out.push({ antragId: b.aktenzeichen, confidence: conf });
  }
  return out;
}

/** Pro MA: alle historischen Antraege als virtuelle Projekte mit confidence=1. */
export function historicalAsVirtuell(antraege: Antrag[], kuerzel: string): VirtuellesProjekt[] {
  const key = normalizeKuerzel(kuerzel);
  if (!key) return [];
  const out: VirtuellesProjekt[] = [];
  for (const a of antraege) {
    const tib = normalizeKuerzel((a as Record<string, unknown>)[CANONICAL_TIB_KUERZ]);
    if (tib === key) out.push({ antragId: a.aktenzeichen, confidence: 1.0 });
  }
  return out;
}

export interface SingleCalibration {
  spearman: number;
  top3Overlap: number;
  scoresA: Map<string, number>;
  scoresB: Map<string, number>;
}

/** Eine einzelne Ranking-Berechnung mit gegebenen Confidence-Faktoren. */
export function calibrateSingle(input: {
  scope: Antrag[];
  histVirtuell: VirtuellesProjekt[];
  swipeVirtuell: VirtuellesProjekt[];
  corpus?: Map<string, number[]>;
}): SingleCalibration {
  const A = computeScores({
    antraege: input.scope, virtuelleProjekte: input.histVirtuell, corpus: input.corpus,
  });
  const B = computeScores({
    antraege: input.scope, virtuelleProjekte: input.swipeVirtuell, corpus: input.corpus,
  });
  const azList = input.scope.map(a => a.aktenzeichen);
  const aVec = azList.map(az => A.get(az) ?? 0);
  const bVec = azList.map(az => B.get(az) ?? 0);
  const sp = spearmanCorrelation(aVec, bVec);

  // Top-3
  const topA = [...A.entries()].sort((x, y) => y[1] - x[1]).slice(0, 3).map(([az]) => az);
  const topB = [...B.entries()].sort((x, y) => y[1] - x[1]).slice(0, 3).map(([az]) => az);
  const overlap = topA.filter(az => topB.includes(az)).length / 3;

  return { spearman: sp, top3Overlap: overlap, scoresA: A, scoresB: B };
}

export interface GridCell {
  kannIch: number;
  teilweise: number;
  spearman: number;
  top3Overlap: number;
}

/**
 * Grid-Search ueber confidence-Faktoren 0.1..1.0 (Schritt 0.1).
 * 100 Iterationen pro MA — bei 50 Antraegen im Scope ein paar Sekunden.
 */
export function gridSearchOptimalConfidence(input: {
  scope: Antrag[];
  histVirtuell: VirtuellesProjekt[];
  bewertungen: OnboardingBewertungEintrag[];
  corpus?: Map<string, number[]>;
  step?: number;
}): { grid: GridCell[]; best: GridCell } {
  const step = input.step ?? 0.1;
  const grid: GridCell[] = [];
  let best: GridCell = { kannIch: 0.7, teilweise: 0.3, spearman: -2, top3Overlap: 0 };
  for (let k = step; k <= 1.0 + 1e-9; k += step) {
    for (let t = step; t <= k + 1e-9; t += step) {   // Constraint: t <= k (Teilweise nie hoeher als Kann)
      const virt = bewertungenToVirtuell(input.bewertungen, Math.round(k * 10) / 10, Math.round(t * 10) / 10);
      const r = calibrateSingle({
        scope: input.scope,
        histVirtuell: input.histVirtuell,
        swipeVirtuell: virt,
        corpus: input.corpus,
      });
      const cell: GridCell = {
        kannIch: Math.round(k * 10) / 10,
        teilweise: Math.round(t * 10) / 10,
        spearman: r.spearman,
        top3Overlap: r.top3Overlap,
      };
      grid.push(cell);
      if (cell.spearman > best.spearman) best = cell;
    }
  }
  return { grid, best };
}

/**
 * Klassifizierungs-Accuracy: stimmt die automatische Ueberkategorie-Zuordnung
 * (aus dem Deskriptoren-Mapping) mit dem ueberein, was die historischen
 * Antraege des MA ergeben? Wir vergleichen pro Antrag die "abgeleitete"
 * vs. "expected"-Kategorie. Da beide aus den gleichen Quellen kommen, ist
 * das in der Praxis ein Konsistenz-Check auf das Mapping.
 */
export function klassifizierungsAccuracy(
  histAntraege: Antrag[],
  kategorien: UeberKategorie[],
): number {
  if (histAntraege.length === 0) return 1;
  const descToKats = new Map<string, string[]>();
  for (const k of kategorien) {
    for (const d of k.deskriptorenMapping) {
      const key = d.toLowerCase();
      const arr = descToKats.get(key) ?? [];
      arr.push(k.id);
      descToKats.set(key, arr);
    }
  }
  let matched = 0;
  for (const a of histAntraege) {
    const desc = readAntragDeskriptoren(a);
    let any = false;
    for (const d of desc) {
      if (descToKats.has(d)) { any = true; break; }
    }
    if (any) matched++;
  }
  return matched / histAntraege.length;
}

/** Aggregations-Helfer fuer mehrere MAs. */
export function aggregateGridResults(perMaGrids: GridCell[][]): { best: GridCell; mean: number } {
  if (perMaGrids.length === 0) {
    return { best: { kannIch: 0.7, teilweise: 0.3, spearman: 0, top3Overlap: 0 }, mean: 0 };
  }
  // Wir gehen davon aus alle Grids haben die gleichen Cells in gleicher Reihenfolge.
  const ref = perMaGrids[0]!;
  let best: GridCell = { ...ref[0]!, spearman: -2 };
  let meanBestSpearman = 0;
  for (let i = 0; i < ref.length; i++) {
    let sum = 0;
    for (const g of perMaGrids) sum += g[i]!.spearman;
    const meanSpearman = sum / perMaGrids.length;
    if (meanSpearman > best.spearman) {
      best = { ...ref[i]!, spearman: meanSpearman };
      meanBestSpearman = meanSpearman;
    }
  }
  return { best, mean: meanBestSpearman };
}

/** Convenience-Default-Confidence-Faktoren. */
export const DEFAULT_KANN_ICH = ONBOARDING_CONFIDENCE.kann_ich;
export const DEFAULT_TEILWEISE = ONBOARDING_CONFIDENCE.teilweise;

/**
 * Liefert eine Erklärung fuer eine Abweichung in der Abweichungstabelle.
 */
export function explainDeviation(
  rangA: number, rangB: number,
  bewertung: OnboardingBewertung,
  hatHistorisch: boolean,
): string {
  if (rangA <= 10 && rangB > 10 && bewertung === 'nicht_meins') {
    return 'Historisch aktiv, im Swipe abgelehnt';
  }
  if (rangB <= 10 && rangA > 10 && !hatHistorisch && bewertung === 'kann_ich') {
    return 'Im Swipe bestätigt, historisch keine Projekte';
  }
  if (rangA <= 10 && rangB > 10) {
    return 'Historisch hoch, Onboarding niedrig';
  }
  if (rangB <= 10 && rangA > 10) {
    return 'Onboarding hoch, historisch niedrig';
  }
  return '';
}

