/**
 * Deckt die geteilte In-App-/CLI-Eval-Orchestrierung ab (kein echter Bridge-Call):
 * ein Dry-Run über alle Fixtures + ein Stub-Transport-Lauf, der Judge-Score und die
 * Reset-/Ziel-Weitergabe prüft. Der ECHTE Qwen-Lauf passiert im Panel beim Nutzer.
 */
import { describe, it, expect } from 'vitest';
import {
  laufeGedaechtnisEval, laufeEineFixtureMitJudge,
} from '../gedaechtnis-eval-runner';
import { frischeIdFabrik, laufeFixture } from '../gedaechtnis-eval-lib';
import { GEDAECHTNIS_FIXTURES } from '../gedaechtnis-fixtures';
import type { GedaechtnisFixture } from '../gedaechtnis-assertions';
import type {
  AITransport, BridgeZiel, ResetErgebnis, SubmitMessageOptions,
} from '@/core/services/ai/transports/streamlit';

/** Zeichnet Reset-/Submit-Ziele auf; unterscheidet Generierung von Judge am Prompt. */
class StubTransport implements AITransport {
  name = 'Stub';
  resetCalls: (BridgeZiel | undefined)[] = [];
  submitZiele: (BridgeZiel | undefined)[] = [];
  constructor(private readonly opsJson: string) {}
  async ping(): Promise<boolean> { return true; }
  async resetChat(ziel?: BridgeZiel): Promise<ResetErgebnis> {
    this.resetCalls.push(ziel);
    return 'ok';
  }
  async submitMessage(message: string, _sys?: string, options?: SubmitMessageOptions): Promise<string> {
    this.submitZiele.push(options?.ziel);
    if (message.includes('bewertest')) {
      return '{"faktentreue":5,"nuetzlichkeit":4,"begruendung":"ok"}';
    }
    return this.opsJson;
  }
}

/** Liefert Ops für die Generierung und eine Warteschlange von Judge-Antworten
 *  (zum Testen von Parse-Fehlern im Judge). */
class JudgeFehlerStub implements AITransport {
  name = 'JF';
  private judgeCall = 0;
  constructor(private readonly opsJson: string, private readonly judgeAntworten: string[]) {}
  async ping(): Promise<boolean> { return true; }
  async submitMessage(message: string): Promise<string> {
    if (message.includes('bewertest')) {
      const a = this.judgeAntworten[this.judgeCall] ?? '{"faktentreue":3,"nuetzlichkeit":3}';
      this.judgeCall++;
      return a;
    }
    return this.opsJson;
  }
}

const KALTSTART = GEDAECHTNIS_FIXTURES.find(f => f.id === 'kaltstart-1')!;

