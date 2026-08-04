/**
 * Was diese Datei festnagelt:
 *
 * 1. Gezählt werden VORGÄNGE je Statuscode — nicht Verbünde, nicht Feld-Wert-Paare.
 * 2. Ein unbekannter Status-Text zählt gar nicht mit, statt still auf einen Code
 *    zu fallen.
 * 3. Varianten-Schreibweisen desselben Codes landen im selben Fach.
 */
import { describe, it, expect } from 'vitest';
import { codeAusSatz, zaehleCodes } from '@/plugins/zu-klaeren/vorkommen';

const satz = (status: unknown): Record<string, unknown> => ({ status });

describe('codeAusSatz (Status-Text → Code)', () => {
  it('liest den Code aus dem Status-Text des Antrags', () => {
    expect(codeAusSatz(satz('bewilligt'))).toBe(59);
  });

  it('ein unbekannter Status-Text ergibt null', () => {
    expect(codeAusSatz(satz('Fantasiestatus'))).toBeNull();
  });

  it('leerer oder fehlender Status ergibt null', () => {
    expect(codeAusSatz(satz(''))).toBeNull();
    expect(codeAusSatz(satz('   '))).toBeNull();
    expect(codeAusSatz({})).toBeNull();
    expect(codeAusSatz(satz(59))).toBeNull();
  });

  it('eine Varianten-Schreibweise trifft denselben Code', () => {
    // `VN techn. geprüft` ist eine gepflegte Variante von `VN technisch geprüft`.
    expect(codeAusSatz(satz('VN techn. geprüft'))).toBe(codeAusSatz(satz('VN technisch geprüft')));
  });
});

describe('zaehleCodes (Vorgänge, nicht Verbünde)', () => {
  it('zählt jeden Vorgang einzeln — fünf TV eines Verbunds sind fünf', () => {
    const m = zaehleCodes([satz('bewilligt'), satz('bewilligt'), satz('bewilligt')]);
    expect(m.get(59)).toBe(3);
  });

  it('unbekannte Status-Texte zählen nicht mit', () => {
    const m = zaehleCodes([satz('bewilligt'), satz('Fantasiestatus'), satz('')]);
    expect(m.get(59)).toBe(1);
    expect([...m.values()].reduce((s, n) => s + n, 0)).toBe(1);
  });

  it('leere Eingabe ergibt eine leere Karte, keinen Fehler', () => {
    expect(zaehleCodes([]).size).toBe(0);
  });

  it('verschiedene Codes stehen nebeneinander', () => {
    const m = zaehleCodes([satz('bewilligt'), satz('beantragt'), satz('beantragt')]);
    expect(m.get(59)).toBe(1);
    expect(m.get(31)).toBe(2);
  });
});
