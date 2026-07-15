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
import type { AITransport, ConversationMessage, BridgeZiel } from '@/core/services/ai/transports/streamlit';
import { starteFrischenChat, type ChatResetStatus } from '@/core/services/ai/chat-reset';
import { aktivesZielFuerLauf } from '@/core/services/ai/ki-ziel';
import { isDevContext } from '@/config/feature-flags';
import { hashText } from '@/plugins/antraege/gutachten/runner';

const BAUSTEIN_MAX_TOKENS_DEFAULT = 1024;

/** Compute-Ergebnis-Status eines Bausteins (das UI kennt zusätzlich `fehlt`/`laeuft`). */
export type BausteinStatus = 'ok' | 'degradiert' | 'fehler';

export interface BausteinResult<T> {
  status: BausteinStatus;
  /** Nur bei `ok` gesetzt (erfolgreich geparste Daten). */
  daten?: T;
  /** Roh-Antwort bei `degradiert` (nicht parsebar / verdächtig) — zur Einsicht im UI
   *  (gekappt auf `ROHTEXT_MAX`). Bei sauberen Läufen NICHT gesetzt (kv nicht aufblähen). */
  rohtext?: string;
  /** Chat-Reset-Status des Laufs — nur bei echtem Submit gesetzt (nicht bei
   *  Cache-Hit / `fehler`). `'nicht-gefunden'`/`'timeout'` markiert das UI (Pitfall #36). */
  chatResetStatus?: ChatResetStatus;
  /** Anzahl automatischer Retries (0/undefined = keiner) — additiv, nur bei Retry gesetzt. */
  retryAnzahl?: number;
  /** Menschenlesbare Begründung der Degradation (z.B. „Modell hat keine Sektion zugeordnet"). */
  begruendung?: string;
}

/** Obergrenze für den mitgespeicherten Rohtext bei Auffälligkeiten (Default 64 kB). */
export const ROHTEXT_MAX = 64 * 1024;

/** kv-Cache-Keys je Baustein (pro Antrag + VB-Hash → Neuberechnung nur bei VB-Änderung). */
export const aspekteCacheKey = (antragKey: string, vbHash: string): string =>
  `aufbereitung:${antragKey}:aspekte:${vbHash}`;
export const steckbriefCacheKey = (antragKey: string, vbHash: string): string =>
  `aufbereitung:${antragKey}:steckbrief:${vbHash}`;
export const zahlenCacheKey = (antragKey: string, vbHash: string): string =>
  `aufbereitung:${antragKey}:zahlen:${vbHash}`;
export const glossarCacheKey = (antragKey: string, vbHash: string): string =>
  `aufbereitung:${antragKey}:glossar:${vbHash}`;
export const verwertungCacheKey = (antragKey: string, vbHash: string): string =>
  `aufbereitung:${antragKey}:verwertung:${vbHash}`;

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

/** Ergebnis eines Baustein-Laufs: Roh-Antwort + der Chat-Reset-Status, der VOR
 *  dem Submit erhoben wurde (frischer Kontext, Pitfall #36). */
export interface RunBausteinErgebnis {
  text: string;
  chatResetStatus: ChatResetStatus;
}

/**
 * Fährt EINEN Baustein-Lauf über den (injizierten, internen) Transport. Startet
 * ZUERST einen frischen Chat (best-effort, Pitfall #36 — der Streamlit-Chat ist
 * stateful), dann der Lauf: bevorzugt `submitConversation` (DirectLLM), Fallback
 * `submitMessage` (Streamlit-Bridge, single-turn) — exakt wie `runRelevanzMap`.
 * System-Rolle aus dem Skill-Record; das Prompt baut der Caller.
 *
 * `ziel` (optional, nur Streamlit) routet den Ziel-Tab: ohne `ziel` = aktiver/
 * Standard-Chat (gpt-oss); `'agentisch'` = der agentische Qwen-Tab (260k, Zweit-LLM-
 * Erprobung — dev-Eval-A/B). Reset UND Submit treffen denselben Tab.
 *
 * ACHTUNG `maxTokens`: greift NUR auf dem `submitConversation`-Pfad (DirectLLM,
 * per-Request). Die Streamlit-Bridge trägt KEIN per-Request-Token-Budget → dort ist
 * die Ausgabelänge SERVER-seitig (Backend-Config des KI-Tabs), `skill.maxTokens`
 * wirkt dort NICHT (relevant für die Truncation-Analyse der Bausteine).
 */
