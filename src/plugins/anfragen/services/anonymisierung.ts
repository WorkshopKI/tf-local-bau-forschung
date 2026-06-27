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
import { safeResetChat } from '@/core/services/ai/chat-reset';
import type { Mapping, PiiTyp, Verallgemeinerung } from '../types';

const PII_TYPEN: readonly PiiTyp[] = [
  'person', 'firma', 'ort', 'fkz', 'email', 'telefon', 'iban', 'x500', 'hostname', 'sonstiges',
];
const asPiiTyp = (v: unknown): PiiTyp =>
  typeof v === 'string' && (PII_TYPEN as readonly string[]).includes(v) ? (v as PiiTyp) : 'sonstiges';

export interface AnonymisierungErgebnis {
  anonymisiertMd: string;
  mapping: Mapping[];
  /** Verallgemeinerter Freitext (Stufe B) — nur lokal, NIE wiedereingesetzt. */
  verallgemeinerungen: Verallgemeinerung[];
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
  // Stufe B (additiv, rückwärtskompatibel): fehlt das Feld → []. Nur Einträge mit
  // nicht-leerem original UND verallgemeinert übernehmen (kein Platzhalter, keine
  // Wiedereinsetzung — strikt getrennt von `mapping`).
  const rawVerallg = obj && Array.isArray(obj.verallgemeinerungen) ? obj.verallgemeinerungen : [];
  const verallgemeinerungen: Verallgemeinerung[] = [];
  for (const v of rawVerallg) {
    if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      const original = typeof o.original === 'string' ? o.original.trim() : '';
      const verallgemeinert = typeof o.verallgemeinert === 'string' ? o.verallgemeinert.trim() : '';
      if (original && verallgemeinert) verallgemeinerungen.push({ original, verallgemeinert });
    }
  }
  return { anonymisiertMd, mapping, verallgemeinerungen };
}

/** True, solange der Skill nicht explizit deaktiviert ist (`aktiv === false`). */
export function istAnonymisiererAktiv(skill: SkillRecord | null | undefined): boolean {
  return !!skill && skill.aktiv !== false;
}

const RETRY_PAUSE_MS = 700;
const warte = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

export interface RunAnonymisierungOptions {
  /** Max. Versuche (Default 3). */
  versuche?: number;
  /** Pause zwischen Versuchen in ms (Default 700; Tests: 0). */
  pauseMs?: number;
}

/**
 * Führt die Anonymisierung über die INTERNE Bridge aus. `getTransportForSkillRun`
 * wirft bei externem Transport (DSGVO-Hardlock); der Originaltext erreicht nie ein
 * externes Modell.
 *
 * Bounded Retry: die Streamlit-Bridge finalisiert die Antwort unter Last
 * gelegentlich ZU FRÜH mit einer kurzen Teil-Antwort („Starte…"), bevor das JSON
 * kommt (das Bookmarklet schließt nach `SETTLE_MS` DOM-Idle, der die Thinking-Pause
 * überschreitet). Dann findet `parseAnonymisierung` kein `{anonymisiert}` und wirft.
 * Ein frischer Versuch = ein neuer `tf-request` = neue Generierung → liefert quasi
 * sicher die volle Antwort. Persistenz/Side-Effects erst nach Erfolg in der UI.
 */
export async function runAnonymisierung(
  bridge: AIBridge,
  skill: SkillRecord,
  originalMd: string,
  opts?: RunAnonymisierungOptions,
): Promise<AnonymisierungErgebnis> {
  const transport = bridge.getTransportForSkillRun(skill);
  const ok = await transport.ping();
  if (!ok) throw new Error('Interne KI nicht erreichbar — Anonymisierung derzeit nicht möglich.');
  // Frischer Kontext vor dem Lauf: kein alter Chat-Verlauf (z. B. vorheriges
  // Eval-Fixture) im internen Modell. Best-effort — bricht NIE ab.
  await safeResetChat(transport);
  const maxVersuche = Math.max(1, opts?.versuche ?? 3);
  const pauseMs = opts?.pauseMs ?? RETRY_PAUSE_MS;
  let letzterFehler: unknown;
  for (let versuch = 0; versuch < maxVersuche; versuch++) {
    const result = await runSkill(transport, skill, [], {
      stammdaten: '',
      vbMarkdown: '',
      zielText: originalMd,
      // Die interne KI denkt IMMER (Reasoning an); der Reasoning-Block kommt inline
      // als <think>…</think> im Content. runSkill strippt ihn nur bei thinkingBudget
      // !== 'none' (extractThinking) — sonst greift der Parser eine Klammer/ein
      // Format-Beispiel aus dem Reasoning. Wir übergeben den Wert NUR, um diese
      // Bereinigung zu aktivieren; Streaming löst er NICHT aus (kein Delta-Consumer →
      // runSkill fährt den robusten non-streaming-Pfad, s. run-skill.ts wantsStream).
      thinkingBudget: 'medium',
    });
    try {
      return parseAnonymisierung(result.raw);
    } catch (err) {
      letzterFehler = err;
      if (versuch < maxVersuche - 1) await warte(pauseMs);
    }
  }
  throw letzterFehler instanceof Error ? letzterFehler : new Error(String(letzterFehler));
}
