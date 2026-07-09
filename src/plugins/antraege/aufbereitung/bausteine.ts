/**
 * LLM-Baustein-Infrastruktur der Antrag-Aufbereitung (Paket 2). Generischer
 * Cache-/Compute-/Degradations-Rahmen nach dem Muster `getOrComputeRelevanzMap`
 * (`gutachten/relevanz-map.ts`): EIN interner LLM-Lauf je Baustein, gecacht im
 * IDB-`kv`-Store per VB-Hash (kein neuer Object-Store, Pitfall #29). Alle
 * Fehlerpfade degradieren — der deterministische Teil (Zeitplan) darf NIE
 * mitgerissen werden.
 *
 * DSGVO: der Lauf trägt VB-Volltext → der Skill-Record ist Policy-Subjekt
 * (`{{vbMarkdown}}` im `promptTemplate` → `skillEnthaeltDokumentInhalte` true →
 * intern-pflichtig, Pitfall #30). Der Transport wird injiziert (beim Caller via
 * `bridge.getTransportForSkillRun`); diese Datei ist transport-agnostisch und
 * ohne IDB (Node-testbar) nutzbar.
 */
import type { IDBStore } from '@/core/services/storage/idb-store';
import type { SkillRecord } from '@/core/services/skills';
import type { AITransport, ConversationMessage } from '@/core/services/ai/transports/streamlit';
import { isDevContext } from '@/config/feature-flags';
import { hashText } from '@/plugins/antraege/gutachten/runner';

const BAUSTEIN_MAX_TOKENS_DEFAULT = 1024;

/** Compute-Ergebnis-Status eines Bausteins (das UI kennt zusätzlich `fehlt`/`laeuft`). */
export type BausteinStatus = 'ok' | 'degradiert' | 'fehler';

export interface BausteinResult<T> {
  status: BausteinStatus;
  /** Nur bei `ok` gesetzt (erfolgreich geparste Daten). */
  daten?: T;
  /** Roh-Antwort bei `degradiert` (nicht parsebar) — zur Einsicht im UI. */
  rohtext?: string;
}

/** kv-Cache-Keys je Baustein (pro Antrag + VB-Hash → Neuberechnung nur bei VB-Änderung). */
export const aspekteCacheKey = (antragKey: string, vbHash: string): string =>
  `aufbereitung:${antragKey}:aspekte:${vbHash}`;
export const steckbriefCacheKey = (antragKey: string, vbHash: string): string =>
  `aufbereitung:${antragKey}:steckbrief:${vbHash}`;

/** VB-Hash (djb2 — dieselbe Funktion wie der deterministische Run + die Relevanz-Map). */
export const vbHashFuer = (vbMarkdown: string): string => hashText(vbMarkdown);

/**
 * Dev-Freischaltung eines `aktiv:false`-Bausteins (Muster
 * `istAnonymisiererFreigeschaltet`): in dev läuft jeder GELADENE Skill; prod
 * respektiert `aktiv !== false`. Die Aufbereitungs-Seite ist ohnehin
 * `antragAufbereitung`-gated (nur dev) — der Gate ist Gürtel-und-Hosenträger, aber
 * die dokumentierte Konvention (geteilte Registry ist prod-sichtbar).
 */
export function istAufbereitungBausteinFreigeschaltet(
  skill: SkillRecord | null | undefined,
  devKontext: boolean = isDevContext(),
): boolean {
  if (devKontext) return !!skill;
  return !!skill && skill.aktiv !== false;
}

/**
 * Fährt EINEN Baustein-Lauf über den (injizierten, internen) Transport. Bevorzugt
 * `submitConversation` (DirectLLM), Fallback `submitMessage` (Streamlit-Bridge,
 * single-turn) — exakt wie `runRelevanzMap`. System-Rolle + Token-Budget aus dem
 * Skill-Record; das eigentliche Prompt baut der Caller (`buildPrompt`).
 */
export async function runBaustein(transport: AITransport, skill: SkillRecord, prompt: string): Promise<string> {
  const system = skill.systemPrompt ?? '';
  const maxTokens = skill.maxTokens ?? BAUSTEIN_MAX_TOKENS_DEFAULT;
  if (typeof transport.submitConversation === 'function') {
    const messages: ConversationMessage[] = [
      ...(system ? [{ role: 'system', content: system } as ConversationMessage] : []),
      { role: 'user', content: prompt },
    ];
    return transport.submitConversation(messages, { maxTokens });
  }
  return transport.submitMessage(system ? `${system}\n\n${prompt}` : prompt, system || undefined);
}

/**
 * Generischer Cache-/Compute-/Degradations-Rahmen (Muster `getOrComputeRelevanzMap`):
 *  - Cache-Hit nur bei passendem VB-Hash → `{ status:'ok', daten }`.
 *  - Miss: EIN Lauf → `parse(raw)`. Non-null → cachen + `ok`. Null (unparsebar /
 *    leer) → `{ status:'degradiert', rohtext }` (NICHT cachen — nächster Versuch neu).
 *  - Transport-/Lauf-Fehler → `{ status:'fehler' }` (NICHT cachen).
 * Wirft NIE. `opts.force` überspringt den Cache-Read (für „KI-Bausteine neu berechnen").
 */
export async function getOrComputeBaustein<T>(
  idb: IDBStore,
  transport: AITransport,
  skill: SkillRecord,
  cacheKey: string,
  vbHash: string,
  buildPrompt: () => string,
  parse: (raw: string) => T | null,
  opts: { force?: boolean } = {},
): Promise<BausteinResult<T>> {
  if (!opts.force) {
    try {
      const cached = await idb.get<{ vbHash: string; daten: T }>(cacheKey);
      if (cached && cached.vbHash === vbHash && cached.daten != null) {
        return { status: 'ok', daten: cached.daten };
      }
    } catch {
      // Cache-Lesefehler ignorieren → frisch berechnen.
    }
  }
  let raw: string;
  try {
    raw = await runBaustein(transport, skill, buildPrompt());
  } catch {
    return { status: 'fehler' };
  }
  let daten: T | null;
  try {
    daten = parse(raw);
  } catch {
    daten = null;
  }
  if (daten == null) return { status: 'degradiert', rohtext: raw };
  try { await idb.set(cacheKey, { vbHash, daten }); } catch { /* Cache-Schreibfehler nicht eskalieren */ }
  return { status: 'ok', daten };
}

/** Löscht die Baustein-Caches eines Antrags (alle VB-Hashes) — für „KI-Bausteine neu berechnen". */
export async function loescheBausteinCaches(idb: IDBStore, antragKey: string): Promise<void> {
  const praefixe = [`aufbereitung:${antragKey}:aspekte:`, `aufbereitung:${antragKey}:steckbrief:`];
  for (const praefix of praefixe) {
    const keys = await idb.keys(praefix).catch(() => [] as string[]);
    for (const k of keys) await idb.delete(k).catch(() => {});
  }
}
