/**
 * Deterministische Extraktions-Qualität des Zeitplans (Paket 5, Phase 4.2). Wann gilt
 * eine geerntete AP-Tabelle als „unsicher" (typisch: PDF-Tabelle, die zu Flattext
 * zerfällt)? Dann KEIN Gantt/Schwimmbahnen (die täuschen Vollständigkeit vor), sondern
 * ehrlich „nicht zuverlässig auslesbar" + die geernteten Roh-Tabellen zeigen.
 *
 * NUR harte, deterministische Kriterien (kein Scoring). Rein/Node-testbar.
 */
import type { ApZeile, RohTabelle } from './tabellen';

/** Anteil AP-Zeilen ohne auswertbare Laufzeit-Spanne, ab dem die Extraktion unsicher ist. */
export const ZEITPLAN_UNSICHER_ANTEIL = 0.5;

/** Hat die Zeile eine auswertbare Laufzeit-Spanne (Start UND Ende in Monaten)? */
export function hatLaufzeitSpanne(z: ApZeile): boolean {
  return z.monatStart != null && z.monatEnde != null;
}

/**
 * Ist die Zeitplan-Extraktion unsicher? `true`, wenn 0 AP-Zeilen geparst wurden ODER
 * mehr als `ZEITPLAN_UNSICHER_ANTEIL` der Zeilen keine auswertbare Laufzeit-Spanne haben.
 */
export function zeitplanUnsicher(zeilen: ApZeile[]): boolean {
  if (zeilen.length === 0) return true;
  const ohneSpanne = zeilen.filter(z => !hatLaufzeitSpanne(z)).length;
  return ohneSpanne / zeilen.length > ZEITPLAN_UNSICHER_ANTEIL;
}

/** Escaped einen Zellwert für eine Markdown-Pipe-Tabelle (Pipes + Zeilenumbrüche). */
function zelle(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim();
}

/**
 * Rendert eine geerntete Roh-Tabelle als Markdown-Pipe-Tabelle (für den bestehenden
 * `MarkdownRenderer`). Leere Tabelle → leerer String.
 */
export function tabelleAlsMarkdown(t: RohTabelle): string {
  if (t.header.length === 0 && t.rows.length === 0) return '';
  const header = t.header.length ? t.header : (t.rows[0] ?? []).map((_, i) => `Spalte ${i + 1}`);
  const kopf = `| ${header.map(zelle).join(' | ')} |`;
  const trenner = `| ${header.map(() => '---').join(' | ')} |`;
  const zeilen = t.rows.map(r => {
    // Auf die Header-Breite normalisieren (fehlende Zellen auffüllen).
    const zellen = header.map((_, i) => zelle(r[i] ?? ''));
    return `| ${zellen.join(' | ')} |`;
  });
  return [kopf, trenner, ...zeilen].join('\n');
}
