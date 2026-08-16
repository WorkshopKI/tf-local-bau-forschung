/**
 * Der Preflight vor jedem KI-Lauf.
 *
 * Anlass ist ein gemeldeter Fall aus `dev:local` (v4.68): Der Nutzer stellte im
 * Frage-Modus eine Frage, der lokale llama.cpp-Server lief nicht — und statt der
 * Verbinden-Aufforderung stand „Failed to fetch" unter dem Suchfeld. Grund war
 * eine Zeile in `kiVerbindungGeprueft`: `if (name !== 'Streamlit') return true;`.
 * Jeder direkte Server lief also ungeprüft durch, und der rohe `fetch`-Fehler
 * wurde zur Fehlermeldung der Oberfläche.
 *
 * Diese Datei hält die Regel fest, die daraus folgt: **geprüft wird der
 * Transport, der den Lauf fährt — egal wie er heißt.**
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { kiVerbindungGeprueft, istVerbindungsFehler, useKiConnectPrompt } from '../ki-guard';
import type { AIBridge } from '../bridge';

function baueTransport(name: string, erreichbar: boolean | Error) {
  return {
    name,
    ping: vi.fn(async () => {
      if (erreichbar instanceof Error) throw erreichbar;
      return erreichbar;
    }),
  };
}

/** Bridge-Attrappe: aktiver und persistenter Streamlit-Transport getrennt. */
function baueBridge(aktiv: ReturnType<typeof baueTransport>, streamlit = aktiv): AIBridge {
  return {
    getActiveTransport: () => aktiv,
    getStreamlitTransport: () => streamlit,
  } as unknown as AIBridge;
}

beforeEach(() => {
  useKiConnectPrompt.setState({ offen: false });
});

describe('kiVerbindungGeprueft — geprüft wird der Transport, der laufen soll', () => {
  it('Bridge erreichbar → darf laufen, kein Dialog', async () => {
    const t = baueTransport('Streamlit', true);
    expect(await kiVerbindungGeprueft(baueBridge(t), 'Streamlit')).toBe(true);
    expect(useKiConnectPrompt.getState().offen).toBe(false);
  });

  it('Bridge tot → blockt und öffnet den Verbinden-Dialog', async () => {
    const t = baueTransport('Streamlit', false);
    expect(await kiVerbindungGeprueft(baueBridge(t), 'Streamlit')).toBe(false);
    expect(useKiConnectPrompt.getState().offen).toBe(true);
  });

  it('lokaler Server tot → blockt EBENFALLS (der gemeldete Fall)', async () => {
    // Vor v4.68 gab diese Zeile `true` zurück, ohne zu fragen — und der Nutzer
    // bekam statt der Aufforderung den Browser-Text „Failed to fetch".
    const t = baueTransport('llama.cpp', false);
    expect(await kiVerbindungGeprueft(baueBridge(t), 'llama.cpp')).toBe(false);
    expect(useKiConnectPrompt.getState().offen).toBe(true);
    expect(t.ping).toHaveBeenCalledTimes(1);
  });

  it('lokaler Server erreichbar → darf laufen', async () => {
    const t = baueTransport('llama.cpp', true);
    expect(await kiVerbindungGeprueft(baueBridge(t), 'llama.cpp')).toBe(true);
    expect(useKiConnectPrompt.getState().offen).toBe(false);
  });

  it('wirft der Ping, gilt das als „nicht erreichbar" — nicht als „egal"', async () => {
    const t = baueTransport('llama.cpp', new TypeError('Failed to fetch'));
    expect(await kiVerbindungGeprueft(baueBridge(t), 'llama.cpp')).toBe(false);
    expect(useKiConnectPrompt.getState().offen).toBe(true);
  });

  it('pingt PASSIV — der Preflight darf kein Fenster aufreißen', async () => {
    const t = baueTransport('Streamlit', true);
    await kiVerbindungGeprueft(baueBridge(t), 'Streamlit');
    expect(t.ping).toHaveBeenCalledWith({ openIfNeeded: false });
  });

  it('nimmt bei der Bridge den PERSISTENTEN Transport, nicht den aktiven', async () => {
    // Nur er trägt das Fenster-Handle aus dem `tf-bridge-ready`-Announce.
    const aktiv = baueTransport('Streamlit', false);
    const persistent = baueTransport('Streamlit', true);
    expect(await kiVerbindungGeprueft(baueBridge(aktiv, persistent), 'Streamlit')).toBe(true);
    expect(persistent.ping).toHaveBeenCalledTimes(1);
    expect(aktiv.ping).not.toHaveBeenCalled();
  });

  it('ohne Namen den aktiven Transport befragen', async () => {
    const t = baueTransport('llama.cpp', false);
    expect(await kiVerbindungGeprueft(baueBridge(t))).toBe(false);
    expect(t.ping).toHaveBeenCalledTimes(1);
  });
});

describe('istVerbindungsFehler — trennt „nicht erreichbar" von „schlecht geantwortet"', () => {
  it.each([
    new TypeError('Failed to fetch'),
    new TypeError('NetworkError when attempting to fetch resource.'),
    new TypeError('Load failed'),
    new Error('fetch failed'),
    new Error('connect ECONNREFUSED 127.0.0.1:8081'),
  ])('erkennt %s', (err) => {
    expect(istVerbindungsFehler(err)).toBe(true);
  });

  it.each([
    new Error('API error: 500 — internal'),
    new Error('Bridge-Timeout'),
    new Error('DSGVO-Transport-Policy: … ist extern.'),
    'irgendein Text',
  ])('lässt %s in Ruhe', (err) => {
    expect(istVerbindungsFehler(err)).toBe(false);
  });
});
