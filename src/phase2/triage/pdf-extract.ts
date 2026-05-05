/**
 * Konsolidierter PDF-Extraktor — oeffnet pdfjs.getDocument einmal pro Datei,
 * extrahiert pages + page1Text + totalCharsPage1, destroyt am Ende.
 *
 * Wird vom Triage-Orchestrator vor Stage 1+2 aufgerufen — beide Stages teilen
 * sich das Ergebnis statt jeweils selber pdfjs zu instanzieren. Spart ~50 %
 * der pdfjs-Arbeit pro PDF.
 *
 * Worker-Setup (Schritt B): pdfjs laeuft im Web-Worker (?worker&inline analog
 * core/services/converter), damit der Main-Thread fuer parallele Triage-Calls
 * frei bleibt. Setup wird einmalig beim ersten Aufruf gemacht — Faelle:
 * - Browser/file://: Worker laedt erfolgreich, alle pdfjs-Calls laufen
 *   in einem dedizierten Worker-Thread.
 * - Vitest/Node: dynamic ?worker-Import schlaegt fehl, wir fallen still auf
 *   Main-Thread-Modus zurueck (kein crash).
 */

const MAX_CHARS = 3500;

// Promise-basiertes Singleton — verhindert dass parallele Worker-Coroutinen
// (Concurrency-Pool in bulk-scan.ts) den Worker-Setup mehrfach starten.
// Race: ein boolean-Flag waere zwischen den `await import(...)`-Yields nicht
// atomic, alle parallelen Caller sehen flag=false und erzeugen je einen
// Worker — die letzte Zuweisung an GlobalWorkerOptions.workerPort gewinnt,
// die anderen Worker sind verwaist und werden GCt. pdfjs interpretiert das
// als 'PDFWorker.create - the worker is being destroyed'.
let workerSetupPromise: Promise<void> | null = null;

/* eslint-disable @typescript-eslint/no-explicit-any */
function setupWorkerOnce(): Promise<void> {
  if (workerSetupPromise) return workerSetupPromise;
  workerSetupPromise = (async () => {
    try {
      const pdfjsLib = await import('pdfjs-dist');
      const workerModule = await import(
        // Vite-spezifischer Suffix: laedt den Worker als Inline-Blob-URL
        // (wichtig fuer file://-Builds — keine separate Worker-Datei).
        'pdfjs-dist/build/pdf.worker.min.mjs?worker&inline'
      );
      const PdfjsWorker = workerModule.default;
      pdfjsLib.GlobalWorkerOptions.workerPort = new PdfjsWorker() as any;
    } catch (e) {
      // In Vitest schlaegt das ?worker-Suffix fehl — wir fallen auf Main-Thread
      // zurueck. Nicht ideal performance-maessig, aber funktional.
      console.warn('[phase2/pdf-extract] Worker-Setup fehlgeschlagen — fallback Main-Thread', e);
    }
  })();
  return workerSetupPromise;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export interface PdfExtractResult {
  pages: number;
  /** Geclipped auf MAX_CHARS (3500). Fuer Stage-2-Keywords/FKZ-Extraktion. */
  page1Text: string;
  /** Ungeclippte Laenge — fuer Stage-1-searchable-Pruefung (>=20 chars). */
  totalCharsPage1: number;
}

function clip(text: string): string {
  if (text.length <= MAX_CHARS) return text;
  return text.slice(0, MAX_CHARS);
}

/**
 * Oeffnet ein PDF einmal mit pdfjs, extrahiert Metadaten + Page-1-Text.
 * Destroyt das Dokument am Ende (kritisch fuer Memory).
 */
export async function extractPdfOnce(blob: Blob): Promise<PdfExtractResult> {
  await setupWorkerOnce();
  const pdfjsLib = await import('pdfjs-dist');
  const buf = await blob.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buf, isEvalSupported: false }).promise;
  try {
    const pages = doc.numPages;
    let totalCharsPage1 = 0;
    let page1Text = '';
    if (pages > 0) {
      try {
        const page = await doc.getPage(1);
        const content = await page.getTextContent();
        const items = content.items as Array<{ str?: string }>;
        const texts: string[] = [];
        for (const it of items) {
          if (it.str) texts.push(it.str);
        }
        page1Text = texts.join(' ').trim();
        totalCharsPage1 = page1Text.length;
      } catch {
        // Page 1 nicht lesbar — pages bleibt korrekt, Text leer
      }
    }
    return { pages, page1Text: clip(page1Text), totalCharsPage1 };
  } finally {
    await doc.destroy().catch(() => { /* best-effort */ });
  }
}
