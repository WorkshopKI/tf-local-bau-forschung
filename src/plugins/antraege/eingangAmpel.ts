import type { AntragListItem } from '@/core/services/csv/types';
import { isOpenStatus } from '@/core/utils/status-canonical';
import { isIrrlaeufer } from '@/core/utils/vb-phase-mappings';
import { antragMatchesBearbeiter, type BearbeiterFilterMode } from './bearbeiterFilter';

/**
 * Eingangs-Ampel basierend auf dem Datum Antragseingang (`antragsdatum`).
 *
 * Schwellen (Wahl des Users):
 * - ≤ 30 Tage  → grün   (frisch)
 * - 31–60 Tage → gelb   (Vorwarnung)
 * - 61–90 Tage → orange (kritisch)
 * - > 90 Tage  → rot    (überfällig)
 *
 * Ampel zeigt NUR fuer fachlich offene Antraege:
 * - bewilligt / abgelehnt / abgeschlossen → null
 * - `bewilligung_datum` gesetzt → null (zusaetzliche Sicherheits-Bedingung,
 *   greift auch bei Datensaetzen ohne sauberen Status)
 *
 * Bei fehlendem oder ungültigem `antragsdatum` → null (keine Ampel zeigen).
 */

export type EingangAmpel = 'gruen' | 'gelb' | 'orange' | 'rot';

/**
 * Minimal-Shape für die Ampel-Berechnung. Erfüllt von `AntragListItem` (voller
 * CSV-Record) wie von der Home-Projektion `AntragVorgang` — so kann die Home-
 * „Meine Anträge"-Liste dieselbe Ampel-Logik nutzen, ohne einen echten
 * `AntragListItem` zu halten.
 */
export interface EingangAmpelInput {
  status?: string;
  antragsdatum?: unknown;
  bewilligung_datum?: unknown;
}

