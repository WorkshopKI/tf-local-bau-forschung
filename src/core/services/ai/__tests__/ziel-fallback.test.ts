import { describe, it, expect, afterEach } from 'vitest';
import { useKiZiel } from '../ki-ziel';
import { mitZielFallback, zielWirktAuf } from '../ziel-fallback';
import type { BridgeZiel } from '../transports/streamlit';

// Der Ziel-Store ist ein Modul-Singleton (wie in ki-ziel.test.ts) — nach jedem
// Test auf den Default zurück, damit kein anderer Lauf 'agentisch' erbt.
afterEach(() => { useKiZiel.getState().setZiel('standard'); });

/** Protokolliert die `ziel`-Werte aller Versuche; `ergebnisse` je Versuch der Reihe nach. */
function laufMit(ergebnisse: Array<string | Error>): {
  lauf: (ziel: BridgeZiel) => Promise<string>;
  versuche: BridgeZiel[];
} {
  const versuche: BridgeZiel[] = [];
  const lauf = async (ziel: BridgeZiel): Promise<string> => {
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
  it('Praeferenz standard: ein Versuch mit explizitem "standard", kein Retry', async () => {
    const { lauf, versuche } = laufMit([new Error('kaputt')]);
    await expect(mitZielFallback(lauf, AGENTISCH)).rejects.toThrow('kaputt');
    expect(versuche).toEqual(['standard']);
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
    expect(r).toEqual({ result: 'gut', zielFallback: false, ziel: 'agentisch' });
    expect(versuche).toEqual(['agentisch']);
  });
});

describe('mitZielFallback — Fallback agentisch → standard', () => {
  it('Wurf im agentischen Versuch: genau ein Retry mit explizitem "standard"', async () => {
    useKiZiel.getState().setZiel('agentisch');
    const { lauf, versuche } = laufMit([new Error('Tab weg'), 'gerettet']);
    const r = await mitZielFallback(lauf, AGENTISCH);
    expect(r).toEqual({ result: 'gerettet', zielFallback: true, ziel: 'standard' });
    expect(versuche).toEqual(['agentisch', 'standard']);
  });

  it('unbrauchbares Ergebnis loest denselben Fallback aus', async () => {
    useKiZiel.getState().setZiel('agentisch');
    const { lauf, versuche } = laufMit(['', 'gerettet']);
    const r = await mitZielFallback(lauf, { ...AGENTISCH, istUnbrauchbar: (s) => s === '' });
    expect(r).toEqual({ result: 'gerettet', zielFallback: true, ziel: 'standard' });
    expect(versuche).toEqual(['agentisch', 'standard']);
  });

  it('GENAU ein Retry — auch wenn der Standard-Lauf ebenfalls unbrauchbar ist', async () => {
    useKiZiel.getState().setZiel('agentisch');
    const { lauf, versuche } = laufMit(['', '']);
    const r = await mitZielFallback(lauf, { ...AGENTISCH, istUnbrauchbar: (s) => s === '' });
    expect(r).toEqual({ result: '', zielFallback: true, ziel: 'standard' });
    expect(versuche).toEqual(['agentisch', 'standard']);
  });

  it('wirft der Retry, propagiert sein Fehler (kein dritter Versuch)', async () => {
    useKiZiel.getState().setZiel('agentisch');
    const { lauf, versuche } = laufMit([new Error('erst'), new Error('dann')]);
    await expect(mitZielFallback(lauf, AGENTISCH)).rejects.toThrow('dann');
    expect(versuche).toEqual(['agentisch', 'standard']);
  });

  it('vorRetry laeuft genau einmal und VOR dem zweiten Versuch', async () => {
    useKiZiel.getState().setZiel('agentisch');
    const folge: string[] = [];
    const lauf = async (ziel: BridgeZiel): Promise<string> => {
      folge.push(`lauf:${ziel}`);
      if (ziel === 'agentisch') throw new Error('kaputt');
      return 'ok';
    };
    await mitZielFallback(lauf, { ...AGENTISCH, vorRetry: () => folge.push('reset') });
    expect(folge).toEqual(['lauf:agentisch', 'reset', 'lauf:standard']);
  });

  /**
   * Regression: der Retry rief `lauf(undefined)` — an der Bridge heisst das „aktiver
   * Tab", also derselbe agentische, dessen Ausfall den Fallback gerade ausgeloest hat.
   * Die Rettung wechselte die KI nie; das Badge „Standard-KI hat uebernommen" war
   * damit sachlich falsch. Fallbacks muessen ihr Ziel ausdruecklich nennen.
   */
  it('der Retry nennt sein Ziel — nie undefined (sonst bleibt er im agentischen Tab)', async () => {
    useKiZiel.getState().setZiel('agentisch');
    const { lauf, versuche } = laufMit([new Error('Tab weg'), 'gerettet']);
    await mitZielFallback(lauf, AGENTISCH);
    expect(versuche[1]).toBe('standard');
    expect(versuche.every(z => z !== undefined)).toBe(true);
  });
});
