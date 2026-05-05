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
import { extractPdfOnce, type PdfExtractResult } from './pdf-extract';

export interface Stage1Input {
  filename: string;
  /** Kann null sein wenn der Caller die Datei nicht lesen konnte. */
  blob: Blob | null;
  /** Optionales doc_type-Pre-Hint (typischerweise aus Stage 0). */
  docTypeHint?: DocType;
  /** Optionales pre-extrahiertes FKZ (typischerweise aus Stage 0 / DMS-CSV). */
  fkzHint?: string | null;
  /** Stage-0-Erbe: DMS-Felder, die in Stage-1-`decided` durchgereicht werden. */
  dmsBezeichnungHint?: string | null;
  dmsAktenplanHint?: string | null;
  creatorKuerzelHint?: string | null;
  /**
   * Optionale pre-extrahierte PDF-Daten (vom Orchestrator), damit Stage 1
   * nicht selbst pdfjs.getDocument aufrufen muss. Wenn nicht uebergeben,
   * faellt Stage 1 auf einen eigenen Aufruf zurueck (Backward-Compat fuer
   * Tests).
   */
  preloadedPdf?: PdfExtractResult;
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
 * Bei Fehler: searchable=false, pages=0.
 *
 * Wenn der Caller `preloaded` mitgibt (Triage-Orchestrator), nutzt Stage 1
 * die bereits extrahierten Daten — kein zweiter pdfjs.getDocument-Call.
 */
async function probePdf(
  blob: Blob,
  preloaded?: PdfExtractResult,
): Promise<{ searchable: boolean; pages: number }> {
  const pdf = preloaded ?? await extractPdfOnce(blob);
  return { searchable: pdf.totalCharsPage1 >= 20, pages: pdf.pages };
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
      // Stage-0-Erbe — sonst gehen die DMS-Felder beim Sonderregel-Pfad verloren.
      creator_kuerzel: input.creatorKuerzelHint ?? null,
      dms_bezeichnung: input.dmsBezeichnungHint ?? null,
      dms_aktenplan: input.dmsAktenplanHint ?? null,
    };
    out.decided = decided;
    return out;
  }

  if (format === 'pdf' && input.blob) {
    try {
      const probe = await probePdf(input.blob, input.preloadedPdf);
      out.pages = probe.pages;
      out.searchable = probe.searchable;
    } catch (e) {
      console.warn(`[phase2/stage1] PDF-Probe fehlgeschlagen: ${input.filename}`, e);
    }
  }
  return out;
}
