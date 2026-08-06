/**
 * Inhaltsabhängige Spaltenbreite — die reine Rechnung, ohne DOM.
 *
 * `table-layout: fixed` heißt: der Browser misst Zellinhalte NIE. Die Breiten
 * kommen aus `SortableColumn.width` — handgepflegte Pixelwerte, die mit jeder
 * neuen Spalte schlechter passen. Diese Datei leitet stattdessen eine
 * Wunschbreite aus dem tatsächlichen Inhalt ab; gerendert wird sie weiter über
 * den Prozent-Pfad in `tableSizing.ts` (dessen Begründung unverändert gilt).
 *
 * Die eigentliche Textmessung ist INJIZIERT (`MesseBreite`) — im Browser Canvas
 * (`textMessung.ts`), im Test eine Attrappe. Nur so ist die Entscheidungslogik
 * node-testbar.
 *
 * ZWEISTUFIG, und das ist keine Optimierung, sondern die Voraussetzung dafür,
 * dass synchron im Render gemessen werden kann (sonst rückten die Breiten
 * sichtbar nach): erst über bis zu `scanFenster` Zeilen die längsten Texte je
 * Spalte nach `String.length` einsammeln, dann nur die `kandidaten` längsten
 * davon durch die teure Messung schicken. Top-3 statt Top-1, weil Zeichenlänge
 * in derselben Schrift gut, aber nicht monoton mit der Pixelbreite korreliert
 * (`WWWW` gegen `iiii`).
 */
import type { MessSchrift, SortableColumn } from '../types';

export type { MessSchrift };

export type MesseBreite = (text: string, schrift: MessSchrift) => number;

export interface MessOptionen {
  /** Zeilen, die überhaupt angesehen werden (nur `String.length`). */
  scanFenster?: number;
  /** Längste Texte je Spalte, die wirklich gemessen werden. */
  kandidaten?: number;
  minBreite?: number;
  maxBreite?: number;
  /** Zell-Polster links+rechts (`px-3`). */
  zellPolster?: number;
  /** Sortier-Pfeil im Kopf (Icon + `gap-1.5`). */
  kopfSortIcon?: number;
  /** Filter-Chevron im Kopf (Icon + `p-0.5` + Abstand). */
  kopfFilterIcon?: number;
  /** Ob der Verbraucher überhaupt Spalten-Filter durchreicht — das weiß nur er,
   *  nicht die Spalte. Ohne das bekäme jede `filterable`-Spalte Platz für ein
   *  Icon, das nie erscheint. */
  filterAktiv?: boolean;
}

export const MESS_DEFAULTS: Required<Omit<MessOptionen, 'filterAktiv'>> & { filterAktiv: boolean } = {
  scanFenster: 2000,
  kandidaten: 3,
  minBreite: 64,
  maxBreite: 420,
  zellPolster: 24,
  kopfSortIcon: 17,
  kopfFilterIcon: 21,
  filterAktiv: false,
};

function mitDefaults(o: MessOptionen | undefined): typeof MESS_DEFAULTS {
  return { ...MESS_DEFAULTS, ...o };
}

/**
 * Der Text, an dem eine Zelle gemessen wird.
 *
 * `exportValue ?? accessor` ist die vorhandene „lesbarer Zellwert"-Kette der
 * XLSX-Exporte — sie trägt für fast alle Spalten. `messText` ist der Ausweg für
 * die wenigen, bei denen Anzeige und Export auseinandergehen (etwa eine
 * Geldspalte, deren Export bewusst die rohe Zahl liefert).
 */
export function messTextVon<T>(spalte: SortableColumn<T>, zeile: T): string {
  if (spalte.messText) return spalte.messText(zeile);
  const roh = spalte.exportValue ? spalte.exportValue(zeile) : spalte.accessor(zeile);
  return typeof roh === 'string' ? roh : String(roh);
}

/**
 * Die längsten Texte je Spalte — Stufe 1 (billig, nur Zeichenlänge).
 *
 * Rückgabe nach Länge absteigend; bei Gleichstand behält der zuerst gesehene
 * Text seinen Platz, ein späterer verdrängt ihn nie. Das macht die Auswahl für
 * eine gegebene Zeilenfolge eindeutig — reihenfolge-UNABHÄNGIG ist sie damit
 * nicht (bei lauter gleich langen Texten entscheidet, wer zuerst kommt). Dass
 * ein Sortierklick die Breiten trotzdem nicht neu würfelt, liegt an der
 * Aufrufseite: gemessen wird der ungesortierte Gesamtsatz, nicht die sortierte
 * Seite.
 */
