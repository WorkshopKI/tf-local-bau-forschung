/**
 * Kapazitaets-Service — v2.4 Single-Source-of-Truth-Modell.
 *
 * Bietet eine einheitliche Sicht auf die Quartals-Kapazitaet eines MAs in
 * **Stunden UND Antraegen**, getrennt nach Buchungs-Status:
 *
 *  - **fest** (aus Master-CSV): die einzige Quelle fuer "harte" Buchungen.
 *  - **pending** (aus Auslastungs-Store): noch nicht in CSV bestaetigt.
 *
 * "Frei"-Stunden = `effektivStunden − (fest.stunden + pending.stunden)`.
 * Diese Definition ist konservativ — pending zaehlt schon als verbraucht,
 * damit ein MA seine Kapazitaet nicht versehentlich ueberzeichnet.
 *
 * Weicher Kapazitaets-Score (`kapazitaetsScore`) bleibt unveraendert — er
 * arbeitet auf `restStunden` und ist von der Datenherkunft unabhaengig.
 */

import type { AnonymerMitarbeiter, AuslastungConfig } from '../types';
import {
  EMPTY_AUSLASTUNG,
  type MaQuartalsAuslastung,
} from './quartals-auslastung';
import { effektiveJahresStunden } from './kapazitaet-pro-typ';

/** Bucket-Snapshot pro MA fuer die KapazitaetsView. */
export interface KapazitaetsBucket {
  antraege: number;       // Anzahl Verbund-Anteile
  tvs: number;            // echte TV-Anzahl
  stunden: number;        // tvs × stundenProTV
}

/** Antrags- + Stunden-Sicht fuer einen MA in einem Quartal. */
export interface KapazitaetsView {
  /** Quartals-Stunden nach Abschlag: jahresKap × (1 - abschlag/100) / 4. */
  effektivStunden: number;
  /** Aus Master-CSV gebuchte Antraege/TVs/Stunden. */
  fest: KapazitaetsBucket;
  /** Selbsteintragungen im Store, noch nicht in CSV. */
  pending: KapazitaetsBucket;
  /** Summe aller verbrauchten Stunden: `fest.stunden + pending.stunden`. */
  verbrauchteStunden: number;
  /** `effektivStunden − verbrauchteStunden`. Kann negativ werden bei Ueberbuchung. */
  restStunden: number;
  /** Verbleibende TVs: `floor(max(0, restStunden) / stundenProTV)`. */
  restTVs: number;
  /** Stunden ueber dem Limit (> 0 nur bei Ueberbuchung, sonst 0). */
  ueberbuchung: number;
}

/**
 * Berechnet die Quartals-Sicht eines MAs aus seinem Profil + dem
 * aggregierten Auslastungs-Index (siehe `computeQuartalsAuslastung`).
 *
 * `auslastung` darf undefined sein — in dem Fall werden leere Buckets
 * angenommen (MA hat im Quartal noch nichts).
 */
export function computeKapazitaet(
  ma: AnonymerMitarbeiter,
  auslastung: MaQuartalsAuslastung | undefined,
  config: AuslastungConfig,
): KapazitaetsView {
  const abschlag = Math.max(0, Math.min(100, ma.abschlagProzent ?? 0));
  // Jahresstunden = Summe der Typ-Stunden (effektiveJahresStunden); 0 ohne
  // gepflegte Kompetenz-Matrix. `ma.jahresKapazitaet` ist deprecated.
  const effektivStunden = (effektiveJahresStunden(ma) * (1 - abschlag / 100)) / 4;
  const stundenProTV = Math.max(1, config.stundenProTV ?? 9);

  const a = auslastung ?? EMPTY_AUSLASTUNG;
  const fest: KapazitaetsBucket = {
    antraege: a.fest.antraege,
    tvs: a.fest.tvs,
    stunden: a.fest.stunden,
  };
  const pending: KapazitaetsBucket = {
    antraege: a.pending.antraege,
    tvs: a.pending.tvs,
    stunden: a.pending.stunden,
  };
  const verbrauchteStunden = fest.stunden + pending.stunden;
  const restStunden = effektivStunden - verbrauchteStunden;
  const restTVs = Math.floor(Math.max(0, restStunden) / stundenProTV);
  const ueberbuchung = restStunden < 0 ? -restStunden : 0;

  return {
    effektivStunden,
    fest,
    pending,
    verbrauchteStunden,
    restStunden,
    restTVs,
    ueberbuchung,
  };
}

/**
 * Weicher Kapazitaets-Score 0..1 (unveraendert seit 1.17). Wird vom
 * Matching gegen einen benoetigten Stunden-Wert ausgewertet.
 *
 * Banden:
 *  - ratio ≥ 1.5     →  1.0   (reichlich Luft)
 *  - 1.0 ≤ ratio < 1.5  →  0.8 + (ratio - 1) × 0.4
 *  - 0.5 ≤ ratio < 1.0  →  0.5 + (ratio - 0.5) × 0.6
 *  - 0.0 ≤ ratio < 0.5  →  0.2 + ratio × 0.6
 *  - ratio < 0       →  Math.max(0.05, 0.2 + ratio × 0.3)
 *
 * Quartals-Ende-Bonus: wenn weniger als `bonusTage` Tage im Quartal verbleiben,
 * wird der Score zusaetzlich um `(bonusTage - tage) / bonusTage × 0.15`
 * angehoben (max +0.15). Cap bei 1.0.
 */
export function kapazitaetsScore(
  restStunden: number,
  benoetigteStunden: number,
  tageImQuartal: number,
  bonusTage: number = 21,
): number {
  if (benoetigteStunden <= 0) return 1.0;
  const ratio = restStunden / benoetigteStunden;

  let kapScore: number;
  if (ratio >= 1.5) kapScore = 1.0;
  else if (ratio >= 1.0) kapScore = 0.8 + (ratio - 1.0) * 0.4;
  else if (ratio >= 0.5) kapScore = 0.5 + (ratio - 0.5) * 0.6;
  else if (ratio >= 0.0) kapScore = 0.2 + ratio * 0.6;
  else kapScore = Math.max(0.05, 0.2 + ratio * 0.3);

  if (bonusTage > 0 && tageImQuartal < bonusTage) {
    kapScore += ((bonusTage - tageImQuartal) / bonusTage) * 0.15;
  }

  return Math.min(kapScore, 1.0);
}

/**
 * Verbleibende Kalender-Tage im Quartal (>= 0). Quartal-Format "YYYY-QN".
 * Gibt 0 zurueck wenn Quartal in der Vergangenheit liegt oder ungueltig ist.
 * `now` als Parameter fuer Testbarkeit; Default ist `new Date()`.
 */
export function tageImQuartal(quartal: string, now: Date = new Date()): number {
  const match = /^(\d{4})-Q([1-4])$/.exec(quartal);
  if (!match) return 0;
  const year = Number(match[1]);
  const q = Number(match[2]);
  const endMonth = q * 3 - 1;
  const endDay = (endMonth === 2 || endMonth === 11) ? 31 : 30;
  const endDate = new Date(year, endMonth, endDay, 23, 59, 59, 999).getTime();
  const diff = endDate - now.getTime();
  if (diff <= 0) return 0;
  return Math.ceil(diff / 86400000);
}
