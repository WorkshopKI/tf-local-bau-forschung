/**
 * OCR Side-Car-Stub.
 *
 * Eigentliche Implementation kommt in einem separaten Patch (analog zur
 * llama.cpp-Integration läuft Tesseract als Portable-Side-Car außerhalb
 * des Browsers, nicht als Tesseract.js — Blob-URL-CSP unter `file://`
 * verbietet das).
 *
 * Diese Datei stellt nur das Interface bereit, damit Stage 2 schon dagegen
 * coden kann. Aufrufe werfen `not_implemented` und werden vom Triage-
 * Orchestrator gefangen.
 */

export interface OcrFirstPageRequest {
  pdfBlob: Blob;
  filename: string;
  /** Optional: Sprache für die OCR (default 'deu'). */
  lang?: 'deu' | 'eng' | 'deu+eng';
}

export interface OcrFirstPageResult {
  text: string;
  /** Confidence des Tesseract-Outputs (0..1). */
  confidence: number;
}

/** Marker-Error, damit Caller den Stub-Fall sauber unterscheiden kann. */
export class OcrNotImplementedError extends Error {
  constructor() {
    super('OCR-Side-Car ist noch nicht implementiert (Phase 2.x).');
    this.name = 'OcrNotImplementedError';
  }
}

/**
 * Stub. Die echte Implementation poked das Tesseract-Side-Car (HTTP, lokal)
 * mit der Page-1-Bitmap und liefert den OCR-Text zurück.
 */
export async function ocrFirstPage(_req: OcrFirstPageRequest): Promise<OcrFirstPageResult> {
  throw new OcrNotImplementedError();
}
