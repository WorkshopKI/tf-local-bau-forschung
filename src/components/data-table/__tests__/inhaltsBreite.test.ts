/**
 * Persistenz des Griff-Umschalters (Einpassen ↔ Inhaltsbreite).
 *
 * Zwei Dinge sind hier wichtig genug für einen Test:
 *
 * 1. **Der Standard hat keinen Schlüssel.** Wer die App vor dem Umschalter
 *    benutzt hat, hat den Eintrag nicht — und muss im Einpass-Modus landen,
 *    nicht in einem Zwischending.
 * 2. **Der Umschalter läuft in einem EIGENEN Schlüssel** neben der gepinnten
 *    Gesamtbreite. Teilten sie sich einen, verlöre jedes Umschalten den Pin
 *    (und umgekehrt).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  inhaltsBreiteKey,
  ladeInhaltsBreite,
  speichereInhaltsBreite,
} from '../useTotalTableWidth';

const KEY = 'test_table_total_width';

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => { store.clear(); },
  });
});

describe('inhaltsBreiteKey', () => {
  it('hängt an den Breiten-Schlüssel an, statt ihn zu ersetzen', () => {
    expect(inhaltsBreiteKey(KEY)).toBe(`${KEY}_inhalt`);
    expect(inhaltsBreiteKey(KEY)).not.toBe(KEY);
  });
});

describe('ladeInhaltsBreite', () => {
  it('ohne Eintrag ist Einpassen der Standard', () => {
    expect(ladeInhaltsBreite(KEY)).toBe(false);
  });

  it('nur das ausdrückliche 1 schaltet um', () => {
    for (const roh of ['0', '', 'true', 'ja', '2', 'null']) {
      localStorage.setItem(inhaltsBreiteKey(KEY), roh);
      expect(ladeInhaltsBreite(KEY)).toBe(false);
    }
    localStorage.setItem(inhaltsBreiteKey(KEY), '1');
    expect(ladeInhaltsBreite(KEY)).toBe(true);
  });
});

describe('speichereInhaltsBreite', () => {
  it('Roundtrip in beide Richtungen', () => {
    speichereInhaltsBreite(KEY, true);
    expect(ladeInhaltsBreite(KEY)).toBe(true);
    speichereInhaltsBreite(KEY, false);
    expect(ladeInhaltsBreite(KEY)).toBe(false);
  });

  it('schreibt den Standard NICHT als 0, sondern löscht ihn', () => {
    speichereInhaltsBreite(KEY, true);
    speichereInhaltsBreite(KEY, false);
    expect(localStorage.getItem(inhaltsBreiteKey(KEY))).toBeNull();
  });

  it('lässt die gepinnte Gesamtbreite unangetastet', () => {
    localStorage.setItem(KEY, '1200');
    speichereInhaltsBreite(KEY, true);
    speichereInhaltsBreite(KEY, false);
    expect(localStorage.getItem(KEY)).toBe('1200');
  });
});
