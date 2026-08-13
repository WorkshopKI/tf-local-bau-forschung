/**
 * LLM-Batch-Klassifizierung — Ping-Guard, Chat-Reset und bounded Retry.
 *
 * Regression zu „Bridge erkennt Generierungs-Ende nicht mehr" (Auslastung): der
 * Caller bekam dieselben drei Schutzschichten wie die Anfragen-Anonymisierung —
 * Ping-Guard (kein Endlos-Spinner bei getrennter KI), Reset je Versuch (keine
 * lastAssistant()-Staleness), Retry auf Parse-Fehler (ein Flake != 0 Ergebnisse).
 * Spiegelt anfragen/services/__tests__/anonymisierung.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { klassifiziereBatch, parseLLMResponse, type LLMVerbund } from '../llm-klassifizierung';
import type { AIBridge } from '@/core/services/ai/bridge';
import type { UeberKategorie } from '../../../types';

const KATEGORIEN = [
  { id: 'IT', name: 'Informationstechnik' },
  { id: 'DT', name: 'Digitale Technologien' },
] as unknown as UeberKategorie[];

const VERBUND: LLMVerbund = { id: 'VB-1', verbundTitel: 'Test', tvTitels: ['TV eins'] };
const GUELTIG = '[{"id":"VB-1","primaer":"IT","aspekte":["DT"],"begruendung":"ok"}]';

interface FakeOpts {
  ping?: boolean;
  /** Antworten je submitMessage-Aufruf; Error → wird geworfen. Letzter Wert wird wiederholt. */
  responses?: Array<string | Error>;
  /** Aufruf-Reihenfolge (reset/submit) protokollieren. */
  calls?: string[];
}
function fakeBridge(opts: FakeOpts): AIBridge {
  let i = 0;
  const transport = {
    name: 'Streamlit',
    ping: async (): Promise<boolean> => opts.ping ?? true,
    resetChat: async (): Promise<boolean> => { opts.calls?.push('reset'); return true; },
    submitMessage: async (): Promise<string> => {
      opts.calls?.push('submit');
      const r = opts.responses?.[Math.min(i, opts.responses.length - 1)] ?? GUELTIG;
      i++;
      if (r instanceof Error) throw r;
      return r;
    },
  };
  return { getActiveTransport: () => transport, getTransportForDatenLauf: () => transport } as unknown as AIBridge;
}

describe('klassifiziereBatch — Ping-Guard', () => {
  it('wirft „nicht erreichbar" und ruft kein submitMessage, wenn ping() false', async () => {
    const calls: string[] = [];
    await expect(klassifiziereBatch({
      verbuende: [VERBUND], kategorien: KATEGORIEN, bridge: fakeBridge({ ping: false, calls }),
      pauseMs: 0,
    })).rejects.toThrow(/nicht erreichbar/);
    expect(calls).not.toContain('submit');
  });
});

describe('klassifiziereBatch — Reset + Retry', () => {
  it('Parse-Fehler beim 1. Versuch, gültiges JSON beim 2. → Ergebnis kommt, Reset je Versuch', async () => {
    const calls: string[] = [];
    const res = await klassifiziereBatch({
      verbuende: [VERBUND], kategorien: KATEGORIEN,
      bridge: fakeBridge({ responses: ['kein json', GUELTIG], calls }),
      pauseMs: 0,
    });
    expect(res.byVerbundId.get('VB-1')?.primaer).toBe('IT');
    expect(res.errors).toHaveLength(0);
    expect(calls.filter(c => c === 'reset')).toHaveLength(2);
    expect(calls.filter(c => c === 'submit')).toHaveLength(2);
  });

  it('alle Versuche unparsebar → genau 1 Batch-Fehler, kein Ergebnis', async () => {
    const res = await klassifiziereBatch({
      verbuende: [VERBUND], kategorien: KATEGORIEN,
      bridge: fakeBridge({ responses: ['nope', 'nope', 'nope'] }),
      versuche: 3, pauseMs: 0,
    });
    expect(res.byVerbundId.size).toBe(0);
    expect(res.errors).toHaveLength(1);
  });
});

describe('parseLLMResponse — diagnostischer Antwort-Snippet', () => {
  it('Nicht-JSON (z. B. gegriffene AitisiGPT-Begrüßung) → Fehler mit Antwort-Anfang', () => {
    // Reproduziert den Begrüßungs-Grab: die Bridge liefert statt JSON die Begrüßung.
    const begruessung = 'Informationen sprechen. Gern kannst du ein oder mehrere Dokumente oben ablegen.';
    expect(() => parseLLMResponse(begruessung)).toThrow(/Antwort-Anfang/);
    expect(() => parseLLMResponse(begruessung)).toThrow(/Informationen sprechen/);
  });

  it('gültiges JSON-Array parst weiterhin fehlerfrei', () => {
    const out = parseLLMResponse('[{"id":"VB-1","primaer":"IT","aspekte":["DT"],"begruendung":"ok"}]');
    expect(out).toEqual([{ id: 'VB-1', primaer: 'IT', aspekte: ['DT'], begruendung: 'ok' }]);
  });
});

describe('klassifiziereBatch — Transport-Fehler NICHT retryen', () => {
  it('Response-Timeout → genau 1 submitMessage, landet in errors (kein 3× 200 s)', async () => {
    const calls: string[] = [];
    const res = await klassifiziereBatch({
      verbuende: [VERBUND], kategorien: KATEGORIEN,
      bridge: fakeBridge({ responses: [new Error('Response timeout')], calls }),
      versuche: 3, pauseMs: 0,
    });
    expect(calls.filter(c => c === 'submit')).toHaveLength(1);
    expect(res.errors[0]?.message).toMatch(/timeout/i);
    expect(res.byVerbundId.size).toBe(0);
  });

  it('AbortError wird durchgereicht (nicht als Batch-Fehler geschluckt)', async () => {
    const err = new DOMException('Aborted', 'AbortError');
    await expect(klassifiziereBatch({
      verbuende: [VERBUND], kategorien: KATEGORIEN,
      bridge: fakeBridge({ responses: [err] }),
      versuche: 3, pauseMs: 0,
    })).rejects.toThrow(/Abort/);
  });
});
