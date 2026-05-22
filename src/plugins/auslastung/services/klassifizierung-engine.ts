/**
 * Klassifizierungs-Engine — ordnet einen Antrag einer oder zwei Ueberkategorien zu.
 *
 * Zweistufig:
 *  - Stufe 1 (Regel): Deskriptoren -> Mapping -> Kategorien
 *  - Stufe 2 (Embedding-Fallback): Antrag-Titel-Embedding gegen Kategorie-Centroids
 *
 * Stufe 2 wird nur ausgeloest wenn:
 *  - `config.stage2Aktiv === true`
 *  - UND Stufe 1 keine eindeutige Antwort liefert (0 matches)
 *  - UND ein `queryEmbedding` mitgeliefert wird (Caller embed't, weil async)
 *
 * Multi-Label-Logik:
 *  - Stufe 1: alle matchenden Kategorien werden ausgegeben (kann 1..N sein,
 *    UI/Caller schneidet auf max 2 nach hoechster Confidence)
 *  - Stufe 2: Top-1, optional Top-2 wenn Differenz < `schwellwert`
 */
import type { Antrag } from '@/core/services/csv/types';
import {
  CANONICAL_VERBUND_ID,
  type KategorieVorschlag,
  type Klassifizierung,
  type UeberKategorie,
} from '../types';
import { readAntragDeskriptoren, findTruthyZtField } from './profil-aggregator';
import { cosineSimilarity } from '@/core/services/embedding-corpus';
import { ZUKUNFTSTECHNOLOGIE_FELDER } from './default-labels';

export interface KlassifizierungInput {
  antrag: Antrag;
  kategorien: UeberKategorie[];
  /** Wenn gesetzt UND stage2Aktiv: Embedding-Fallback ist verfuegbar. */
  queryEmbedding?: number[];
  /** Multi-Label-Schwellwert: Differenz Top-1 vs Top-2. Default 0.15. */
  schwellwert?: number;
  /** Default false. */
  stage2Aktiv?: boolean;
}

export function klassifiziereAntrag(input: KlassifizierungInput): Klassifizierung {
  const { antrag, kategorien } = input;
  const schwellwert = input.schwellwert ?? 0.15;
  const stage2Aktiv = input.stage2Aktiv ?? false;

  // ─── Stufe 0: Direkte Zukunftstechnologie-Boolean-Flags ──────────────
  // Wenn der Antrag ZT-Spalten gesetzt hat (z.B. "Künstliche Intelligenz"-
  // Spalte hat Wert "X" oder "1"), direkt der entsprechenden Ueberkategorie
  // zuordnen. Wird vor dem Deskriptoren-Mapping aufgerufen, weil
  // praeziser. Filtert auf die in `kategorien` vorhandenen IDs (damit
  // wir nicht "DT" vorschlagen wenn PL die Kategorie umbenannt hat).
  const ztVorschlaege = matchZukunftstechnologien(antrag, kategorien);
  if (ztVorschlaege.length > 0) {
    return {
      antragId: antrag.aktenzeichen,
      vorgeschlageneKategorien: ztVorschlaege,
      freigegebeneKategorien: [],
      status: 'vorgeschlagen',
    };
  }

  // ─── Stufe 1: Regel-Mapping ───────────────────────────────────────────
  const deskriptoren = readAntragDeskriptoren(antrag);
  const regelVorschlaege = matchDeskriptoren(deskriptoren, kategorien);

  if (regelVorschlaege.length > 0) {
    return {
      antragId: antrag.aktenzeichen,
      vorgeschlageneKategorien: regelVorschlaege,
      freigegebeneKategorien: [],
      status: 'vorgeschlagen',
    };
  }

  // ─── Stufe 2: Embedding-Fallback ───────────────────────────────────────
  if (stage2Aktiv && input.queryEmbedding) {
    const embVorschlaege = matchEmbeddings(input.queryEmbedding, kategorien, schwellwert);
    return {
      antragId: antrag.aktenzeichen,
      vorgeschlageneKategorien: embVorschlaege,
      freigegebeneKategorien: [],
      status: 'vorgeschlagen',
    };
  }

  // ─── Kein Match — leerer Vorschlag, UI flaggt als "manuelle Klassifizierung noetig"
  return {
    antragId: antrag.aktenzeichen,
    vorgeschlageneKategorien: [],
    freigegebeneKategorien: [],
    status: 'vorgeschlagen',
  };
}

/**
 * Stage-0-Algorithmus: pruefe ZT-Boolean-Spalten aus der CSV
 * ("Künstliche", "Cloud Comp", "Gesundes L", ...). Diese sind direkt
 * mit einer Default-Ueberkategorie verknuepft (aus `default-labels.ts`).
 *
 * Truthy-Werte: `true`, `"X"`, `"x"`, `"1"`, `"true"`, `"ja"`, `"y"`.
 * Confidence: 1 Kategorie -> 1.0 (high), 2+ -> 0.8 (Multi-Label).
 *
 * Filtert auf die aktiven `kategorien` (PL kann eine Kategorie umbenannt
 * oder geloescht haben — wir matchen anhand der ID).
 */
