import { describe, it, expect } from 'vitest';
import {
  runEvalBatch,
  makeStarkerJudgeTransport,
  GenTransportUnreachableError,
  EVAL_MAX_ANZAHL,
} from '../eval-batch';
import { resolveRegistry } from '../registry-load';
import { loadEvalFixtures } from '../fixtures/bundle';
import { parseVbHeadings } from '@/plugins/antraege/gutachten/relevanz-map';
import type { AITransport } from '@/core/services/ai/transports/streamlit';

/**
 * Funktionaler Beweis der Browser-Orchestrierung (`runEvalBatch`) über
 * netzwerkfreie Pfade: Generierung + Relevanz-Map via Stub-Transport, Judge AUS
 * (bzw. der interne Judge-Adapter separat gegen einen Stub). Die fiktiven
 * Fixtures kommen aus dem gebrandeten Bundle (`loadEvalFixtures`) — läuft dieser
 * Test, ist der Provenienz-Guard erfüllt (sonst würfe runEvalBatch).
 */

const SKILL_REPLY = '### Finaler Text\nSynthetischer Abschnittstext für den Eval-Batch-Test.';
/** Eindeutiger Marker aus `buildRelevanzPrompt` — trennt Map-Läufe von Skill-Läufen. */
const RELEVANZ_MARKER = 'den Teilen eines ZIM-Gutachtens zu';

interface StubOpts {
  reachable?: boolean;
  name?: string;
  /** Antwort des Stubs auf einen Relevanz-Map-Prompt (Default: leer → Map degradiert zu Volltext). */
  relevanzReply?: string;
  /** Wirft im Map-Lauf (Test der stillen Degradation zu Volltext). */
  mapThrows?: boolean;
}

/** Stub-Transport: Skill-Antwort bzw. (bei Relevanz-Prompt) die konfigurierte Map-Antwort. */
function stubTransport(opts?: StubOpts): AITransport {
  const antwort = (text: string): string => {
    if (text.includes(RELEVANZ_MARKER)) {
      if (opts?.mapThrows) throw new Error('map boom');
      return opts?.relevanzReply ?? '';
    }
    return SKILL_REPLY;
  };
  return {
    name: opts?.name ?? 'stub-intern',
    ping: async () => opts?.reachable ?? true,
    submitMessage: async (message) => antwort(message),
    submitConversation: async (messages) => antwort(messages.map(m => m.content).join('\n')),
  };
}

