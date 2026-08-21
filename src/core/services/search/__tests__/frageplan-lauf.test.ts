/**
 * Der KI-Lauf des Frageplans — geprüft werden die sechs Pflichten aus dem
 * Kopfkommentar von [frageplan-lauf.ts](src/core/services/search/frageplan-lauf.ts),
 * nicht die Übersetzungsqualität (die misst kein Unit-Test).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const kiVerbindungGeprueft = vi.fn(async (_b: unknown, _n?: string) => true);
const dialogGeoeffnet = vi.fn();
vi.mock('@/core/services/ai/ki-guard', async (echt) => {
  // `istVerbindungsFehler` bewusst ECHT: sie ist die Regel, die hier geprüft
  // wird. Nur die beiden Seiteneffekte (Preflight, Dialog) sind Attrappen.
  const original = await echt<typeof import('@/core/services/ai/ki-guard')>();
  return {
    istVerbindungsFehler: original.istVerbindungsFehler,
    kiVerbindungGeprueft: (b: unknown, n?: string) => kiVerbindungGeprueft(b, n),
    useKiConnectPrompt: { getState: () => ({ oeffnen: dialogGeoeffnet }) },
  };
});

import { ermittleFrageplan, FRAGEPLAN_MELDUNG } from '../frageplan-lauf';
import type { AIBridge } from '@/core/services/ai/bridge';

const GUELTIG = JSON.stringify({
  begriffe: [{ begriff: 'Normung', nadeln: ['normung', 'normen'] }],
});

/** Aufzeichnung der Reihenfolge — „Reset VOR Submit" ist eine Reihenfolge-Zusage. */
let ablauf: string[] = [];
let resetZiel: unknown;
let submitArgs: unknown[] = [];

function baueTransport(antwort: string | Error) {
  return {
    name: 'Streamlit',
    resetChat: vi.fn(async (ziel?: unknown) => {
      ablauf.push('reset');
      resetZiel = ziel;
      return 'ok';
    }),
    submitMessage: vi.fn(async (...args: unknown[]) => {
      ablauf.push('submit');
      submitArgs = args;
      if (antwort instanceof Error) throw antwort;
      return antwort;
    }),
    ping: vi.fn(async () => true),
  };
}

function baueBridge(transport: unknown, wirft?: Error): AIBridge {
  return {
    getTransportForDatenLauf: vi.fn(() => {
      if (wirft) throw wirft;
      return transport;
    }),
  } as unknown as AIBridge;
}

beforeEach(() => {
  ablauf = [];
  submitArgs = [];
  resetZiel = undefined;
  kiVerbindungGeprueft.mockResolvedValue(true);
  dialogGeoeffnet.mockClear();
});

describe('ermittleFrageplan — der glückliche Fall', () => {
  it('liefert den geparsten Plan', async () => {
    const res = await ermittleFrageplan(baueBridge(baueTransport(GUELTIG)), 'Normung?', 2026);
    expect(res.ok).toBe(true);
    expect(res.ok && res.plan.leitbegriffe[0]?.begriff).toBe('Normung');
  });

  it('setzt den frischen Chat VOR dem Submit (Pitfall #36)', async () => {
    await ermittleFrageplan(baueBridge(baueTransport(GUELTIG)), 'Normung?', 2026);
    expect(ablauf).toEqual(['reset', 'submit']);
  });

  it('pinnt BEIDE Aufrufe auf gpt-oss', async () => {
    // `undefined` hiesse an der Bridge „aktiver Tab" — womöglich der agentische.
    await ermittleFrageplan(baueBridge(baueTransport(GUELTIG)), 'Normung?', 2026);
    expect(resetZiel).toBe('gpt-oss');
    expect((submitArgs[2] as { ziel?: string }).ziel).toBe('gpt-oss');
  });

  it('inlined den System-Prompt in die Message und reicht ihn zusätzlich durch', async () => {
    // Die Bridge verwirft den zweiten Parameter; DirectLLM nutzt ihn als System-Rolle.
    await ermittleFrageplan(baueBridge(baueTransport(GUELTIG)), 'Normung?', 2026);
    const message = submitArgs[0] as string;
    const system = submitArgs[1] as string;
    expect(message.startsWith(system)).toBe(true);
    expect(message).toContain('Normung?');
    expect(system).not.toContain('Normung?');
  });

  it('ruft genau EINMAL auf', async () => {
    const t = baueTransport(GUELTIG);
    await ermittleFrageplan(baueBridge(t), 'Normung?', 2026);
    expect(t.submitMessage).toHaveBeenCalledTimes(1);
  });
});