export function matchZukunftstechnologien(
  antrag: Antrag,
  kategorien: UeberKategorie[],
): KategorieVorschlag[] {
  if (kategorien.length === 0) return [];
  const aktiveKategorien = new Set(kategorien.map(k => k.id));
  const treffer = new Map<string, number>();
  const rec = antrag as Record<string, unknown>;

  // Pro ZT-Klartext (TV+VB dedupliziert) genau ein Match-Versuch ueber alle
  // bekannten Slug-Kandidaten via findTruthyZtField — deckt sowohl Fixture-
  // Schemas (zt_kuenstliche_intelligenz_ki_tv) als auch Wizard-Imports mit
  // Label-XLS (kunstliche_intelligenz_ki) ab. Vorher pro-Feld-Match haette
  // bei Wizard-CSVs immer 0 Treffer ergeben.
  const seenKlartexte = new Set<string>();
  for (const zt of ZUKUNFTSTECHNOLOGIE_FELDER) {
    if (seenKlartexte.has(zt.klartext)) continue;
    seenKlartexte.add(zt.klartext);
    if (!aktiveKategorien.has(zt.defaultUeberKategorie)) continue;
    if (findTruthyZtField(rec, zt.klartext)) {
      treffer.set(zt.defaultUeberKategorie, (treffer.get(zt.defaultUeberKategorie) ?? 0) + 1);
    }
  }

  if (treffer.size === 0) return [];
  const confidence = treffer.size === 1 ? 1.0 : 0.8;
  return [...treffer.keys()].map(katId => ({
    kategorieId: katId,
    confidence,
    methode: 'regel' as const,
  }));
}

/**
 * Stufe-1-Algorithmus: zaehlt pro Kategorie wie viele Antrags-Deskriptoren
 * im Mapping enthalten sind. Confidence:
 *  - 1 Kategorie matched -> high (1.0)
 *  - 2+ Kategorien -> medium (0.7) je matchender Kategorie
 */
export function matchDeskriptoren(
  deskriptoren: string[],
  kategorien: UeberKategorie[],
): KategorieVorschlag[] {
  if (deskriptoren.length === 0 || kategorien.length === 0) return [];

  const lowerSet = new Set(deskriptoren.map(d => d.toLowerCase()));
  const hits: Array<{ kategorieId: string; count: number }> = [];

  for (const k of kategorien) {
    let count = 0;
    for (const map of k.deskriptorenMapping) {
      if (lowerSet.has(map.toLowerCase())) count++;
    }
    if (count > 0) hits.push({ kategorieId: k.id, count });
  }

  if (hits.length === 0) return [];

  // Multi-Label: 1 Kategorie -> high; 2+ -> medium
  const confidence = hits.length === 1 ? 1.0 : 0.7;
  return hits.map(h => ({
    kategorieId: h.kategorieId,
    confidence,
    methode: 'regel' as const,
  }));
}

/**
 * Stufe-2-Algorithmus: Cosine-Similarity gegen jeden Kategorie-Centroid.
 * Top-1 + (Top-2 wenn Differenz < schwellwert).
 *
 * Confidence: > 0.7 -> high, 0.4-0.7 -> medium, < 0.4 -> low.
 */
export function matchEmbeddings(
  query: number[],
  kategorien: UeberKategorie[],
  schwellwert: number,
): KategorieVorschlag[] {
  const scored: Array<{ kategorieId: string; sim: number }> = [];
  for (const k of kategorien) {
    if (!k.referenzEmbedding || k.referenzEmbedding.length === 0) continue;
    const sim = cosineSimilarity(query, k.referenzEmbedding);
    scored.push({ kategorieId: k.id, sim });
  }
  if (scored.length === 0) return [];

  scored.sort((a, b) => b.sim - a.sim);
  const top = scored[0]!;
  const out: KategorieVorschlag[] = [{
    kategorieId: top.kategorieId,
    confidence: clampToConfidence(top.sim),
    methode: 'embedding',
  }];

  if (scored.length > 1) {
    const second = scored[1]!;
    if (top.sim - second.sim < schwellwert) {
      out.push({
        kategorieId: second.kategorieId,
        confidence: clampToConfidence(second.sim),
        methode: 'embedding',
      });
    }
  }
  return out;
}

function clampToConfidence(sim: number): number {
  // Cosine-Sim ist [-1, 1] aber typischerweise [0, 1]. Direkt durchreichen,
  // UI mapped numerisch auf high/medium/low.
  if (sim < 0) return 0;
  if (sim > 1) return 1;
  return sim;
}

/**
 * Berechnet Centroid-Embeddings fuer alle Ueberkategorien aus der Map
 * (Klassifizierung -> Antrags-Embedding). Wird beim Corpus-Build aufgerufen.
 *
 * Input:
 *  - klassifizierungen[]: gibt an welcher Antrag in welcher Kategorie war
 *    (genutzt wird `freigegebeneKategorien` falls vorhanden, sonst
 *    `vorgeschlageneKategorien` Top-1)
 *  - embeddings: Map<aktenzeichen, number[]>
 */