function trimmed(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

export function daysSinceEingang(a: { antragsdatum?: unknown }): number | null {
  const d = trimmed(a.antragsdatum);
  if (!d) return null;
  const ms = new Date(d).getTime();
  if (Number.isNaN(ms)) return null;
  return Math.floor((Date.now() - ms) / (1000 * 60 * 60 * 24));
}

export function getEingangAmpel(a: EingangAmpelInput): EingangAmpel | null {
  if (trimmed(a.bewilligung_datum)) return null;
  if (!isOpenStatus(a.status)) return null;
  const days = daysSinceEingang(a);
  if (days === null || days < 0) return null;
  if (days <= 30) return 'gruen';
  if (days <= 60) return 'gelb';
  if (days <= 90) return 'orange';
  return 'rot';
}

export const AMPEL_COLOR: Record<EingangAmpel, string> = {
  gruen: 'var(--tf-success-text)',
  gelb: 'var(--tf-warning-text)',
  orange: 'var(--tf-orange-text)',
  rot: 'var(--tf-danger-text)',
};

export const AMPEL_TOOLTIP: Record<EingangAmpel, string> = {
  gruen: 'Eingangsalter ≤ 30 Tage',
  gelb: 'Eingangsalter 31–60 Tage',
  orange: 'Eingangsalter 61–90 Tage',
  rot: 'Eingangsalter > 90 Tage',
};

/**
 * Drei-stufige Aggregation der vier Ampel-Stufen für die Home-Aggregat-Karte:
 * gelb + orange → warnung (31–90 Tage).
 */
export type AmpelBucket = 'frisch' | 'warnung' | 'kritisch';

export function getAmpelBucket(a: AntragListItem): AmpelBucket | null {
  const ampel = getEingangAmpel(a);
  if (ampel === null) return null;
  if (ampel === 'gruen') return 'frisch';
  if (ampel === 'rot') return 'kritisch';
  return 'warnung';
}

/**
 * Konfigurierbare Bucket-Schwellen (v2.229, Home-Widget-Config). Wirken NUR
 * über die Aggregations-Pfade (useEingangAmpelCounts / Ampel-Quickfilter) —
 * die 4-Stufen-Semantik von `getEingangAmpel` (AntragCard-Listenzeilen,
 * Tabellen-Spalten, Gruppen-Aggregatoren) bleibt UNANGETASTET fix bei 30/60/90.
 */
export interface AmpelSchwellen {
  /** Grenze frisch→warnung in Tagen (Default 30). */
  warnschwelleTage: number;
  /** Grenze warnung→kritisch in Tagen (Default 90). */
  kritischSchwelleTage: number;
}

export const AMPEL_SCHWELLEN_DEFAULT: AmpelSchwellen = {
  warnschwelleTage: 30,
  kritischSchwelleTage: 90,
};

/**
 * Tage-basierter 3-Bucket mit konfigurierbaren Schwellen. Mit den Defaults
 * (30/90) EXAKT äquivalent zu `getAmpelBucket` (gruen ≤30 → frisch,
 * gelb|orange ≤90 → warnung, rot >90 → kritisch) — Regressionstest
 * `ampelSchwellen.test.ts` sichert die Äquivalenz.
 */
export function getAmpelBucketMitSchwellen(
  a: EingangAmpelInput,
  schwellen: AmpelSchwellen = AMPEL_SCHWELLEN_DEFAULT,
): AmpelBucket | null {
  if (trimmed(a.bewilligung_datum)) return null;
  if (!isOpenStatus(a.status)) return null;
  const days = daysSinceEingang(a);
  if (days === null || days < 0) return null;
  if (days <= schwellen.warnschwelleTage) return 'frisch';
  if (days <= schwellen.kritischSchwelleTage) return 'warnung';
  return 'kritisch';
}

/**
 * Zählt offene Anträge pro Ampel-Bucket. Übernimmt die Standard-
 * Vorfilter aus `viewCount`: Irrläufer (`vb_phase=9`) werden geskippt,
 * der Bearbeiter-Filter wird optional angewendet. Wird primär von der
 * Home-Sidebar-Karte `EingangAmpelCard` genutzt. Ohne `schwellen` läuft
 * bewusst der unveränderte `getAmpelBucket`-Pfad (Null-Risiko für
 * Bestands-Aufrufer); mit `schwellen` der parametrisierte.
 */
export function countByAmpelBucket(
  antraege: AntragListItem[],
  bucket: AmpelBucket,
  bearbeiter?: BearbeiterFilterMode,
  schwellen?: AmpelSchwellen,
): number {
  let n = 0;
  for (const a of antraege) {
    if (isIrrlaeufer(a.vb_phase)) continue;
    const b = schwellen ? getAmpelBucketMitSchwellen(a, schwellen) : getAmpelBucket(a);
    if (b !== bucket) continue;
    if (bearbeiter && !antragMatchesBearbeiter(a, bearbeiter)) continue;
    n++;
  }
  return n;
}

/** Aktiver Ampel-Quickfilter der Antragsliste (Klick auf eine Widget-Zeile).
 *  Trägt die SCHWELLEN aus der Widget-Config mit — Liste und Widget zählen
 *  garantiert identisch (kein Zahlen-Drift). */
export interface AmpelQuickfilter {
  bucket: AmpelBucket;
  schwellen: AmpelSchwellen;
}

/** Reiner Pipeline-Schritt für `useFilteredAntraege` (testbar ohne Hook). */
export function filtereAmpelQuickfilter(
  antraege: AntragListItem[],
  quick: AmpelQuickfilter | null,
): AntragListItem[] {
  if (!quick) return antraege;
  return antraege.filter(a => getAmpelBucketMitSchwellen(a, quick.schwellen) === quick.bucket);
}

/** Deutsche Bucket-Labels (Chip + Widget-Zeilen). */
export const AMPEL_BUCKET_LABEL: Record<AmpelBucket, string> = {
  frisch: 'Frisch',
  warnung: 'Warnung',
  kritisch: 'Kritisch',
};