describe('ermittleFrageplan — Fehlerfälle enden als Ergebnis, nicht als Wurf', () => {
  it('fängt den Wurf der Transport-Policy bei externem Provider ab', async () => {
    const t = baueTransport(GUELTIG);
    const bridge = baueBridge(t, new Error('DSGVO-Transport-Policy: … ist extern.'));
    const res = await ermittleFrageplan(bridge, 'Normung?', 2026);
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.fehler).toContain('extern');
    expect(t.submitMessage).not.toHaveBeenCalled();
  });

  it('bricht ab, wenn die interne KI nicht verbunden ist — ohne Submit', async () => {
    kiVerbindungGeprueft.mockResolvedValue(false);
    const t = baueTransport(GUELTIG);
    const res = await ermittleFrageplan(baueBridge(t), 'Normung?', 2026);
    expect(res.ok === false && res.verbindungFehlt).toBe(true);
    expect(t.resetChat).not.toHaveBeenCalled();
    expect(t.submitMessage).not.toHaveBeenCalled();
  });

  it('meldet kaputtes JSON und wiederholt NICHT', async () => {
    const t = baueTransport('Tut mir leid, dazu fällt mir nichts ein.');
    const res = await ermittleFrageplan(baueBridge(t), 'Normung?', 2026);
    expect(res.ok === false && res.fehler).toBe(FRAGEPLAN_MELDUNG.keinPlan);
    expect(t.submitMessage).toHaveBeenCalledTimes(1);
  });

  it('reicht einen Transport-Fehler als Meldung durch, statt zu werfen', async () => {
    const t = baueTransport(new Error('Bridge-Timeout'));
    const res = await ermittleFrageplan(baueBridge(t), 'Normung?', 2026);
    expect(res.ok === false && res.fehler).toContain('Bridge-Timeout');
    // Ein Modell-/Zeitfehler ist KEIN Verbindungsfehler — kein Dialog.
    expect(dialogGeoeffnet).not.toHaveBeenCalled();
  });

  it('macht aus „Failed to fetch" die Verbinden-Aufforderung, nicht die Browser-Meldung', async () => {
    // Gemeldet aus dev:local: der lokale Server war aus, der Nutzer las „Failed
    // to fetch" statt zu erfahren, dass er die KI verbinden soll. Der Preflight
    // fängt den Normalfall, DIESER Pfad den Ausfall zwischen Ping und Antwort.
    const t = baueTransport(new TypeError('Failed to fetch'));
    const res = await ermittleFrageplan(baueBridge(t), 'Normung?', 2026);
    expect(res.ok === false && res.verbindungFehlt).toBe(true);
    expect(res.ok === false && res.fehler).toBe(FRAGEPLAN_MELDUNG.nichtVerbunden);
    expect(res.ok === false && res.fehler).not.toContain('Failed to fetch');
    expect(dialogGeoeffnet).toHaveBeenCalledTimes(1);
  });

  it('lehnt eine leere Frage ab, ohne die Bridge anzufassen', async () => {
    const t = baueTransport(GUELTIG);
    const bridge = baueBridge(t);
    const res = await ermittleFrageplan(bridge, '   ', 2026);
    expect(res.ok === false && res.fehler).toBe(FRAGEPLAN_MELDUNG.leer);
    expect(bridge.getTransportForDatenLauf).not.toHaveBeenCalled();
  });

  it('meldet einen Abbruch als Abbruch, nicht als Modellfehler', async () => {
    const ctrl = new AbortController();
    const t = baueTransport(new Error('aborted'));
    t.resetChat = vi.fn(async () => { ctrl.abort(); return 'ok'; });
    const res = await ermittleFrageplan(baueBridge(t), 'Normung?', 2026, ctrl.signal);
    expect(res.ok === false && res.fehler).toBe(FRAGEPLAN_MELDUNG.abgebrochen);
    expect(t.submitMessage).not.toHaveBeenCalled();
  });
});
