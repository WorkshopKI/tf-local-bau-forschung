/**
 * Was die interne KI anbietet und was wir an ihr abgelesen haben.
 *
 * `leseKontextTokens` lag bis v5 gespiegelt im Bookmarklet; die Fixtures hier
 * stammen aus dem Produktivsystem (Konsolen-Auszug der AitisiGPT-Oberfläche und
 * der Bildschirmabzug „Chatlänge [Token]: 1k von 62k").
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const mem = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
  setItem: (k: string, v: string) => { mem.set(k, String(v)); },
  removeItem: (k: string) => { mem.delete(k); },
  clear: () => { mem.clear(); },
});

import {
  leseKontextTokens,
  normModellText,
  useBridgeModelle,
  gelerntesFenster,
  aufloesungFuer,
  modellLabel,
} from '../bridge-modelle';

beforeEach(() => {
  mem.clear();
  useBridgeModelle.setState({ angeboten: [], fenster: {} });
});

describe('leseKontextTokens — die Chatlängen-Anzeige der Seite', () => {
  it('liest die echten Anzeigen des Produktivsystems', () => {
    expect(leseKontextTokens('Chatlänge [Token]: 1k von 62k')).toBe(62_000);
    expect(leseKontextTokens('Chatlänge [Token]: 0k von 62k')).toBe(62_000);
    expect(leseKontextTokens('Chatlänge [Token]: 42k von 259k')).toBe(259_000);
  });

  it('versteht Tausenderpunkt und ausgeschriebene Zahlen', () => {
    expect(leseKontextTokens('… von 259.000')).toBe(259_000);
    expect(leseKontextTokens('… von 62000')).toBe(62_000);
    expect(leseKontextTokens('… von 1m')).toBe(1_000_000);
  });

  it('gibt 0 zurück, wo nichts zu lesen ist — statt zu raten', () => {
    for (const s of ['', 'Chatlänge unbekannt', 'von k', 'von 0k']) {
      expect(leseKontextTokens(s)).toBe(0);
    }
  });
});

describe('normModellText', () => {
  it('vereinheitlicht Schreibweise und Leerraum', () => {
    expect(normModellText('  Qwen3.6-35B ')).toBe('qwen3.6-35b');
    expect(normModellText('gpt-oss  120b')).toBe('gpt-oss 120b');
  });

  it('lässt Punkte und Bindestriche stehen', () => {
    // Schärfer zu normalisieren würde zwei Modelle desselben Hauses
    // zusammenwerfen — und ein gelerntes Fenster zeigte auf das falsche.
    expect(normModellText('Qwen3.6-35B')).not.toBe(normModellText('Qwen36 35B'));
  });
});

describe('lerneFenster — abgelesene Fenster festhalten', () => {
  it('merkt sich das Fenster unter dem Modellnamen', () => {
    useBridgeModelle.getState().lerneFenster('Qwen3.6-35B', 259_000);
    expect(gelerntesFenster('qwen3.6-35b')).toBe(259_000);
  });

  it('verwirft Unsinn, statt die Rechnung zu kapern', () => {
    for (const v of [0, -5, 12, 99_000_000, NaN]) {
      useBridgeModelle.getState().lerneFenster('Modell X', v);
    }
    expect(gelerntesFenster('Modell X')).toBeNull();
  });

  it('kennt ein nie gesehenes Modell nicht', () => {
    expect(gelerntesFenster('Llama-5')).toBeNull();
  });
});

describe('meldeListe + Auflösung', () => {
  const LISTE = [
    { text: 'gpt-oss-120b', aktiv: true },
    { text: 'Qwen3.6-35B' },
    { text: 'Qwen3-VL-30B (multimodal)' },
  ];

  it('übernimmt die Liste und löst beide Rollen darauf auf', () => {
    useBridgeModelle.getState().meldeListe(LISTE);
    expect(aufloesungFuer('standard').text).toBe('gpt-oss-120b');
    expect(aufloesungFuer('stark').text).toBe('Qwen3.6-35B');
  });

  it('wirft leere Einträge weg (fremde Daten, keine Formzusage)', () => {
    useBridgeModelle.getState().meldeListe([
      { text: '  ' }, { text: 'gpt-oss-120b' },
    ]);
    expect(useBridgeModelle.getState().angeboten).toHaveLength(1);
  });

  it('modellLabel nennt das Modell, das die Rolle GERADE trägt', () => {
    useBridgeModelle.getState().meldeListe([
      { text: 'gpt-oss-120b', aktiv: true },
      { text: 'Llama-5-Titan-70B' },
    ]);
    useBridgeModelle.getState().lerneFenster('Llama-5-Titan-70B', 400_000);
    expect(modellLabel('stark')).toBe('Llama-5-Titan-70B');
  });

  it('ohne gemeldete Liste nennt es den Katalognamen', () => {
    expect(modellLabel('stark')).toBe('Qwen3.6-35B');
  });
});
