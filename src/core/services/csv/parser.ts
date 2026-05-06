import Papa from 'papaparse';
import type { CsvEncoding, CsvSeparator } from './types';

export interface CsvPreview {
  headers: string[];
  rows: Record<string, string>[];
  totalLines: number;
  encoding: CsvEncoding;
  separator: CsvSeparator;
  /** Automatisch erkannte Werte (unabhängig von Override). */
  detected: { encoding: CsvEncoding; separator: CsvSeparator };
}

export interface ParseOptions {
  encoding?: CsvEncoding;
  separator?: CsvSeparator;
}

const MOJIBAKE_PATTERN = /Ã[¤¶¼„–œß]|Ã‚|â€/;
const SEPARATOR_CANDIDATES: CsvSeparator[] = [';', ',', '\t', '|'];

function stripBom(text: string): string {
  if (text.charCodeAt(0) === 0xfeff) return text.slice(1);
  return text;
}

async function readAsText(blob: Blob, encoding: string): Promise<string> {
  const buf = await blob.arrayBuffer();
  const decoder = new TextDecoder(encoding);
  return stripBom(decoder.decode(buf));
}

export async function readWithEncodingFallback(
  blob: Blob,
  forced?: CsvEncoding,
): Promise<{ text: string; encoding: CsvEncoding }> {
  if (forced) {
    const text = await readAsText(blob, forced === 'UTF-8' ? 'utf-8' : 'windows-1252');
    return { text, encoding: forced };
  }
  // Primärer Test: UTF-8 mit fatal=true. Wirft bei invaliden Byte-Sequenzen (typisch für
  // Windows-1252-Umlaute wie 0xFC = ü, 0xE4 = ä, 0x80 = €), die kein valider UTF-8-Start sind.
  const buf = await blob.arrayBuffer();
  try {
    const text = stripBom(new TextDecoder('utf-8', { fatal: true }).decode(buf));
    // Zusätzliche Mojibake-Heuristik für den Fall, dass eine Win-1252-Datei versehentlich
    // als UTF-8 gespeichert wurde und als UTF-8 dekodiert „Ã¼"-Sequenzen enthält.
    if (MOJIBAKE_PATTERN.test(text.slice(0, 4096))) {
      const w1252 = stripBom(new TextDecoder('windows-1252').decode(buf));
      return { text: w1252, encoding: 'windows-1252' };
    }
    return { text, encoding: 'UTF-8' };
  } catch {
    const w1252 = stripBom(new TextDecoder('windows-1252').decode(buf));
    return { text: w1252, encoding: 'windows-1252' };
  }
}

/**
 * Ermittelt den wahrscheinlichsten Spalten-Separator.
 * Algorithmus: pro Kandidat Count pro Zeile über die ersten 20 nicht-leeren Zeilen.
 * Kandidat gewinnt wenn: Count ≥ 1 in allen Zeilen UND Count gleich in allen Zeilen
 * (Varianz 0) UND mittlerer Count am höchsten. Tiebreak: Semikolon > Komma > Tab > Pipe.
 */
export function detectSeparator(sample: string): CsvSeparator {
  const lines = sample.split(/\r?\n/).filter(l => l.length > 0).slice(0, 20);
  if (lines.length === 0) return ',';

  type Stat = { sep: CsvSeparator; mean: number; variance: number; allNonZero: boolean };
  const stats: Stat[] = SEPARATOR_CANDIDATES.map(sep => {
    const counts = lines.map(line => countOutsideQuotes(line, sep));
    const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
    const variance = counts.reduce((a, c) => a + (c - mean) ** 2, 0) / counts.length;
    return { sep, mean, variance, allNonZero: counts.every(c => c >= 1) };
  });

  const viable = stats.filter(s => s.allNonZero);
  if (viable.length === 0) return ',';

  viable.sort((a, b) => {
    if (a.variance !== b.variance) return a.variance - b.variance;
    if (a.mean !== b.mean) return b.mean - a.mean;
    return SEPARATOR_CANDIDATES.indexOf(a.sep) - SEPARATOR_CANDIDATES.indexOf(b.sep);
  });
  const winner = viable[0];
  return winner ? winner.sep : ',';
}

function countOutsideQuotes(line: string, sep: string): number {
  let count = 0;
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { i++; continue; }
      inQuote = !inQuote;
    } else if (!inQuote && ch === sep) {
      count++;
    }
  }
  return count;
}

export async function parseCsvPreview(
  blob: Blob,
  previewRows = 5,
  opts: ParseOptions = {},
): Promise<CsvPreview> {
  const { text, encoding } = await readWithEncodingFallback(blob, opts.encoding);
  const detectedEncoding: CsvEncoding = encoding;
  const detectedSeparator = detectSeparator(text.slice(0, 20_000));
  const separator: CsvSeparator = opts.separator ?? detectedSeparator;

  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    delimiter: separator,
    dynamicTyping: false,
    skipEmptyLines: true,
    preview: previewRows,
  });
  const meta = Papa.parse<Record<string, string>>(text, {
    header: true,
    delimiter: separator,
    dynamicTyping: false,
    skipEmptyLines: true,
  });
  const headers = (result.meta.fields ?? []).map(h => h.trim());
  const rows = (result.data ?? []).map(r => normalizeRow(r, headers));
  return {
    headers,
    rows,
    totalLines: meta.data.length,
    encoding,
    separator,
    detected: { encoding: detectedEncoding, separator: detectedSeparator },
  };
}

