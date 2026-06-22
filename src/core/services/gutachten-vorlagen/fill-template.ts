/**
 * DOCX-Vorlagen-Füller (Gutachten-Durchstich, Baustein 4). Verarbeitet
 * `word/document.xml` als String — kein DOM, keine XML-Library (file://-tauglich,
 * keine neue Dependency außer dem vorhandenen jszip).
 *
 * Kernproblem „Run-Splitting": Platzhalter wie `&F:VMS VB Projekt&` können durch
 * Word-Formatierung über mehrere `<w:r>`/`<w:t>`-Runs zersplittert sein. Lösung:
 * pro Absatz (`<w:p>`) die `<w:t>`-Texte konkatenieren, Platzhalter dort suchen,
 * den Ersatzwert in den ERSTEN beteiligten Run injizieren und alle Platzhalter-
 * Zeichen (über alle beteiligten Runs) entfernen — `<w:rPr>` bleibt unangetastet.
 *
 * Word speichert `&` in XML als `&amp;`; der Matcher akzeptiert beide
 * Delimiter-Formen und arbeitet auf dem konkatenierten Text, ist also robust
 * gegen Splits an beliebiger Stelle (auch innerhalb von `&amp;`).
 *
 * STOPP-Bedingung (CLAUDE.md): trägt die String-Manipulation im Einzelfall nicht
 * (Anker in Tabelle/Textbox), wird der Anker ausgelassen (anchorFound=false) und
 * die Vorlage trotzdem erstellt — KEIN Ausweichen auf DOM/Library.
 */
import type { Antrag } from '@/core/services/csv/types';
import { resolveField } from './field-mapping';
import type { ArtefaktBlock, AbschnittStatus, FillResult, MappedField } from './types';

