/**
 * Stage 2 — Seite-1-Text + Keyword-Heuristik.
 *
 * - Lädt Seite-1-Text via mammoth/pdfjs/OCR-Stub
 * - Sucht Keyword-Marker pro doc_type
 * - Extrahiert FKZ (strict) und Akronym-Hint
 *
 * Liefert einen TriageResult mit dem besten doc_type + Reason.
 * Wenn kein eindeutiges Match: result.doc_type='sonstiges' und Stage 3
 * darf übernehmen.
 */

import { extractPage1Text } from './page1-extractor';
import { findAkronymHint, matchKeywords } from './keywords';
import type { DocType, TriageResult } from '../types';
import { extractFkzStrict, extractFkzTolerant } from '../matcher/fkz-extractor';
import type { PdfExtractResult } from './pdf-extract';

export interface Stage2Input {
  filename: string;
  blob: Blob;
  /** Hint aus Stage 0/1 — wird im reason mitgeführt. */
  docTypeHint?: DocType;
  fkzHint?: string | null;
  /** Vom Orchestrator pre-extrahierte PDF-Daten (PDF-Pfad), spart 2. pdfjs-Call. */
  preloadedPdf?: PdfExtractResult;
}

export interface Stage2Output {
  result: TriageResult;
  /** Page-1-Text für nachgelagerte Stage 3 (falls nötig). */
  page1_text: string;
  /** Wahrer match — false wenn kein Keyword-Treffer. */
  matched: boolean;
}

export async function runStage2(input: Stage2Input): Promise<Stage2Output> {
  const ext = await extractPage1Text(input.filename, input.blob, input.preloadedPdf);
  const matches = matchKeywords(ext.text);

  // FKZ aus Page 1 (falls noch keiner aus Stage 0 da ist)
  let fkz = input.fkzHint ?? null;
  if (!fkz && ext.text) {
    const strict = extractFkzStrict(ext.text);
    if (strict) {
      fkz = strict.fkz;
    } else {
      const tolerant = extractFkzTolerant(ext.text);
      if (tolerant) fkz = tolerant.fkz;
    }
  }
  const akronym = ext.text ? findAkronymHint(ext.text) : null;

  let docType: DocType = 'sonstiges';
  let reason = `stage2_no_keyword_match (text_len=${ext.text.length}, source=${ext.source})`;
  let matched = false;
  const top = matches[0];
  if (top) {
    docType = top.doc_type;
    reason = `stage2_keyword_match: ${top.matched_patterns.slice(0, 3).join(' / ')} (${top.hits} hits)`;
    matched = true;
  } else if (input.docTypeHint && input.docTypeHint !== 'sonstiges') {
    // Wenn Stage 0/1 schon einen Hint hatte, vertrauen wir dem als Fallback
    docType = input.docTypeHint;
    reason = `stage2_fallback_hint: ${input.docTypeHint} (kein Keyword-Match in ${ext.text.length} Zeichen)`;
  }

  // Sonderregel: Korrespondenz mit "Nachforderung" / "Ergänzung der Unterlagen"
  // → spezifischerer Typ nachforderung. Nur wenn Stage-2-Top-Match Korrespondenz war.
  if (matched && docType === 'korrespondenz') {
    const nachfMatch = matches.find(m => m.doc_type === 'nachforderung');
    if (nachfMatch) {
      docType = 'nachforderung';
      reason = `stage2_refined: korrespondenz → nachforderung (${nachfMatch.matched_patterns[0]})`;
    }
  }

  // Sonderregel auch im Stage-2-Pfad: Gutachten als DOCX = Arbeitsversion → irrelevant.
  // Das fängt den Fall "kein DMS-Eintrag, aber per Keyword als Gutachten klassifiziert" ab.
  const isDocx = input.filename.toLowerCase().endsWith('.docx');
  const isGutachten = docType === 'gutachten' || docType === 'gutachten_qs';
  const triageState = (isDocx && isGutachten)
    ? 'irrelevant'
    : (docType === 'irrelevant' ? 'irrelevant' : 'relevant');
  if (isDocx && isGutachten) {
    reason = `${reason} | gutachten_docx_arbeitsversion`;
  }

  const result: TriageResult = {
    filename: input.filename,
    doc_type: docType,
    triage_state: triageState,
    triage_stage: 2,
    source: 'stage2',
    reason,
    page1_text: ext.text || undefined,
    extracted_fkz: fkz,
    extracted_akronym: akronym,
    creator_kuerzel: null,
    dms_bezeichnung: null,
    dms_aktenplan: null,
  };
  return { result, page1_text: ext.text, matched };
}
