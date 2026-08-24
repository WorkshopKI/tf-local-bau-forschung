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

import { PDF_ASSET_MELDUNG } from './pdf-assets';

/**
 * `gut` ist kein Problem, sondern eine Zusicherung („die Gliederung ist da").
 * Sie steht in derselben Liste, weil sie dieselbe Frage beantwortet wie die
 * Warnungen — nur mit dem anderen Ausgang; und sie darf die Zeile nie
 * alarmieren (siehe `maxConversionLevel`).
 */
export type ConversionLevel = 'warnung' | 'hinweis' | 'gut';

/**
 * Welche Sprosse der PDF-Leiter getragen hat (siehe `leseAllePdfSeiten`):
 * `strukturiert` = Tag-Baum, `geschaetzt` = Schriftgrößen, `flach` = nur Text.
 */
export type PdfStrukturStufe = 'strukturiert' | 'geschaetzt' | 'flach';

/**
 * Der Satz, der den Bearbeiter zum PDF-Client schickt. Steht hier einmal, weil
 * ihn zwei Sprossen brauchen — und weil ein Test ihn festhält.
 */
export const DOCX_UMWEG_MELDUNG =
  'Tipp: Das Dokument im PDF-Client (Kofax) nach Word (.docx) umwandeln und die DOCX hochladen — daraus liest die App die Gliederung vollständig.';

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
  /** Nur PDF: welche Sprosse der Leiter getragen hat. */
  pdfStruktur?: PdfStrukturStufe;
  warnings: ConversionWarning[];
}

export interface ConversionInput {
  format: string;            // 'pdf' | 'docx' | 'md' | 'txt'
  /** Extrahierter Text (PDF) bzw. Markdown-Body (DOCX) — ohne Frontmatter. */
  text: string;
  /**
   * Hat pdf.js beim Lesen eine **Zeichentabelle** (CMap) nicht laden können?
   * Dann fehlt Text, ohne dass ein Fehler geworfen wurde — siehe
   * `pdf-assets.ts`. Fehlt das Feld, ändert sich nichts.
   */
  pdfCmapFehlt?: boolean;
  /**
   * Welche Sprosse der PDF-Leiter getragen hat. Fehlt das Feld, sagt der
   * Bericht über die Gliederung nichts (Verhalten bis v6.27).
   */
  pdfStruktur?: PdfStrukturStufe;
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

/**
 * Meldungen zur PDF-Gliederung. Eine Zeile je Sprosse — und nur dort, wo der
 * Bearbeiter etwas TUN kann, folgt der Hinweis auf den PDF-Client.
 */
function gliederungsMeldungen(stufe: PdfStrukturStufe | undefined): ConversionWarning[] {
  if (stufe === 'strukturiert') {
    return [{
      level: 'gut',
      message: 'Gliederung aus dem PDF übernommen — Überschriften, Listen und Tabellen stehen wie im Original.',
    }];
  }
  if (stufe === 'geschaetzt') {
    return [
      {
        level: 'hinweis',
        message: 'Dieses PDF trägt keine Gliederungs-Tags — die Überschriften wurden aus den Schriftgrößen GESCHÄTZT. Bitte in der Vorschau prüfen.',
      },
      { level: 'hinweis', message: DOCX_UMWEG_MELDUNG },
    ];
  }
  if (stufe === 'flach') {
    return [
      {
        level: 'warnung',
        message: 'Dieses PDF trägt keine Gliederung: Der Text kommt vollständig an, aber ALLE Überschriften sind verloren — die KI sieht das Dokument als einen Block.',
      },
      { level: 'hinweis', message: DOCX_UMWEG_MELDUNG },
    ];
  }
  return [];
}

export function buildConversionReport(input: ConversionInput): ConversionReport {
  const text = input.text.trim();
  const charCount = text.length;
  const warnings: ConversionWarning[] = [];

  if (input.format === 'pdf') {
    const pages = input.pages;
    const duenn = pages !== undefined && pages > 0 && charCount / pages < PDF_MIN_CHARS_PER_PAGE;
    // Die CMap-Meldung ERSETZT die Gescannt-Vermutung, statt danebenzustehen:
    // beide beschreiben denselben fehlenden Text, aber nur eine nennt die
    // Ursache — und sie widerspricht der anderen (OCR hilft hier nicht).
    //
    // Sie erscheint nur zusammen mit dem SYMPTOM. Eine Warnung allein genügt
    // nicht: gemessen an echten Dokumenten liefert pdf.js auch dann brauchbaren
    // Text, wenn es über ein Asset klagt. Wo Text da ist, gibt es nichts zu
    // melden — egal was die Bibliothek in die Konsole schreibt.
    if (input.pdfCmapFehlt === true && (charCount === 0 || duenn)) {
      warnings.push({ level: 'warnung', message: PDF_ASSET_MELDUNG });
    } else if (charCount === 0) {
      warnings.push({
        level: 'warnung',
        message: 'Kein Text extrahiert — vermutlich ein gescanntes PDF. Bitte per OCR (z. B. im PDF-Tool nach DOCX) umwandeln, prüfen und erneut hochladen.',
      });
    } else if (duenn) {
      warnings.push({
        level: 'warnung',
        message: `Sehr wenig Text extrahiert (Ø ${Math.round(charCount / pages!)} Zeichen/Seite) — evtl. ein bildbasiertes PDF. Bitte Konvertierung prüfen.`,
      });
    }
    // Was ist aus der GLIEDERUNG geworden? Das entscheidet, ob der Bearbeiter
    // den Umweg über den PDF-Client gehen sollte — und es steht nur dort, wo
    // überhaupt Text ankam (bei 0 Zeichen ist die Gliederung nicht das Problem).
    if (charCount > 0) warnings.push(...gliederungsMeldungen(input.pdfStruktur));

    return {
      charCount,
      ...(pages !== undefined ? { pages } : {}),
      ...(input.pdfStruktur !== undefined ? { pdfStruktur: input.pdfStruktur } : {}),
      warnings,
    };
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
  if (report.warnings.some(w => w.level === 'warnung')) return 'warnung';
  if (report.warnings.some(w => w.level === 'hinweis')) return 'hinweis';
  return 'gut';
}
