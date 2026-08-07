/**
 * Text vergleichbar machen — **und sagen können, wo das Verglichene herkam**.
 *
 * Kleinschreibung und Diakritika-Strip sind schnell hingeschrieben
 * (`s.toLowerCase().normalize('NFD').replace(…)`). Sobald die Suche aber die
 * Fundstelle AUSZEICHNEN soll, reicht das nicht: `normalize('NFD')` spaltet „ü"
 * in zwei Zeichen und „ß" wird zu „ss" — die Position im gefalteten Text ist
 * dann nicht mehr die im Original. Wer trotzdem darauf schneidet, markiert das
 * falsche Zeichen oder zerreißt das Wort.
 *
 * Darum faltet `falte()` Zeichen für Zeichen und führt zu JEDEM gefalteten
 * Zeichen mit, aus welchem Stück des Originals es stammt. Ein Treffer im
 * gefalteten Text lässt sich damit verlustfrei zurückrechnen.
 *
 * **„ß" fällt auf „ss".** Damit findet „Strasse" auch „Straße" — und umgekehrt,
 * weil beide Seiten durch dieselbe Faltung gehen.
 *
 * **Nicht abgedeckt: die Umschreibung „oe/ae/ue".** „Foerdergeber" findet
 * „Fördergeber" nicht. Beide Gewohnheiten gleichzeitig zu bedienen ginge nur mit
 * unscharfem Vergleich: faltet man „ö" auf „o", passt die Umschreibung nicht,
 * faltet man auf „oe", passt das Tippen ohne Umlaut nicht. Die Faltung auf den
 * Grundbuchstaben ist die verbreitetere Gewohnheit und die verlustärmere Regel.
 */

/** Kombinierende Diakritika (U+0300–U+036F), die `normalize('NFD')` abspaltet.
 *  Bewusst als Escape-Sequenz: die Zeichen selbst sind unsichtbar und
 *  überstehen kein Copy-Paste. */
const DIAKRITIKA = new RegExp('[\\u0300-\\u036f]', 'g');

export interface Faltung {
  /** Der gefaltete Text: klein, ohne Diakritika, „ß" als „ss". */
  text: string;
  /** Je Zeichen von `text` der Startindex im Original. */
  von: number[];
  /** Je Zeichen von `text` der Endindex (exklusiv) im Original. */
  bis: number[];
}

/** Ein einzelnes Zeichen falten. Ergebnis kann leer (reines Diakritikum),
 *  ein Zeichen (Normalfall) oder zwei Zeichen („ß") lang sein. */
function falteZeichen(zeichen: string): string {
  const klein = zeichen.toLocaleLowerCase('de-DE');
  return (klein === 'ß' ? 'ss' : klein).normalize('NFD').replace(DIAKRITIKA, '');
}

/**
 * Faltet und merkt sich die Herkunft jedes Zeichens.
 *
 * `text.length === von.length === bis.length` gilt immer — darauf darf sich
 * `ursprung()` verlassen.
 */
export function falte(roh: string): Faltung {
  const zeichen: string[] = [];
  const von: number[] = [];
  const bis: number[] = [];

  let start = 0;
  // Nach Codepoints, damit ein Zeichen außerhalb der BMP nicht mitten
  // durchgeschnitten wird; die Indizes bleiben trotzdem UTF-16-Indizes des
  // Originals, weil `slice()` später genau damit rechnet.
  for (const einzel of roh) {
    const ende = start + einzel.length;
    const gefaltet = falteZeichen(einzel);
    for (let k = 0; k < gefaltet.length; k++) {
      zeichen.push(gefaltet[k]!);
      von.push(start);
      bis.push(ende);
    }
    start = ende;
  }

  return { text: zeichen.join(''), von, bis };
}

/** Nur der gefaltete Text, ohne Herkunft — für den reinen Vergleich. */
export function falteText(roh: string): string {
  return falte(roh).text;
}

/**
 * Ein Treffer `[start, ende)` im gefalteten Text, zurückgerechnet auf das
 * Original.
 *
 * Ein Treffer, der nur die HÄLFTE einer Ausweitung erwischt (das erste „s" von
 * „ß"), liefert trotzdem das ganze Ausgangszeichen: ein halbes „ß" gibt es
 * nicht, und ein Schnitt mitten hinein zerlegte die Anzeige.
 */
export function ursprung(f: Faltung, start: number, ende: number): { von: number; bis: number } {
  if (ende <= start) return { von: 0, bis: 0 };
  return { von: f.von[start] ?? 0, bis: f.bis[ende - 1] ?? 0 };
}
