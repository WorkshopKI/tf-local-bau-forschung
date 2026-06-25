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

/** Strippt Codefences, nimmt das erste balancierte Top-Level-JSON-Objekt (truncation-tolerant). */
function parseFirstJsonObject(raw: string): Record<string, unknown> | null {
  const text = stripMarkdownWrapper(raw.trim());
  const start = text.indexOf('{');
  if (start < 0) return null;
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

export function parseAnonymisierung(raw: string): AnonymisierungErgebnis {
  const obj = parseFirstJsonObject(raw);
  const anonymisiertMd = obj && typeof obj.anonymisiert === 'string' ? obj.anonymisiert : null;
  if (anonymisiertMd == null) {
    throw new Error(
      'Die KI-Antwort war nicht im erwarteten JSON-Format {anonymisiert, mapping}. Bitte erneut anonymisieren.',
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
  });
  return parseAnonymisierung(result.raw);
}
