/**
 * Was von den selbst angelegten Spalten in die Slim-Projektion wandert.
 *
 * **Nur Rohwerte, nie Ergebnisse** — die Begründung steht in `anzeige.ts`. Der
 * Beutel ist nach `feldId` gekeyt, nicht nach Spalte: zwei Spalten, die dasselbe
 * Feld lesen, kosten einen Eintrag, nicht zwei.
 *
 * Rein: keine IO.
 */
import type { FreiesFeld } from './aufloesung';

/** Beutel im Slim-Item: feldId → Rohwert, wie er im Record stand. */
export type FreiRoh = Record<string, string>;

function roh(record: Record<string, unknown>, key: string): string {
  const v = record[key];
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number') return String(v);
  return '';
}

/**
 * Baut den Beutel für einen Record.
 *
 * Leere Werte fallen weg, und ein durchweg leerer Beutel wird zu `undefined` —
 * dieselbe Regel wie bei `kat_status`. Ein leeres Objekt je Antrag kostete bei
 * ~29.000 Zeilen Platz und Vergleichszeit, ohne etwas auszusagen.
 */
export function baueFreiRoh(
  record: Record<string, unknown>, felder: readonly FreiesFeld[],
): FreiRoh | undefined {
  if (felder.length === 0) return undefined;
  const out: FreiRoh = {};
  for (const f of felder) {
    const wert = roh(record, f.recordKey);
    if (wert !== '') out[f.feldId] = wert;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
