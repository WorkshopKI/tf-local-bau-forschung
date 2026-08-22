import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { findeKiFensterWieder, KI_WINDOW_NAME } from '../connect-ki';
import { StreamlitBridgeTransport } from '../transports/streamlit';

// Regression (v6.9.7): nach einem Reload des App-Tabs stand „Interne KI nicht
// verbunden" vor einer WEITERLAUFENDEN Bridge.
//
// Gemeldet als „wenn ich einen Browser-Refresh (F5) mache, kommt der Dialog
// wieder". Der Griff auf den KI-Tab lebt nur im Speicher der Seite (`event.source`
// einer eingehenden Bridge-Nachricht), und das Bookmarklet meldet sich nur EINMAL —
// beim Aktivieren (`tf-bridge-ready`). Ein Reload loescht den Griff, und niemand
// stellt ihn wieder her; der einzige Rueckweg war die Pille im KI-Tab, die per
// `tf-app-ping` von sich aus sendet. Genau das war der Umweg des Nutzers.
//
// Der Fix darf den Tab NICHT navigieren: ein `window.open` mit url laedt ihn neu
// und loescht dabei das injizierte Bookmarklet. Deshalb die leere url.

/** Der echte KI-Tab: fremde Origin, `location` ist nicht lesbar. */
function fremdesFenster(close: () => void): Window {
  const w = { close } as unknown as Window;
  Object.defineProperty(w, 'location', {
    get() { throw new Error('SecurityError: cross-origin'); },
  });
  return w;
}

/** Ein Leer-Tab, den der Aufruf selbst erzeugt hat (Popups erlaubt, Name unbekannt). */
function leererTab(close: () => void): Window {
  return { close, location: { href: 'about:blank' } } as unknown as Window;
}

let openSpy: ReturnType<typeof vi.fn>;
let closeSpy: Mock<() => void>;

beforeEach(() => {
  openSpy = vi.fn(() => null);
  closeSpy = vi.fn<() => void>();
  vi.stubGlobal('window', { addEventListener: vi.fn(), open: openSpy });
});

afterEach(() => { vi.unstubAllGlobals(); });

describe('findeKiFensterWieder — den ueberlebenden KI-Tab wieder aufnehmen', () => {
  it('sucht das benannte Fenster mit LEERER url (sonst wuerde es neu geladen)', () => {
    findeKiFensterWieder();
    expect(openSpy).toHaveBeenCalledWith('', KI_WINDOW_NAME);
  });

  it('fremde Origin → das ist der gesuchte Tab, er wird uebernommen', () => {
    const tab = fremdesFenster(closeSpy);
    openSpy.mockReturnValue(tab);
    expect(findeKiFensterWieder()).toBe(tab);
    expect(closeSpy).not.toHaveBeenCalled();
  });

  it('kein benanntes Fenster (Popup-Blocker liefert null) → null', () => {
    expect(findeKiFensterWieder()).toBeNull();
  });

  it('selbst erzeugter Leer-Tab → nicht uebernehmen UND wieder schliessen', () => {
    openSpy.mockReturnValue(leererTab(closeSpy));
    expect(findeKiFensterWieder()).toBeNull();
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });
});

describe('StreamlitBridgeTransport — Wiederaufnahme nach App-Reload', () => {
  it('ueberlebender KI-Tab → der frische Transport hat sofort ein lebendes Fenster', () => {
    openSpy.mockReturnValue(fremdesFenster(closeSpy));
    expect(new StreamlitBridgeTransport().hasLiveBridgeWindow()).toBe(true);
  });

  it('kein ueberlebender Tab → kein Fehlalarm „verbunden"', () => {
    expect(new StreamlitBridgeTransport().hasLiveBridgeWindow()).toBe(false);
  });
});
