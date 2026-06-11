/**
 * Exzerpt-Generator für RAG-Quellen.
 *
 * Aus einem Chunk-Text + der Suchanfrage wird ein lesbares Exzerpt rund um den
 * ersten Query-Term-Treffer gebaut. Zwei Varianten:
 *  - `snippet`: längeres Exzerpt (~SNIPPET_LEN), Treffer in «…» markiert (Panel)
 *  - `contextLine`: kürzere, einzeilige, ellipsierte Variante ohne Marker (Liste)
 *
 * Pure (kein DOM) — die «…»-Marker werden erst im React-Layer zu .hl-Spans.
 */

const SNIPPET_LEN = 280;
const CONTEXT_LEN = 120;
const MIN_TERM_LEN = 3;

function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** Query in unterscheidbare Such-Terme (≥3 Buchstaben, lowercased, unique). */
function queryTerms(query: string): string[] {
  const matches = query.toLowerCase().match(/\p{L}{3,}/gu) ?? [];
  return [...new Set(matches.filter(t => t.length >= MIN_TERM_LEN))];
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Frühester Index irgendeines Terms im (bereits lowercased) Text, sonst -1. */
function firstHit(lowerText: string, terms: string[]): number {
  let best = -1;
  for (const t of terms) {
    const idx = lowerText.indexOf(t);
    if (idx !== -1 && (best === -1 || idx < best)) best = idx;
  }
  return best;
}

/** Fenster um `center` der Länge `len`, an Wortgrenzen ausgerichtet, mit Ellipsen. */
function window(text: string, center: number, len: number): string {
  if (text.length <= len) return text;
  let start = Math.max(0, center - Math.floor(len * 0.35));
  let end = Math.min(text.length, start + len);
  start = Math.max(0, end - len);
  // an Wortgrenzen rücken
  if (start > 0) {
    const sp = text.indexOf(' ', start);
    if (sp !== -1 && sp < center) start = sp + 1;
  }
  if (end < text.length) {
    const sp = text.lastIndexOf(' ', end);
    if (sp > center) end = sp;
  }
  let out = text.slice(start, end).trim();
  if (start > 0) out = `… ${out}`;
  if (end < text.length) out = `${out} …`;
  return out;
}

function highlight(excerpt: string, terms: string[]): string {
  if (terms.length === 0) return excerpt;
  const re = new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'giu');
  return excerpt.replace(re, '«$1»');
}

export function buildSnippet(text: string, query: string): { snippet: string; contextLine: string } {
  const clean = collapse(text);
  if (!clean) return { snippet: '', contextLine: '' };

  const terms = queryTerms(query);
  const hit = firstHit(clean.toLowerCase(), terms);
  const center = hit === -1 ? 0 : hit;

  const snippet = highlight(window(clean, center, SNIPPET_LEN), hit === -1 ? [] : terms);
  const contextLine = window(clean, center, CONTEXT_LEN);
  return { snippet, contextLine };
}
