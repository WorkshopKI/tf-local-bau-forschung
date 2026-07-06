/**
 * Interner KI-Lauf zum Taggen einer Anfrage + tolerantes Parsing der Ausgabe.
 *
 * DSGVO: Der Lauf geht ausschließlich über `bridge.getTransportForSkillRun(skill)`
 * — der Skill trägt Dokumentinhalte (`{{zielText}}`), die Transport-Policy erzwingt
 * damit einen internen Transport und wirft bei externem Provider. Die extrahierten
 * Metadaten (inkl. Klartext-`name`/`firma`) entstehen rein lokal und werden NIE an
 * einen Transport gegeben.
 *
 * Härtung 1:1 wie `anonymisierung.ts` (verifizierte Vorlage): Ping-Guard → frischer
 * Chat-Kontext → Bounded Retry gegen zu früh finalisierte Teil-Antworten der
 * Streamlit-Bridge. Parsing = balanciertes Top-Level-Objekt (truncation-tolerant),
 * KEIN `response_format` (intern nicht garantiert).
 */
import type { AIBridge } from '@/core/services/ai/bridge';
import { runSkill, type SkillRecord } from '@/core/services/skills';
import { stripMarkdownWrapper } from '@/core/services/ai/json-tolerant';
import { safeResetChat } from '@/core/services/ai/chat-reset';
import { THEMENGRUPPEN } from '@/core/services/skills/registry/anfrage-metadaten.seed';

export interface MetadatenErgebnis {
  antragsart: string;
  name: string;
  firma: string;
  themengruppe: string;
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
 * Holt das Metadaten-Objekt robust heraus:
 *  1. erstes balanciertes Top-Level-Objekt (Schnellpfad, sauberes JSON);
 *  2. Fallback: auf das Feld `"antragsart"` ankern und das umschließende Objekt
 *     parsen — überspringt Reasoning-Klammern/Beispiele, die ein Thinking-Modell
 *     ggf. VOR der echten Antwort emittiert.
 */
function extractMetadatenObject(raw: string): Record<string, unknown> | null {
  const text = stripMarkdownWrapper(raw.trim());
  const firstBrace = text.indexOf('{');
  if (firstBrace >= 0) {
    const obj = extractBalancedObject(text, firstBrace);
    if (obj && ('antragsart' in obj || 'themengruppe' in obj)) return obj;
  }
  const key = text.indexOf('"antragsart"');
  if (key >= 0) {
    let start = text.lastIndexOf('{', key);
    while (start >= 0) {
      const obj = extractBalancedObject(text, start);
      if (obj && 'antragsart' in obj) return obj;
      start = text.lastIndexOf('{', start - 1);
    }
  }
  return null;
}

const asTrimmedString = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** Erst-Buchstabe groß (semi-offene `antragsart` sauber halten, ohne Wörter zu verbiegen). */
function capitalizeFirst(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/**
 * Normalisiert die `themengruppe` gegen das feste `THEMENGRUPPEN`-Vokabular
 * (case-/whitespace-tolerant). Unbekanntes/Leeres → „Sonstiges" (letzter Wert im
 * Vokabular) — hält die Filter-Kandidatenliste sauber.
 */
function normalizeThemengruppe(v: unknown): string {
  const raw = asTrimmedString(v);
  const fallback = THEMENGRUPPEN[THEMENGRUPPEN.length - 1] ?? 'Sonstiges';
  if (!raw) return fallback;
  const lower = raw.toLowerCase();
  const treffer = THEMENGRUPPEN.find(t => t.toLowerCase() === lower);
  return treffer ?? fallback;
}

export function parseMetadaten(raw: string): MetadatenErgebnis {
  const obj = extractMetadatenObject(raw);
  if (!obj) {
    const snippet = raw.trim().slice(0, 200).replace(/\s+/g, ' ');
    throw new Error(
      'Die KI-Antwort war nicht im erwarteten JSON-Format {antragsart, name, firma, themengruppe}.'
      + `${snippet ? ` (Antwort-Anfang: „${snippet}…")` : ''}`,
    );
  }
  return {
    antragsart: capitalizeFirst(asTrimmedString(obj.antragsart)),
    name: asTrimmedString(obj.name),
    firma: asTrimmedString(obj.firma),
    themengruppe: normalizeThemengruppe(obj.themengruppe),
  };
}

const RETRY_PAUSE_MS = 700;
const warte = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

export interface RunMetadatenOptions {
  /** Max. Versuche (Default 3). */
  versuche?: number;
  /** Pause zwischen Versuchen in ms (Default 700; Tests: 0). */
  pauseMs?: number;
}

/**
 * Führt das Metadaten-Tagging über die INTERNE Bridge aus.
 * `getTransportForSkillRun` wirft bei externem Transport (DSGVO-Hardlock); der
 * Originaltext erreicht nie ein externes Modell. Bounded Retry aus demselben Grund
 * wie beim Anonymisierer (früh finalisierte Streamlit-Teil-Antworten).
 */
export async function runMetadatenExtraktion(
  bridge: AIBridge,
  skill: SkillRecord,
  originalMd: string,
  opts?: RunMetadatenOptions,
): Promise<MetadatenErgebnis> {
  const transport = bridge.getTransportForSkillRun(skill);
  const ok = await transport.ping();
  if (!ok) throw new Error('Interne KI nicht erreichbar — Tagging derzeit nicht möglich.');
  await safeResetChat(transport);
  const maxVersuche = Math.max(1, opts?.versuche ?? 3);
  const pauseMs = opts?.pauseMs ?? RETRY_PAUSE_MS;
  let letzterFehler: unknown;
  for (let versuch = 0; versuch < maxVersuche; versuch++) {
    const result = await runSkill(transport, skill, [], {
      stammdaten: '',
      vbMarkdown: '',
      zielText: originalMd,
      // Interne KI denkt immer; thinkingBudget aktiviert das <think>-Stripping in
      // runSkill (kein Streaming, da kein Delta-Consumer). Siehe anonymisierung.ts.
      thinkingBudget: 'medium',
    });
    try {
      return parseMetadaten(result.raw);
    } catch (err) {
      letzterFehler = err;
      if (versuch < maxVersuche - 1) await warte(pauseMs);
    }
  }
  throw letzterFehler instanceof Error ? letzterFehler : new Error(String(letzterFehler));
}
