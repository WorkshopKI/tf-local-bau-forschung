/**
 * Konvertierungs-Qualität: aus den Roh-Bausteinen einer Konvertierung
 * (extrahierter Text, mammoth-HTML, Seitenzahl) eine prüfbare Bewertung +
 * deutsche Warnungen bauen. REINE Funktion — kein DOM, keine Libs — damit per
 * Vitest ohne echte Dateien testbar.
 *
 * Hintergrund: Die KI sieht nur den extrahierten TEXT. Gescannte PDFs (kein
 * eingebetteter Text), verlorene Tabellen und Bilder sind die typischen
 * Fehlerquellen — der Bearbeiter soll davon erfahren und ggf. extern
 * korrigieren (PDF-Tool → OCR/DOCX) und erneut hochladen.
 */

export type ConversionLevel = 'warnung' | 'hinweis';

export interface ConversionWarning {
  level: ConversionLevel;
  message: string;
}

export interface ConversionReport {
  /** Länge des extrahierten Textes (getrimmt), ohne Frontmatter. */
  charCount: number;
  pages?: number;
  tableCount?: number;
  imageCount?: number;
  warnings: ConversionWarning[];
}

export interface ConversionInput {
  format: string;            // 'pdf' | 'docx' | 'md' | 'txt'
  /** Extrahierter Text (PDF) bzw. Markdown-Body (DOCX) — ohne Frontmatter. */
  text: string;
  /** mammoth-HTML (nur DOCX) — Quelle für Tabellen-/Bild-Zählung. */
  html?: string;
  pages?: number;
  /** mammoth-Konvertierungs-Messages (nur DOCX). */
  mammothMessages?: string[];
}

const PDF_MIN_CHARS_PER_PAGE = 80;
const DOCX_MIN_CHARS = 200;
const MAX_MAMMOTH = 5;

function dedupe(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of arr) {
    const t = s.trim();
    if (t && !seen.has(t)) { seen.add(t); out.push(t); }
  }
  return out;
}

export function buildConversionReport(input: ConversionInput): ConversionReport {
  const text = input.text.trim();
  const charCount = text.length;
  const warnings: ConversionWarning[] = [];

  if (input.format === 'pdf') {
    const pages = input.pages;
    if (charCount === 0) {
      warnings.push({
        level: 'warnung',
        message: 'Kein Text extrahiert — vermutlich ein gescanntes PDF. Bitte per OCR (z. B. im PDF-Tool nach DOCX) umwandeln, prüfen und erneut hochladen.',
      });
    } else if (pages && pages > 0 && charCount / pages < PDF_MIN_CHARS_PER_PAGE) {
      warnings.push({
        level: 'warnung',
        message: `Sehr wenig Text extrahiert (Ø ${Math.round(charCount / pages)} Zeichen/Seite) — evtl. ein bildbasiertes PDF. Bitte Konvertierung prüfen.`,
      });
    }
    return { charCount, ...(pages !== undefined ? { pages } : {}), warnings };
  }

  if (input.format === 'docx') {
    const html = input.html ?? '';
    const tableCount = (html.match(/<table[\s>]/gi) ?? []).length;
    const imageCount = (html.match(/<img[\s>]/gi) ?? []).length;
    if (charCount < DOCX_MIN_CHARS) {
      warnings.push({ level: 'warnung', message: 'Kaum Text extrahiert — bitte Konvertierung prüfen.' });
    }
    if (imageCount > 0) {
      warnings.push({
        level: 'hinweis',
        message: `${imageCount} Bild${imageCount === 1 ? '' : 'er'} im Dokument — Bildinhalte werden NICHT als Text erfasst (die KI sieht nur Text).`,
      });
    }
    if (tableCount > 0) {
      warnings.push({
        level: 'hinweis',
        message: `${tableCount} Tabelle${tableCount === 1 ? '' : 'n'} erkannt — bitte prüfen, ob sie korrekt als Text übernommen wurden.`,
      });
    }
    const msgs = dedupe(input.mammothMessages ?? []);
    for (const m of msgs.slice(0, MAX_MAMMOTH)) warnings.push({ level: 'hinweis', message: m });
    if (msgs.length > MAX_MAMMOTH) {
      warnings.push({ level: 'hinweis', message: `… und ${msgs.length - MAX_MAMMOTH} weitere Konvertierungs-Hinweise.` });
    }
    return { charCount, tableCount, imageCount, warnings };
  }

  // txt / md — keine strukturellen Risiken
  return { charCount, warnings };
}

/** Höchster Schweregrad in einem Report (für Banner-Styling); null wenn keine. */
export function maxConversionLevel(report: ConversionReport | undefined): ConversionLevel | null {
  if (!report || report.warnings.length === 0) return null;
  return report.warnings.some(w => w.level === 'warnung') ? 'warnung' : 'hinweis';
}