/** `<w:t ...>inner</w:t>` — Gruppen: openTag, inner, closeTag. */
const T_RE = /(<w:t\b[^>]*>)([\s\S]*?)(<\/w:t>)/g;
/** `<w:p ...>…</w:p>` — ein Absatz (WordML-Absätze schachteln nicht). */
const P_RE = /<w:p\b[^>]*>[\s\S]*?<\/w:p>/g;
/** Platzhalter mit `&`- ODER `&amp;`-Delimitern; Code enthält kein `&`. */
const PLACEHOLDER_RE = /(?:&amp;|&)[FC]:([^&]+?)(?:&amp;|&)/g;

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizeWs(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/** Konkatenierter Klartext aller `<w:t>` eines Absatzes (roh, ohne Entity-Decode). */
function paragraphPlainText(paragraph: string): string {
  return [...paragraph.matchAll(T_RE)].map(m => m[2]).join('');
}

interface Collector {
  (code: string, placeholder: string): string | null;
}

/**
 * Ersetzt Platzhalter in EINEM Absatz unter Beachtung des Run-Splittings.
 * `collect` liefert den Ersatzwert (null = unbekannt → unverändert lassen) und
 * sammelt nebenbei die Mapping-Infos.
 */
function processParagraph(paragraph: string, collect: Collector): string {
  const runs = [...paragraph.matchAll(T_RE)].map(m => ({
    open: m[1]!, inner: m[2]!, close: m[3]!, index: m.index!, full: m[0],
  }));
  if (runs.length === 0) return paragraph;

  // Konkatenierter Text + Run-Grenzen (globale Offsets in C).
  let C = '';
  const bounds: Array<[number, number]> = [];
  for (const r of runs) { bounds.push([C.length, C.length + r.inner.length]); C += r.inner; }

  // Platzhalter im konkatenierten Text finden (collect läuft für JEDEN Treffer,
  // auch unbefüllbare → die werden gemeldet, aber nicht ersetzt).
  const reps: Array<{ start: number; end: number; value: string }> = [];
  const re = new RegExp(PLACEHOLDER_RE.source, 'g');
  let pm: RegExpExecArray | null;
  while ((pm = re.exec(C)) !== null) {
    const code = pm[1]!.trim();
    const value = collect(code, pm[0]);
    if (value !== null) reps.push({ start: pm.index, end: pm.index + pm[0].length, value: escapeXml(value) });
  }
  if (reps.length === 0) return paragraph;

  // Platzhalter-Zeichen entfernen, Wert am Match-Start injizieren.
  const drop = new Array<boolean>(C.length).fill(false);
  const inject = new Map<number, string>();
  for (const rep of reps) {
    for (let k = rep.start; k < rep.end; k++) drop[k] = true;
    inject.set(rep.start, rep.value);
  }
  const newInners = runs.map((_, i) => {
    const [gs, ge] = bounds[i]!;
    let s = '';
    for (let k = gs; k < ge; k++) {
      const v = inject.get(k);
      if (v !== undefined) s += v;
      if (!drop[k]) s += C[k];
    }
    return s;
  });

  // Absatz rekonstruieren (nur die `<w:t>`-Inhalte tauschen).
  let out = '';
  let cursor = 0;
  runs.forEach((r, i) => {
    out += paragraph.slice(cursor, r.index) + r.open + newInners[i] + r.close;
    cursor = r.index + r.full.length;
  });
  out += paragraph.slice(cursor);
  return out;
}

/** Baut WordML-Absätze (ein `<w:p>` je Textabsatz, ohne `<w:rPr>`). */
function buildAnchorParagraphs(finalerText: string): string {
  return finalerText
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(p => p.length > 0)
    .map(p => `<w:p><w:r><w:t xml:space="preserve">${escapeXml(p)}</w:t></w:r></w:p>`)
    .join('');
}

export interface ProcessResult {
  xml: string;
  mappedFields: MappedField[];
  unfilledCodes: string[];
  /** Status je übergebenem (freigegebenem) Abschnitt. */
  sections: AbschnittStatus[];
  eingefuegteAnzahl: number;
}

/** Sucht den Anker-Absatz; gibt die Einfüge-Position (nach dem Absatz) oder -1. */
function findInsertPos(xml: string, anker: string): number {
  const needle = normalizeWs(anker);
  const paraRe = new RegExp(P_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = paraRe.exec(xml)) !== null) {
    if (normalizeWs(paragraphPlainText(m[0])).includes(needle)) {
      return m.index + m[0].length;
    }
  }
  return -1;
}

/**
 * Pure Kern-Transformation auf dem `document.xml`-String (ohne ZIP-I/O) — der
 * vollständig getestete Teil. `fillTemplate` legt nur die jszip-Hülle drumherum.
 *
 * Phase 1: Platzhalter-Felder ersetzen (abschnitts-unabhängig). Phase 2: jeden
 * übergebenen (= freigegebenen) Abschnitt an SEINEM Anker einfügen — pro Abschnitt
 * wird FRISCH gescannt (Offsets verschieben sich nach jedem Splice), daher
 * reihenfolge-stabil und unabhängig davon, in welcher Reihenfolge die Anker im
 * Dokument stehen. Nicht gefundener Anker → übersprungen (anchorFound=false).
 */
export function processDocumentXml(
  xml: string,
  antrag: Antrag,
  sections: ArtefaktBlock[],
): ProcessResult {
  const mapped = new Map<string, MappedField>();
  const unfilled = new Set<string>();
  const collect: Collector = (code, placeholder) => {
    const value = resolveField(code, antrag);
    if (!mapped.has(code)) {
      mapped.set(code, { code, placeholder, value, befuellbar: value !== null });
    }
    if (value === null) unfilled.add(code);
    return value;
  };

  // 1) Platzhalter pro Absatz ersetzen.
  let result = xml.replace(P_RE, para => processParagraph(para, collect));

  // 2) Je Abschnitt: Anker frisch suchen + Text direkt danach einfügen.
  const statuses: AbschnittStatus[] = [];
  for (const sec of sections) {
    const insertPos = findInsertPos(result, sec.anker);
    const found = insertPos >= 0;
    if (found) {
      const inserted = buildAnchorParagraphs(sec.finalerText);
      result = result.slice(0, insertPos) + inserted + result.slice(insertPos);
    }
    statuses.push({ id: sec.id, anker: sec.anker, anchorFound: found, eingefuegt: found });
  }

  return {
    xml: result,
    mappedFields: [...mapped.values()],
    unfilledCodes: [...unfilled],
    sections: statuses,
    eingefuegteAnzahl: statuses.filter(s => s.eingefuegt).length,
  };
}

