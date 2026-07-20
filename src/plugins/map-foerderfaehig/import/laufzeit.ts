/**
 * Laufzeit- und Datumsrechnung des Import-Adapters.
 *
 * Die Quelle führt KEIN Monatsfeld — die Laufzeit muss aus Start- und Enddatum
 * gerechnet werden. Datumsangaben kommen als `YYYY-MM-DD`; sie werden bewusst
 * manuell zerlegt statt über `new Date(string)`, weil letzteres je nach Laufzeit-
 * umgebung als UTC oder lokal interpretiert wird und dann um einen Tag springt.
 */

export interface KalenderDatum {
  jahr: number;
  /** 1–12. */
  monat: number;
  /** 1–31. */
  tag: number;
}

/** Zerlegt `YYYY-MM-DD` (führende Zeitanteile werden ignoriert). Rein. */
export function parseDatum(wert: unknown): KalenderDatum | null {
  if (typeof wert !== 'string') return null;
  const treffer = /^(\d{4})-(\d{2})-(\d{2})/.exec(wert.trim());
  if (!treffer) return null;
  const jahr = Number(treffer[1]);
  const monat = Number(treffer[2]);
  const tag = Number(treffer[3]);
  if (monat < 1 || monat > 12 || tag < 1 || tag > 31) return null;
  return { jahr, monat, tag };
}

/** Fortlaufender Monatsindex — erlaubt Differenzen über Jahresgrenzen. */
export function monatsIndex(d: KalenderDatum): number {
  return d.jahr * 12 + (d.monat - 1);
}

/**
 * Laufzeit in **angefangenen Kalendermonaten** — die im Förderkontext übliche
 * Lesart: ein Vorhaben vom 01.06.2025 bis 30.04.2027 läuft über die Monate
 * Juni 2025 bis April 2027, also 23 Monate. Ein angebrochener Endmonat zählt
 * voll mit (die Bewilligung deckt den ganzen Monat ab).
 *
 * Gibt `null` bei unlesbaren Daten oder wenn das Ende vor dem Start liegt.
 */
export function monateZwischen(start: unknown, ende: unknown): number | null {
  const a = parseDatum(start);
  const b = parseDatum(ende);
  if (!a || !b) return null;
  const differenz = monatsIndex(b) - monatsIndex(a);
  if (differenz < 0) return null;
  return differenz + 1;
}

export interface Zeitraum {
  start: string | null;
  ende: string | null;
}

/** Vergleicht zwei Kalenderdaten: <0, 0 oder >0. */
export function vergleicheDatum(a: KalenderDatum, b: KalenderDatum): number {
  if (a.jahr !== b.jahr) return a.jahr - b.jahr;
  if (a.monat !== b.monat) return a.monat - b.monat;
  return a.tag - b.tag;
}

export type LaufzeitVerstoss = 'start-vor-beginn' | 'ende-nach-abschluss';

/**
 * Prüft, ob ein Zeitraum vollständig in der Projektlaufzeit liegt. Liefert die
 * Liste der Verstösse (leer = in Ordnung). Unlesbare Daten erzeugen KEINEN
 * Verstoss — Fehlen ist ein eigener Befund, keine Terminüberschreitung.
 */
export function pruefeInLaufzeit(zeitraum: Zeitraum, laufzeit: Zeitraum): LaufzeitVerstoss[] {
  const verstoesse: LaufzeitVerstoss[] = [];
  const lStart = parseDatum(laufzeit.start);
  const lEnde = parseDatum(laufzeit.ende);
  const zStart = parseDatum(zeitraum.start);
  const zEnde = parseDatum(zeitraum.ende);

  if (lStart && zStart && vergleicheDatum(zStart, lStart) < 0) verstoesse.push('start-vor-beginn');
  if (lEnde && zEnde && vergleicheDatum(zEnde, lEnde) > 0) verstoesse.push('ende-nach-abschluss');
  return verstoesse;
}

/**
 * Prüft, ob ein Jahr noch in die Laufzeit fällt. Braucht die Einsatzplanung,
 * die Personenmonate auf Jahresscheiben (`jahr1`…`jahr4`) verteilt — im Dummy
 * bis 2028, obwohl die Laufzeit am 30.04.2027 endet.
 */
export function jahrInLaufzeit(jahr: number, laufzeit: Zeitraum): boolean {
  const lStart = parseDatum(laufzeit.start);
  const lEnde = parseDatum(laufzeit.ende);
  if (lStart && jahr < lStart.jahr) return false;
  if (lEnde && jahr > lEnde.jahr) return false;
  return true;
}

/** `YYYY-MM-DD` für die Anzeige (`30.04.2027`). */
export function formatDatum(wert: string | null): string {
  const d = parseDatum(wert);
  if (!d) return '—';
  const zwei = (n: number): string => String(n).padStart(2, '0');
  return `${zwei(d.tag)}.${zwei(d.monat)}.${d.jahr}`;
}
