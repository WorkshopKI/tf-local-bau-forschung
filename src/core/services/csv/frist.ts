/**
 * Phasen-aware Frist-Berechnung fuer Foerderantraege.
 *
 * Zwei verschiedene Lebenszyklen mit unterschiedlichen Fristen:
 * - **Antragsphase** (Stati: offen / in_pruefung / nachforderung / entscheidung):
 *   Bearbeitungs-SLA = `antragsdatum` (D_AAE) + 90 Tage. Bezugsdatum: Antrags-
 *   eingang. Schwellen synchron zur Eingangs-Ampel (`eingangAmpel.ts`).
 * - **Begleitphase** (Stati: begleitung, VN-/ZB-Pruefung):
 *   VN-Frist = `vn_eingang_datum` (D_VBE) + 6 Monate. Bezugsdatum: Eingang
 *   Verwendungsnachweis. Wenn D_VBE leer ist, gibt es keine Frist.
 *
 * Wohnt im csv-Layer (nicht im Plugin), damit der Merger-Fallback
 * (`applyFristDatumFallback`) ohne Plugin-Cycle drauf zugreifen kann.
 */

import { isBegleitungStatus } from '@/core/utils/status-canonical';
import type { AntragListItem } from './types';
import { MS_TAG } from '@/core/utils/zeitEinheiten';

export const ANTRAG_SLA_DAYS = 90;
export const VN_SLA_MONTHS = 6;

/** Addiert N Kalendermonate auf ein ISO-Datum. Bei Monatsende-Drift (z.B.
 *  31.01. + 1 Monat → 28.02.) faellt JavaScript automatisch auf den letzten
 *  Tag des Zielmonats zurueck. Liefert ISO-String oder `null` bei ungueltigem
 *  Input. */
export function addMonths(iso: string, months: number): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + months;
  const day = d.getUTCDate();
  const next = new Date(Date.UTC(year, month, day));
  return next.toISOString();
}

/** Addiert N Tage auf ein ISO-Datum. Liefert ISO-String oder `null` bei
 *  ungueltigem Input. */
export function addDays(iso: string, days: number): string | null {
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return null;
  return new Date(ms + days * MS_TAG).toISOString();
}

/**
 * Berechnet das Frist-Datum eines Antrags phasen-abhaengig:
 * - Begleitphase + `vn_eingang_datum` gesetzt → `vn_eingang_datum + 6 Monate`
 * - Begleitphase + `vn_eingang_datum` leer → `null` (keine Frist anzeigen)
 * - Sonst (Antragsphase) + `antragsdatum` gesetzt → `antragsdatum + 90 Tage`
 * - Sonst leer → `null`
 *
 * Akzeptiert auch das schlanke `AntragListItem` oder einen vollen `Antrag`-
 * Record (beide haben die relevanten Felder als optionale Strings).
 */
export function computeFristDatum(
  antrag: Pick<AntragListItem, 'status' | 'antragsdatum' | 'vn_eingang_datum'>,
): string | null {
  if (isBegleitungStatus(antrag.status)) {
    const vn = typeof antrag.vn_eingang_datum === 'string' ? antrag.vn_eingang_datum : null;
    if (!vn) return null;
    return addMonths(vn, VN_SLA_MONTHS);
  }
  const ad = typeof antrag.antragsdatum === 'string' ? antrag.antragsdatum : null;
  if (!ad) return null;
  return addDays(ad, ANTRAG_SLA_DAYS);
}

/**
 * Maßgebliches Antragsdatum eines Verbundes = das **späteste** (max) `antragsdatum`
 * über alle übergebenen TVs (= das zuletzt eingegangene Teilvorhaben). Leere und
 * ungültige Datumswerte werden ignoriert; liefert `null`, wenn kein TV ein
 * `antragsdatum` hat.
 *
 * Fachlich: Ein Verbund kann erst bearbeitet werden, wenn das letzte TV eingegangen
 * ist — vorher darf keine (Antrags-)Frist laufen. Für ein einzelnes TV ist das
 * Ergebnis dessen eigenes `antragsdatum`.
 */
export function verbundAntragsdatum(
  // `object` (statt `{ antragsdatum?: unknown }`) akzeptiert sowohl den index-
  // signierten `Antrag` als auch das getypte `AntragListItem` / `Pick<…>` und
  // Test-Literale — der schmale Shape-Typ wuerde an `Antrag` (nur Index-Signatur,
  // kein benanntes `antragsdatum`) am Weak-Type-Check scheitern.
  tvs: ReadonlyArray<object>,
): string | null {
  let best: string | null = null;
  let bestMs = -Infinity;
  for (const tv of tvs) {
    const raw = (tv as { antragsdatum?: unknown }).antragsdatum;
    const ad = typeof raw === 'string' ? raw : '';
    if (!ad) continue;
    const ms = new Date(ad).getTime();
    if (Number.isNaN(ms)) continue;
    if (ms > bestMs) {
      bestMs = ms;
      best = ad;
    }
  }
  return best;
}

