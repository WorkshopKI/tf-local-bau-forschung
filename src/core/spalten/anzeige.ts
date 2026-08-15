/**
 * Was steht in der Zelle einer selbst angelegten Spalte?
 *
 * Gerechnet wird beim **Rendern**, nicht bei der Projektion — aus den
 * projizierten Rohwerten und dem injizierten Stichtag. Drei Gründe, und alle
 * drei sind der Grund für den Zuschnitt dieses Moduls:
 *
 * 1. **Datumsregeln bleiben frisch.** `tageSeit`/`datumVor heute` zur
 *    Projektionszeit eingefroren wäre still falsch, bis jemand neu importiert.
 * 2. **Regeln bearbeiten kostet keinen Rebuild.** Text, Farbe und Reihenfolge
 *    ändern nichts an den gelesenen Feldern — nur ein NEUES Feld tut das.
 * 3. **Verbund-Zeilen können über alle Teilvorhaben werten.** Zur
 *    Projektionszeit läge nur der eine Record vor.
 *
 * Rein und deterministisch: keine IO, kein `new Date()`. Der Stichtag kommt von
 * außen, wie überall in der Bedingungs-Auswertung.
 */
import { parseGermanDate } from '@/core/services/csv/dateParse';
import { baueKontext, pruefeBedingung } from '@/core/status/bedingung';
import type { EigeneSpalte, SpaltenFarbe } from './typen';

/** Die Rohwerte einer Zeile: feldId → Wert, wie projiziert. */
export type Rohwerte = Record<string, string>;

export interface Zellwert {
  /** Was angezeigt und exportiert wird. Leer = die Zelle bleibt leer. */
  text: string;
  farbe?: SpaltenFarbe;
  /**
   * Sortierschlüssel. Bewusst getrennt vom Text: ein Datum sortiert nach ISO,
   * eine Regel-Spalte nach der Reihenfolge ihrer Regeln (sonst stünde die
   * Rangfolge, die der Autor gerade festgelegt hat, alphabetisch durcheinander).
   */
  sortier: string | number;
  /** Zusatzangabe für den Zell-Tooltip (bei Sammel-Spalten das Datum). */
  titel?: string;
}

const LEER: Zellwert = { text: '', sortier: '' };

/**
 * Berechnet den Zellwert.
 *
 * `tvRohwerte` sind die Rohwerte der Teilvorhaben einer Verbund-Zeile; bei einer
 * Einzelzeile bleibt der Parameter weg. `heute` ist der injizierte Stichtag
 * (ISO) — ohne ihn evaluieren die stichtagsabhängigen Operatoren zu `false`,
 * genau wie in der To-do-Engine.
 */
export function berechneZelle(
  spalte: EigeneSpalte,
  roh: Rohwerte,
  tvRohwerte?: readonly Rohwerte[],
  heute?: string,
): Zellwert {
  switch (spalte.art) {
    case 'feld': return feldZelle(spalte.feldId, spalte.typ, roh);
    case 'sammel': return sammelZelle(spalte.felder, spalte.wahl, roh);
    case 'regel': return regelZelle(spalte, roh, tvRohwerte, heute);
  }
}

function feldZelle(feldId: string, typ: 'datum' | 'wert', roh: Rohwerte): Zellwert {
  const wert = (roh[feldId] ?? '').trim();
  if (wert === '') return LEER;
  if (typ !== 'datum') return { text: wert, sortier: wert };
  // Datumsfelder tragen im Bestand beide Schreibweisen. Angezeigt wird, was
  // dasteht; sortiert wird nach ISO — sonst stünde 01.12. vor 02.03.
  const iso = parseGermanDate(wert);
  return iso ? { text: wert, sortier: iso } : { text: wert, sortier: '' };
}

function sammelZelle(
  felder: readonly string[], wahl: 'juengstes' | 'aeltestes', roh: Rohwerte,
): Zellwert {
  let bestIso: string | null = null;
  let bestFeld = '';
  let bestMs = wahl === 'juengstes' ? -Infinity : Infinity;
  for (const feldId of felder) {
    const iso = parseGermanDate((roh[feldId] ?? '').trim());
    if (!iso) continue;
    const ms = new Date(iso).getTime();
    if (Number.isNaN(ms)) continue;
    // Gleichstand: der früher gelistete gewinnt (strikter Vergleich) — dieselbe
    // Tie-Break-Regel wie bei den eingebauten Datums-Status-Gruppen.
    const besser = wahl === 'juengstes' ? ms > bestMs : ms < bestMs;
    if (!besser) continue;
    bestMs = ms; bestIso = iso; bestFeld = feldId;
  }
  if (bestIso === null) return LEER;
  return { text: bestFeld, sortier: bestIso, titel: bestIso };
}

function regelZelle(
  spalte: Extract<EigeneSpalte, { art: 'regel' }>,
  roh: Rohwerte,
  tvRohwerte?: readonly Rohwerte[],
  heute?: string,
): Zellwert {
  const tvFelder = tvRohwerte && tvRohwerte.length > 0
    ? Object.fromEntries(tvRohwerte.map((r, i) => [String(i), r]))
    : undefined;
  const ctx = baueKontext(roh, tvFelder);
  for (let i = 0; i < spalte.regeln.length; i++) {
    const r = spalte.regeln[i]!;
    if (!pruefeBedingung(r.wenn, ctx, heute)) continue;
    // Sortiert wird nach dem RANG der Regel, nicht nach ihrem Text: die
    // Reihenfolge ist die Aussage des Autors („dringend" vor „läuft"), und
    // alphabetisch stünde sie zufällig.
    return { text: r.text, ...(r.farbe ? { farbe: r.farbe } : null), sortier: i };
  }
  if (!spalte.sonst) return { text: '', sortier: spalte.regeln.length };
  return {
    text: spalte.sonst.text,
    ...(spalte.sonst.farbe ? { farbe: spalte.sonst.farbe } : null),
    sortier: spalte.regeln.length,
  };
}
