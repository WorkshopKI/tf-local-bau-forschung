/**
 * Assistent-Panel (Phase 1) — Turn-Orchestrator (rein, node-testbar).
 *
 * Ein Turn = Frage entgegennehmen → Kontext deterministisch assemblieren →
 * resetChat (best-effort, Pitfall #36) → EINEN Prompt an den internen Transport
 * senden → Antwort zurückgeben. KEIN Auto-Retry, KEINE Schleife, KEINE
 * Selbstkorrektur (Runner-Prinzip). Alle unreinen Abhängigkeiten (Transport,
 * Kontext-Snapshot, Retrieval) werden injiziert → in Node ohne React testbar.
 */
import type { AITransport } from '@/core/services/ai/transports/streamlit';
import type { OramaSearchResult } from '@/core/services/search/orama-store';
import { resetHatVerlaufsrisiko, starteFrischenChat } from '@/core/services/ai/chat-reset';
import { extractThinking } from '@/core/services/ai/thinking-parser';
import { assembliereAssistentKontext } from '@/core/services/assistent/kontext';
import type { AssistentTurn, KontextEntitaet } from '@/core/services/assistent/kontext';
import { buildChatSources } from '../services/rag-sources';
import type { ChatSource } from '../types';

/** Menschliche Degradations-Meldung, wenn die interne KI nicht erreichbar ist. */
export const DEGRADATION_MELDUNG = 'Der interne KI-Dienst ist derzeit nicht erreichbar.';
const LEERE_ANTWORT_MELDUNG = 'Die interne KI hat keine Antwort geliefert. Bitte erneut versuchen.';
const ABGEBROCHEN_MELDUNG = 'Anfrage abgebrochen.';

export interface AssistentTurnKontext {
  routeBeschreibung: string;
  entitaet: KontextEntitaet | null;
}

export interface AssistentTurnDeps {
  /** Gegateter, intern-only Transport (wirft bei externem Provider → Degradation). */
  getTransport: () => AITransport;
  /** Aktueller Route-/Entitäts-Snapshot (unrein — liest Stores/Location). */
  getKontext: () => AssistentTurnKontext | Promise<AssistentTurnKontext>;
  /** Orama-Retrieval (unrein). `null`/`[]` = kein Retrieval für diesen Turn. */
  retrieve: (frage: string) => Promise<ReadonlyArray<OramaSearchResult> | null>;
}

export type AssistentTurnErgebnis =
  | {
    ok: true;
    antwort: string;
    thinking?: string;
    sources: ChatSource[];
    kontextBeschreibung: string;
    resetWarnung: boolean;
  }
  | { ok: false; fehler: string };

/**
 * Führt genau EINEN Assistenten-Turn aus. Fehler werden NIE geworfen, sondern als
 * `{ ok: false, fehler }` zurückgegeben — der Aufrufer (Session-Store) hält die
 * Historie dann unverändert und stellt die Frage ins Eingabefeld zurück.
 */
export async function fuehreAssistentTurnAus(
  frage: string,
  turns: ReadonlyArray<AssistentTurn>,
  deps: AssistentTurnDeps,
  signal?: AbortSignal,
): Promise<AssistentTurnErgebnis> {
  // 1. Transport — DSGVO-gated (wirft bei extern). Fehlschlag = Degradation.
  let transport: AITransport;
  try {
    transport = deps.getTransport();
  } catch (e) {
    return { ok: false, fehler: e instanceof Error ? e.message : DEGRADATION_MELDUNG };
  }

  // 2. Verfügbarkeit — vor jedem Aufwand prüfen (fail-fast, kein Inhalt gesendet).
  const erreichbar = await transport.ping().catch(() => false);
  if (!erreichbar) return { ok: false, fehler: DEGRADATION_MELDUNG };

  // 3. Kontext-Snapshot + optionales Retrieval.
  const kontext = await deps.getKontext();
  const treffer = await deps.retrieve(frage).catch(() => null);

  // 4. Deterministisch assemblieren (das LLM formuliert nur).
  const prompt = assembliereAssistentKontext({
    routeBeschreibung: kontext.routeBeschreibung,
    entitaet: kontext.entitaet,
    frage,
    turns,
    treffer: treffer ?? null,
  });

  // 5. resetChat VOR dem Senden (Pitfall #36) — best-effort, Kontaminations-Warnung.
  const resetStatus = await starteFrischenChat(transport);
  const resetWarnung = resetHatVerlaufsrisiko(resetStatus);

  // 6. Genau EIN Aufruf.
  let roh: string;
  try {
    roh = await transport.submitMessage(prompt.promptText, undefined, signal ? { signal } : undefined);
  } catch (e) {
    if (signal?.aborted) return { ok: false, fehler: ABGEBROCHEN_MELDUNG };
    return { ok: false, fehler: e instanceof Error ? e.message : DEGRADATION_MELDUNG };
  }
  const { content, thinking } = extractThinking(roh ?? '');
  if (!content.trim()) return { ok: false, fehler: LEERE_ANTWORT_MELDUNG };

  return {
    ok: true,
    antwort: content.trim(),
    ...(thinking ? { thinking } : {}),
    sources: buildChatSources([...prompt.verwendeteTreffer], frage),
    kontextBeschreibung: prompt.kontextBeschreibung,
    resetWarnung,
  };
}
