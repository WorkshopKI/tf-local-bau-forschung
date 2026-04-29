/**
 * Stage 1 — Strukturelle Features (kostenlos, nur Datei-Metadaten + Header).
 *
 * - Format-Check (PDF / DOCX)
 * - Bei PDF: Seitenanzahl + searchable? (Text-Layer vorhanden)
 * - Sonderregel: doc_type=Gutachten + format=docx → automatisch irrelevant
 *   (Arbeitsversion, finale Variante ist immer PDF). Spart die Versions-
 *   Klassifikation Original/QS-docx komplett.
 */

import type { DocType, TriageResult } from '../types';

export interface Stage1Input {
  filename: string;
  /** Kann null sein wenn der Caller die Datei nicht lesen konnte. */
  blob: Blob | null;
  /** Optionales doc_type-Pre-Hint (typischerweise aus Stage 0). */
  docTypeHint?: DocType;
  /** Optionales pre-extrahiertes FKZ (typischerweise aus Stage 0 / DMS-CSV). */
  fkzHint?: string | null;
}

export interface Stage1Output {
  format: 'pdf' | 'docx' | 'unknown';
  pages?: number;
  searchable?: boolean;
  /** Wenn definitiv eine Entscheidung gefallen ist (z.B. Gutachten-DOCX-Sonderregel), liefert das hier das Ergebnis. */
  decided?: TriageResult;
}

function detectFormat(filename: string): 'pdf' | 'docx' | 'unknown' {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.pdf')) return 'pdf';
  if (lower.endsWith('.docx')) return 'docx';
  return 'unknown';
}

/**
 * Prüft ob ein PDF eine Text-Schicht hat (durchsuchbar). Gibt searchable + pages zurück.
 * Bei Fehler: searchable=false, pages=undefined.
 */
async function probePdf(blob: Blob): Promise<{ searchable: boolean; pages: number }> {
  // Lazy import: in Node-Tests crasht der pdfjs-Init weil DOMMatrix fehlt.
  // Sobald hier wirklich PDFs verarbeitet werden, ist der Code im Browser.
  const pdfjsLib = await import('pdfjs-dist');
  const buf = await blob.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buf, isEvalSupported: false }).promise;
  const pages = doc.numPages;
  let searchable = false;
  // Nur erste Seite probe — wenn die Text hat, ist es i.d.R. ein durchsuchbares PDF
  try {
    const page = await doc.getPage(1);
    const content = await page.getTextContent();
    const items = content.items as Array<{ str?: string }>;
    const totalChars = items.reduce((s, it) => s + ((it.str ?? '').length), 0);
    searchable = totalChars >= 20;
  } catch {
    searchable = false;
  }
  return { searchable, pages };
}

export async function runStage1(input: Stage1Input): Promise<Stage1Output> {
  const format = detectFormat(input.filename);
  const out: Stage1Output = { format };

  // Sonderregel Gutachten + DOCX → irrelevant ohne weitere Inspektion.
  // Funktioniert auch ohne Blob (Hint kommt aus Stage 0).
  if (
    format === 'docx' &&
    (input.docTypeHint === 'gutachten' || input.docTypeHint === 'gutachten_qs')
  ) {
    const decided: TriageResult = {
      filename: input.filename,
      doc_type: input.docTypeHint,
      triage_state: 'irrelevant',
      triage_stage: 1,
      source: 'stage1',
      reason: 'gutachten_docx_arbeitsversion',
      extracted_fkz: input.fkzHint ?? null,
      extracted_akronym: null,
      creator_kuerzel: null,
      dms_bezeichnung: null,
      dms_aktenplan: null,
    };
    out.decided = decided;
    return out;
  }

  if (format === 'pdf' && input.blob) {
    try {
      const probe = await probePdf(input.blob);
      out.pages = probe.pages;
      out.searchable = probe.searchable;
    } catch (e) {
      console.warn(`[phase2/stage1] PDF-Probe fehlgeschlagen: ${input.filename}`, e);
    }
  }
  return out;
}
