/**
 * Gliederungs-Rekonstruktion aus dem **Tag-Baum** eines PDFs.
 *
 * Ein aus Word (oder LibreOffice, InDesign, LaTeX mit `tagpdf`) exportiertes PDF
 * trägt seine Struktur mit: `getStructTree()` liefert `H1`…`H6`, `P`, `L`/`LI`,
 * `Table`/`TR`/`TH`/`TD` — dieselbe Gliederung, die im Word-Dokument stand. Die
 * Überschriften sind also IM PDF; der Konverter hat sie bis v6.28 nur nie
 * gelesen, weil er ausschließlich `getTextContent()` (Position + Zeichen)
 * auswertete. Gemessen an den drei synthetischen Anträgen kamen dadurch 0 von
 * 44–47 Überschriften an, 0 Listen und 0 Auszeichnungen — bei einem PDF, das
 * alles davon sauber getaggt mitbringt.
 *
 * Die Verbindung zwischen Baum und Text sind die **Marked-Content-Ids**: der
 * Baum endet in Blättern `{ type: 'content', id: 'p4_mc0' }`, und
 * `getTextContent({ includeMarkedContent: true })` streut Marker mit denselben
 * Ids zwischen die Textstücke. Wer beides zusammenführt, weiß für jedes Wort,
 * in welchem Tag es steht.
 *
 * Nebeneffekt, der eigens Erwähnung verdient: Kopf- und Fußzeilen sind
 * **Artefakte** und stehen NICHT im Baum. Sie fallen hier von selbst weg —
 * bisher stand die Kopfzeile auf jeder Seite mitten im Fließtext.
 *
 * REINE Funktion mit eigenen, minimalen Typen (keine pdf.js-Abhängigkeit),
 * damit sie ohne echtes PDF unter Vitest prüfbar ist.
 */

/** Knoten aus `page.getStructTree()` (nur die Felder, die hier zählen). */
export interface PdfStrukturKnoten {
  role?: string;
  /** `'content'` an den Blättern, die auf Marked Content zeigen. */
  type?: string;
  /** Marked-Content-Id des Blattes. */
  id?: string;
  children?: PdfStrukturKnoten[];
}

/** Element aus `getTextContent({ includeMarkedContent: true })`. */
export interface PdfMarkiertesElement {
  str?: string;
  hasEOL?: boolean;
  /** `'beginMarkedContentProps'` | `'beginMarkedContent'` | `'endMarkedContent'`. */
  type?: string;
  id?: string | null;
}

/** Rollen, die einen eigenen Textblock aufmachen. */
const BLOCK_ROLLEN = new Set([
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H',
  'P', 'Lbl', 'LBody', 'TD', 'TH', 'TOCI', 'Caption', 'Figure',
]);

/** Rollen, die nur schmücken — sie sollen keinen Block aufreißen. */
const INLINE_ROLLEN = new Set(['Span', 'Link', 'Em', 'Strong', 'Quote', 'Code', 'Reference', 'Note']);

interface Zuordnung {
  /** Laufender Index des Block-Knotens (trennt zwei benachbarte `P`). */
  block: number;
  rolle: string;
  /** Index des `Table`-Knotens, falls der Block in einer Tabelle liegt. */
  tabelle?: number;
  /** Index des `TR`-Knotens. */
  zeile?: number;
  /** true, wenn die Zelle unter `THead` steht. */
  kopf?: boolean;
  /** Index des `LI`-Knotens — `Lbl` und `LBody` desselben Punktes teilen ihn. */
  listenPunkt?: number;
  /** Schachtelungstiefe in `L` (1 = oberste Liste). */
  listenTiefe?: number;
  /** Der Text steht in einem `Link` — Kennzeichen einer Verweis-Zeile. */
  imLink?: boolean;
}

/** Ein zusammengeführter Textblock in Lesereihenfolge. */
interface Block extends Zuordnung {
  text: string;
}

/**
 * Baum ablaufen und jeder Marked-Content-Id ihren Block-Kontext zuordnen.
 * Der Laufindex ist die Knoten-Identität: zwei aufeinanderfolgende Absätze
 * bekommen verschiedene Indizes und verschmelzen dadurch nicht.
 */
