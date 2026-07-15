/**
 * Heuristische Tabellen-Rekonstruktion aus positionierten PDF-Textfragmenten.
 *
 * pdf.js `getTextContent()` liefert nur Fragmente mit (x, y, width) — KEINE Zeilen,
 * Zellen oder Tabellen. Der bisherige Konverter fügte Fragmente nur per Y-Abstand
 * zusammen, sodass eine PDF-Tabelle (z. B. Anlage 5) zu Flattext zerfiel — weder in
 * der Vorschau als Tabelle sichtbar noch später für die Zeitplan-Ernte auslesbar.
 *
 * Diese REINE Funktion clustert Fragmente zu Zeilen (nach y), splittet jede Zeile an
 * großen horizontalen Lücken in Zellen und emittiert eine **Markdown-Pipe-Tabelle**,
 * wo ≥2 aufeinanderfolgende Zeilen ≥2 stabil ausgerichtete Spalten teilen. Alles
 * andere bleibt Flattext (≈ bisheriges Verhalten) — bewusst konservativ: im Zweifel
 * KEINE Tabelle (die Aufbereitung fängt nicht-auslesbare Anlagen sauber ab). Rein und
 * unit-testbar (keine pdf.js-/DOM-Abhängigkeit).
 */

export interface PdfTextFragment {
  str: string;
  /** transform[4] (x-Position, PDF-Text-Einheiten). */
  x: number;
  /** transform[5] (y-Position; in PDF steigt y nach oben). */
  y: number;
  /** Vorschub-Breite des Fragments (gleiche Einheit wie x). */
  width: number;
}

interface Cell {
  x: number;
  text: string;
}

const LINE_Y_TOL = 3; // gleiche Textzeile, wenn |Δy| ≤ 3 PDF-Einheiten
const MIN_TABLE_ROWS = 2; // mind. 2 Zeilen für eine Tabelle
const MIN_COLS = 2; // mind. 2 Spalten

/** Median-Zeichenbreite über alle Fragmente (für adaptive Lücken-Schwellen). */
function medianCharWidth(frags: PdfTextFragment[]): number {
  const ws: number[] = [];
  for (const f of frags) {
    const n = f.str.length;
    if (n > 0 && f.width > 0) ws.push(f.width / n);
  }
  if (ws.length === 0) return 4;
  ws.sort((a, b) => a - b);
  return ws[Math.floor(ws.length / 2)] ?? 4;
}

/** Fragmente → Zeilen (nach y geclustert, oben zuerst; innerhalb der Zeile nach x). */
function clusterLines(frags: PdfTextFragment[]): PdfTextFragment[][] {
  const sorted = frags.filter(f => f.str.trim().length > 0).sort((a, b) => b.y - a.y);
  const lines: { y: number; items: PdfTextFragment[] }[] = [];
  for (const f of sorted) {
    const line = lines.find(l => Math.abs(l.y - f.y) <= LINE_Y_TOL);
    if (line) line.items.push(f);
    else lines.push({ y: f.y, items: [f] });
  }
  return lines.map(l => l.items.sort((a, b) => a.x - b.x));
}

/** Eine (nach x sortierte) Zeile in Zellen splitten: neue Zelle, wenn Lücke > colGap. */
function splitCells(items: PdfTextFragment[], colGap: number): Cell[] {
  const cells: Cell[] = [];
  let cur: { x: number; parts: string[]; end: number } | null = null;
  for (const it of items) {
    if (cur && it.x - cur.end > colGap) {
      cells.push({ x: cur.x, text: cur.parts.join(' ').trim() });
      cur = null;
    }
    if (!cur) cur = { x: it.x, parts: [], end: it.x };
    cur.parts.push(it.str);
    cur.end = it.x + it.width;
  }
  if (cur) cells.push({ x: cur.x, text: cur.parts.join(' ').trim() });
  return cells.filter(c => c.text.length > 0);
}

/** Zell-x über mehrere Zeilen zu aufsteigenden Spalten-Ankern clustern (Anker = kleinstes x). */
function detectColumns(rows: Cell[][], tol: number): number[] {
  const xs = rows.flatMap(r => r.map(c => c.x)).sort((a, b) => a - b);
  const cols: number[] = [];
  for (const x of xs) {
    const last = cols[cols.length - 1];
    if (last === undefined || x - last > tol) cols.push(x);
  }
  return cols;
}

/** Nächster Spalten-Index für ein Zell-x. */
function nearestCol(cols: number[], x: number): number {
  let best = 0;
  let bestD = Infinity;
  for (let k = 0; k < cols.length; k++) {
    const c = cols[k];
    if (c === undefined) continue;
    const d = Math.abs(c - x);
    if (d < bestD) { bestD = d; best = k; }
  }
  return best;
}

const escCell = (s: string): string => s.replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();

/** Zeilen (Zellen) + Spalten-Anker → Markdown-Pipe-Tabelle (erste Zeile = Kopf). */
function emitTable(rows: Cell[][], cols: number[]): string {
  const grid = rows.map(row => {
    const out = new Array<string>(cols.length).fill('');
    for (const cell of row) {
      const ci = nearestCol(cols, cell.x);
      out[ci] = out[ci] ? `${out[ci]} ${cell.text}` : cell.text;
    }
    return out;
  });
  const line = (cells: string[]): string => `| ${cells.map(escCell).join(' | ')} |`;
  const sep = `| ${cols.map(() => '---').join(' | ')} |`;
  return [line(grid[0] ?? []), sep, ...grid.slice(1).map(line)].join('\n');
}

/**
 * Rekonstruiert das Markdown einer PDF-Seite aus ihren Textfragmenten: Tabellen-
 * Regionen als Pipe-Tabellen, alles andere als Absatz-Fließtext (Zeile = Absatz,
 * wie bisher). Gibt einen leeren String zurück, wenn die Seite keinen Text trägt.
 */
export function pdfPageToMarkdown(frags: PdfTextFragment[]): string {
  const lines = clusterLines(frags);
  if (lines.length === 0) return '';
  const charW = medianCharWidth(frags);
  const colGap = Math.max(6, charW * 2.5); // Spalten-Lücke ≫ Wort-Lücke
  const tol = Math.max(4, charW * 1.5); // Spalten-x-Toleranz über Zeilen

  const rows = lines.map(items => splitCells(items, colGap));
  const out: string[] = [];
  let i = 0;
  while (i < rows.length) {
    const row = rows[i];
    if (row === undefined) { i++; continue; }
    if (row.length >= MIN_COLS) {
      // Lauf aufeinanderfolgender mehr-zelliger Zeilen einsammeln.
      let j = i;
      while (j < rows.length) {
        const rj = rows[j];
        if (rj === undefined || rj.length < MIN_COLS) break;
        j++;
      }
      const run = rows.slice(i, j);
      const cols = detectColumns(run, tol);
      const maxCells = Math.max(...run.map(r => r.length));
      // Tabelle nur, wenn ≥2 Zeilen UND die Spaltenzahl mit den Zellen je Zeile
      // zusammenpasst (sauber ausgerichtet) — sonst zerstreute Lücken → Fließtext.
      const tabellarisch = run.length >= MIN_TABLE_ROWS && cols.length >= MIN_COLS && cols.length <= maxCells + 1;
      if (tabellarisch) out.push(emitTable(run, cols));
      else for (const r of run) out.push(r.map(c => c.text).join(' '));
      i = j;
    } else {
      out.push(row.map(c => c.text).join(' '));
      i++;
    }
  }
  return out.join('\n\n');
}
