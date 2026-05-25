/**
 * Kapazitaets-Service — Workflow-Revision 1.17.
 *
 * Bietet eine einheitliche Sicht auf die Quartals-Kapazitaet eines MAs in
 * **Stunden UND Antraegen**. Stunden bleiben die interne Berechnungs-Einheit
 * (kompatibel zur bestehenden Matching-Engine), aber alle User-facing UIs
 * (Homepage, VorschlagCards, Selbsteintragung) zeigen Antraege.
 *
 * Zusaetzlich der **weiche Kapazitaets-Score** fuer das Matching: statt
 * MAs mit `rest < benoetigt` hart auszufiltern, bekommen sie einen Malus,
 * bleiben aber im Ranking. Quartals-Ende-Bonus: in den letzten ~3 Wochen
 * eines Quartals milderer Malus, weil das neue Quartal bald startet.
 */

import type {
  AnonymerMitarbeiter,
  AuslastungConfig,
  Zuweisung,
} from '../types';

/** Antrags-Anzeige + Stunden-Sicht fuer einen MA in einem Quartal. */
export interface KapazitaetsView {
  /** Quartals-Stunden nach Abschlag: jahresKap × (1 - abschlag/100) / 4. */
  effektivStunden: number;
  /** Summe aller Stunden aus `freigegebenen`/`selbst`-Zuweisungen. */
  verbrauchteStunden: number;
  /** effektivStunden - verbrauchteStunden. Kann negativ werden bei Ueberbuchung. */
  restStunden: number;
  /** Maximale Antrags-Anzahl: floor(effektivStunden / (stundenProTV × durchschnittTV)). */
  maxAntraege: number;
  /** Anzahl bereits zugewiesener Antraege (freigegeben + selbst). */
  zugewiesenAnzahl: number;
  /** Verbleibende Antraege: floor(restStunden / (stundenProTV × durchschnittTV)).
   *  Wichtig: aus restStunden gerechnet, NICHT als maxAntraege - zugewiesen
   *  (sonst wuerde ein MA mit 4-TV-Verbund nicht mehr ueberbucht erscheinen). */
  restAntraege: number;
  /** Stunden ueber dem Limit. > 0 nur bei Ueberbuchung, sonst 0. */
  ueberbuchung: number;
}

/**
 * Berechnet die Quartals-Sicht eines MAs aus seinem Profil + den aktuellen
 * Zuweisungen.
 */
export function computeKapazitaet(
  ma: AnonymerMitarbeiter,
  zuweisungen: Zuweisung[],
  config: AuslastungConfig,
  quartal: string,
): KapazitaetsView {
  const abschlag = Math.max(0, Math.min(100, ma.abschlagProzent ?? 0));
  const effektivStunden = (ma.jahresKapazitaet * (1 - abschlag / 100)) / 4;

  let verbrauchteStunden = 0;
  let zugewiesenAnzahl = 0;
  for (const z of zuweisungen) {
    if (z.quartal !== quartal) continue;
    if (z.anonId !== ma.anonId) continue;
    if (z.status !== 'freigegeben' && z.status !== 'selbst') continue;
    verbrauchteStunden += z.stunden;
    zugewiesenAnzahl += 1;
  }

  const restStunden = effektivStunden - verbrauchteStunden;
  const stundenProTV = Math.max(1, config.stundenProTV ?? 9);
  const durchschnittTV = Math.max(1, config.durchschnittTVproAntrag ?? 2);
  const antragsStunden = stundenProTV * durchschnittTV;

  const maxAntraege = Math.floor(effektivStunden / antragsStunden);
  const restAntraege = Math.floor(restStunden / antragsStunden);
  const ueberbuchung = restStunden < 0 ? -restStunden : 0;

  return {
    effektivStunden,
    verbrauchteStunden,
    restStunden,
    maxAntraege,
    zugewiesenAnzahl,
    restAntraege,
    ueberbuchung,
  };
}

/**
 * Weicher Kapazitaets-Score 0..1. Statt hartem Filter wird der Score in das
 * finale Ranking eingewichtet — ein MA mit perfektem fachlichen Match aber
 * leerer Kapazitaet rutscht nach hinten, aber bleibt sichtbar.
 *
 * Banden:
 *  - ratio ≥ 1.5     →  1.0   (reichlich Luft)
 *  - 1.0 ≤ ratio < 1.5  →  0.8 + (ratio - 1) × 0.4   (knapp ueber dem Bedarf)
 *  - 0.5 ≤ ratio < 1.0  →  0.5 + (ratio - 0.5) × 0.6 (knapp drunter)
 *  - 0.0 ≤ ratio < 0.5  →  0.2 + ratio × 0.6         (deutlich knapp)
 *  - ratio < 0       →  Math.max(0.05, 0.2 + ratio × 0.3) (ueberbucht)
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
  // Quartals-Ende: Q1=31.3., Q2=30.6., Q3=30.9., Q4=31.12.
  const endMonth = q * 3 - 1;          // 0-indiziert: Q1→2 (Maerz), Q2→5 (Juni), ...
  const endDay = (endMonth === 2 || endMonth === 11) ? 31 : 30;
  // Lokales Datum (Date konstruiert end-of-day in lokaler TZ).
  const endDate = new Date(year, endMonth, endDay, 23, 59, 59, 999).getTime();
  const diff = endDate - now.getTime();
  if (diff <= 0) return 0;
  return Math.ceil(diff / 86400000);
}