export function computeKategorieCentroids(
  klassifizierungen: Klassifizierung[],
  embeddings: Map<string, number[]>,
  kategorien: UeberKategorie[],
): Map<string, number[]> {
  // Sammle pro Kategorie alle Embeddings
  const byKategorie = new Map<string, number[][]>();
  for (const k of kategorien) {
    byKategorie.set(k.id, []);
  }
  for (const klass of klassifizierungen) {
    const emb = embeddings.get(klass.antragId);
    if (!emb) continue;
    const targetKats = klass.freigegebeneKategorien.length > 0
      ? klass.freigegebeneKategorien
      : klass.vorgeschlageneKategorien.map(v => v.kategorieId);
    for (const katId of targetKats) {
      const list = byKategorie.get(katId);
      if (list) list.push(emb);
    }
  }

  // Mean-Centroid + L2-Normalisierung
  const result = new Map<string, number[]>();
  for (const [katId, vectors] of byKategorie.entries()) {
    if (vectors.length === 0) continue;
    const dim = vectors[0]!.length;
    const sum = new Array<number>(dim).fill(0);
    for (const v of vectors) {
      for (let i = 0; i < dim; i++) sum[i]! += v[i]!;
    }
    for (let i = 0; i < dim; i++) sum[i]! /= vectors.length;
    let norm = 0;
    for (let i = 0; i < dim; i++) norm += sum[i]! * sum[i]!;
    norm = Math.sqrt(norm);
    if (norm > 0) {
      for (let i = 0; i < dim; i++) sum[i]! /= norm;
    }
    result.set(katId, sum);
  }
  return result;
}

/**
 * Variante: Centroids aus Verbund-Embeddings statt pro-TV-Embeddings.
 *
 * Klassifizierungen sind pro TV (`antragId`) persistiert, aber bei
 * Verbund-Klassifizierung haben alle TVs eines Verbundes denselben Stand.
 * Wir deduplizieren deshalb pro Verbund-ID — sonst zaehlt ein 4-TV-Verbund
 * im Centroid vierfach.
 *
 * Lookup `antragId → verbund_id` kommt ueber die `antraege`-Liste; Antraege
 * ohne `verbund_id` werden mit ihrem `aktenzeichen` als Pseudo-Verbund-ID
 * behandelt (Solo-Verbund).
 */
export function computeKategorieCentroidsFromVerbund(
  klassifizierungen: Klassifizierung[],
  verbundEmbeddings: Map<string, number[]>,
  kategorien: UeberKategorie[],
  antraege: Antrag[],
): Map<string, number[]> {
  // Antrag-Lookup: aktenzeichen -> verbund_id (oder Solo-Pseudo-ID).
  const verbundIdByAktz = new Map<string, string>();
  for (const a of antraege) {
    const vid = (a as Record<string, unknown>)[CANONICAL_VERBUND_ID];
    const key = typeof vid === 'string' && vid.length > 0 ? vid : a.aktenzeichen;
    verbundIdByAktz.set(a.aktenzeichen, key);
  }

  // Pro Kategorie: Set von Verbund-IDs (deduplikation).
  const verbundIdsByKategorie = new Map<string, Set<string>>();
  for (const k of kategorien) {
    verbundIdsByKategorie.set(k.id, new Set());
  }
  for (const klass of klassifizierungen) {
    const verbundId = verbundIdByAktz.get(klass.antragId);
    if (!verbundId) continue;
    const targetKats = klass.freigegebeneKategorien.length > 0
      ? klass.freigegebeneKategorien
      : klass.vorgeschlageneKategorien.map(v => v.kategorieId);
    for (const katId of targetKats) {
      verbundIdsByKategorie.get(katId)?.add(verbundId);
    }
  }

  // Pro Kategorie: Mean der Verbund-Embeddings.
  const result = new Map<string, number[]>();
  for (const [katId, verbundIds] of verbundIdsByKategorie.entries()) {
    const vectors: number[][] = [];
    for (const vid of verbundIds) {
      const emb = verbundEmbeddings.get(vid);
      if (emb) vectors.push(emb);
    }
    if (vectors.length === 0) continue;
    const dim = vectors[0]!.length;
    const sum = new Array<number>(dim).fill(0);
    for (const v of vectors) {
      for (let i = 0; i < dim; i++) sum[i]! += v[i]!;
    }
    for (let i = 0; i < dim; i++) sum[i]! /= vectors.length;
    let norm = 0;
    for (let i = 0; i < dim; i++) norm += sum[i]! * sum[i]!;
    norm = Math.sqrt(norm);
    if (norm > 0) {
      for (let i = 0; i < dim; i++) sum[i]! /= norm;
    }
    result.set(katId, sum);
  }
  return result;
}
