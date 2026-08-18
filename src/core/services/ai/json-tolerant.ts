/**
 * Toleranter JSON-Parser für LLM-Ausgaben — geteilte Utility.
 *
 * LLM-JSON ist nie verlässlich: Markdown-Fences, Erklärungstext drumherum und
 * Token-Limit-Truncation am Ende. Diese beiden puren Helfer (0 Deps) lösen das
 * truncation-tolerant und werden von MEHREREN Call-Sites genutzt — der
 * Batch-Klassifizierung (`llm-klassifizierung.ts`) und dem strukturierten
 * Skill-Output (`parseSkillOutput`, `teilStruktur`). Extrahiert (statt geforkt),
 * damit beide dasselbe bewährte Salvage-Verhalten teilen.
 */

/**
 * Ist das ein Objekt, aus dem sich Schlüssel lesen lassen?
 *
 * `null` und Arrays fallen heraus — beide sind in JS `typeof 'object'`, und ein
 * Modell, das statt des Objekts eine Liste liefert, dürfte nicht als leeres
 * Objekt durchgehen.
 */
export function istRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/** Ein Listenwert, tolerant: was keine Liste ist, ist eine leere. */
export function alsListe(x: unknown): unknown[] {
  return Array.isArray(x) ? x : [];
}

/** Ein getrimmter Textwert, tolerant: was kein String ist, ist leer. */
export function alsText(x: unknown): string {
  return typeof x === 'string' ? x.trim() : '';
}

/** Entfernt einen umschließenden ```json … ``` (oder ``` … ```) Markdown-Fence. */
export function stripMarkdownWrapper(text: string): string {
  // Entfernt Patterns wie ```json ... ``` oder ``` ... ```
  const match = /^```(?:json|JSON)?\s*\n?([\s\S]*?)\n?```\s*$/m.exec(text.trim());
  if (match && match[1]) return match[1];
  return text;
}

/**
 * Parst ein JSON-Array von Objekten und ist tolerant gegen Truncation.
 *
 * `slice` beginnt bei der ersten `[`. Happy Path: striktes `JSON.parse` ueber
 * den Bereich bis zur letzten `]`. Schlaegt das fehl (z.B. weil die schliessende
 * `]` fehlt oder das letzte Objekt mitten im Token-Limit abbricht), faellt die
 * Funktion auf einen Objekt-Walker zurueck: sie sammelt jedes balancierte
 * Top-Level-`{…}` und parst es einzeln. Ein angeschnittenes letztes Objekt
 * schliesst nie (Tiefe > 0 am Stringende) und wird damit automatisch verworfen.
 */
export function parseJsonArrayTolerant(slice: string): unknown[] {
  const lastBracket = slice.lastIndexOf(']');
  if (lastBracket > 0) {
    try {
      const parsed = JSON.parse(slice.slice(0, lastBracket + 1));
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Happy Path fehlgeschlagen → Salvage unten.
    }
  }

  const objects: unknown[] = [];
  let depth = 0;
  let inString = false;
  let escaped = false;
  let objStart = -1;
  for (let i = 0; i < slice.length; i++) {
    const ch = slice[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      if (depth === 0) objStart = i;
      depth++;
    } else if (ch === '}') {
      if (depth > 0) depth--;
      if (depth === 0 && objStart >= 0) {
        try {
          objects.push(JSON.parse(slice.slice(objStart, i + 1)));
        } catch {
          // Einzelnes Objekt nicht parsebar → ueberspringen.
        }
        objStart = -1;
      }
    }
  }
  return objects;
}
