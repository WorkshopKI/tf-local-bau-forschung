/**
 * Fundstellen im Trefferttext auszeichnen — zwei Klassen, eine Zerlegung.
 *
 * Die Suchseite zeigt bisher gar keine Markierung: Titel und Vorschautext
 * stehen als Klartext da, und wer bei „Standards" den Treffer „HPC Standards
 * GmbH" sieht, muss raten, warum die Zeile kam.
 *
 * Zwei Klassen, weil es zwei Gründe gibt: das WÖRTLICHE Suchwort (gelb) und
 * eine über den Wortstamm hinzugekommene Variante (türkis). Wer „Normen" sucht
 * und „Normung" markiert sieht, versteht die Trefferliste ohne Erklärung.
 *
 * **Gesucht wird im gefalteten Text, markiert wird im Original** — dieselbe
 * Regel wie im Glossar ([glossarSuche.ts](src/plugins/glossar/glossarSuche.ts)):
 * `normalize('NFD')` zerlegt „ü", „ß" verdoppelt sich, ohne die Herkunft aus
 * `falte()` säße die Markierung daneben.
 *
 * Gibt Segmente zurück, kein JSX — die Vitest-Projekte laufen ohne DOM.
 */
import { falte, ursprung } from '@/core/utils/textFaltung';

export type MarkierungsArt = 'wortlaut' | 'aehnlich';

export interface MarkSegment {
  text: string;
  /** `null` = unmarkiert. */
  art: MarkierungsArt | null;
}

interface RohTreffer { von: number; bis: number; art: MarkierungsArt }

/** Wörtliche Treffer haben Vorrang vor Stamm-Varianten. */
function rang(art: MarkierungsArt): number {
  return art === 'wortlaut' ? 0 : 1;
}

/**
 * Zerlegt `text` in markierte und unmarkierte Segmente.
 *
 * `wortlaut` sind die eingegebenen Wörter, `aehnlich` die über den Wortstamm
 * hinzugekommenen. Überschneiden sich beide, gewinnt `wortlaut` — der Nutzer
 * hat das Wort schließlich selbst getippt.
 *
 * Trifft nichts, kommt genau ein Segment zurück; die Zeile ist dann Zeichen für
 * Zeichen die alte.
 */
export function markiereText(
  text: string,
  wortlaut: readonly string[],
  aehnlich: readonly string[] = [],
): MarkSegment[] {
  const ganz: MarkSegment[] = [{ text, art: null }];
  if (text === '' || (wortlaut.length === 0 && aehnlich.length === 0)) return ganz;

  const f = falte(text);
  const roh: RohTreffer[] = [];
  sammle(f, wortlaut, 'wortlaut', roh);
  sammle(f, aehnlich, 'aehnlich', roh);
  if (roh.length === 0) return ganz;

  const segmente: MarkSegment[] = [];
  let ab = 0;
  for (const t of verschmelze(roh)) {
    if (t.von > ab) segmente.push({ text: text.slice(ab, t.von), art: null });
    // Ein Treffer, der ganz in einem schon geschriebenen Segment liegt, bringt
    // nichts Neues — `verschmelze` liefert aufsteigend und überlappungsfrei.
    if (t.bis > ab) segmente.push({ text: text.slice(Math.max(ab, t.von), t.bis), art: t.art });
    ab = Math.max(ab, t.bis);
  }
  if (ab < text.length) segmente.push({ text: text.slice(ab), art: null });
  return segmente;
}

function sammle(
  f: ReturnType<typeof falte>,
  nadeln: readonly string[],
  art: MarkierungsArt,
  ziel: RohTreffer[],
): void {
  for (const nadel of nadeln) {
    const gefaltet = falte(nadel).text;
    if (gefaltet.length === 0) continue;
    // Schrittweite 1, nicht `nadel.length`: „aa" in „aaa" überlappt sich selbst,
    // und das Verschmelzen unten räumt das ohnehin auf.
    for (let i = f.text.indexOf(gefaltet); i !== -1; i = f.text.indexOf(gefaltet, i + 1)) {
      const { von, bis } = ursprung(f, i, i + gefaltet.length);
      if (bis > von) ziel.push({ von, bis, art });
    }
  }
}

/**
 * Sortiert und legt überlappende Treffer zusammen. Bei gleichem Anfang gewinnt
 * der wörtliche — sonst überdeckte eine Stamm-Variante das getippte Wort und die
 * Zeile behauptete, der Treffer sei nur „ähnlich".
 */
function verschmelze(roh: RohTreffer[]): RohTreffer[] {
  const sortiert = [...roh].sort((a, b) => (
    a.von - b.von
    // Klasse VOR Länge: „norm" (getippt) muss die Farbe bestimmen, auch wenn
    // die Stamm-Variante „Normung" länger ist. Deren Überhang („ung") wird
    // danach als eigenes, türkises Segment angehängt.
    || rang(a.art) - rang(b.art)
    || (b.bis - b.von) - (a.bis - a.von)
  ));
  const out: RohTreffer[] = [];
  for (const t of sortiert) {
    const letzter = out[out.length - 1];
    if (letzter && t.von <= letzter.bis) {
      // Gleiche Art: zusammenziehen. Verschiedene Art: der frühere behält seinen
      // Bereich, der spätere darf nur den Überhang beanspruchen.
      if (t.art === letzter.art) {
        letzter.bis = Math.max(letzter.bis, t.bis);
      } else if (t.bis > letzter.bis) {
        out.push({ von: letzter.bis, bis: t.bis, art: t.art });
      }
      continue;
    }
    out.push({ ...t });
  }
  return out;
}
