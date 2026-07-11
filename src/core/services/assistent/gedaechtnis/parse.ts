/**
 * Toleranter Parser für die LLM-Operationsliste (Assistent Phase 2).
 *
 * Wiederverwendet die geteilte Salvage-Utility (json-tolerant.ts) — dieselbe, die
 * die Batch-Klassifizierung + der strukturierte Skill-Output nutzen. Erwartet ein
 * JSON-Array; liefert `null`, wenn KEIN Array-Anfang (`[`) gefunden wird (echter
 * Parse-Fehler → Bestand/Wasserzeichen bleiben unverändert). Ein LEERES Array
 * `[]` (keine Operationen) ist ein GÜLTIGES Ergebnis und liefert `[]`.
 */
import { parseJsonArrayTolerant, stripMarkdownWrapper } from '@/core/services/ai/json-tolerant';

export function parseOperationsliste(raw: string): unknown[] | null {
  const text = stripMarkdownWrapper(raw ?? '').trim();
  const start = text.indexOf('[');
  if (start < 0) return null; // kein Array → echter Parse-Fehler
  return parseJsonArrayTolerant(text.slice(start));
}
