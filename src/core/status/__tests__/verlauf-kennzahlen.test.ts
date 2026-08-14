/**
 * Die Kennzahlen über dem Verlauf. Zwei Zahlen statt einer, weil „28 Termine"
 * zwei verschiedene Fragen gleichzeitig beantwortete: wie viele **Schritte** es
 * gibt (Zeilen der Matrix) und wie viele **Datumsangaben** darüber stehen
 * (befüllte Zellen). Vier Teilvorhaben mit demselben Eingang sind ein Schritt
 * und vier Datumsangaben.
 */
import { describe, it, expect } from 'vitest';
import { verlaufKennzahlen, zellenJeEintrag } from '@/core/status/verlauf-kennzahlen';
import type { ChronikEintrag } from '@/core/status/chronik';
import type { OffenesPaarJeTv } from '@/core/status/waechter';
import type { StatusFeldEintrag } from '@/core/status/typen';

const feld = (code: string): StatusFeldEintrag => ({
  feldId: `D_${code}`, label: `Bezeichnung ${code}`, typ: 'datum', ebene: 'tv', code,
  prominenzDefault: 'normal', aktiv: true, unkuratiert: false,
});

const e = (code: string, tag: string, tvIds: string[] = []): ChronikEintrag =>
  ({ tag, feld: feld(code), wert: tag, tvIds });

const paar = (fehlt: string, tvId: string): OffenesPaarJeTv =>
  ({ gesetzt: 'X', fehlt, fehltLabel: 'x', seit: '2026-05-05', tage: 9, rolle: null, tvId });

describe('verlauf-kennzahlen', () => {
  it('zählt Schritte als verschiedene Felder, Datumsangaben als Zellen', () => {
    const k = verlaufKennzahlen([
      e('AAE', '2026-02-24', ['TV1', 'TV2', 'TV3', 'TV4']),
      e('PC+', '2026-03-24', ['TV1', 'TV2']),
    ], [], 4);
    expect(k.schritte).toBe(2);
    expect(k.datumsangaben).toBe(6);
  });

  it('rechnet einen Verbund-Eintrag als EINE Zelle — leer heißt Verbund, nicht niemand', () => {
    expect(zellenJeEintrag(e('XTE', '2026-03-10'))).toBe(1);
    expect(verlaufKennzahlen([e('XTE', '2026-03-10')], [], 4).datumsangaben).toBe(1);
  });

  it('zählt denselben Schritt an zwei Tagen als EINEN Schritt', () => {
    const k = verlaufKennzahlen([
      e('AAE', '2026-02-24', ['TV1']),
      e('AAE', '2026-03-06', ['TV2', 'TV3']),
    ], [], 3);
    expect(k.schritte).toBe(1);
    expect(k.datumsangaben).toBe(3);
  });

  it('nennt die Spanne vom frühesten bis zum spätesten Tag', () => {
    const k = verlaufKennzahlen([
      e('PC+', '2026-03-24', ['TV1']),
      e('AAE', '2026-02-24', ['TV1']),
      e('QSF', '2026-07-10', ['TV1']),
    ], [], 1);
    expect(k.von).toBe('2026-02-24');
    expect(k.bis).toBe('2026-07-10');
  });

  it('lässt Lücken NICHT in die Datumsangaben laufen', () => {
    const k = verlaufKennzahlen([e('AAE', '2026-02-24', ['TV1'])], [paar('AK4', 'TV2')], 2);
    expect(k.datumsangaben).toBe(1);
    expect(k.nichtGesetzt).toBe(1);
  });

  it('kommt ohne einen einzigen Termin aus', () => {
    const k = verlaufKennzahlen([], [paar('AK4', 'TV1')], 2);
    expect(k).toEqual({
      schritte: 0, datumsangaben: 0, tvAnzahl: 2, von: null, bis: null, nichtGesetzt: 1,
    });
  });
});
