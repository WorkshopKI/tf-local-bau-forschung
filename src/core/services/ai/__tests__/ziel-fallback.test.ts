import { describe, it, expect, afterEach } from 'vitest';
import { useKiZiel } from '../ki-ziel';
import { mitZielFallback, zielWirktAuf } from '../ziel-fallback';
import type { BridgeZiel } from '../transports/streamlit';

// Der Ziel-Store ist ein Modul-Singleton (wie in ki-ziel.test.ts) — nach jedem
// Test auf den Default zurück, damit kein anderer Lauf 'agentisch' erbt.
afterEach(() => { useKiZiel.getState().setZiel('standard'); });

/** Protokolliert die `ziel`-Werte aller Versuche; `ergebnisse` je Versuch der Reihe nach. */
function laufMit(ergebnisse: Array<string | Error>): {
  lauf: (ziel: BridgeZiel | undefined) => Promise<string>;
  versuche: Array<BridgeZiel | undefined>;
} {
  const versuche: Array<BridgeZiel | undefined> = [];
  const lauf = async (ziel: BridgeZiel | undefined): Promise<string> => {
    const i = versuche.length;
    versuche.push(ziel);
    const e = ergebnisse[i] ?? 'ok';
    if (e instanceof Error) throw e;
    return e;
  };
  return { lauf, versuche };
}

const AGENTISCH = { zielWirkt: true } as const;

describe('zielWirktAuf', () => {
  it('nur die Streamlit-Bridge wertet ziel aus', () => {
    expect(zielWirktAuf({ name: 'Streamlit' })).toBe(true);
    expect(zielWirktAuf({ name: 'DirectLLM' })).toBe(false);
  });
});

describe('mitZielFallback — kein Fallback', () => {
  it('Praeferenz standard: ein Versuch mit undefined, kein Retry', async () => {
    const { lauf, versuche } = laufMit([new Error('kaputt')]);
    await expect(mitZielFallback(lauf, AGENTISCH)).rejects.toThrow('kaputt');
    expect(versuche).toEqual([undefined]);
  });

  it('zielWirkt false (DirectLLM): der zweite Lauf waere byte-identisch → kein Retry', async () => {
    useKiZiel.getState().setZiel('agentisch');
    const { lauf, versuche } = laufMit([new Error('kaputt')]);
    await expect(mitZielFallback(lauf, { zielWirkt: false })).rejects.toThrow('kaputt');
    expect(versuche).toEqual(['agentisch']);
  });

  it('Nutzer-Abbruch (AbortError) ist kein Ausfall → kein Retry', async () => {
    useKiZiel.getState().setZiel('agentisch');
    const abbruch = new DOMException('Aborted', 'AbortError');
    const { lauf, versuche } = laufMit([abbruch as unknown as Error]);
    await expect(mitZielFallback(lauf, AGENTISCH)).rejects.toThrow('Aborted');
    expect(versuche).toEqual(['agentisch']);
  });

  it('bereits abgebrochenes Signal → kein Retry', async () => {
    useKiZiel.getState().setZiel('agentisch');
    const ctrl = new AbortController();
    ctrl.abort();
    const { lauf, versuche } = laufMit([new Error('kaputt')]);
    await expect(mitZielFallback(lauf, { ...AGENTISCH, signal: ctrl.signal })).rejects.toThrow('kaputt');
    expect(versuche).toEqual(['agentisch']);
  });

  it('brauchbares Ergebnis bleibt unangetastet', async () => {
    useKiZiel.getState().setZiel('agentisch');
    const { lauf, versuche } = laufMit(['gut']);
    const r = await mitZielFallback(lauf, { ...AGENTISCH, istUnbrauchbar: (s) => s === '' });
    expect(r).toEqual({ result: 'gut', zielFallback: false });
    expect(versuche).toEqual(['agentisch']);
  });
});

describe('mitZielFallback — Fallback agentisch → standard', () => {
  it('Wurf im agentischen Versuch: genau ein Retry mit undefined', async () => {
    useKiZiel.getState().setZiel('agentisch');
    const { lauf, versuche } = laufMit([new Error('Tab weg'), 'gerettet']);
    const r = await mitZielFallback(lauf, AGENTISCH);
    expect(r).toEqual({ result: 'gerettet', zielFallback: true });
    expect(versuche).toEqual(['agentisch', undefined]);
  });

  it('unbrauchbares Ergebnis loest denselben Fallback aus', async () => {
    useKiZiel.getState().setZiel('agentisch');
    const { lauf, versuche } = laufMit(['', 'gerettet']);
    const r = await mitZielFallback(lauf, { ...AGENTISCH, istUnbrauchbar: (s) => s === '' });
    expect(r).toEqual({ result: 'gerettet', zielFallback: true });
    expect(versuche).toEqual(['agentisch', undefined]);
  });

  it('GENAU ein Retry — auch wenn der Standard-Lauf ebenfalls unbrauchbar ist', async () => {
    useKiZiel.getState().setZiel('agentisch');
    const { lauf, versuche } = laufMit(['', '']);
    const r = await mitZielFallback(lauf, { ...AGENTISCH, istUnbrauchbar: (s) => s === '' });
    expect(r).toEqual({ result: '', zielFallback: true });
    expect(versuche).toEqual(['agentisch', undefined]);
  });

  it('wirft der Retry, propagiert sein Fehler (kein dritter Versuch)', async () => {
    useKiZiel.getState().setZiel('agentisch');
    const { lauf, versuche } = laufMit([new Error('erst'), new Error('dann')]);
    await expect(mitZielFallback(lauf, AGENTISCH)).rejects.toThrow('dann');
    expect(versuche).toEqual(['agentisch', undefined]);
  });

  it('vorRetry laeuft genau einmal und VOR dem zweiten Versuch', async () => {
    useKiZiel.getState().setZiel('agentisch');
    const folge: string[] = [];
    const lauf = async (ziel: BridgeZiel | undefined): Promise<string> => {
      folge.push(`lauf:${ziel ?? 'standard'}`);
      if (ziel === 'agentisch') throw new Error('kaputt');
      return 'ok';
    };
    await mitZielFallback(lauf, { ...AGENTISCH, vorRetry: () => folge.push('reset') });
    expect(folge).toEqual(['lauf:agentisch', 'reset', 'lauf:standard']);
  });
});