function normalizeRow(raw: Record<string, string>, headers: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const h of headers) {
    out[h] = (raw[h] ?? '').toString();
  }
  return out;
}

export interface StreamOptions {
  onChunk: (rows: Record<string, string>[], totalSoFar: number) => Promise<void> | void;
  chunkSize?: number;
  encoding?: CsvEncoding;
  separator?: CsvSeparator;
}

export async function parseCsvStream(
  blob: Blob,
  opts: StreamOptions,
): Promise<{ headers: string[]; total: number; encoding: CsvEncoding; separator: CsvSeparator }> {
  const { text, encoding } = await readWithEncodingFallback(blob, opts.encoding);
  const separator: CsvSeparator = opts.separator ?? detectSeparator(text.slice(0, 20_000));
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    delimiter: separator,
    dynamicTyping: false,
    skipEmptyLines: true,
  });
  const headers = (result.meta.fields ?? []).map(h => h.trim());
  const rows = (result.data ?? []).map(r => normalizeRow(r, headers));
  const chunkSize = opts.chunkSize ?? 500;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    await opts.onChunk(chunk, Math.min(i + chunk.length, rows.length));
  }
  return { headers, total: rows.length, encoding, separator };
}

export async function parseCsvAll(
  blob: Blob,
  opts: ParseOptions = {},
): Promise<{ headers: string[]; rows: Record<string, string>[]; encoding: CsvEncoding; separator: CsvSeparator }> {
  const { text, encoding } = await readWithEncodingFallback(blob, opts.encoding);
  const separator: CsvSeparator = opts.separator ?? detectSeparator(text.slice(0, 20_000));
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    delimiter: separator,
    dynamicTyping: false,
    skipEmptyLines: true,
  });
  const headers = (result.meta.fields ?? []).map(h => h.trim());
  const rows = (result.data ?? []).map(r => normalizeRow(r, headers));
  return { headers, rows, encoding, separator };
}

export interface StreamedParseOptions extends ParseOptions {
  /** Pro Yield (alle ~500 Rows) aufgerufen; bytes = parser.getCharIndex(), totalBytes = text.length. */
  onProgress?: (bytes: number, totalBytes: number) => void;
  /** Yield-Frequenz in geparsten Rows. Default 500 — niedriger = mehr UI-Updates, hoehere CPU-Last. */
  yieldEveryRows?: number;
}

/**
 * Wie parseCsvAll, plus Byte-Progress in zwei Phasen: 0%/100%-Bracket um
 * den (synchronen) Papa.parse-Aufruf, dann eine inkrementelle Normalize-
 * Phase mit setTimeout-Yields. Damit hat der ETA-Sampler in Step4Progress
 * zumindest waehrend der Normalize-Phase Daten.
 *
 * Frueherer Versuch mit Papa.parse step:-Callback + parser.pause()/resume()
 * funktionierte nicht zuverlaessig: setTimeout(resume, 0) traf bei reinem
 * Text-Input nicht den Parser-Zustand korrekt — `complete` feuerte mit
 * leerem rows-Array. Daher hier explizit pre-parse + post-normalize.
 */
export async function parseCsvAllStreamed(
  blob: Blob,
  opts: StreamedParseOptions = {},
): Promise<{ headers: string[]; rows: Record<string, string>[]; encoding: CsvEncoding; separator: CsvSeparator; totalBytes: number }> {
  const { text, encoding } = await readWithEncodingFallback(blob, opts.encoding);
  const separator: CsvSeparator = opts.separator ?? detectSeparator(text.slice(0, 20_000));
  const totalBytes = text.length;

  // 0% — User sieht den Bar bevor der sync-Parse startet
  if (opts.onProgress) opts.onProgress(0, totalBytes);

  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    delimiter: separator,
    dynamicTyping: false,
    skipEmptyLines: true,
  });
  const headers = (result.meta.fields ?? []).map(h => h.trim());
  const raw = (result.data ?? []) as Record<string, string>[];

  // Normalize in Chunks mit periodischen Yields. Auf einer 50-MB-CSV mit
  // 13k Rows kommen wir auf ~13 Chunks → 13 Progress-Updates → der
  // ETA-Sampler kriegt Daten waehrend dieser Phase.
  const CHUNK = 1000;
  const rows: Record<string, string>[] = [];
  for (let i = 0; i < raw.length; i += CHUNK) {
    const end = Math.min(i + CHUNK, raw.length);
    for (let j = i; j < end; j++) {
      const r = raw[j];
      if (r) rows.push(normalizeRow(r, headers));
    }
    if (opts.onProgress) {
      const approxBytes = raw.length > 0
        ? Math.floor((end / raw.length) * totalBytes)
        : totalBytes;
      opts.onProgress(approxBytes, totalBytes);
    }
    if (end < raw.length) {
      await new Promise<void>(r => setTimeout(r, 0));
    }
  }

  if (opts.onProgress) opts.onProgress(totalBytes, totalBytes);
  return { headers, rows, encoding, separator, totalBytes };
}
