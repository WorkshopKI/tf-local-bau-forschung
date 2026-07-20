/**
 * Deterministische Rechenchecks über das importierte Strukturmodell.
 *
 * Fünf Prüfungen, alle rein und ohne LLM:
 *   a) Gesamtkosten = Summe der Kostenarten
 *   b) Beantragte Zuwendung = Gesamtkosten × Fördersatz (Toleranz 1 €)
 *   c) Summe der AP-Personenmonate = Personenmonate der Einsatzplanung
 *   d) Arbeitspakete und Jahresscheiben liegen in der Laufzeit,
 *      keine verwaisten AP-Referenzen
 *   e) kein Arbeitspaket über der PM-Grenze
 *
 * Die Grenzwerte sind Prüfwissen der Fachseite, nicht Richtlinientext. Sie
 * liegen hier als benannte Konstanten; sobald es eine kuratierbare Parameter-
 * Ablage gibt, ziehen sie dorthin um (Konzept-Delta 3).
 *
 * WICHTIG: Kosten werden nie über `normiertemonatskosten_number` nachgerechnet.
 * Das Feld widerspricht im Echtfall der tatsächlichen Rechnung (5.999 gegen
 * effektiv 5.833 €/PM) und erzeugte damit Falsch-Befunde. Wahrheit sind
 * `gesamtkostenAP` und `pkma_number`. Ein Convention-Test bewacht das.
 */
import type { MapEinreichung, RechenBefund } from '../types';
import { jahrInLaufzeit, pruefeInLaufzeit } from './laufzeit';

/** Kein Arbeitspaket über 6 Personenmonaten („ausreichend untersetzt"). */
export const AP_PM_GRENZE = 6;

/** Rundungstoleranz beim Abgleich der Zuwendung, in Euro. */
export const ZUWENDUNG_TOLERANZ_EUR = 1;

/** Toleranz beim Abgleich von Personenmonats-Summen (halbe PM sind üblich). */
export const PM_TOLERANZ = 0.01;

const euro = (n: number): string =>
  `${n.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €`;

const pm = (n: number): string =>
  `${n.toLocaleString('de-DE', { maximumFractionDigits: 2 })} PM`;

// --- a) Gesamtkosten = Summe der Kostenarten -------------------------------

function pruefeKostensumme(e: MapEinreichung): RechenBefund[] {
  const { personal, dritte, fue, temp, uebrige, gesamt } = e.kosten;
  const teile = [personal, dritte, fue, temp, uebrige].filter((t): t is number => t !== null);
  if (teile.length === 0 || gesamt === null) return [];

  const summe = teile.reduce((a, b) => a + b, 0);
  if (Math.abs(summe - gesamt) <= ZUWENDUNG_TOLERANZ_EUR) return [];

  return [{
    id: 'kosten-summe',
    titel: 'Gesamtkosten stimmen nicht mit der Summe der Kostenarten überein',
    schwere: 'fehler',
    erwartet: `${euro(summe)} (Summe der Kostenarten)`,
    gefunden: `${euro(gesamt)} (angegebene Gesamtkosten)`,
  }];
}

// --- b) Zuwendung = Gesamt × Fördersatz ------------------------------------

function pruefeZuwendung(e: MapEinreichung): RechenBefund[] {
  const { gesamt, foerdersatz, beantragteZuwendung } = e.kosten;
  if (gesamt === null || foerdersatz === null || beantragteZuwendung === null) return [];

  const erwartet = gesamt * foerdersatz;
  if (Math.abs(erwartet - beantragteZuwendung) <= ZUWENDUNG_TOLERANZ_EUR) return [];

  const prozent = (foerdersatz * 100).toLocaleString('de-DE', { maximumFractionDigits: 1 });
  return [{
    id: 'zuwendung-foerdersatz',
    titel: 'Beantragte Zuwendung passt nicht zum Fördersatz',
    schwere: 'fehler',
    erwartet: `${euro(erwartet)} (${euro(gesamt)} × ${prozent} %)`,
    gefunden: euro(beantragteZuwendung),
  }];
}

// --- c) AP-Personenmonate = Einsatzplanung ---------------------------------

