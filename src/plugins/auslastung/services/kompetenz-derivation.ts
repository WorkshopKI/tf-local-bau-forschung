/**
 * Kompetenz-Matrix — reine Ableitungs- + Normalisierungs-Helfer (v2.15).
 *
 * Die PL-Kompetenz-Matrix (`AnonymerMitarbeiter.kompetenzMatrix`) hält pro
 * Überkategorie (IT/DT/EU/LG/NM) je Unterkategorie ein Level 1/2/3. Aus dieser
 * Matrix werden abgeleitet:
 *
 *  - `deriveHauptNeben` → Hauptkategorie (Pool-Gate im Matcher) + Nebenkategorien
 *    (Aspekt-Bonus). Die stärkste Überkategorie wird Haupt, weitere oberhalb der
 *    Schwelle werden Neben.
 *  - `normLevelForUeber` → 0..1-Faktor (max-Level / 3) für die Engine-Gewichtung.
 *  - `kompetenzTokens` → level-gewichtete Unterkat.-Labels (Level 3 = Token 3×)
 *    für den BM25-Profil-Doc.
 *
 * Alles pure + ohne Seiteneffekte → direkt unit-testbar (gleicher Pfad wie Prod).
 */
import {
  ALL_ANTRAGSTYP_BUCKETS,
  type AntragstypBucket,
  type KompetenzLevel,
  type KompetenzMatrix,
} from '../types';
import type { UeberkategorieId } from './default-labels';

/** Reihenfolge der Überkategorien für deterministische Tie-Breaks. Entspricht
 *  `DEFAULT_UEBERKATEGORIEN`. */
export const UEBER_ORDER: readonly UeberkategorieId[] = ['IT', 'DT', 'EU', 'LG', 'NM'];

/** Ab dieser Überkat.-Punktzahl (Σ Level) wird eine Überkategorie als
 *  Nebenkategorie geführt (≈ mind. 1× „vertieft" oder 2× „Grund"). */
export const NEBEN_SCHWELLE = 2;

const VALID_LEVELS: ReadonlySet<number> = new Set([1, 2, 3]);

function asLevel(v: unknown): KompetenzLevel | null {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').trim());
  return VALID_LEVELS.has(n) ? (n as KompetenzLevel) : null;
}

/**
 * Validiert/normalisiert Roh-JSON zu einer `KompetenzMatrix`. Behält nur
 * bekannte Überkategorie-IDs + Zellen mit gültigem Level (1/2/3). Leeres
 * Resultat → `undefined` (additiv: kein Feld statt leerem Objekt).
 */
