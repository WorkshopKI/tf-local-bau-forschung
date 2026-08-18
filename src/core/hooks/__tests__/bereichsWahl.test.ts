/**
 * Die **Auswahl** eines Betrachtungsbereichs: was gespeichert überlebt und was
 * daraus an Programmen folgt.
 *
 * Drei der vier Stufen sind listenlos und **abgeleitet** (`standard`, `aktuell`,
 * `alle`) — sie folgen einem Richtlinien-Wechsel von selbst. Genau deshalb muss
 * jede von ihnen den Weg durch den Speicher überstehen: fällt eine unbekannte
 * Stufe still auf den Grundzustand zurück, sieht der Nutzer nach jedem Neustart
 * wieder mehr Datensätze, als er gewählt hat.
 *
 * Ohne Katalog-Fassung (`getAktiveVersion() === null`, wie in prod/as) gilt der
 * Code-Seed — dieselbe Auflösung, die die Tests hier annehmen.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { erzeugeBereichsStore } from '@/core/hooks/bereichsStore';
import { komponiereBereich } from '@/core/hooks/useBereich';
import { AKTUELLE_RICHTLINIE, BETRACHTUNGSBEREICH_SEED } from '@/core/status';

/** Minimaler localStorage — die Suite läuft in `node`, dort gibt es keinen. */
function stubSpeicher(): Map<string, string> {
  const daten = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => daten.get(k) ?? null,
    setItem: (k: string, v: string) => { daten.set(k, v); },
    removeItem: (k: string) => { daten.delete(k); },
  };
  return daten;
}

const KEY = 'test_bereich_v1';

describe('gespeicherte Bereichs-Auswahl', () => {
  let daten: Map<string, string>;

  beforeEach(() => { daten = stubSpeicher(); });
  afterEach(() => { delete (globalThis as { localStorage?: unknown }).localStorage; });

  it('jede Stufe überlebt den Neustart', () => {
    for (const modus of ['standard', 'aktuell', 'alle'] as const) {
      daten.set(KEY, JSON.stringify({ modus, auswahl: [] }));
      expect(erzeugeBereichsStore(KEY, 'standard').getState().modus, modus).toBe(modus);
    }
    daten.set(KEY, JSON.stringify({ modus: 'auswahl', auswahl: ['76'] }));
    const s = erzeugeBereichsStore(KEY, 'standard').getState();
    expect(s.modus).toBe('auswahl');
    expect(s.auswahl).toEqual(['76']);
  });

  it('was die App nicht kennt, fällt auf den Grundzustand zurück', () => {
    daten.set(KEY, JSON.stringify({ modus: 'phantasie', auswahl: [] }));
    expect(erzeugeBereichsStore(KEY, 'alle').getState().modus).toBe('alle');
    // Eine eigene Auswahl OHNE Liste wäre ein Bereich ohne Inhalt.
    daten.set(KEY, JSON.stringify({ modus: 'auswahl', auswahl: [] }));
    expect(erzeugeBereichsStore(KEY, 'standard').getState().modus).toBe('standard');
  });

  it('`setModus` schreibt ohne Liste — die Stufe greift ihre Programme selbst ab', () => {
    const store = erzeugeBereichsStore(KEY, 'standard');
    store.getState().setModus('aktuell');
    expect(JSON.parse(daten.get(KEY) ?? '{}')).toEqual({ modus: 'aktuell', auswahl: [] });
  });
});

describe('komponiereBereich', () => {
  const leer = (): void => {};

  it('„aktuell" meint die jüngste Generation, nicht den halben Standard-Bereich', () => {
    const b = komponiereBereich('aktuell', [], leer, leer);
    expect(b.programme).toEqual(AKTUELLE_RICHTLINIE);
    expect(b.menge?.size).toBe(AKTUELLE_RICHTLINIE.length);
    // Ein Filter gilt — nur „alle" schaltet ihn ab.
    expect(b.menge).not.toBeNull();
    // Der Standard-Bereich bleibt daneben stehen: er ist der Rückweg im Panel.
    expect(b.standard).toEqual(BETRACHTUNGSBEREICH_SEED);
    expect(b.programme.length).toBeLessThan(b.standard.length);
  });

  it('die übrigen Stufen bleiben, was sie waren', () => {
    expect(komponiereBereich('standard', ['76'], leer, leer).programme)
      .toEqual(BETRACHTUNGSBEREICH_SEED);
    expect(komponiereBereich('auswahl', ['76'], leer, leer).programme).toEqual(['76']);
    const alle = komponiereBereich('alle', ['76'], leer, leer);
    expect(alle.programme).toEqual([]);
    expect(alle.menge, 'kein Filter').toBeNull();
  });
});
