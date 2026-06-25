/**
 * Anonymisierungs-Lauf + tolerantes Parsing der KI-Ausgabe.
 *
 * DSGVO: Der Lauf geht ausschließlich über `bridge.getTransportForSkillRun(skill)`
 * — der Skill trägt Dokumentinhalte (`{{zielText}}`), die Transport-Policy erzwingt
 * damit einen internen Transport und wirft bei externem Provider. Das `mapping`
 * (Platzhalter→Original) entsteht hier rein lokal und wird NIE serialisiert/an
 * einen Transport gegeben.
 */
import type { AIBridge } from '@/core/services/ai/bridge';
import { runSkill, type SkillRecord } from '@/core/services/skills';
import { stripMarkdownWrapper } from '@/core/services/ai/json-tolerant';
import type { Mapping, PiiTyp } from '../types';

const PII_TYPEN: readonly PiiTyp[] = [
  'person', 'firma', 'ort', 'fkz', 'email', 'telefon', 'iban', 'x500', 'hostname', 'sonstiges',
];
const asPiiTyp = (v: unknown): PiiTyp =>
  typeof v === 'string' && (PII_TYPEN as readonly string[]).includes(v) ? (v as PiiTyp) : 'sonstiges';

export interface AnonymisierungErgebnis {
  anonymisiertMd: string;
  mapping: Mapping[];
}

/** Parst das balancierte Top-Level-Objekt ab `start` (truncation-tolerant). */
function extractBalancedObject(text: string, start: number): Record<string, unknown> | null {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        try {
          const parsed: unknown = JSON.parse(text.slice(start, i + 1));
          return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? (parsed as Record<string, unknown>)
            : null;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/**
 * Holt das `{anonymisiert,…}`-Objekt robust heraus:
 *  1. erstes balanciertes Top-Level-Objekt (Schnellpfad, sauberes JSON);
 *  2. Fallback: auf das Feld `"anonymisiert"` ankern und das umschließende Objekt
 *     parsen — überspringt Reasoning-Klammern/Beispiele, die das Modell
 *     (Thinking-Modell) ggf. VOR der echten Antwort emittiert.
 * Erste Verteidigungslinie bleibt `extractThinking` in runSkill (strippt
 * `<think>…</think>`); das hier fängt untaggte Reasoning-Reste ab.
 */
function extractAnonObject(raw: string): Record<string, unknown> | null {
  const text = stripMarkdownWrapper(raw.trim());
  const firstBrace = text.indexOf('{');
  if (firstBrace >= 0) {
    const obj = extractBalancedObject(text, firstBrace);
    if (obj && typeof obj.anonymisiert === 'string') return obj;
  }
  const key = text.indexOf('"anonymisiert"');
  if (key >= 0) {
    let start = text.lastIndexOf('{', key);
    while (start >= 0) {
      const obj = extractBalancedObject(text, start);
      if (obj && typeof obj.anonymisiert === 'string') return obj;
      start = text.lastIndexOf('{', start - 1);
    }
  }
  return null;
}

export function parseAnonymisierung(raw: string): AnonymisierungErgebnis {
  const obj = extractAnonObject(raw);
  const anonymisiertMd = obj && typeof obj.anonymisiert === 'string' ? obj.anonymisiert : null;
  if (anonymisiertMd == null) {
    const snippet = raw.trim().slice(0, 200).replace(/\s+/g, ' ');
    throw new Error(
      'Die KI-Antwort war nicht im erwarteten JSON-Format {anonymisiert, mapping}. Bitte erneut '
      + `anonymisieren.${snippet ? ` (Antwort-Anfang: „${snippet}…")` : ''}`,
    );
  }
  const rawMapping = obj && Array.isArray(obj.mapping) ? obj.mapping : [];
  const mapping: Mapping[] = [];
  for (const m of rawMapping) {
    if (m && typeof m === 'object') {
      const o = m as Record<string, unknown>;
      const platzhalter = typeof o.platzhalter === 'string' ? o.platzhalter.trim() : '';
      const original = typeof o.original === 'string' ? o.original.trim() : '';
      if (platzhalter && original) mapping.push({ platzhalter, original, typ: asPiiTyp(o.typ) });
    }
  }
  return { anonymisiertMd, mapping };
}

/** True, solange der Skill nicht explizit deaktiviert ist (`aktiv === false`). */
export function istAnonymisiererAktiv(skill: SkillRecord | null | undefined): boolean {
  return !!skill && skill.aktiv !== false;
}

/**
 * Führt die Anonymisierung über die INTERNE Bridge aus. `getTransportForSkillRun`
 * wirft bei externem Transport (DSGVO-Hardlock); der Originaltext erreicht nie ein
 * externes Modell.
 */
export async function runAnonymisierung(
  bridge: AIBridge,
  skill: SkillRecord,
  originalMd: string,
): Promise<AnonymisierungErgebnis> {
  const transport = bridge.getTransportForSkillRun(skill);
  const ok = await transport.ping();
  if (!ok) throw new Error('Interne KI nicht erreichbar — Anonymisierung derzeit nicht möglich.');
  const result = await runSkill(transport, skill, [], {
    stammdaten: '',
    vbMarkdown: '',
    zielText: originalMd,
    // Die interne KI denkt IMMER (Reasoning an); im non-streaming Streamlit-Pfad
    // kommt der Reasoning-Block inline als <think>…</think> im Content. runSkill
    // strippt ihn nur bei thinkingBudget !== 'none' (extractThinking) — sonst greift
    // der Parser eine Klammer/ein Format-Beispiel aus dem Reasoning. Wert ist für die
    // Streamlit-Bridge nicht transportrelevant (wird nicht gesendet), aktiviert aber
    // die Bereinigung.
    thinkingBudget: 'medium',
  });
  return parseAnonymisierung(result.raw);
}
