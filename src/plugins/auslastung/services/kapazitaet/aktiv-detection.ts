/**
 * Aktiv-Detection: Heuristik fuer den Initial-Vorschlag-Banner.
 *
 * "MA hat im Referenz-Jahr (z.B. 2026) mindestens einen Antrag mit seinem
 * TIB-Kuerzel als Bearbeiter → wahrscheinlich aktiv. Sonst → wahrscheinlich
 * ehemals taetig, vorschlagen zum Deaktivieren."
 *
 * Wird nur als Vorschlag verwendet — PL bestaetigt/korrigiert via Banner-
 * Aktionen ("Uebernehmen" / "Manuell" / "Spaeter") oder einzeln im Drawer.
 */
import type { AntragOderSlim } from '@/core/services/csv/types';
import type { AnonymerMitarbeiter } from '../../types';
import { CANONICAL_TIB_KUERZ, CANONICAL_ANTRAGSDATUM } from '../../types';
import { normalizeKuerzel } from '../identitaet/anonym-map';
import type { AnonymMap } from '../identitaet/anonym-map';

export interface AktivDetectionResult {
  /** Vorgeschlagene Aktiv-Map: anonId -> aktiv. */
  vorschlag: Record<string, boolean>;
  /** Anzahl MAs die als aktiv vorgeschlagen werden. */
  aktivCount: number;
  /** Anzahl MAs die als inaktiv vorgeschlagen werden. */
  inaktivCount: number;
  /** Anzahl MAs ohne aufloesbares TIB-Kuerzel (kein Eintrag in anonymMap). */
  ohneKuerzelCount: number;
}

/**
 * Berechnet einen Aktiv-Vorschlag pro MA: aktiv = es existiert mindestens
 * ein Antrag mit `tib_kuerz === ma.realKuerzel` UND `antragsdatum` faengt mit
 * `<referenzJahr>-` an.
 *
 * MAs deren anonId nicht in der `anonymMap.toReal` aufzuloesen ist (z.B.
 * weil sie nur per virtuellem Projekt im Modul leben) bleiben unveraendert
 * im Vorschlag (`vorschlag[anonId] = ma.aktiv`).
 */
export function detectAktiveMAs(
  antraege: ReadonlyArray<AntragOderSlim>,
  mitarbeiter: Record<string, AnonymerMitarbeiter>,
  anonymMap: AnonymMap,
  referenzJahr: number,
): AktivDetectionResult {
  const yearPrefix = `${referenzJahr}-`;
  const tibKuerzImJahr = new Set<string>();
  for (const a of antraege) {
    const datum = (a as Record<string, unknown>)[CANONICAL_ANTRAGSDATUM];
    if (typeof datum !== 'string' || !datum.startsWith(yearPrefix)) continue;
    const k = normalizeKuerzel((a as Record<string, unknown>)[CANONICAL_TIB_KUERZ]);
    if (k) tibKuerzImJahr.add(k);
  }

  const vorschlag: Record<string, boolean> = {};
  let aktivCount = 0;
  let inaktivCount = 0;
  let ohneKuerzelCount = 0;

  for (const ma of Object.values(mitarbeiter)) {
    const realKuerz = anonymMap.toReal.get(ma.anonId);
    if (!realKuerz) {
      // Keine Aufloesung moeglich → MA bleibt wie er ist (kein Vorschlag).
      vorschlag[ma.anonId] = ma.aktiv;
      ohneKuerzelCount++;
      if (ma.aktiv) aktivCount++; else inaktivCount++;
      continue;
    }
    const istAktiv = tibKuerzImJahr.has(realKuerz);
    vorschlag[ma.anonId] = istAktiv;
    if (istAktiv) aktivCount++; else inaktivCount++;
  }

  return { vorschlag, aktivCount, inaktivCount, ohneKuerzelCount };
}

/**
 * Wann soll der Vorschlags-Banner ueberhaupt erscheinen? Antwort:
 * wenn ALLE MAs noch `aktiv: true` haben — das ist der Indikator dass die
 * PL noch nie manuell eine Deaktivierung vorgenommen oder den Banner
 * abgearbeitet hat. Sobald auch nur ein MA inaktiv ist, geht das Modul
 * davon aus dass die Liste manuell gepflegt ist.
 *
 * Edge-Case: leeres `mitarbeiter`-Record → false (nichts zu zeigen).
 */
export function shouldShowAktivVorschlag(
  mitarbeiter: Record<string, AnonymerMitarbeiter>,
): boolean {
  const list = Object.values(mitarbeiter);
  if (list.length === 0) return false;
  return list.every(m => m.aktiv === true);
}