export async function runBaustein(
  transport: AITransport, skill: SkillRecord, prompt: string,
  // Ohne explizites `ziel` gilt die globale KI-Varianten-Präferenz (`aktivesZielFuerLauf`):
  // Standard → undefined (aktiver Tab, byte-identisch), Agentisch → 'agentisch'. Die
  // dev-Eval übergibt weiterhin ein explizites `ziel` (überstimmt die Präferenz).
  ziel: BridgeZiel | undefined = aktivesZielFuerLauf(),
): Promise<RunBausteinErgebnis> {
  const chatResetStatus = await starteFrischenChat(transport, ziel);
  const system = skill.systemPrompt ?? '';
  const maxTokens = skill.maxTokens ?? BAUSTEIN_MAX_TOKENS_DEFAULT;
  if (typeof transport.submitConversation === 'function') {
    const messages: ConversationMessage[] = [
      ...(system ? [{ role: 'system', content: system } as ConversationMessage] : []),
      { role: 'user', content: prompt },
    ];
    return { text: await transport.submitConversation(messages, { maxTokens }), chatResetStatus };
  }
  return {
    text: await transport.submitMessage(
      system ? `${system}\n\n${prompt}` : prompt,
      system || undefined,
      ziel ? { ziel } : undefined,
    ),
    chatResetStatus,
  };
}

/**
 * Generischer Cache-/Compute-/Degradations-Rahmen (Muster `getOrComputeRelevanzMap`):
 *  - Cache-Hit nur bei passendem VB-Hash → `{ status:'ok', daten }`.
 *  - Miss: EIN Lauf → `parse(raw)`. Non-null (und nicht verdächtig) → cachen + `ok`.
 *    Null (unparsebar/leer) oder als `opts.verdaechtig` deklariertes Ergebnis →
 *    `{ status:'degradiert', rohtext, begruendung }` (NICHT cachen — nächster Versuch neu).
 *  - Transport-/Lauf-Fehler → `{ status:'fehler' }` (NICHT cachen).
 * `opts.verdaechtig` (opt-in): erkennt ein parsebar-aber-unplausibles Ergebnis (z.B.
 *    0 Zuordnungen bei ≥1 Sektion). Ist es gesetzt UND das Erstergebnis auffällig
 *    (null ODER verdächtig), läuft EIN automatischer Retry mit frischem Chat
 *    (`runBaustein` resettet vor dem Submit, Pitfall #36). Ohne `verdaechtig` bleibt das
 *    Verhalten exakt wie bisher (null → sofort degradiert, kein Retry).
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
  opts: { force?: boolean; verdaechtig?: { pruefe: (daten: T) => boolean; grund: string } } = {},
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

  /** EIN Lauf: Transport-Fehler → null (= 'fehler' außen), sonst Roh + geparst (parse wirft nie nach außen). */
  const einLauf = async (): Promise<{ daten: T | null; raw: string; reset: ChatResetStatus } | null> => {
    let raw: string;
    let reset: ChatResetStatus;
    try {
      const r = await runBaustein(transport, skill, buildPrompt());
      raw = r.text;
      reset = r.chatResetStatus;
    } catch {
      return null;
    }
    let daten: T | null;
    try { daten = parse(raw); } catch { daten = null; }
    return { daten, raw, reset };
  };

  const istSchlecht = (d: T | null): boolean => d == null || (!!opts.verdaechtig && opts.verdaechtig.pruefe(d));

  const erster = await einLauf();
  if (!erster) return { status: 'fehler' };
  let { daten, raw, reset } = erster;
  let retryAnzahl = 0;

  // Auffälliges Erstergebnis + deklarierte Verdächtig-Regel → EIN Retry (frischer Chat).
  if (opts.verdaechtig && istSchlecht(daten)) {
    retryAnzahl = 1;
    const zweiter = await einLauf();
    if (zweiter) ({ daten, raw, reset } = zweiter);
  }

  if (istSchlecht(daten)) {
    const begruendung = daten == null ? 'Antwort nicht parsebar' : opts.verdaechtig?.grund;
    return {
      status: 'degradiert',
      rohtext: raw.slice(0, ROHTEXT_MAX),
      chatResetStatus: reset,
      ...(retryAnzahl ? { retryAnzahl } : {}),
      ...(begruendung ? { begruendung } : {}),
    };
  }
  try { await idb.set(cacheKey, { vbHash, daten: daten as T }); } catch { /* Cache-Schreibfehler nicht eskalieren */ }
  return { status: 'ok', daten: daten as T, chatResetStatus: reset, ...(retryAnzahl ? { retryAnzahl } : {}) };
}

/** Löscht die Baustein-Caches eines Antrags (alle VB-Hashes) — für „KI-Bausteine neu berechnen". */
export async function loescheBausteinCaches(idb: IDBStore, antragKey: string): Promise<void> {
  const praefixe = [
    `aufbereitung:${antragKey}:aspekte:`,
    `aufbereitung:${antragKey}:steckbrief:`,
    `aufbereitung:${antragKey}:zahlen:`,
    `aufbereitung:${antragKey}:glossar:`,
    `aufbereitung:${antragKey}:verwertung:`,
  ];
  for (const praefix of praefixe) {
    const keys = await idb.keys(praefix).catch(() => [] as string[]);
    for (const k of keys) await idb.delete(k).catch(() => {});
  }
}
