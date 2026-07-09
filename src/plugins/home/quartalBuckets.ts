/**
 * Quartals-Bucketing für den Home-Rückstands-Balken.
 *
 * Sortiert die eigenen offenen Anträge (`meineAntraege`) nach dem Alter ihres
 * `antragsdatum` in vier Segmente — aktuelles Quartal · Q-1 · Q-2 · Q-3 und
 * älter —, damit der Balken auf der Home-Page den persönlichen Rückstand zeigt
 * (Vorlage: Auslastungs-Altlast-Balken, aber inkl. aktuellem Quartal und ohne
 * Q-7-Cap, damit ALLE offenen Anträge erfasst sind).
 *
 * Bewusst selbstständig (keine Auslastungs-Imports): der Balken rendert in ALLEN
 * Build-Varianten (prod/as/pl/kurator/dev), auch wenn das Auslastungs-Modul aus
 * ist. Reine Kalender-Arithmetik über `year*4 + quartalIndex`.
 */
import type { AntragVorgang } from './useDashboardData';

/** Bucket-Index: 0 = aktuelles Quartal, 1 = Q-1, 2 = Q-2, 3 = Q-3 und älter. */
export type QuartalBucketIndex = 0 | 1 | 2 | 3;

export interface QuartalBucket {
  /** Semantischer Index (0 = aktuell … 3 = Q-3 und älter). */
  index: QuartalBucketIndex;
  /** Anzahl Anträge (Verbünde als ein Eintrag) in diesem Segment. */
  count: number;
  /** Summe der TVs über die Anträge dieses Segments. */
  tvs: number;
  /** Die konkreten Anträge dieses Segments (für den Hover-Tooltip). */
  rows: AntragVorgang[];
}

export interface QuartalBucketResult {
  /** Genau vier Buckets, nach Index (0..3) sortiert. */
  buckets: [QuartalBucket, QuartalBucket, QuartalBucket, QuartalBucket];
  /** Anzahl datierbarer, gebucketeter Anträge (undatierbare zählen NICHT mit). */
  totalAntraege: number;
  /** TV-Summe über die gebucketeten Anträge. */
  totalTvs: number;
}

/**
 * Parst ein rohes `antragsdatum` (`YYYY-MM-DD` oder `YYYY/MM/DD`) in eine
 * sortierbare Quartalszahl `year*4 + (quartalIndex 0..3)`. `null` bei fehlendem
 * oder unplausiblem Datum.
 */
export function antragsdatumToQuartalNum(datum: string | undefined | null): number | null {
  if (typeof datum !== 'string') return null;
  const m = datum.trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]); // 1..12
  if (!Number.isFinite(year) || month < 1 || month > 12) return null;
  const quartalIndex = Math.floor((month - 1) / 3); // 0..3
  return year * 4 + quartalIndex;
}

/** Aktuelle Quartalszahl (UTC-Kalender, deterministisch für Tests). */
export function currentQuartalNum(now: Date): number {
  const year = now.getUTCFullYear();
  const quartalIndex = Math.floor(now.getUTCMonth() / 3); // 0..3
  return year * 4 + quartalIndex;
}

/**
 * Ordnet ein `antragsdatum` einem Bucket zu:
 * `0` = aktuelles Quartal, `1` = Q-1, `2` = Q-2, `3` = Q-3 **und älter**.
 * `null` = zukünftig (sollte nicht vorkommen) oder undatierbar.
 */
export function quartalBucketIndex(
  datum: string | undefined | null,
  now: Date,
): QuartalBucketIndex | null {
  const q = antragsdatumToQuartalNum(datum);
  if (q === null) return null;
  const diff = currentQuartalNum(now) - q;
  if (diff < 0) return null; // Zukunft
  if (diff === 0) return 0;
  if (diff === 1) return 1;
  if (diff === 2) return 2;
  return 3; // Q-3 und älter (kein oberes Cap)
}

/**
 * Verteilt die offenen Anträge auf die vier Quartals-Buckets. Undatierbare
 * Anträge fallen aus dem Balken; `totalAntraege`/`totalTvs` zählen nur die
 * gebucketeten Zeilen — so bleiben Balken und Header konsistent.
 */
export function bucketMeineAntraege(antraege: readonly AntragVorgang[], now: Date): QuartalBucketResult {
  const buckets: QuartalBucketResult['buckets'] = [
    { index: 0, count: 0, tvs: 0, rows: [] },
    { index: 1, count: 0, tvs: 0, rows: [] },
    { index: 2, count: 0, tvs: 0, rows: [] },
    { index: 3, count: 0, tvs: 0, rows: [] },
  ];
  let totalAntraege = 0;
  let totalTvs = 0;

  for (const a of antraege) {
    const idx = quartalBucketIndex(a.antragsdatum, now);
    if (idx === null) continue;
    const tvs = a.tv_count ?? 1;
    const bucket = buckets[idx];
    bucket.count += 1;
    bucket.tvs += tvs;
    bucket.rows.push(a);
    totalAntraege += 1;
    totalTvs += tvs;
  }

  return { buckets, totalAntraege, totalTvs };
}