describe('gedaechtnis-eval-runner', () => {
  it('Dry-Run: alle Fixtures bestehen die deterministischen Assertions', async () => {
    const erg = await laufeGedaechtnisEval({ n: 1, transport: null, dryRun: true });
    expect(erg.aggregate).toHaveLength(GEDAECHTNIS_FIXTURES.length);
    expect(erg.alleAssertionsOk).toBe(true);
    for (const a of erg.aggregate) expect(a.okLaeufe).toBe(1);
  });

  it('EvalZeile-JSONL trägt exakt die CLI-Felder (Download-Form)', async () => {
    const erg = await laufeGedaechtnisEval({ n: 1, transport: null, dryRun: true, fixtures: [KALTSTART] });
    const zeile = erg.zeilen[0]!;
    // Der Download joint JSON.stringify(zeile) — undefined `judge` fällt dabei weg.
    const parsed = JSON.parse(JSON.stringify(zeile)) as Record<string, unknown>;
    expect(Object.keys(parsed).sort()).toEqual(
      ['aktive', 'assertionsFehler', 'assertionsOk', 'fixture', 'run', 'szenario'],
    );
    expect(parsed.fixture).toBe('kaltstart-1');
    expect(parsed.szenario).toBe('kaltstart');
    expect(parsed.run).toBe(0);
    expect(parsed.aktive).toBe(2);
    expect(parsed.assertionsOk).toBe(true);
    expect(parsed.assertionsFehler).toEqual([]);
  });

  it('Stub-Transport: Judge-Score + Reset/Ziel-Weitergabe (Generierung + Judge)', async () => {
    const stub = new StubTransport(JSON.stringify(KALTSTART.zyklen[0]!.stubOps));
    const { zeilen, aggregat } = await laufeEineFixtureMitJudge(KALTSTART, {
      n: 1, transport: stub, judgeTransport: stub, ziel: 'qwen35', reset: true,
    });
    expect(aggregat.okLaeufe).toBe(1);
    expect(aggregat.judgeF).toBe(5);
    expect(aggregat.judgeN).toBe(4);
    expect(zeilen[0]!.judge).toEqual({ faktentreue: 5, nuetzlichkeit: 4, begruendung: 'ok' });
    // 1 Zyklus-Reset (Generierung) + 1 Judge-Reset, beide auf Qwen3.6.
    expect(stub.resetCalls).toEqual(['qwen35', 'qwen35']);
    expect(stub.submitZiele).toEqual(['qwen35', 'qwen35']);
  });

  it('Ohne reset/ziel: keine Reset-Aufrufe, kein Ziel am Submit (CLI-Pfad-Spiegel)', async () => {
    const stub = new StubTransport(JSON.stringify(KALTSTART.zyklen[0]!.stubOps));
    await laufeEineFixtureMitJudge(KALTSTART, { n: 1, transport: stub });
    expect(stub.resetCalls).toEqual([]);
    expect(stub.submitZiele).toEqual([undefined]); // nur Generierung, kein Judge
  });

  it('Judge-Parse-Fehler fließen NICHT ins Mittel (nur gute Judges zählen)', async () => {
    const stub = new JudgeFehlerStub(
      JSON.stringify(KALTSTART.zyklen[0]!.stubOps),
      ['{"faktentreue":5,"nuetzlichkeit":5}', 'kaputt-kein-json'], // run 1 = Parse-Fehler
    );
    const { aggregat } = await laufeEineFixtureMitJudge(KALTSTART, {
      n: 2, transport: stub, judgeTransport: stub,
    });
    expect(aggregat.okLaeufe).toBe(2);
    expect(aggregat.judgeF).toBe(5); // nur der gute Judge (nicht der 0er-Parse-Fehler)
    expect(aggregat.judgeN).toBe(5);
    expect(aggregat.judgeFehler).toBe(1);
  });

  it('AbortSignal (vorab): laufeFixture bricht vor dem ersten Submit ab', async () => {
    const stub = new StubTransport(JSON.stringify(KALTSTART.zyklen[0]!.stubOps));
    const ctrl = new AbortController();
    ctrl.abort();
    const erg = await laufeFixture(KALTSTART, stub, frischeIdFabrik('x'), { signal: ctrl.signal });
    expect(stub.submitZiele).toEqual([]); // kein Bridge-Call
    expect(erg.ergebnisse).toEqual([]);
  });

  it('AbortSignal (vorab): laufeGedaechtnisEval bricht ab, kein Aggregat', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const erg = await laufeGedaechtnisEval({ n: 1, transport: null, dryRun: true, signal: ctrl.signal });
    expect(erg.abgebrochen).toBe(true);
    expect(erg.aggregate).toEqual([]);
    expect(erg.zeilen).toEqual([]);
  });

  it('Provenienz-Guard wirft bei nicht-fiktiver Fixture', async () => {
    const bad = { ...KALTSTART, fiktiv: false } as unknown as GedaechtnisFixture;
    await expect(
      laufeGedaechtnisEval({ n: 1, transport: null, dryRun: true, fixtures: [bad] }),
    ).rejects.toThrow(/Provenienz/);
  });
});