function sammleZuordnungen(wurzel: PdfStrukturKnoten): Map<string, Zuordnung> {
  const map = new Map<string, Zuordnung>();
  let lauf = 0;

  const gehe = (knoten: PdfStrukturKnoten, ctx: Partial<Zuordnung>): void => {
    const idx = lauf++;
    let next = ctx;
    const rolle = knoten.role;

    if (rolle === 'Link') next = { ...next, imLink: true };
    if (rolle && !INLINE_ROLLEN.has(rolle)) {
      if (rolle === 'Table') next = { ...next, tabelle: idx, zeile: undefined, kopf: false };
      else if (rolle === 'THead') next = { ...next, kopf: true };
      else if (rolle === 'TBody' || rolle === 'TFoot') next = { ...next, kopf: false };
      else if (rolle === 'TR') next = { ...next, zeile: idx };
      else if (rolle === 'L' || rolle === 'TOC') next = { ...next, listenTiefe: (next.listenTiefe ?? 0) + 1 };
      else if (rolle === 'LI') next = { ...next, listenPunkt: idx };
      // Ein Inhaltsverzeichnis IST eine Liste. Das ist nicht nur hübscher: als
      // blanke Zeilen gesetzt liest die Gliederungs-Erkennung jede IHV-Zeile als
      // eigenes Kapitel („3.1 Lösungsweg") und verdoppelt die halbe Gliederung
      // (gemessen: 59 statt 47 Sektionen). Mit `- ` davor greift die
      // Nummern-Inferenz nicht mehr.
      else if (rolle === 'TOCI') next = { ...next, listenPunkt: idx };
      if (BLOCK_ROLLEN.has(rolle)) next = { ...next, block: idx, rolle };
    }

    if (knoten.type === 'content' && knoten.id && next.rolle !== undefined && next.block !== undefined) {
      map.set(knoten.id, next as Zuordnung);
    }
    for (const kind of knoten.children ?? []) gehe(kind, next);
  };

  gehe(wurzel, {});
  return map;
}

/**
 * Textstücke in Stream-Reihenfolge zu Blöcken zusammenziehen. Textstücke ohne
 * bekannte Id (Artefakte — Kopf-/Fußzeile, Seitenzahl) fallen weg.
 */
function baueBloecke(items: PdfMarkiertesElement[], zuordnung: Map<string, Zuordnung>): Block[] {
  const bloecke: Block[] = [];
  const stapel: (Zuordnung | undefined)[] = [];

  for (const it of items) {
    if (it.type === 'beginMarkedContent' || it.type === 'beginMarkedContentProps') {
      stapel.push(it.id ? zuordnung.get(it.id) : undefined);
      continue;
    }
    if (it.type === 'endMarkedContent') { stapel.pop(); continue; }
    if (!it.str) continue;

    let aktuell: Zuordnung | undefined;
    for (let i = stapel.length - 1; i >= 0; i--) {
      const kandidat = stapel[i];
      if (kandidat) { aktuell = kandidat; break; }
    }
    if (!aktuell) continue; // Artefakt — bewusst verworfen

    const letzter = bloecke[bloecke.length - 1];
    const stueck = it.str + (it.hasEOL ? ' ' : '');
    if (letzter && letzter.block === aktuell.block) {
      letzter.text += stueck;
      // Ein einziges Stück außerhalb des Links genügt: dann ist der Absatz
      // Fließtext mit Link darin, keine Verweis-Zeile.
      if (!aktuell.imLink) letzter.imLink = false;
    } else {
      bloecke.push({ ...aktuell, imLink: aktuell.imLink === true, text: stueck });
    }
  }

  for (const b of bloecke) {
    b.text = b.text.replace(/\s+/g, ' ').trim();
    // Verweis-Zeilen (ein Absatz, der GANZ in einem Link steht) sind
    // Inhaltsverzeichnis-Einträge. Nicht jedes Word-IHV ist als `TOC`/`TOCI`
    // getaggt — eines der drei Muster-PDFs setzt es als `P > Link`. Ohne diese
    // Zeile liest die Gliederungs-Erkennung jeden IHV-Eintrag als Kapitel und
    // verdoppelt die halbe Gliederung (gemessen: 59 statt 47 Sektionen).
    const istUeberschrift = /^H[1-6]?$/.test(b.rolle);
    if (b.imLink && !istUeberschrift && b.listenPunkt === undefined && b.tabelle === undefined) {
      b.listenPunkt = b.block;
    }
  }
  return bloecke.filter(b => b.text.length > 0);
}

const escCell = (s: string): string => s.replace(/\|/g, '\\|');

