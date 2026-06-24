import { describe, it, expect } from 'vitest';
import { runEvalBatch, GenTransportUnreachableError, EVAL_MAX_ANZAHL } from '../eval-batch';
import { resolveRegistry } from '../registry-load';
import type { AITransport } from '@/core/services/ai/transports/streamlit';

/**
 * Funktionaler Beweis der Browser-Orchestrierung (`runEvalBatch`) über
 * netzwerkfreie Pfade: Generierung via Stub-Transport, Judge AUS. Die fiktiven
 * Fixtures kommen aus dem gebrandeten Bundle (`loadEvalFixtures`) — läuft dieser
 * Test, ist der Provenienz-Guard erfüllt (sonst würfe runEvalBatch). Der Judge-AN-
 * Pfad (externer DirectLLMTransport) ist netzgebunden und hier bewusst nicht
 * abgedeckt; die JudgeScores→JudgeResult-Verdrahtung deckt der Convention-Test
 * `eval-gui-fictional-only` + die CLI-Parität (cli.ts) ab.
 */

/** Stub-Transport: feste „### Finaler Text"-Antwort; ping konfigurierbar. */
function stubTransport(opts?: { reachable?: boolean; name?: string }): AITransport {
  const reply = '### Finaler Text\nSynthetischer Abschnittstext für den Eval-Batch-Test.';
  return {
    name: opts?.name ?? 'stub-intern',
    ping: async () => opts?.reachable ?? true,
    submitMessage: async () => reply,
    submitConversation: async () => reply,
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
      judge: null,
      onProgress: (done, total) => progress.push([done, total]),
    });

    expect(res.results).toHaveLength(2);
    expect(res.results.every(r => r.parsed?.finalerText.includes('Synthetischer'))).toBe(true);
    expect(res.judges).toEqual([]);
    expect(res.judgeAktiv).toBe(false);
    expect(res.modellId).toBe('gpt-oss-120b');
    // Matrix = aggregate(results, []): eine Zelle (ein Abschnitt × ein Modell × voll).
    expect(res.matrix.cells.length).toBeGreaterThan(0);
    expect(res.matrix.modelle).toContain('gpt-oss-120b');
    expect(progress).toEqual([[1, 2], [2, 2]]);
  });

  it('Anzahl wird auf [1, Bestand] geklemmt (0 → 1 Lauf)', async () => {
    const res = await runEvalBatch({
      abschnitt: 'A',
      anzahl: 0,
      registry: resolveRegistry(null),
      genTransport: stubTransport(),
      judge: null,
    });
    expect(res.results).toHaveLength(1);
  });

  it('Anzahl über dem Maximum bleibt ≤ EVAL_MAX_ANZAHL', async () => {
    const res = await runEvalBatch({
      abschnitt: 'A',
      anzahl: 999,
      registry: resolveRegistry(null),
      genTransport: stubTransport(),
      judge: null,
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
      judge: null,
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
      judge: null,
      signal: ac.signal,
    });
    expect(res.results).toEqual([]);
    expect(res.matrix.cells).toEqual([]);
  });
});
