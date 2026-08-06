/**
 * Reine Logik des Spalten-Pickers — Suche, Zähler, Rubrik-Zielzustand.
 *
 * Getrennt von `ColumnPicker.tsx`, weil Vitest hier node-only läuft und keine
 * `.tsx` einsammelt. Alles hier ist ohne DOM prüfbar.
 */
import type { SortableColumn } from './types';

export interface SpaltenRubrik<T> {
  /** `null` = Spalten ohne `gruppe`; sie stehen ohne Überschrift da. */
  name: string | null;
  columns: SortableColumn<T>[];
}

/**
 * Faltet die Spaltenliste in Rubriken. Die Reihenfolge der Rubriken folgt dem
 * ERSTEN Auftreten ihrer Spalten — so ergibt sich die Lesefolge aus der
 * Registry, ohne dass daneben eine zweite Rubrik-Liste gepflegt werden muss
 * (die driftete sonst bei jeder neuen Spalte still auseinander).
 */
export function gruppiereSpalten<T>(columns: readonly SortableColumn<T>[]): SpaltenRubrik<T>[] {
  const rubriken: SpaltenRubrik<T>[] = [];
  const index = new Map<string, SpaltenRubrik<T>>();
  for (const c of columns) {
    const roh = typeof c.gruppe === 'string' ? c.gruppe.trim() : '';
    const name = roh.length > 0 ? roh : null;
    // Sentinel statt `null` als Map-Key: eine leere Zeichenkette waere ein
    // gueltiger (wenn auch sinnloser) Rubrikname und wuerde kollidieren.
    const schluessel = name ?? ' ohne';
    let rubrik = index.get(schluessel);
    if (!rubrik) {
      rubrik = { name, columns: [] };
      index.set(schluessel, rubrik);
      rubriken.push(rubrik);
    }
    rubrik.columns.push(c);
  }
  return rubriken;
}

/** Kombinierende Diakritika (U+0300–U+036F), die `normalize('NFD')` abspaltet.
 *  Bewusst als Escape-Sequenz: die Zeichen selbst sind unsichtbar und
 *  überstehen kein Copy-Paste. */
const DIAKRITIKA = new RegExp('[\\u0300-\\u036f]', 'g');

/**
 * Suchbegriff und Spaltenname vergleichbar machen: Kleinschreibung + Diakritika
 * weg. „Fordergeber" soll „Fördergeber" finden, „Prufung" auch „Prüfung".
 */
export function normalisiereSuche(s: string): string {
  return s.trim().toLocaleLowerCase('de-DE').normalize('NFD').replace(DIAKRITIKA, '');
}

/**
 * Rubriken auf die Treffer eindampfen. Leerer Begriff → alles unverändert
 * (inklusive Objekt-Identität, damit der Memo oben nicht unnötig neu rechnet);
 * Rubriken ohne Treffer verschwinden ganz.
 */
export function filtereRubriken<T>(
  rubriken: readonly SpaltenRubrik<T>[],
  suche: string,
): SpaltenRubrik<T>[] {
  const q = normalisiereSuche(suche);
  if (q.length === 0) return rubriken as SpaltenRubrik<T>[];
  const out: SpaltenRubrik<T>[] = [];
  for (const r of rubriken) {
    // Trifft die RUBRIK selbst, bleiben alle ihre Spalten stehen — sonst müsste
    // man „Termine" tippen und bekäme trotzdem nichts, weil keine Spalte so heißt.
    const rubrikTrifft = r.name !== null && normalisiereSuche(r.name).includes(q);
    const treffer = rubrikTrifft
      ? r.columns
      : r.columns.filter(c => normalisiereSuche(c.label).includes(q));
    if (treffer.length > 0) out.push({ name: r.name, columns: treffer });
  }
  return out;
}

/**
 * Wie viele der ANGEBOTENEN Spalten sichtbar sind.
 *
 * Bewusst nicht `visibleKeys.length`: die gespeicherte Auswahl kann Schlüssel
 * enthalten, die es in `columns` gar nicht gibt (eine abgewählte Ordner-Spalte
 * aus einer früheren Katalogfassung). Der Zähler zeigte sonst „25 von 24".
 */
export function zaehleSichtbar<T>(
  columns: readonly SortableColumn<T>[],
  visibleKeys: readonly string[],
): number {
  const sichtbar = new Set(visibleKeys);
  return columns.reduce((n, c) => n + (sichtbar.has(c.key) ? 1 : 0), 0);
}

/**
 * Was ein Klick auf den Rubrik-Schalter tun soll.
 *
 * `locked`-Spalten zählen nicht mit — sie lassen sich ohnehin nicht abwählen,
 * und mit ihnen wäre eine Rubrik nie „ganz aus".
 */
export function rubrikZielZustand<T>(
  spalten: readonly SortableColumn<T>[],
  visibleKeys: readonly string[],
): 'alleAn' | 'alleAus' {
  const sichtbar = new Set(visibleKeys);
  const schaltbar = spalten.filter(c => c.locked !== true);
  if (schaltbar.length === 0) return 'alleAn';
  return schaltbar.every(c => sichtbar.has(c.key)) ? 'alleAus' : 'alleAn';
}

/**
 * Die neue Schlüsselliste nach einem Rubrik-Schalter. `locked`-Spalten bleiben
 * unangetastet drin, die Reihenfolge der übrigen Auswahl bleibt erhalten.
 */
export function wendeRubrikSchalterAn<T>(
  spalten: readonly SortableColumn<T>[],
  visibleKeys: readonly string[],
  ziel: 'alleAn' | 'alleAus',
): string[] {
  const schaltbar = spalten.filter(c => c.locked !== true).map(c => c.key);
  if (ziel === 'alleAus') {
    const raus = new Set(schaltbar);
    return visibleKeys.filter(k => !raus.has(k));
  }
  const drin = new Set(visibleKeys);
  return [...visibleKeys, ...schaltbar.filter(k => !drin.has(k))];
}