export function normalizeKompetenzMatrix(raw: unknown): KompetenzMatrix | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: KompetenzMatrix = {};
  for (const ueber of UEBER_ORDER) {
    const sub = (raw as Record<string, unknown>)[ueber];
    if (!sub || typeof sub !== 'object') continue;
    const cells: Record<string, KompetenzLevel> = {};
    for (const [label, val] of Object.entries(sub as Record<string, unknown>)) {
      const key = label.trim();
      const lvl = asLevel(val);
      if (key && lvl) cells[key] = lvl;
    }
    if (Object.keys(cells).length > 0) out[ueber] = cells;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Validiert/normalisiert das Antrags-Kontingent (Anträge/Jahr) pro Typ.
 *  Negativwerte/NaN raus; leeres Resultat → undefined. */
export function normalizeKontingent(
  raw: unknown,
): Partial<Record<AntragstypBucket, number>> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: Partial<Record<AntragstypBucket, number>> = {};
  for (const bucket of ALL_ANTRAGSTYP_BUCKETS) {
    const v = (raw as Record<string, unknown>)[bucket];
    const n = typeof v === 'number' ? v : Number(String(v ?? '').trim().replace(',', '.'));
    if (Number.isFinite(n) && n > 0) out[bucket] = n;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Σ aller Levels einer Überkategorie (0 falls nicht vorhanden). */
export function ueberScore(matrix: KompetenzMatrix | undefined, ueber: UeberkategorieId): number {
  const cells = matrix?.[ueber];
  if (!cells) return 0;
  let s = 0;
  for (const lvl of Object.values(cells)) s += lvl;
  return s;
}

/** Anzahl Level-3-Zellen einer Überkategorie (Tie-Break-Kriterium). */
function countLevel3(matrix: KompetenzMatrix, ueber: UeberkategorieId): number {
  const cells = matrix[ueber];
  if (!cells) return 0;
  let c = 0;
  for (const lvl of Object.values(cells)) if (lvl === 3) c++;
  return c;
}

/**
 * Leitet Hauptkategorie (stärkste Überkat.) + Nebenkategorien (übrige oberhalb
 * `NEBEN_SCHWELLE`) aus der Matrix ab. Tie-Break: höhere Σ-Punktzahl → mehr
 * Level-3-Zellen → Reihenfolge in `order`.
 */
export function deriveHauptNeben(
  matrix: KompetenzMatrix | undefined,
  order: readonly UeberkategorieId[] = UEBER_ORDER,
): { hauptKategorie: string; nebenKategorien: string[] } {
  if (!matrix) return { hauptKategorie: '', nebenKategorien: [] };
  const scored = order
    .map(u => ({ u, score: ueberScore(matrix, u), top: countLevel3(matrix, u) }))
    .filter(e => e.score > 0);
  if (scored.length === 0) return { hauptKategorie: '', nebenKategorien: [] };

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.top !== a.top) return b.top - a.top;
    return order.indexOf(a.u) - order.indexOf(b.u);
  });

  const haupt = scored[0]!.u;
  const neben = scored
    .slice(1)
    .filter(e => e.score >= NEBEN_SCHWELLE)
    .map(e => e.u);
  return { hauptKategorie: haupt, nebenKategorien: neben };
}

/**
 * Normalisierter Kompetenz-Faktor (0..1) einer Überkategorie für die Engine-
 * Gewichtung: höchstes Level / 3. Experte (3) → 1.0, Grundkenntnis (1) → 0.33.
 * Überkat. nicht in der Matrix → 1.0 (neutral, kein Malus für MAs ohne Upload).
 */
export function normLevelForUeber(matrix: KompetenzMatrix | undefined, ueber: string): number {
  const cells = matrix?.[ueber as UeberkategorieId];
  if (!cells) return 1;
  let max = 0;
  for (const lvl of Object.values(cells)) if (lvl > max) max = lvl;
  return max > 0 ? max / 3 : 1;
}

/**
 * Additiver Kompetenz-Score (0..1) einer Überkategorie: höchstes Level / 3
 * (Experte (3) → 1.0, Grundkenntnis (1) → 0.33). Liefert `undefined`, wenn die
 * Matrix für diese Überkat. KEINE Zelle hat — damit „keine Bewertung" im
 * additiven 50/50-Blend (v2.31) NICHT als Signal (1.0) zählt, anders als
 * `normLevelForUeber` (das für den multiplikativen Aspekt-Bonus neutral-1.0
 * zurückgibt).
 */
export function matrixScoreForUeber(
  matrix: KompetenzMatrix | undefined,
  ueber: string,
): number | undefined {
  const cells = matrix?.[ueber as UeberkategorieId];
  if (!cells) return undefined;
  let max = 0;
  for (const lvl of Object.values(cells)) if (lvl > max) max = lvl;
  return max > 0 ? max / 3 : undefined;
}

/**
 * Level-gewichtete Unterkategorie-Tokens für den BM25-Profil-Doc: jedes
 * Unterkat.-Label wird `level`-fach eingefügt (Level 3 ⇒ 3×). Dadurch gewichtet
 * die BM25-Termfrequenz Experten-Kompetenzen höher. Leere Matrix → [].
 */
export function kompetenzTokens(matrix: KompetenzMatrix | undefined): string[] {
  if (!matrix) return [];
  const out: string[] = [];
  for (const ueber of UEBER_ORDER) {
    const cells = matrix[ueber];
    if (!cells) continue;
    for (const [label, lvl] of Object.entries(cells)) {
      const t = label.trim();
      if (!t) continue;
      for (let i = 0; i < lvl; i++) out.push(t);
    }
  }
  return out;
}
