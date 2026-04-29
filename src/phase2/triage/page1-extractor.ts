/**
 * Page-1-Text-Extraktor für Stage 2.
 *
 * - DOCX: erste ~500 Tokens via mammoth (extractRawText)
 * - Text-PDF: erste Seite via pdfjs-dist
 * - OCR-PDF: nur Seite 1 OCR'en — über `ocr/side-car.ts`-Stub
 *   (eigentlicher Side-Car kommt in einem separaten Patch)
 *
 * Gibt einen abgeschnittenen Text auf max ~500 Tokens (~3500 Zeichen) zurück.
 */

import mammoth from 'mammoth';
import { ocrFirstPage, OcrNotImplementedError } from '../ocr/side-car';

/** Geschätzt: 1 Token ≈ 7 Zeichen Deutsch (whitespace-separated) — wir nehmen 3500 Zeichen Deckel. */
const MAX_CHARS = 3500;

export interface Page1ExtractResult {
  text: string;
  /** Quelle des Texts. */
  source: 'docx' | 'pdf_text_layer' | 'pdf_ocr' | 'unsupported' | 'ocr_unavailable';
  /** Wenn das Dokument gescannt war und OCR gebraucht wurde. */
  needed_ocr: boolean;
}

function clip(text: string): string {
  if (text.length <= MAX_CHARS) return text;
  return text.slice(0, MAX_CHARS);
}

async function extractDocxText(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  // Mammoth akzeptiert in Node `{ buffer }` (Buffer/Uint8Array), im Browser
  // `{ arrayBuffer }`. In `file://` läuft der Code im Browser; in Vitest in Node.
  // Wir versuchen erst arrayBuffer, fallback auf Uint8Array-Wrapping.
  let result: { value?: string };
  try {
    result = await mammoth.extractRawText({ arrayBuffer: buf });
  } catch {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result = await (mammoth.extractRawText as any)({ buffer: new Uint8Array(buf) });
  }
  return clip(result.value ?? '');
}

async function extractPdfPage1Text(blob: Blob): Promise<{ text: string; hasTextLayer: boolean }> {
  // Lazy import (siehe stage1-structural.ts) — pdfjs-Init crasht in Node ohne DOMMatrix.
  const pdfjsLib = await import('pdfjs-dist');
  const buf = await blob.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buf, isEvalSupported: false }).promise;
  if (doc.numPages === 0) return { text: '', hasTextLayer: false };
  const page = await doc.getPage(1);
  const content = await page.getTextContent();
  const items = content.items as Array<{ str?: string }>;
  const texts: string[] = [];
  for (const it of items) {
    if (it.str) texts.push(it.str);
  }
  const text = texts.join(' ').trim();
  return { text: clip(text), hasTextLayer: text.length >= 20 };
}

export async function extractPage1Text(filename: string, blob: Blob): Promise<Page1ExtractResult> {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.docx')) {
    const text = await extractDocxText(blob);
    return { text, source: 'docx', needed_ocr: false };
  }
  if (lower.endsWith('.pdf')) {
    const { text, hasTextLayer } = await extractPdfPage1Text(blob);
    if (hasTextLayer) {
      return { text, source: 'pdf_text_layer', needed_ocr: false };
    }
    // Fallback: OCR (Stub bis der Side-Car-Patch landet)
    try {
      const ocr = await ocrFirstPage({ pdfBlob: blob, filename, lang: 'deu' });
      return { text: clip(ocr.text), source: 'pdf_ocr', needed_ocr: true };
    } catch (e) {
      if (e instanceof OcrNotImplementedError) {
        return { text: '', source: 'ocr_unavailable', needed_ocr: true };
      }
      throw e;
    }
  }
  return { text: '', source: 'unsupported', needed_ocr: false };
}
