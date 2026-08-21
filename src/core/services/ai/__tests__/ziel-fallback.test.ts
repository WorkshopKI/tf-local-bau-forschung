import { describe, it, expect, afterEach } from 'vitest';
import { useKiZiel } from '../ki-ziel';
import { mitZielFallback, zielWirktAuf } from '../ziel-fallback';
import type { BridgeZiel } from '../transports/streamlit';

// Der Ziel-Store ist ein Modul-Singleton (wie in ki-ziel.test.ts) — nach jedem
// Test auf den Default zurück, damit kein anderer Lauf 'qwen35' erbt.
afterEach(() => { useKiZiel.getState().setZiel('gpt-oss'); });

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
    expect(versuche).toEqual(['gpt-oss']);
  });

  it('zielWirkt false (DirectLLM): der zweite Lauf waere byte-identisch → kein Retry', async () => {
    useKiZiel.getState().setZiel('qwen35');
    const { lauf, versuche } = laufMit([new Error('kaputt')]);
    await expect(mitZielFallback(lauf, { zielWirkt: false })).rejects.toThrow('kaputt');
    expect(versuche).toEqual(['qwen35']);
  });

  it('Nutzer-Abbruch (AbortError) ist kein Ausfall → kein Retry', async () => {
    useKiZiel.getState().setZiel('qwen35');
    const abbruch = new DOMException('Aborted', 'AbortError');
    const { lauf, versuche } = laufMit([abbruch as unknown as Error]);
    await expect(mitZielFallback(lauf, AGENTISCH)).rejects.toThrow('Aborted');
    expect(versuche).toEqual(['qwen35']);
  });

  it('bereits abgebrochenes Signal → kein Retry', async () => {
    useKiZiel.getState().setZiel('qwen35');
    const ctrl = new AbortController();
    ctrl.abort();
    const { lauf, versuche } = laufMit([new Error('kaputt')]);
    await expect(mitZielFallback(lauf, { ...AGENTISCH, signal: ctrl.signal })).rejects.toThrow('kaputt');
    expect(versuche).toEqual(['qwen35']);
  });

  it('brauchbares Ergebnis bleibt unangetastet', async () => {
    useKiZiel.getState().setZiel('qwen35');
    const { lauf, versuche } = laufMit(['gut']);
    const r = await mitZielFallback(lauf, { ...AGENTISCH, istUnbrauchbar: (s) => s === '' });
    expect(r).toEqual({ result: 'gut', zielFallback: false, ziel: 'qwen35' });
    expect(versuche).toEqual(['qwen35']);
  });
});

