/**
 * Quartal-Helfer fuer das Auslastungs-Modul.
 *
 * Bis v2.3 enthielt dieses Modul die Heuristik fuer "externe Zuweisungen"
 * via Master-CSV `tib_kuerz`. Ab v2.4 ist die Quartals-Auslastung in
 * `quartals-auslastung.ts` zentralisiert — hier bleibt nur noch der
 * `dateToQuartal`-Helper, weil er auch dort verwendet wird.
 */

/**
 * Quartal-String "YYYY-Q1".."YYYY-Q4" aus ISO-Date "YYYY-MM-DD" oder
 * "YYYY/MM/DD". CSVs koennen mal so, mal so kommen — beide Separatoren
 * werden akzeptiert. Verlangt einen Tag-Part (YYYY-MM-DD), `YYYY-MM` ohne
 * Tag wird abgelehnt (mehrdeutig: Quartal-Anfang? -Mitte?).
 */
export function dateToQuartal(date: string | undefined | null): string | null {
  if (!date) return null;
  const m = /^(\d{4})[-/](\d{2})[-/](\d{2})/.exec(date.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (!Number.isFinite(year) || month < 1 || month > 12) return null;
  const q = Math.ceil(month / 3);
  return `${year}-Q${q}`;
}
