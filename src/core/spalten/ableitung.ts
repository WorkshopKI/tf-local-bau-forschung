/**
 * Was sich aus einer Spalten-Definition ABLEITEN lässt: welche Felder sie
 * braucht, und wie sie sich selbst erklärt.
 *
 * Beides gehört zusammen, weil beides dieselbe Frage beantwortet — „woraus
 * entsteht diese Spalte?". Die eine Antwort geht an die Projektion (was muss
 * mitgeschrieben werden), die andere an den Tooltip (was sieht der Nutzer).
 * Zwei Implementierungen liefen unweigerlich auseinander: eine Spalte, die ein
 * Feld liest, das ihre Erklärung nicht nennt, ist genau der Fall, den die
 * Herkunftsangabe verhindern soll.
 *
 * Rein: keine IO, keine Schemas. Aufgelöst wird erst in `aufloesung.ts`.
 */
import { bedingungFeldRefs } from '@/core/status/bedingung';
import type { SpaltenHilfe } from '@/components/data-table/types';
import type { EigeneSpalte } from './typen';

/**
 * Alle Felder, die diese Spalte liest — dedupliziert, in stabiler Reihenfolge.
 *
 * Für Regel-Spalten kommt die Liste aus `bedingungFeldRefs`, also aus derselben
 * Funktion, die auch die Meilensteine und die Import-Validierung benutzen. Ein
 * neuer Operator mit einem zweiten Feldbezug wird dort einmal ergänzt und wirkt
 * hier mit — eine eigene Kopie fiele bei genau so einer Erweiterung still aus.
 */
export function feldRefs(spalte: EigeneSpalte): string[] {
  switch (spalte.art) {
    case 'feld':
      return [spalte.feldId];
    case 'sammel':
      return [...new Set(spalte.felder)];
    case 'regel': {
      const out: string[] = [];
      for (const r of spalte.regeln) bedingungFeldRefs(r.wenn, out);
      return out;
    }
  }
}

/** Alle Feld-Refs über eine Menge von Spalten — sortiert, dedupliziert. Das ist
 *  genau die Menge, die projiziert werden muss, und geht als solche in die
 *  Projektions-Signatur ein. */
export function alleFeldRefs(spalten: readonly EigeneSpalte[]): string[] {
  const out = new Set<string>();
  for (const s of spalten) for (const f of feldRefs(s)) out.add(f);
  return [...out].sort((a, b) => a.localeCompare(b, 'de'));
}

/** Klartext einer Feld-Id, soweit bekannt. Der Aufrufer reicht ihn herein
 *  (Spalten-Inventar); ohne Treffer bleibt es beim rohen Code. */
export type LabelVon = (feldId: string) => string;

const SAMMEL_REGEL: Record<'juengstes' | 'aeltestes', string> = {
  juengstes: 'Von den unten genannten Feldern gewinnt das jüngste gesetzte Datum.',
  aeltestes: 'Von den unten genannten Feldern gewinnt das älteste gesetzte Datum.',
};

/**
 * Die Herkunftsangabe einer selbst angelegten Spalte — dieselbe Struktur, die
 * die eingebauten Spalten tragen. Dadurch erklärt sich eine eigene Spalte im
 * Kopf-Tooltip und im Picker genau wie jede andere, ohne dass der Autor etwas
 * dafür tun müsste.
 */
export function hilfeAus(spalte: EigeneSpalte, labelVon: LabelVon = f => f): SpaltenHilfe {
  const felder = feldRefs(spalte).map(f => ({ code: f, label: labelVon(f) }));
  const satz = spalte.beschreibung?.trim() || standardSatz(spalte);
  const regel = regelText(spalte);
  return { satz, ...(regel ? { regel } : null), ...(felder.length > 0 ? { felder } : null) };
}

function standardSatz(spalte: EigeneSpalte): string {
  switch (spalte.art) {
    case 'feld':
      return 'Selbst angelegte Spalte: zeigt ein Feld des Fachsystems unverändert.';
    case 'sammel':
      return 'Selbst angelegte Spalte: der jeweils passende Termin aus mehreren Feldern.';
    case 'regel':
      return 'Selbst angelegte Spalte: der Text der Regel, die auf diese Zeile zutrifft.';
  }
}

function regelText(spalte: EigeneSpalte): string | null {
  switch (spalte.art) {
    case 'feld':
      return null;
    case 'sammel':
      return SAMMEL_REGEL[spalte.wahl];
    case 'regel': {
      const n = spalte.regeln.length;
      const sonst = spalte.sonst
        ? `Trifft keine zu, steht „${spalte.sonst.text}" da.`
        : 'Trifft keine zu, bleibt die Zelle leer.';
      return `${n} ${n === 1 ? 'Regel' : 'Regeln'} in fester Reihenfolge — die erste zutreffende gewinnt. ${sonst}`;
    }
  }
}
