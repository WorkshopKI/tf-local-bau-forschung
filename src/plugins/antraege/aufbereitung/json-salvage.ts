/**
 * Truncation-toleranter JSON-Array-Salvage der Aufbereitungs-Bausteine. Birgt ein
 * benanntes Array-Feld (`"claims"`, `"begriffe"`, …) + `schemaVersion` aus einer
 * LLM-Antwort — auch wenn das äußere Objekt am Token-Limit abgeschnitten wurde
 * (Lehre aus dem Zahlen-Prod-Eval, v2.217.1). Nutzt die GETEILTEN
 * `extractLastJsonObject` (Objekt-Happy-Path) + `parseJsonArrayTolerant` (Array-Salvage) —
 * kein dritter Parser. Geteilt vom Zahlen- UND Glossar-Baustein.
 */
import { parseJsonArrayTolerant } from '@/core/services/ai/json-tolerant';
import { extractLastJsonObject } from './steckbrief';

/**
 * Happy Path: das letzte vollständige JSON-Objekt; sein `feld`-Array (oder `[]`). Bricht
 * die Antwort mitten im Array ab (äußeres `{` schließt nie → `extractLastJsonObject` =
 * `null`), wird ab dem `[` hinter `"<feld>"` jedes balancierte `{…}` geborgen (das
 * angeschnittene letzte verworfen). `null` NUR, wenn WEDER Objekt NOCH Array bergbar ist.
 */
export function birgtRohArray(raw: string, feld: string): { items: unknown[]; schemaVersion: number } | null {
  const obj = extractLastJsonObject(raw);
  if (obj) {
    const wert = (obj as Record<string, unknown>)[feld];
    return { items: Array.isArray(wert) ? wert : [], schemaVersion: typeof obj.schemaVersion === 'number' ? obj.schemaVersion : 1 };
  }
  const key = raw.indexOf(`"${feld}"`);
  if (key < 0) return null;
  const arrStart = raw.indexOf('[', key);
  if (arrStart < 0) return null;
  const items = parseJsonArrayTolerant(raw.slice(arrStart));
  if (items.length === 0) return null;
  const sv = /"schemaVersion"\s*:\s*(\d+)/.exec(raw);
  return { items, schemaVersion: sv ? parseInt(sv[1]!, 10) : 1 };
}
