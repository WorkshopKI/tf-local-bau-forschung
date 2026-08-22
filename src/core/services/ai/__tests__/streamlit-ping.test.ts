import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Regression: ein VERFÜGBARKEITS-Ping darf die Streamlit-Bridge NICHT öffnen.
// Bug: das Öffnen einer Verbund-Detailseite mit generierten Abschnitten poppte
// ungefragt den KI-Tab (window.open auf https://gpt.vdivde-it.de/) auf, weil die
// Mount-Probe `ping()` über `ensureConnection()` bedingungslos `window.open` rief.
// Fix: passiver Ping (`{ openIfNeeded: false }`) pingt nur ein bereits offenes
// Fenster und öffnet selbst keins.

// StreamlitBridgeTransport registriert im Konstruktor einen `window`-message-Listener
// und ruft beim aktiven Ping `window.open` — im node-Test-Env fehlt `window`. Pro Test
// ein frischer Stub mit Spy auf `open`.
let openSpy: ReturnType<typeof vi.fn>;
let addListenerSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  openSpy = vi.fn(() => null);
  addListenerSpy = vi.fn();
  vi.stubGlobal('window', { addEventListener: addListenerSpy, open: openSpy });
  useBridgeStatus.getState().reset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

import { StreamlitBridgeTransport } from '../transports/streamlit';
import { useBridgeStatus } from '../bridge-status';

describe('StreamlitBridgeTransport.ping — passiver vs. aktiver Check', () => {
  it('passiv (openIfNeeded: false) ohne offenes Fenster → false UND kein window.open', async () => {
    const transport = new StreamlitBridgeTransport();
    const ok = await transport.ping({ openIfNeeded: false });
    expect(ok).toBe(false);
    // Gemessen wird „kein Tab geht auf" — nicht „`window.open` bleibt ungerufen".
    // Seit v6.9.7 sucht der Konstruktor einmal nach einem ueberlebenden KI-Tab, und
    // zwar mit LEERER url: dieser Aufruf navigiert nichts und oeffnet nichts (er
    // liefert `null`, wenn es das benannte Fenster nicht gibt). Ein Aufruf MIT url
    // wuerde dagegen genau den Popup ausloesen, den dieser Test verbietet.
    expect(openSpy.mock.calls.filter(([url]) => url !== '')).toHaveLength(0);
  });

  it('aktiv (Default) → öffnet das Bridge-Fenster (window.open)', async () => {
    vi.useFakeTimers();
    const transport = new StreamlitBridgeTransport();
    // Kein Pong → läuft in den 5-s-Timeout (→ false). Uns interessiert nur, DASS
    // window.open gerufen wurde (Default-Verhalten der Nutzer-Gesten bleibt erhalten).
    const pending = transport.ping();
    await vi.advanceTimersByTimeAsync(5001);
    expect(openSpy).toHaveBeenCalledWith('https://gpt.vdivde-it.de/', 'teamflow-streamlit');
    await expect(pending).resolves.toBe(false);
  });
});

