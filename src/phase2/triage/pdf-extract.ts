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

import { istFehlendesPdfAsset, sammlePdfWarnungen } from '@/core/services/converter/pdf-assets';

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
  /**
   * pdfjs konnte die ZEICHENTABELLE (CMap) nicht laden UND es kam kein Text
   * heraus — beides zusammen, weil die Warnung allein nichts bedeutet (siehe
   * `core/services/converter/pdf-assets.ts`).
   *
   * Wichtig fuer die Triage: das ist KEIN `parse_error`. Die Datei ist lesbar,
   * nur ihre Schrift nicht — sie als „kaputt" einzusortieren (cleanup.ts) waere
   * falsch, denn ein Mensch kann sie oeffnen.
   */
  cmapFehlt?: boolean;
}

function clip(text: string): string {
  if (text.length <= MAX_CHARS) return text;
  return text.slice(0, MAX_CHARS);
}

/**
 * Erkennt pdfjs-Worker-Race-Errors die bei Concurrency >1 sporadisch auftreten:
 * wenn ein Worker gerade `doc.destroy()` macht und gleichzeitig ein anderer
 * `getDocument()` startet, kann pdfjs intern den Worker als 'being destroyed'
 * sehen, obwohl er funktional weiterlaufen wuerde. Ein 75ms-Wait + Retry
 * bringt typischerweise alles ins Gleis.
 */
function isWorkerRaceError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /worker.*(destroy|being destroyed)|PDFWorker\.create/i.test(msg);
}

async function extractPdfOnceInternal(blob: Blob): Promise<PdfExtractResult> {
  // Der haeufigere Fall ist der stille: pdfjs warnt und liefert weniger Text,
  // statt zu werfen. Deshalb der Warnungs-Kanal UM den ganzen Lauf, nicht nur
  // ein `catch` (siehe `pdf-assets.ts`).
  const { ergebnis, cmapFehlt } = await sammlePdfWarnungen(() => leseEinmal(blob));
  // Nur melden, wenn auch tatsaechlich kein Text herauskam: pdfjs klagt auch
  // dann ueber Assets, wenn es brauchbar liest (an echten PDFs gemessen).
  return cmapFehlt && ergebnis.totalCharsPage1 === 0
    ? { ...ergebnis, cmapFehlt: true }
    : ergebnis;
}

async function leseEinmal(blob: Blob): Promise<PdfExtractResult> {
  await setupWorkerOnce();
  const pdfjsLib = await import('pdfjs-dist');
  const buf = await blob.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buf, isEvalSupported: false }).promise;
  try {
    const pages = doc.numPages;
    let totalCharsPage1 = 0;
    let page1Text = '';
    let cmapFehlt = false;
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
      } catch (e) {
        // Page 1 nicht lesbar — pages bleibt korrekt, Text leer. Ein fehlendes
        // Zusatz-Asset wird dabei NICHT verschluckt: es ist der Unterschied
        // zwischen „diese Seite ist kaputt" und „wir koennen diese Schrift
        // nicht lesen", und nur der zweite Fall ist einem Menschen erklaerbar.
        if (istFehlendesPdfAsset(e)) cmapFehlt = true;
      }
    }
    return { pages, page1Text: clip(page1Text), totalCharsPage1, cmapFehlt };
  } finally {
    await doc.destroy().catch(() => { /* best-effort */ });
  }
}

/**
 * Oeffnet ein PDF einmal mit pdfjs, extrahiert Metadaten + Page-1-Text.
 * Destroyt das Dokument am Ende (kritisch fuer Memory).
 *
 * Retry-Logic: bei pdfjs-Worker-Race-Errors (sporadisch bei Concurrency >1)
 * wird einmal 75ms gewartet und der Aufruf wiederholt. Faengt ~90 % der
 * verbleibenden Worker-Race-Errors silent ab. Hilft der Aufruf trotzdem
 * nicht, propagiert der Error zum Caller (bulk-scan: parse_error-Manifest +
 * 'Nur Errors retriagieren'-Pfad).
 */
export async function extractPdfOnce(blob: Blob): Promise<PdfExtractResult> {
  try {
    return await extractPdfOnceInternal(blob);
  } catch (e) {
    if (isWorkerRaceError(e)) {
      await new Promise(r => setTimeout(r, 75));
      return await extractPdfOnceInternal(blob);
    }
    throw e;
  }
}