export function waehleMesskandidaten<T>(
  zeilen: readonly T[],
  spalten: readonly SortableColumn<T>[],
  optionen?: MessOptionen,
): Record<string, string[]> {
  const o = mitDefaults(optionen);
  const aktive = spalten.filter(s => s.autoWidth !== false);
  const top = new Map<string, string[]>();
  for (const s of aktive) top.set(s.key, []);

  const bis = Math.min(zeilen.length, o.scanFenster);
  for (let i = 0; i < bis; i++) {
    const zeile = zeilen[i]!;
    for (const s of aktive) {
      const text = messTextVon(s, zeile);
      if (!text) continue;
      const liste = top.get(s.key)!;
      if (liste.length >= o.kandidaten && text.length <= liste[liste.length - 1]!.length) continue;
      // Einfügen an der richtigen Stelle (Liste ist nach Länge absteigend), dann
      // hinten abschneiden. `>` statt `>=`: bei Gleichstand bleibt der frühere
      // Text vorne — das macht das Ergebnis reihenfolge-unabhängig.
      let pos = liste.length;
      while (pos > 0 && text.length > liste[pos - 1]!.length) pos--;
      liste.splice(pos, 0, text);
      if (liste.length > o.kandidaten) liste.length = o.kandidaten;
    }
  }
  return Object.fromEntries(top);
}

/**
 * Platzbedarf der Kopfzelle. Sie ist der BODEN jeder Spalte — eine Spalte
 * schmaler als ihre Überschrift zu rendern, bringt nichts: der Kopf bricht dann
 * über den Rand (siehe Kommentar in `TableHeadRows.tsx`).
 */
export function kopfBreite<T>(
  spalte: SortableColumn<T>,
  messeBreite: MesseBreite,
  optionen?: MessOptionen,
): number {
  const o = mitDefaults(optionen);
  // Der Kopf rendert `uppercase` — gemessen wird deshalb die Großschreibung.
  let b = messeBreite(spalte.label.toLocaleUpperCase('de-DE'), 'kopf') + o.zellPolster;
  if (spalte.sortable) b += o.kopfSortIcon;
  if (o.filterAktiv && spalte.filterable) b += o.kopfFilterIcon;
  return b;
}

/**
 * Wunschbreite je Spalte — Stufe 2 (teuer, echte Messung der Kandidaten).
 *
 * Spalten mit `autoWidth: false` fehlen im Ergebnis und fallen damit auf ihre
 * gepflegte `width` zurück (für Zellen, deren Platzbedarf kein Text ist —
 * Eingabefelder, Auswahlmenüs).
 */
export function berechneAutoBreiten<T>(
  spalten: readonly SortableColumn<T>[],
  kandidaten: Record<string, string[]>,
  messeBreite: MesseBreite,
  optionen?: MessOptionen,
): Record<string, number> {
  const o = mitDefaults(optionen);
  const out: Record<string, number> = {};
  for (const s of spalten) {
    if (s.autoWidth === false) continue;
    let roh = 0;
    for (const t of kandidaten[s.key] ?? []) {
      roh = Math.max(roh, messeBreite(t, s.messSchrift ?? 'zelle'));
    }
    // Leere Spalte: kein Inhalts-Anspruch, der Kopf entscheidet allein. Ohne die
    // Abfrage bekäme sie Polster + Zuschlag für einen Text, den es nicht gibt.
    const inhalt = roh > 0 ? roh + o.zellPolster + (s.messZuschlag ?? 0) : 0;
    const wunsch = Math.max(inhalt, kopfBreite(s, messeBreite, o));
    const min = s.minWidth ?? o.minBreite;
    // `Math.max(min, max)`: eine Spalte mit min > max soll ihren Mindestbedarf
    // behalten, nicht darunter geklemmt werden.
    const max = Math.max(min, s.maxWidth ?? o.maxBreite);
    out[s.key] = Math.round(Math.min(Math.max(wunsch, min), max));
  }
  return out;
}
