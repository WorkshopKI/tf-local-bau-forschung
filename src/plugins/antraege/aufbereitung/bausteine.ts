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
import { starteFrischenChat, resetHatVerlaufsrisiko, type ChatResetStatus } from '@/core/services/ai/chat-reset';
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
// `recherchePromptCacheKey` lebt in `recherche-prompt.ts` — sein Key trägt die
// Stichwort-Schema-Version, und die von hier zu importieren wäre ein Modul-Zyklus.
/** Import-Struktur-Lauf: gekeyt über den Hash des EXTERNEN Textes (nicht `vbHash`). */
export const rechercheImportCacheKey = (antragKey: string, externHash: string): string =>
  `aufbereitung:${antragKey}:recherche-import:${externHash}`;

/** VB-Hash (djb2 — dieselbe Funktion wie der deterministische Run + die Relevanz-Map). */
export const vbHashFuer = (vbMarkdown: string): string => hashText(vbMarkdown);

/**
 * Liest ein gecachtes Baustein-Ergebnis — Treffer NUR bei passendem `vbHash`
 * (anderer Korpus = fachlich anderes Ergebnis). Rechnet nie, braucht keinen
 * Transport und wirft nie: ein Lesefehler ist ein Miss.
 *
 * Einzige Lesestelle der Cache-Shape `{ vbHash, daten }` — `getOrComputeBaustein`
 * ruft sie ebenso auf wie die Rehydrierung beim Öffnen einer Seite. Ohne diese
 * Funktion käme man an ein bereits berechnetes Ergebnis nur über einen
 * Compute-Aufruf heran, und der braucht einen Transport.
 */
export async function leseBausteinCache<T>(
  idb: IDBStore, cacheKey: string, vbHash: string,
): Promise<T | null> {
  try {
    const cached = await idb.get<{ vbHash: string; daten: T }>(cacheKey);
    if (cached && cached.vbHash === vbHash && cached.daten != null) return cached.daten;
  } catch {
    // Cache-Lesefehler ignorieren → wie ein Miss behandeln.
  }
  return null;
}

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
 * Standard-Chat (gpt-oss); `'agentisch'` = der agentische Qwen-Tab (262k, Zweit-LLM-
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
  opts: {
    force?: boolean;
    verdaechtig?: { pruefe: (daten: T) => boolean; grund: string };
    /** KI-Varianten-Ziel für DIESEN Baustein (nur Streamlit). `'agentisch'` = agentischer
     *  Qwen-Tab; scheitert dessen Reset (Tab nicht verbunden), fällt der Lauf einmal auf
     *  den Standard-Chat zurück (kein Fehler). Ohne `ziel` = globale Präferenz.
     *
     *  Die Aufbereitungs-Seite setzt es IMMER (`bestimmeLaufZiel`, `lauf-ziel.ts`) und
     *  hängt damit nicht an der globalen Variante; das MAP-Modul nutzt denselben Rahmen
     *  und bleibt bewusst bei der Präferenz. Deshalb wird hier NICHT vorbelegt. */
    ziel?: BridgeZiel;
    /**
     * `true`, wenn der Korpus NICHT ins Standard-Fenster passt (Notausfahrt).
     *
     * Dann entfällt der Standard-Fallback: der Ersatzlauf liefe garantiert über
     * ein zu kleines Kontextfenster, llama.cpp schöbe den Anfang still heraus,
     * und das abgeschnittene Ergebnis überschriebe das vollständige und würde
     * gecacht — ohne dass irgendetwas auf dem Bildschirm darauf hinweist. Das
     * agentische Ergebnis bleibt dann stehen, mit seinem Reset-Status: markieren
     * statt ersetzen (Pitfall #36, v4.124).
     */
    ueberStandardCap?: boolean;
  } = {},
): Promise<BausteinResult<T>> {
  if (!opts.force) {
    const cached = await leseBausteinCache<T>(idb, cacheKey, vbHash);
    if (cached !== null) return { status: 'ok', daten: cached };
  }

  /** EIN Lauf: Transport-Fehler → null (= 'fehler' außen), sonst Roh + geparst (parse wirft nie nach außen). */
  const einLauf = async (ziel?: BridgeZiel): Promise<{ daten: T | null; raw: string; reset: ChatResetStatus } | null> => {
    let raw: string;
    let reset: ChatResetStatus;
    try {
      const r = await runBaustein(transport, skill, buildPrompt(), ziel);
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

  /** EIN Lauf inkl. Agentisch-Fallback: wollte er den agentischen Tab, ist dessen Reset
   *  aber fehlgeschlagen (Tab nicht verbunden), einmal auf den Standard-Chat zurückfallen.
   *  Der Fallback nennt `'standard'` AUSDRÜCKLICH: ohne `ziel` bliebe das Bookmarklet im
   *  AKTIVEN Tab — also womöglich in genau dem agentischen, der gerade nicht antwortet
   *  (Lehre v2.292, `feedbackImprove.ts`). */
  const laufMitFallback = async (): Promise<{ daten: T | null; raw: string; reset: ChatResetStatus } | null> => {
    const r = await einLauf(opts.ziel);
    // Kein Rückfall, wenn der Korpus das Standard-Fenster sprengt (siehe
    // `ueberStandardCap`) — dort wäre der Ersatzlauf nachweislich beschnitten.
    if (r && opts.ziel === 'agentisch' && !opts.ueberStandardCap && resetHatVerlaufsrisiko(r.reset)) {
      const standard = await einLauf('standard');
      if (standard) return standard;
    }
    return r;
  };

  const erster = await laufMitFallback();
  if (!erster) return { status: 'fehler' };
  let { daten, raw, reset } = erster;
  let retryAnzahl = 0;

  // Auffälliges Erstergebnis + deklarierte Verdächtig-Regel → EIN Retry (frischer Chat).
  if (opts.verdaechtig && istSchlecht(daten)) {
    retryAnzahl = 1;
    const zweiter = await laufMitFallback();
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

// `loescheBausteinCaches` lebt in `baustein-katalog.ts`: es leitet seine Präfixe aus
// den Katalog-Einträgen ab, und der Katalog importiert die Cache-Keys von hier — die
// umgekehrte Richtung wäre ein Modul-Zyklus.