/** Zellen-Blöcke einer Tabelle → Markdown-Pipe-Tabelle. */
function emittiereTabelle(zellen: Block[]): string {
  const zeilen: { zeile: number; kopf: boolean; texte: string[] }[] = [];
  for (const z of zellen) {
    const key = z.zeile ?? -1;
    const letzte = zeilen[zeilen.length - 1];
    if (letzte && letzte.zeile === key) letzte.texte.push(z.text);
    else zeilen.push({ zeile: key, kopf: z.kopf === true || z.rolle === 'TH', texte: [z.text] });
  }
  if (zeilen.length === 0) return '';
  const breite = Math.max(...zeilen.map(z => z.texte.length));
  const zeile = (texte: string[]): string =>
    '| ' + Array.from({ length: breite }, (_, i) => escCell(texte[i] ?? '')).join(' | ') + ' |';
  const trenner = '| ' + Array.from({ length: breite }, () => '---').join(' | ') + ' |';
  const kopfZeile = zeilen[0]!;
  return [zeile(kopfZeile.texte), trenner, ...zeilen.slice(1).map(z => zeile(z.texte))].join('\n');
}

/** `1.` / `a)` / `iv.` → geordnete Liste; alles andere (•, –, ▪) → Aufzählung. */
function istGeordnet(marke: string): boolean {
  return /^\(?[0-9]+[.)]?$/.test(marke) || /^\(?[a-zA-Z][.)]$/.test(marke);
}

/** Blöcke eines Listenpunktes (`Lbl` + `LBody`) → eine Markdown-Zeile. */
function emittiereListenpunkt(teile: Block[]): string {
  const tiefe = Math.max(1, teile[0]?.listenTiefe ?? 1);
  const einzug = '  '.repeat(tiefe - 1);
  const marke = teile.find(t => t.rolle === 'Lbl')?.text ?? '';
  const rest = teile.filter(t => t.rolle !== 'Lbl').map(t => t.text).join(' ').trim();
  const text = rest || marke;
  if (!text) return '';
  const zeichen = marke && istGeordnet(marke) ? (rest ? marke.replace(/[).]?$/, '.') : '-') : '-';
  return `${einzug}${zeichen} ${text}`;
}

/**
 * Tag-Baum + markierter Textstrom einer Seite → Markdown.
 *
 * Überschriften werden zu `#`-Ebenen, Listen zu `-`/`1.`, Tabellen zu
 * Pipe-Tabellen; Artefakte (Kopf-/Fußzeile) fallen weg. Leerer String, wenn die
 * Seite keinen zugeordneten Text trägt — der Aufrufer fällt dann auf die
 * Positions-Rekonstruktion zurück.
 */
export function pdfStrukturSeiteZuMarkdown(
  baum: PdfStrukturKnoten | null,
  items: PdfMarkiertesElement[],
): string {
  if (!baum) return '';
  const bloecke = baueBloecke(items, sammleZuordnungen(baum));
  if (bloecke.length === 0) return '';

  const raus: string[] = [];
  let i = 0;
  while (i < bloecke.length) {
    const b = bloecke[i]!;

    if (b.tabelle !== undefined) {
      let j = i;
      while (j < bloecke.length && bloecke[j]!.tabelle === b.tabelle) j++;
      const md = emittiereTabelle(bloecke.slice(i, j));
      if (md) raus.push(md);
      i = j;
      continue;
    }

    if (b.listenPunkt !== undefined) {
      // Lauf zusammenhängender Listenpunkte → ein Listenblock.
      const zeilen: string[] = [];
      let j = i;
      while (j < bloecke.length && bloecke[j]!.listenPunkt !== undefined && bloecke[j]!.tabelle === undefined) {
        const punkt = bloecke[j]!.listenPunkt;
        let k = j;
        while (k < bloecke.length && bloecke[k]!.listenPunkt === punkt) k++;
        const zeile = emittiereListenpunkt(bloecke.slice(j, k));
        if (zeile) zeilen.push(zeile);
        j = k;
      }
      if (zeilen.length > 0) raus.push(zeilen.join('\n'));
      i = j;
      continue;
    }

    const stufe = /^H([1-6])$/.exec(b.rolle);
    if (stufe) raus.push('#'.repeat(Number(stufe[1])) + ' ' + b.text);
    else if (b.rolle === 'H') raus.push('# ' + b.text);
    else raus.push(b.text);
    i++;
  }

  return raus.join('\n\n');
}