export interface FillOptions {
  /** Nur analysieren (Mapping-/Anker-Vorschau), kein Blob erzeugen. */
  dryRun?: boolean;
  /**
   * Dateinamen-Präfix je Artefakt-Typ (Artefakt-Engine). Default `'Gutachten_EP'`
   * → `Gutachten_EP_<az>.docx` (GA byte-identisch). NF z.B. `'ZIM-Nachforderung'`.
   */
  dateiPrefix?: string;
}

/** Normalisiert die Eingabe auf einen `ArrayBuffer` (für `crypto.subtle.digest`). */
async function toArrayBuffer(input: Blob | ArrayBuffer | Uint8Array): Promise<ArrayBuffer> {
  if (input instanceof Uint8Array) {
    return input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength) as ArrayBuffer;
  }
  if (input instanceof ArrayBuffer) return input;
  return input.arrayBuffer(); // Blob
}

/** SHA-256-Hex der Eingabe-Bytes (`crypto.subtle` — sicherer Kontext unter file://, Pitfall #6). */
async function sha256Hex(input: Blob | ArrayBuffer | Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await toArrayBuffer(input));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Öffnet die DOCX (ZIP), füllt `word/document.xml` und gibt das Ergebnis-Blob
 * zurück. Im Dry-Run-Modus nur die Analyse (für die Dialog-Vorschau).
 *
 * Die Vorlage wird stets FRISCH übergeben (nie gecacht) und mit einem SHA-256-
 * Stempel (`hash`) versehen (Audit/Reproduzierbarkeit). Eine fehlende/kaputte
 * Vorlage WIRFT NICHT, sondern liefert ein `FillResult` mit `fehler` (kein Blob).
 */
export async function fillTemplate(
  input: Blob | ArrayBuffer | Uint8Array,
  antrag: Antrag,
  sections: ArtefaktBlock[],
  opts: FillOptions = {},
): Promise<FillResult> {
  const filename = `${opts.dateiPrefix ?? 'Gutachten_EP'}_${antrag.aktenzeichen}.docx`;
  const fehlerResult = (fehler: string): FillResult =>
    ({ mappedFields: [], unfilledCodes: [], sections: [], eingefuegteAnzahl: 0, filename, fehler });

  try {
    const { default: JSZip } = await import('jszip');
    const zip = await JSZip.loadAsync(input);
    const docFile = zip.file('word/document.xml');
    if (!docFile) return fehlerResult('Vorlage enthält keine word/document.xml (kein gültiges DOCX).');

    const hash = await sha256Hex(input);
    const xml = await docFile.async('string');
    const processed = processDocumentXml(xml, antrag, sections);

    const base = {
      mappedFields: processed.mappedFields,
      unfilledCodes: processed.unfilledCodes,
      sections: processed.sections,
      eingefuegteAnzahl: processed.eingefuegteAnzahl,
      filename,
      hash,
    };
    if (opts.dryRun) return base;

    zip.file('word/document.xml', processed.xml);
    const blob = await zip.generateAsync({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    return { ...base, blob };
  } catch {
    return fehlerResult('Vorlage konnte nicht gelesen werden (kein gültiges DOCX/ZIP).');
  }
}