// Regression (v6.9.5): „Interne KI nicht verbunden" bei LEBENDER Bridge.
//
// Gemeldet als „das Fenster kommt öfters, obwohl die KI verbunden ist; ich klicke
// im KI-Tab auf die Pille und die App meldet wieder verbunden". Der Klick ist kein
// Neuverbinden — er schickt bloss IRGENDEINE Inbound-Nachricht, und die setzt den
// Status ueber `markActivity()` zurueck auf `connected`. Die Verbindung war nie weg.
//
// Ursache: Pings lagen im `pending`-Register unter dem FESTEN Schluessel 'ping' —
// ein einziger Platz. Zwei Proben ueberlappen im Betrieb regelmaessig (der
// Heartbeat probt alle ~15 s, und JEDE KI-Aktion probt ueber `kiVerbindungGeprueft`
// noch einmal selbst). Die zweite ueberschrieb die erste, ohne deren Timeout zu
// loeschen; der verwaiste Timeout raeumte dann den Platz der ZWEITEN Probe weg.
// Ein `tf-pong` traegt keine id (das Bookmarklet antwortet unadressiert) und kann
// den Verlust nicht heilen: es fand einen leeren Platz vor.
describe('StreamlitBridgeTransport.ping — gleichzeitige Proben', () => {
  function makeTransport(): {
    transport: StreamlitBridgeTransport;
    pong: () => void;
  } {
    const transport = new StreamlitBridgeTransport();
    const call = addListenerSpy.mock.calls.find(c => c[0] === 'message');
    if (!call) throw new Error('message-Listener nicht registriert');
    const listener = call[1] as (event: unknown) => void;
    const tab = { closed: false, postMessage: vi.fn() };
    const emit = (data: Record<string, unknown>): void =>
      listener({ origin: 'https://gpt.vdivde-it.de', source: tab, data });
    emit({ type: 'tf-bridge-ready' }); // Fenster-Handle capturen
    return { transport, pong: () => emit({ type: 'tf-pong', rev: 'interne-KI v2' }) };
  }

  it('EIN tf-pong beantwortet ALLE offenen Proben (es traegt keine id)', async () => {
    vi.useFakeTimers();
    const { transport, pong } = makeTransport();

    const heartbeat = transport.ping({ openIfNeeded: false });
    await vi.advanceTimersByTimeAsync(1_000);
    const aktion = transport.ping({ openIfNeeded: false });
    await vi.advanceTimersByTimeAsync(0);

    pong();
    // Ueber beide 5-s-Fristen hinaus weiterlaufen lassen: sonst haengt eine
    // verhungerte Probe bis zum Test-Timeout, statt ihr `false` zu zeigen.
    await vi.advanceTimersByTimeAsync(6_000);

    await expect(aktion).resolves.toBe(true);
    await expect(heartbeat).resolves.toBe(true);
  });

  it('die auslaufende Probe reisst die juengere NICHT mit (der Nutzer-Fall)', async () => {
    vi.useFakeTimers();
    const { transport, pong } = makeTransport();

    // t=0 Heartbeat-Probe, t=4 s die Probe vor einer KI-Aktion.
    const heartbeat = transport.ping({ openIfNeeded: false });
    await vi.advanceTimersByTimeAsync(4_000);
    const aktion = transport.ping({ openIfNeeded: false });

    // t=5 s: der Heartbeat laeuft aus — er darf nur sich selbst aufgeben.
    await vi.advanceTimersByTimeAsync(1_100);
    await expect(heartbeat).resolves.toBe(false);

    // Kurz darauf antwortet die Bridge. Die Aktion muss durchkommen, sonst
    // steht der Verbinden-Dialog vor einer lebenden KI.
    pong();
    await vi.advanceTimersByTimeAsync(6_000);
    await expect(aktion).resolves.toBe(true);
    expect(useBridgeStatus.getState().status).toBe('connected');
  });

  it('nach einem tf-pong kippt kein verwaister Timeout den Status auf getrennt', async () => {
    vi.useFakeTimers();
    const { transport, pong } = makeTransport();

    const heartbeat = transport.ping({ openIfNeeded: false });
    await vi.advanceTimersByTimeAsync(1_000);
    const aktion = transport.ping({ openIfNeeded: false });
    await vi.advanceTimersByTimeAsync(0);
    pong();
    await vi.advanceTimersByTimeAsync(6_000);
    await expect(aktion).resolves.toBe(true);
    await expect(heartbeat).resolves.toBe(true);

    // Weit ueber die 5-s-Frist beider Proben hinaus: der Beweis fuer Leben ist
    // erbracht, es darf nichts mehr nachtraeglich auf `disconnected` schalten.
    await vi.advanceTimersByTimeAsync(10_000);
    expect(useBridgeStatus.getState().status).toBe('connected');
  });
});
