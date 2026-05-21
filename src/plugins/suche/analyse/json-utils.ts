/**
 * Robustes JSON-Parsing fuer LLM-Antworten.
 *
 * LLM-Output kann schmutzig sein:
 *  - Markdown-Fences ```json ... ``` drumherum
 *  - Vor/nach dem JSON ein Erklaerungstext ("Hier ist das JSON: { ... }")
 *  - Trailing-Punkt nach JSON
 *  - Vereinzelt invalide JSON-Konstrukte (unescapete Newlines in Strings)
 *
 * Strategie: erst Fences strippen, dann nach erstem `{` oder `[` suchen,
 * dann auf passendes Klammer-Ende parsen.
 */

/** Strippt Markdown-Fences. Akzeptiert ```json ... ``` und ``` ... ```. */
function stripFences(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced && fenced[1]) return fenced[1].trim();
  return raw.trim();
}

/** Findet einen balancierten JSON-Block beginnend mit `open` ('{' oder '[').
 *  Beruecksichtigt Strings (inkl. Escapes) — schliesst nicht in Strings.
 *  Returnt den Substring oder `null` wenn unbalanciert. */
function extractBalanced(raw: string, open: '{' | '['): string | null {
  const close = open === '{' ? '}' : ']';
  const start = raw.indexOf(open);
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\') { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return raw.slice(start, i + 1);
    }
  }
  return null;
}

export function extractFirstJsonObject(raw: string): string | null {
  return extractBalanced(stripFences(raw), '{');
}

export function extractFirstJsonArray(raw: string): string | null {
  return extractBalanced(stripFences(raw), '[');
}

/**
 * Generischer Helper: extrahiert das erste valide JSON-Objekt oder -Array
 * aus dem LLM-Output und parsed es. Returnt `null` wenn keins gefunden oder
 * parsing fehlschlaegt.
 */
export function parseLLMJson<T = unknown>(raw: string): T | null {
  const cleaned = stripFences(raw);
  // Heuristik: was kommt zuerst, `{` oder `[`?
  const objIdx = cleaned.indexOf('{');
  const arrIdx = cleaned.indexOf('[');
  let candidate: string | null = null;
  if (objIdx === -1 && arrIdx === -1) return null;
  if (objIdx === -1) candidate = extractBalanced(cleaned, '[');
  else if (arrIdx === -1) candidate = extractBalanced(cleaned, '{');
  else candidate = extractBalanced(cleaned, objIdx < arrIdx ? '{' : '[');
  if (!candidate) return null;
  try {
    return JSON.parse(candidate) as T;
  } catch {
    return null;
  }
}