describe('runEvalBatch (dev-only Orchestrierung)', () => {
  it('Judge-AUS: erzeugt N Läufe + Matrix, keine Judge-Bewertungen, Progress je Fixture', async () => {
    const progress: Array<[number, number]> = [];
    const res = await runEvalBatch({
      abschnitt: 'A',
      anzahl: 2,
      registry: resolveRegistry(null),
      genTransport: stubTransport({ name: 'gpt-oss-120b' }),
      onProgress: (done, total) => progress.push([done, total]),
    });

    expect(res.results).toHaveLength(2);
    expect(res.results.every(r => r.parsed?.finalerText.includes('Synthetischer'))).toBe(true);
    expect(res.results.every(r => r.kontext === 'voll')).toBe(true);
    expect(res.judges).toEqual([]);
    expect(res.judgeAktiv).toBe(false);
    expect(res.judgeModellId).toBeNull();
    expect(res.modellId).toBe('gpt-oss-120b');
    expect(res.matrix.cells.length).toBeGreaterThan(0);
    expect(res.matrix.kontexte).toEqual(['voll']);
    expect(res.relevanzInfos).toEqual([]);
    expect(progress).toEqual([[1, 2], [2, 2]]);
  });

  it('Anzahl wird auf [1, Bestand] geklemmt (0 → 1 Lauf)', async () => {
    const res = await runEvalBatch({
      abschnitt: 'A',
      anzahl: 0,
      registry: resolveRegistry(null),
      genTransport: stubTransport(),
    });
    expect(res.results).toHaveLength(1);
  });

  it('Anzahl über dem Maximum bleibt ≤ EVAL_MAX_ANZAHL', async () => {
    const res = await runEvalBatch({
      abschnitt: 'A',
      anzahl: 999,
      registry: resolveRegistry(null),
      genTransport: stubTransport(),
    });
    expect(res.results.length).toBeLessThanOrEqual(EVAL_MAX_ANZAHL);
    expect(res.results.length).toBeGreaterThan(0);
  });

  it('nicht erreichbarer Gen-Transport → GenTransportUnreachableError (vor dem ersten Lauf)', async () => {
    await expect(runEvalBatch({
      abschnitt: 'A',
      anzahl: 3,
      registry: resolveRegistry(null),
      genTransport: stubTransport({ reachable: false }),
    })).rejects.toBeInstanceOf(GenTransportUnreachableError);
  });

  it('bereits abgebrochenes Signal → keine Läufe', async () => {
    const ac = new AbortController();
    ac.abort();
    const res = await runEvalBatch({
      abschnitt: 'A',
      anzahl: 5,
      registry: resolveRegistry(null),
      genTransport: stubTransport(),
      signal: ac.signal,
    });
    expect(res.results).toEqual([]);
    expect(res.matrix.cells).toEqual([]);
  });

  it("kontext 'both' erzeugt beide Arme (voll + relevant) je Fixture", async () => {
    const res = await runEvalBatch({
      abschnitt: 'A',
      anzahl: 1,
      registry: resolveRegistry(null),
      genTransport: stubTransport(),
      kontext: 'both',
      mapSchwelle: 0, // Map-Pfad erzwingen (Stub liefert leere Map → Volltext-Fallback)
    });
    expect(res.results).toHaveLength(2);
    expect(res.results.map(r => r.kontext).sort()).toEqual(['relevant', 'voll']);
    expect(res.matrix.kontexte).toEqual(['voll', 'relevant']);
  });

  it("Schwellen-No-op: VB unter Schwelle läuft als Volltext, wird getaggt (kein echtes A/B)", async () => {
    const res = await runEvalBatch({
      abschnitt: 'A',
      anzahl: 1,
      registry: resolveRegistry(null),
      genTransport: stubTransport({ relevanzReply: 'A: h0' }),
      kontext: 'relevant',
      mapSchwelle: 10_000_000, // größer als jede Fixture → nie durch die Map
    });
    expect(res.results.every(r => r.kontext === 'relevant')).toBe(true);
    expect(res.relevanzInfos).toHaveLength(1);
    const info = res.relevanzInfos[0]!;
    expect(info.mapAngewandt).toBe(false);
    expect(info.grund).toBe('unter Schwelle');
    expect(info.relevantChars).toBe(info.vollChars);
  });

  it('Map angewandt: relevanter Kontext ist echt kleiner als der volle VB', async () => {
    const fx = loadEvalFixtures()[0]!;
    const headings = parseVbHeadings(fx.vbMarkdown)
      .filter(h => fx.vbMarkdown.slice(h.start, h.end).trim().length > 50);
    // Kleinste nicht-leere Sektion wählen → Auszug garantiert < Volltext.
    const chosen = headings.reduce((a, b) => (b.end - b.start) < (a.end - a.start) ? b : a);
    const res = await runEvalBatch({
      abschnitt: 'A',
      anzahl: 1,
      registry: resolveRegistry(null),
      genTransport: stubTransport({ relevanzReply: `A: ${chosen.id}` }),
      kontext: 'relevant',
      mapSchwelle: 0,
    });
    expect(res.relevanzInfos).toHaveLength(1);
    const info = res.relevanzInfos[0]!;
    expect(info.mapAngewandt).toBe(true);
    expect(info.grund).toBe('angewandt');
    expect(info.relevantChars).toBeLessThan(info.vollChars);
  });

  it('Map-Lauf scheitert → stille Degradation zu Volltext + Tag, kein Batch-Abbruch', async () => {
    const res = await runEvalBatch({
      abschnitt: 'A',
      anzahl: 1,
      registry: resolveRegistry(null),
      genTransport: stubTransport({ mapThrows: true }),
      kontext: 'relevant',
      mapSchwelle: 0,
    });
    expect(res.results).toHaveLength(1);
    expect(res.results[0]!.fehler).toBeUndefined();
    const info = res.relevanzInfos[0]!;
    expect(info.mapAngewandt).toBe(false);
    expect(info.grund).toBe('Map leer → Volltext');
    expect(info.relevantChars).toBe(info.vollChars);
  });
});

describe('makeStarkerJudgeTransport (interner Judge-Adapter)', () => {
  it('resettet den Chat, sendet ziel=qwen35 und strippt <think> vor der Rückgabe', async () => {
    let resetZiel: string | undefined = 'ungesetzt';
    let submittedZiel: string | undefined;
    const inner: AITransport = {
      name: 'bridge',
      displayName: 'standard',
      ping: async () => true,
      resetChat: async (ziel) => { resetZiel = ziel; return 'ok'; },
      submitMessage: async (_msg, _sys, opts) => {
        submittedZiel = opts?.ziel;
        return '<think>ich überlege…</think>{"fachliche_korrektheit":4}';
      },
    };
    const judge = makeStarkerJudgeTransport(inner);
    const out = await judge.submitMessage('prompt', 'system');

    expect(resetZiel).toBe('stark');
    expect(submittedZiel).toBe('stark');
    expect(out).toBe('{"fachliche_korrektheit":4}');
    expect(judge.displayName).toContain('stark');
  });
});