function pruefePersonenmonate(e: MapEinreichung): RechenBefund[] {
  const apSumme = e.arbeitspakete
    .map(a => a.aufwandPm)
    .filter((n): n is number => n !== null)
    .reduce((a, b) => a + b, 0);
  const einsatz = e.summen.personenmonateEinsatz;

  if (e.arbeitspakete.length === 0 || einsatz === null) return [];
  if (Math.abs(apSumme - einsatz) <= PM_TOLERANZ) return [];

  return [{
    id: 'pm-summe',
    titel: 'Personenmonate der Arbeitspakete und der Einsatzplanung weichen ab',
    schwere: 'fehler',
    erwartet: `${pm(apSumme)} (Summe über ${e.arbeitspakete.length} Arbeitspakete)`,
    gefunden: `${pm(einsatz)} (Einsatzplanung)`,
  }];
}

// --- d) Termintreue + verwaiste Referenzen ---------------------------------

function pruefeTermine(e: MapEinreichung, verwaisteRefs: readonly string[]): RechenBefund[] {
  const befunde: RechenBefund[] = [];
  const laufzeit = { start: e.laufzeit.start, ende: e.laufzeit.ende };

  for (const ap of e.arbeitspakete) {
    const verstoesse = pruefeInLaufzeit({ start: ap.start, ende: ap.ende }, laufzeit);
    if (verstoesse.length === 0) continue;
    const nr = ap.laufnummer ?? ap.quellIndex + 1;
    befunde.push({
      id: `ap-zeitraum:${nr}`,
      titel: `Arbeitspaket „${ap.name}" liegt ausserhalb der Projektlaufzeit`,
      schwere: 'warnung',
      erwartet: `innerhalb ${e.laufzeit.start ?? '—'} bis ${e.laufzeit.ende ?? '—'}`,
      gefunden: `${ap.start ?? '—'} bis ${ap.ende ?? '—'}`,
    });
  }

  const jahreAusserhalb = [...new Set(e.einsatzplanung.flatMap(z => z.jahre))]
    .filter(jahr => !jahrInLaufzeit(jahr, laufzeit))
    .sort((a, b) => a - b);

  for (const jahr of jahreAusserhalb) {
    befunde.push({
      id: `einsatz-jahr:${jahr}`,
      titel: `Die Einsatzplanung verteilt Personenmonate auf ${jahr}`,
      schwere: 'warnung',
      erwartet: `nur Jahre innerhalb der Laufzeit (bis ${e.laufzeit.ende ?? '—'})`,
      gefunden: `Personenmonate im Jahr ${jahr}`,
    });
  }

  if (verwaisteRefs.length > 0) {
    befunde.push({
      id: 'ap-ref-verwaist',
      titel: 'Verweise auf nicht vorhandene Arbeitspakete',
      schwere: 'warnung',
      erwartet: `nur Verweise auf die ${e.arbeitspakete.length} vorhandenen Arbeitspakete`,
      gefunden: verwaisteRefs.join(', '),
    });
  }

  return befunde;
}

// --- e) PM-Grenze je Arbeitspaket ------------------------------------------

function pruefeApGrenze(e: MapEinreichung): RechenBefund[] {
  return e.arbeitspakete
    .filter(ap => ap.aufwandPm !== null && ap.aufwandPm > AP_PM_GRENZE)
    .map(ap => {
      const nr = ap.laufnummer ?? ap.quellIndex + 1;
      return {
        id: `ap-pm-grenze:${nr}`,
        titel: `Arbeitspaket „${ap.name}" überschreitet die Personenmonats-Grenze`,
        schwere: 'warnung' as const,
        erwartet: `höchstens ${pm(AP_PM_GRENZE)}`,
        gefunden: pm(ap.aufwandPm!),
      };
    });
}

/**
 * Führt alle Rechenchecks aus. `verwaisteRefs` kommt aus dem Adapter, weil dafür
 * die Rohquelle nötig ist — die Checks selbst arbeiten sonst ausschliesslich auf
 * dem Strukturmodell. Rein.
 */
export function rechneChecks(
  einreichung: MapEinreichung, verwaisteRefs: readonly string[] = [],
): RechenBefund[] {
  return [
    ...pruefeKostensumme(einreichung),
    ...pruefeZuwendung(einreichung),
    ...pruefePersonenmonate(einreichung),
    ...pruefeTermine(einreichung, verwaisteRefs),
    ...pruefeApGrenze(einreichung),
  ];
}
