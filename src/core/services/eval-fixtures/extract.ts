/**
 * Extraktion der INHALTLICHEN Stammdaten-Felder aus einer Vorhabensbeschreibung
 * (Titel, Akronym, Konsortialführer + Partner). Zwei Wege:
 *
 *  - `ExtractFn` — injizierte Variante (im CLI: OpenRouter). Die mockbare Naht,
 *    analog zur DI in `gutachten-batch/runner.ts` (Tests laufen ohne LLM).
 *  - `extractHeuristisch` — reiner, deterministischer Offline-Fallback (für
 *    `--dry-run`, fehlenden API-Key und als Degraded-Mode bei Parse-Fehlern).
 *
 * Inhaltliche Felder MÜSSEN zum VB passen → werden extrahiert, nie frei erfunden.
 */
import { sha1Hex } from './sha1';

export interface ExtractedPartner {
  /** Organisation (Konsortialführer = partner[0]). */
  name: string;
  /** Teilvorhaben-Titel, falls bekannt (heuristisch: null). */
  teilTitel: string | null;
}

export interface ExtractedContent {
  titel: string | null;
  akronym: string;
  partner: ExtractedPartner[];
}

/** Signatur der injizierten Extraktion (real: LLM; Test/Fallback: heuristisch). */
export type ExtractFn = (vb: string, datei: string) => Promise<ExtractedContent>;

/**
 * Organisationen mit deutscher Rechtsform-Endung (Heuristik): ein Lauf von 1–5
 * GROSS beginnenden Namens-Tokens (der eigentliche Firmenname) unmittelbar vor
 * der Rechtsform. Das verhindert, dass kleingeschriebene Satz-Füllwörter
 * („… entwickeln die Nordlicht Energie AG") mit eingefangen werden. Der negative
 * Lookahead `(?![A-Za-zÄÖÜäöüß])` blockt Endung-als-Präfix („SE" in „SENSOR").
 */
const ORG_RE =
  /((?:[A-ZÄÖÜ][A-Za-zÄÖÜäöüß0-9&-]*[ \t]+){1,5})(GmbH|AG|UG|KG|mbH|e\.\s?V\.|SE)(?![A-Za-zÄÖÜäöüß])/g;

/** Führende deutsche Füll-/Artikelwörter, die kein Teil des Organisationsnamens sind. */
const LEADING_ARTICLE_RE = /^(?:die|der|das|den|dem|des|ein|eine|einen|einer|und|mit|bei|durch|von|vom|im|am)\s+/i;

/** Stabiles 4-Hex-Suffix aus dem Dateinamen (deterministisch über Läufe). */
function stableSuffix(datei: string): string {
  return sha1Hex(datei).slice(0, 4).toUpperCase();
}

/** Erste nicht-leere Zeile, führende Markdown-`#` + Whitespace entfernt. */
function ableitTitel(vb: string): string | null {
  for (const raw of vb.split(/\r?\n/)) {
    const line = raw.replace(/^#+\s*/, '').trim();
    if (line) return line;
  }
  return null;
}

function ableitPartner(vb: string): ExtractedPartner[] {
  const seen = new Set<string>();
  const out: ExtractedPartner[] = [];
  for (const m of vb.matchAll(ORG_RE)) {
    const namensteil = m[1];
    const rechtsform = m[2];
    if (!namensteil || !rechtsform) continue;
    const name = `${namensteil} ${rechtsform}`
      .replace(/\s+/g, ' ')
      .trim()
      .replace(LEADING_ARTICLE_RE, ''); // führender Satz-Artikel („Die …") ist kein Namensteil
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, teilTitel: null });
  }
  return out;
}

/** Längstes ALLCAPS-Token (≥2 Zeichen) — bevorzugt das aussagekräftigere Akronym. */
function laengstesAllcaps(text: string): string | null {
  const matches = [...text.matchAll(/\b[A-ZÄÖÜ][A-ZÄÖÜ0-9]{1,}\b/g)].map(m => m[0]);
  if (matches.length === 0) return null;
  return matches.reduce((a, b) => (b.length > a.length ? b : a));
}

function ableitAkronym(titel: string | null, vb: string, datei: string): string {
  const allcaps = laengstesAllcaps(titel ?? '') ?? laengstesAllcaps(vb);
  if (allcaps) return allcaps.slice(0, 12);
  if (titel) {
    const initials = titel
      .split(/\s+/)
      .filter(w => /^[A-Za-zÄÖÜäöü]/.test(w))
      .map(w => w.charAt(0).toUpperCase())
      .join('');
    if (initials.length >= 2) return initials.slice(0, 12);
  }
  return `VB${stableSuffix(datei)}`;
}

/** Reiner, deterministischer Heuristik-Extraktor. */
export function extractHeuristisch(vb: string, datei: string): ExtractedContent {
  const titel = ableitTitel(vb);
  let partner = ableitPartner(vb);
  if (partner.length === 0) {
    // Keine Org gefunden → ein stabiles Fiktiv-Institut, damit jeder VB einen
    // Antragsteller bekommt (sonst leerer Stammdaten-Block).
    partner = [{ name: `Institut ${stableSuffix(datei)}`, teilTitel: null }];
  }
  const akronym = ableitAkronym(titel, vb, datei);
  return { titel, akronym, partner };
}
