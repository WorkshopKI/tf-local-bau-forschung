/**
 * Externe Zuweisungen — vom Auslastungs-Modul abgeleitete "PL-hat-direkt-
 * zugewiesen"-Marker aus der Master-CSV.
 *
 * Problem: PL kann TIB-Kürzel direkt am Antrag im Master-CSV eintragen,
 * komplett am Auslastungs-Workflow (Klassifizierung → Vorschlag → Freigabe)
 * vorbei. Diese Zuweisungen sind im `Zuweisung[]`-Store nicht sichtbar,
 * würden aber die Kapazität des MAs im aktuellen Quartal verbrauchen.
 *
 * Heuristik: Ein Antrag gilt als "extern zugewiesen", wenn
 *  - `tib_kuerz` matched eines der eigenen Kürzel (case-insensitive,
 *    "MUE, SCH"-Listen werden komma-separiert behandelt) UND
 *  - `antragsdatum` fällt in das angefragte Quartal.
 *
 * Source-of-Truth bleibt die CSV — wir persistieren NICHTS, sondern leiten
 * dynamisch ab. Vermeidet Drift bei CSV-Re-Imports.
 */

/**
 * Minimale Antrags-Form für die Helper. Bewusst lose statt `import type
 * { Antrag }`, damit der Helper ohne den 500-Felder-Typ testbar bleibt.
 */
export interface ExterneZuweisungAntrag {
  aktenzeichen: string;
  tib_kuerz?: string;
  antragsdatum?: string;
}

/**
 * Quartal-String "YYYY-Q1".."YYYY-Q4" aus ISO-Date "YYYY-MM-DD" oder
 * "YYYY/MM/DD". Toleriert beide Trennzeichen (CSVs kommen mal so, mal so).
 * Returns null bei leerem/ungültigem Input — Caller filtert solche Anträge raus.
 */
export function dateToQuartal(date: string | undefined | null): string | null {
  if (!date) return null;
  // Verlangt YYYY-MM-DD oder YYYY/MM/DD (mit Tageskomponente). CSVs ohne Tag
  // sind selten und mehrdeutig (Quartal-Anfang? Mitte?) — daher Reject.
  const m = /^(\d{4})[-/](\d{2})[-/](\d{2})/.exec(date.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (!Number.isFinite(year) || month < 1 || month > 12) return null;
  const q = Math.ceil(month / 3);
  return `${year}-Q${q}`;
}

/**
 * Parst das Profil-Feld `bearbeiter_kuerzel` ("MUE" oder "MUE, SCH") zu
 * normalisierten uppercase-Tokens. Leer / "alle" → leeres Array (= keine
 * Zuordnung möglich, da Filter inaktiv). Bewusst entkoppelt von
 * `parseBearbeiterFilter` aus dem antraege-Plugin, damit auslastung keine
 * Cross-Plugin-Dependency aufbaut.
 */
export function parseKuerzelTokens(raw: string | undefined | null): string[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];
  if (trimmed.toLowerCase() === 'alle') return [];
  return trimmed
    .split(',')
    .map(t => t.trim().toUpperCase())
    .filter(t => t.length > 0);
}

/**
 * Zählt Anträge, deren `tib_kuerz` in `meineKuerzel` enthalten ist UND deren
 * `antragsdatum` in `quartal` fällt. Case-insensitive Vergleich auf TIB.
 * Leere `meineKuerzel` → 0 (keine Zuordnung möglich).
 */
export function countExterneZuweisungenImQuartal(
  antraege: readonly ExterneZuweisungAntrag[],
  meineKuerzel: readonly string[],
  quartal: string,
): number {
  if (meineKuerzel.length === 0) return 0;
  const meineSet = new Set(meineKuerzel.map(k => k.toUpperCase()));
  let n = 0;
  for (const a of antraege) {
    const k = (a.tib_kuerz ?? '').trim().toUpperCase();
    if (!k || !meineSet.has(k)) continue;
    if (dateToQuartal(a.antragsdatum) !== quartal) continue;
    n++;
  }
  return n;
}

/**
 * IDs (aktenzeichen) der extern zugewiesenen Anträge im Quartal — für die
 * Pool-Filterung in "Neue Anträge für Dich". Selbe Heuristik wie
 * `countExterneZuweisungenImQuartal`, gibt aber ein Set zurück.
 */
export function getExterneAntragIds(
  antraege: readonly ExterneZuweisungAntrag[],
  meineKuerzel: readonly string[],
  quartal: string,
): Set<string> {
  const ids = new Set<string>();
  if (meineKuerzel.length === 0) return ids;
  const meineSet = new Set(meineKuerzel.map(k => k.toUpperCase()));
  for (const a of antraege) {
    const k = (a.tib_kuerz ?? '').trim().toUpperCase();
    if (!k || !meineSet.has(k)) continue;
    if (dateToQuartal(a.antragsdatum) !== quartal) continue;
    ids.add(a.aktenzeichen);
  }
  return ids;
}