describe('mitZielFallback — Fallback agentisch → standard', () => {
  it('Wurf im agentischen Versuch: genau ein Retry mit explizitem "standard"', async () => {
    useKiZiel.getState().setZiel('qwen35');
    const { lauf, versuche } = laufMit([new Error('Tab weg'), 'gerettet']);
    const r = await mitZielFallback(lauf, AGENTISCH);
    expect(r).toEqual({ result: 'gerettet', zielFallback: true, ziel: 'gpt-oss' });
    expect(versuche).toEqual(['qwen35', 'gpt-oss']);
  });

  it('unbrauchbares Ergebnis loest denselben Fallback aus', async () => {
    useKiZiel.getState().setZiel('qwen35');
    const { lauf, versuche } = laufMit(['', 'gerettet']);
    const r = await mitZielFallback(lauf, { ...AGENTISCH, istUnbrauchbar: (s) => s === '' });
    expect(r).toEqual({ result: 'gerettet', zielFallback: true, ziel: 'gpt-oss' });
    expect(versuche).toEqual(['qwen35', 'gpt-oss']);
  });

  it('GENAU ein Retry — auch wenn der Standard-Lauf ebenfalls unbrauchbar ist', async () => {
    useKiZiel.getState().setZiel('qwen35');
    const { lauf, versuche } = laufMit(['', '']);
    const r = await mitZielFallback(lauf, { ...AGENTISCH, istUnbrauchbar: (s) => s === '' });
    expect(r).toEqual({ result: '', zielFallback: true, ziel: 'gpt-oss' });
    expect(versuche).toEqual(['qwen35', 'gpt-oss']);
  });

  it('wirft der Retry, propagiert sein Fehler (kein dritter Versuch)', async () => {
    useKiZiel.getState().setZiel('qwen35');
    const { lauf, versuche } = laufMit([new Error('erst'), new Error('dann')]);
    await expect(mitZielFallback(lauf, AGENTISCH)).rejects.toThrow('dann');
    expect(versuche).toEqual(['qwen35', 'gpt-oss']);
  });

  it('vorRetry laeuft genau einmal und VOR dem zweiten Versuch', async () => {
    useKiZiel.getState().setZiel('qwen35');
    const folge: string[] = [];
    const lauf = async (ziel: BridgeZiel): Promise<string> => {
      folge.push(`lauf:${ziel}`);
      if (ziel === 'qwen35') throw new Error('kaputt');
      return 'ok';
    };
    await mitZielFallback(lauf, { ...AGENTISCH, vorRetry: () => folge.push('reset') });
    expect(folge).toEqual(['lauf:qwen35', 'reset', 'lauf:gpt-oss']);
  });

  /**
   * Regression: der Retry rief `lauf(undefined)` — an der Bridge heisst das „aktiver
   * Tab", also derselbe agentische, dessen Ausfall den Fallback gerade ausgeloest hat.
   * Die Rettung wechselte die KI nie; das Badge „gpt-oss-120b hat uebernommen" war
   * damit sachlich falsch. Fallbacks muessen ihr Ziel ausdruecklich nennen.
   */
  it('der Retry nennt sein Ziel — nie undefined (sonst bleibt er im Qwen3.6-Modell)', async () => {
    useKiZiel.getState().setZiel('qwen35');
    const { lauf, versuche } = laufMit([new Error('Tab weg'), 'gerettet']);
    await mitZielFallback(lauf, AGENTISCH);
    expect(versuche[1]).toBe('gpt-oss');
    expect(versuche.every(z => z !== undefined)).toBe(true);
  });
});

/**
 * Erzwungenes Ziel („Zweitfassung mit der anderen KI"). Der Fallback muss dabei
 * AUS sein: wer ausdrücklich die andere KI verlangt, bekäme sonst bei deren Ausfall
 * still die Fassung der ersten zurück — und verglichen würde eine Fassung mit sich
 * selbst.
 */
describe('mitZielFallback — zielOverride', () => {
  it('benutzt das erzwungene Ziel statt der Präferenz', async () => {
    useKiZiel.getState().setZiel('gpt-oss');
    const { lauf, versuche } = laufMit(['ok']);
    const r = await mitZielFallback(lauf, { ...AGENTISCH, zielOverride: 'qwen35' });
    expect(versuche).toEqual(['qwen35']);
    expect(r.ziel).toBe('qwen35');
    expect(r.zielFallback).toBe(false);
  });

  it('macht KEINEN Retry, wenn der erzwungene Lauf wirft', async () => {
    useKiZiel.getState().setZiel('gpt-oss');
    const { lauf, versuche } = laufMit([new Error('Tab weg'), 'gerettet']);
    await expect(mitZielFallback(lauf, { ...AGENTISCH, zielOverride: 'qwen35' })).rejects.toThrow('Tab weg');
    expect(versuche).toEqual(['qwen35']);
  });

  it('macht KEINEN Retry bei unbrauchbarem Ergebnis', async () => {
    useKiZiel.getState().setZiel('gpt-oss');
    const { lauf, versuche } = laufMit(['', 'gerettet']);
    const r = await mitZielFallback(lauf, {
      ...AGENTISCH, zielOverride: 'qwen35', istUnbrauchbar: (s) => s === '',
    });
    expect(versuche).toEqual(['qwen35']);
    expect(r.result).toBe('');
  });

  it('ohne Override bleibt alles beim Alten (Präferenz + Fallback)', async () => {
    useKiZiel.getState().setZiel('qwen35');
    const { lauf, versuche } = laufMit([new Error('Tab weg'), 'gerettet']);
    const r = await mitZielFallback(lauf, AGENTISCH);
    expect(versuche).toEqual(['qwen35', 'gpt-oss']);
    expect(r.zielFallback).toBe(true);
  });
});