/**
 * Frist-Datum eines Verbundes — Verbund-aware Variante von `computeFristDatum`:
 * - **Antragsphase**: `max(antragsdatum über alle TVs) + 90 Tage` — die Frist
 *   startet ab dem zuletzt eingegangenen TV (siehe `verbundAntragsdatum`).
 * - **Begleitphase**: per-TV wie gehabt (`computeFristDatum(representative)`,
 *   `vn_eingang_datum + 6 Monate`) — die „letztes TV"-Regel gilt nur für die
 *   Antragsphase.
 *
 * Für einen Solo-Antrag (`tvs = [antrag]`, `representative = antrag`) ist das
 * Ergebnis identisch zu `computeFristDatum(antrag)` → kein Regress bei Einzelanträgen.
 */
export function computeVerbundFristDatum(
  tvs: ReadonlyArray<Pick<AntragListItem, 'status' | 'antragsdatum' | 'vn_eingang_datum'>>,
  representative: Pick<AntragListItem, 'status' | 'antragsdatum' | 'vn_eingang_datum'>,
): string | null {
  // Begleitphase: eigener Lebenszyklus (VN-Frist), Regel greift nicht.
  if (isBegleitungStatus(representative.status)) {
    return computeFristDatum(representative);
  }
  // Antragsphase: Frist ab dem spätesten Antragsdatum aller TVs.
  const maxAntragsdatum = verbundAntragsdatum(tvs);
  if (!maxAntragsdatum) return computeFristDatum(representative);
  return computeFristDatum({ ...representative, antragsdatum: maxAntragsdatum });
}

/**
 * **Wirksamer Eingang** = das spätere von Antragseingang (`D_AAE`) und „alle
 * Anträge da" (`D_XTE`).
 *
 * So startet die AB-Mappe alle Tage-Zählungen und damit faktisch die 90-Tage-Uhr:
 * bearbeitet werden kann erst, wenn wirklich alles vorliegt. Fehlt `D_XTE`,
 * bleibt es beim Antragseingang — das ist der heutige Stand und damit
 * abwärtskompatibel.
 *
 * **Bewusst additiv.** `computeFristDatum` speist über den Merger das
 * persistierte `frist_datum` des gesamten Bestands; diese Regel dort einzubauen
 * änderte auf einen Schlag Zahlen in Listen, Ampeln und Home. Sie wird deshalb
 * erst dort verwendet, wo sie ausgewiesen ist, und ihre Wirkung auf den Bestand
 * wird gemessen, bevor sie irgendwo zum Default wird.
 *
 * Nimmt die beiden Werte als Parameter statt sie aus dem Antrag zu lesen:
 * `D_XTE` ist in den Schemas **custom** gemappt (`alle_an_trage_da`) und steht
 * nicht in der schlanken Listen-Projektion. Wer den Wert hat, reicht ihn herein
 * — geraten wird der Record-Key hier nicht (recurring-bug-classes Klasse 5).
 */
export function wirksamerEingang(
  antragsdatum: string | null | undefined,
  alleAntraegeDa: string | null | undefined,
): string | null {
  const kandidaten = [antragsdatum, alleAntraegeDa]
    .filter((d): d is string => typeof d === 'string' && d.trim() !== '')
    .map(d => ({ iso: d, ms: new Date(d).getTime() }))
    .filter(k => !Number.isNaN(k.ms));
  if (kandidaten.length === 0) return null;
  return kandidaten.reduce((a, b) => (b.ms > a.ms ? b : a)).iso;
}

/** Tage bis zur Frist (Vorzeichen-konsistent). Negativ = ueberfaellig,
 *  positiv = noch Zeit, `null` = keine Frist berechenbar. */
export function daysUntilFristAware(
  antrag: Pick<AntragListItem, 'status' | 'antragsdatum' | 'vn_eingang_datum'>,
  nowMs: number = Date.now(),
): number | null {
  const frist = computeFristDatum(antrag);
  if (!frist) return null;
  const ms = new Date(frist).getTime();
  if (Number.isNaN(ms)) return null;
  return Math.ceil((ms - nowMs) / MS_TAG);
}
