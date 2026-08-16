/**
 * Die KI-Prüfung der Wortform-Chips.
 *
 * Geprüft wird die Robustheit gegen die Antwort, nicht die Urteilsqualität —
 * die misst kein Unit-Test. Der teuerste Fehler wäre, dass eine schlechte
 * Antwort dem Nutzer stillschweigend Treffer nimmt; dagegen sind die meisten
 * Fälle hier geschrieben.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const kiVerbindungGeprueft = vi.fn(async (_b: unknown, _n?: string) => true);
const dialogGeoeffnet = vi.fn();
vi.mock('@/core/services/ai/ki-guard', async (echt) => {
  const original = await echt<typeof import('@/core/services/ai/ki-guard')>();
  return {
    istVerbindungsFehler: original.istVerbindungsFehler,
    kiVerbindungGeprueft: (b: unknown, n?: string) => kiVerbindungGeprueft(b, n),
    useKiConnectPrompt: { getState: () => ({ oeffnen: dialogGeoeffnet }) },
  };
});

import {
  pruefeWortformen,
  leseAussortierte,
  bauePruefPrompt,
  PRUEF_MELDUNG,
} from '../wortformen-pruefung';
import type { AIBridge } from '@/core/services/ai/bridge';

const KANDIDATEN = ['Normung', 'Normen', 'normotherme', 'Sicherheitsnormen', 'normale'];

let ablauf: string[] = [];
let submitArgs: unknown[] = [];

function baueTransport(antwort: string | Error) {
  return {
    name: 'Streamlit',
    resetChat: vi.fn(async (_ziel?: unknown) => { ablauf.push('reset'); return 'ok'; }),
    submitMessage: vi.fn(async (...args: unknown[]) => {
      ablauf.push('submit');
      submitArgs = args;
      if (antwort instanceof Error) throw antwort;
      return antwort;
    }),
    ping: vi.fn(async () => true),
  };
}

function baueBridge(transport: unknown): AIBridge {
  return { getTransportForDatenLauf: vi.fn(() => transport) } as unknown as AIBridge;
}

beforeEach(() => {
  ablauf = [];
  submitArgs = [];
  kiVerbindungGeprueft.mockResolvedValue(true);
  dialogGeoeffnet.mockClear();
});

describe('leseAussortierte — die Antwort darf nie mehr dürfen als die Liste hergibt', () => {
  it('nimmt die genannten Wörter', () => {
    expect(leseAussortierte('normotherme\nnormale', KANDIDATEN))
      .toEqual(['normotherme', 'normale']);
  });

  it('vergleicht ohne Rücksicht auf Groß-/Kleinschreibung, liefert aber die Schreibweise der Liste', () => {
    expect(leseAussortierte('NORMOTHERME', KANDIDATEN)).toEqual(['normotherme']);
  });

  it('räumt Aufzählungszeichen und Nummern weg', () => {
    expect(leseAussortierte('- normotherme\n2. normale', KANDIDATEN))
      .toEqual(['normotherme', 'normale']);
  });

  it('ignoriert erfundene Wörter — aussortiert wird nur, was es gab', () => {
    expect(leseAussortierte('normotherme\nQuatschwort\nnoch eins', KANDIDATEN))
      .toEqual(['normotherme']);
  });

  it('„KEINE" heißt: alles passt', () => {
    expect(leseAussortierte('KEINE', KANDIDATEN)).toEqual([]);
  });

  it('unverwertbares Geschwätz ändert NICHTS, statt alles zu behalten oder zu werfen', () => {
    // `null` heißt „nicht anwenden" — der Aufrufer meldet und lässt die Liste stehen.
    expect(leseAussortierte('Gerne! Ich habe mir die Liste angesehen.', KANDIDATEN)).toBeNull();
    expect(leseAussortierte('', KANDIDATEN)).toBeNull();
  });

  it('eine Antwort, die ALLES aussortiert, gilt als umgedrehte Aufgabe', () => {
    // Der teuerste Fehlerfall: das Modell nennt die passenden statt der
    // unpassenden. Angewandt nähme das dem Nutzer die ganze Trefferliste.
    expect(leseAussortierte(KANDIDATEN.join('\n'), KANDIDATEN)).toBeNull();
  });
});

describe('bauePruefPrompt', () => {
  it('nennt die Suchwörter und jeden Kandidaten', () => {
    const { systemPrompt, userPrompt } = bauePruefPrompt(['Normen'], KANDIDATEN);
    expect(userPrompt).toContain('Normen');
    for (const k of KANDIDATEN) expect(userPrompt).toContain(k);
    expect(systemPrompt).toContain('KEINE');
  });

  it('führt keine Beispiel-Liste — ein Modell, das die Schablone wiederholt, lieferte sonst sie', () => {
    const { systemPrompt } = bauePruefPrompt(['Normen'], KANDIDATEN);
    expect(systemPrompt).not.toContain('[');
    expect(systemPrompt).not.toContain('{');
  });
});

describe('pruefeWortformen — die Pflichten des Laufs', () => {
  it('setzt den frischen Chat VOR dem Submit (Pitfall #36)', async () => {
    await pruefeWortformen(baueBridge(baueTransport('normotherme')), ['Normen'], KANDIDATEN);
    expect(ablauf).toEqual(['reset', 'submit']);
  });

  it('pinnt den Aufruf auf den Standard-Tab', async () => {
    await pruefeWortformen(baueBridge(baueTransport('normotherme')), ['Normen'], KANDIDATEN);
    expect((submitArgs[2] as { ziel?: string }).ziel).toBe('standard');
  });

  it('ruft genau EINMAL auf und wiederholt bei unverwertbarer Antwort nicht', async () => {
    const t = baueTransport('Da kann ich leider nichts zu sagen.');
    const res = await pruefeWortformen(baueBridge(t), ['Normen'], KANDIDATEN);
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.fehler).toBe(PRUEF_MELDUNG.unverstaendlich);
    expect(t.submitMessage).toHaveBeenCalledTimes(1);
  });

  it('bricht ohne Verbindung ab — ohne Submit', async () => {
    kiVerbindungGeprueft.mockResolvedValue(false);
    const t = baueTransport('normotherme');
    const res = await pruefeWortformen(baueBridge(t), ['Normen'], KANDIDATEN);
    expect(res.ok === false && res.verbindungFehlt).toBe(true);
    expect(t.submitMessage).not.toHaveBeenCalled();
  });

  it('macht aus „Failed to fetch" die Verbinden-Aufforderung', async () => {
    const t = baueTransport(new TypeError('Failed to fetch'));
    const res = await pruefeWortformen(baueBridge(t), ['Normen'], KANDIDATEN);
    expect(res.ok === false && res.verbindungFehlt).toBe(true);
    expect(dialogGeoeffnet).toHaveBeenCalledTimes(1);
  });

  it('fasst die Bridge ohne Kandidaten gar nicht erst an', async () => {
    const bridge = baueBridge(baueTransport('x'));
    const res = await pruefeWortformen(bridge, ['Normen'], []);
    expect(res.ok === false && res.fehler).toBe(PRUEF_MELDUNG.leer);
    expect(bridge.getTransportForDatenLauf).not.toHaveBeenCalled();
  });
});
