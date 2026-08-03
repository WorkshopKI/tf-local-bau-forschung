/**
 * Die **Projektion eines Antrags** auf die Journal-Felder. Rein.
 *
 * Datumswerte werden zu `YYYYMMDD`-Zahlen: der Export liefert `03.08.2026`, und
 * über tausende Anträge ist die Zahl deutlich kleiner als der String — bei einer
 * Datei, die jede Nacht über SMB geschrieben wird, zählt das. Leere Werte fehlen
 * als **Schlüssel**; ein `null` je Feld je Antrag wäre der größte Einzelposten
 * der Datei und trüge keine Information.
 */
import { parseGermanDate } from '@/core/services/csv/dateParse';
import type { JournalFeld } from './felder';
import type { JournalWert } from './typen';

/** `03.08.2026` → `20260803`; ISO geht genauso. `null`, wenn kein Datum. */
export function alsTagesZahl(roh: string): number | null {
  const iso = parseGermanDate(roh) ?? (/^\d{4}-\d{2}-\d{2}/.test(roh) ? roh.slice(0, 10) : null);
  if (iso === null) return null;
  const n = Number(iso.slice(0, 4) + iso.slice(5, 7) + iso.slice(8, 10));
  return Number.isFinite(n) ? n : null;
}

/**
 * Eine Export-Zeile als Journal-Werte. Leere Werte fallen weg.
 *
 * **Ein Datumsfeld, dessen Wert kein Datum ist, wird als Text geführt** statt
 * verworfen: der Export hat dort schon Freitext geliefert, und eine Änderung
 * daran ist eine Änderung. Weggeworfen wird nur, was wirklich leer ist.
 */
export function projiziereAntrag(
  zeile: Record<string, string>, felder: readonly JournalFeld[],
): Record<string, JournalWert> {
  const out: Record<string, JournalWert> = {};
  for (const f of felder) {
    const roh = zeile[f.key];
    if (typeof roh !== 'string') continue;
    const wert = roh.trim();
    if (wert === '') continue;
    out[f.spalte] = f.datum ? (alsTagesZahl(wert) ?? wert) : wert;
  }
  return out;
}

/**
 * Der ganze Export als Journal-Projektion. Rein.
 *
 * `imBereich` ist ein **expliziter Parameter** — das Journal folgt dem
 * Betrachtungsbereich, aber die Entscheidung darüber fällt beim Aufrufer und
 * nicht still hier drin (Pitfall #46). Zeilen ohne Aktenzeichen fallen weg;
 * ohne Schlüssel gäbe es nichts, wogegen man vergleichen könnte.
 */
export function projiziereExport(
  zeilen: readonly Record<string, string>[],
  felder: readonly JournalFeld[],
  joinSpalte: string,
  imBereich: (zeile: Record<string, string>) => boolean,
): Record<string, Record<string, JournalWert>> {
  const out: Record<string, Record<string, JournalWert>> = {};
  for (const z of zeilen) {
    const id = (z[joinSpalte] ?? '').trim();
    if (id === '' || !imBereich(z)) continue;
    out[id] = projiziereAntrag(z, felder);
  }
  return out;
}
