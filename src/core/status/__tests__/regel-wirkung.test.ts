/**
 * Was diese Datei festnagelt:
 *
 * 1. **Der Unterschied ist die Aussage.** Eine Regel, die von einer früheren
 *    verdeckt wird, trifft öfter zu, als sie gewinnt — und genau das soll der
 *    Regelautor sehen.
 * 2. **Die Zahlen kommen aus der Engine**, nicht aus einer zweiten Rechnung: sie
 *    werden gegen `ermittleTodo` gestellt, nicht gegen eine Erwartung im Kopf.
 * 3. **Ein gesperrter Strang zählt nirgends mit** — die Sperre bekommt ihre
 *    eigene Zahl, sonst läse sich „trifft 0" an ihr wie ein Messfehler.
 * 4. **Die Veraltungs-Signatur reagiert auf alles, was die Zahlen ändert**, und
 *    auf nichts sonst: eine geänderte Beschreibung entwertet keinen teuren Lauf.
 */
import { describe, it, expect } from 'vitest';
import { erhebeRegelWirkung, wirkungsSignatur, type BewerteterLauf } from '@/core/status/regel-wirkung';
import { ermittleTodo } from '@/core/status/todo-engine';
import type { BedingungsKontext } from '@/core/status/bedingung';
import { ALLE_STRAENGE, type TodoRegel } from '@/core/status/typen';

const STICHTAG = '2026-08-01T00:00:00.000Z';

const regel = (p: Partial<TodoRegel> & { id: string; reihenfolge: number }): TodoRegel => ({
  beschreibung: p.id, bedingung: { feldId: 'a', op: 'gefuellt' },
  todo: `todo-${p.id}`, zustaendig: [], aktiv: true, ...p,
});

const ctx = (werte: Record<string, string>): BedingungsKontext =>
  new Map(Object.entries(werte).map(([k, v]) => [k, [v]]));

/** Der Weg, den auch die Oberfläche geht: EIN Engine-Lauf je Vorgang. */
function bewerte(regeln: readonly TodoRegel[], vorgaenge: BedingungsKontext[]): BewerteterLauf[] {
  return vorgaenge.map((c, i) => ({
    aktenzeichen: `AZ-${i}`,
    ergebnis: ermittleTodo(regeln, c, STICHTAG),
  }));
}

describe('erhebeRegelWirkung — gewinnt vs. trifft zu', () => {
  const REGELN = [
    regel({ id: 'r1', reihenfolge: 10, bedingung: { feldId: 'a', op: 'gefuellt' } }),
    regel({ id: 'r2', reihenfolge: 20, bedingung: { feldId: 'b', op: 'gefuellt' } }),
  ];

  it('zählt den Sieger in beiden Zahlen', () => {
    const w = erhebeRegelWirkung(bewerte(REGELN, [ctx({ a: 'x' })]), REGELN);
    expect(w.get('r1')).toEqual({ gewinnt: 1, trifftZu: 1, greift: 0 });
  });

  it('eine verdeckte Regel trifft zu, ohne zu gewinnen', () => {
    // Beide Bedingungen erfüllt; r1 steht vorn und gewinnt, r2 wird verdeckt.
    const w = erhebeRegelWirkung(bewerte(REGELN, [ctx({ a: 'x', b: 'y' })]), REGELN);
    expect(w.get('r1')).toMatchObject({ gewinnt: 1, trifftZu: 1 });
    expect(w.get('r2')).toMatchObject({ gewinnt: 0, trifftZu: 1 });
    expect(w.get('r2')!.gewinnt).toBeLessThan(w.get('r2')!.trifftZu);
  });

  it('summiert über den Bestand', () => {
    const w = erhebeRegelWirkung(bewerte(REGELN, [
      ctx({ a: 'x', b: 'y' }), ctx({ a: 'x', b: 'y' }), ctx({ b: 'y' }), ctx({}),
    ]), REGELN);
    expect(w.get('r1')).toMatchObject({ gewinnt: 2, trifftZu: 2 });
    // r2 gewinnt nur im dritten Fall, trifft aber in dreien zu.
    expect(w.get('r2')).toMatchObject({ gewinnt: 1, trifftZu: 3 });
  });

  it('die Zahlen stimmen mit der Engine überein, Vorgang für Vorgang', () => {
    const vorgaenge = [ctx({ a: 'x' }), ctx({ b: 'y' }), ctx({ a: 'x', b: 'y' }), ctx({})];
    const laeufe = bewerte(REGELN, vorgaenge);
    const w = erhebeRegelWirkung(laeufe, REGELN);
    // Gegenprobe ohne das Modul: die Engine selbst befragen.
    const ausEngine = vorgaenge.filter(c => ermittleTodo(REGELN, c, STICHTAG).regelId === 'r2').length;
    expect(w.get('r2')!.gewinnt).toBe(ausEngine);
  });

  it('ein Vorgang ohne Treffer erhöht keine Zahl', () => {
    const w = erhebeRegelWirkung(bewerte(REGELN, [ctx({}), ctx({})]), REGELN);
    expect(w.get('r1')).toEqual({ gewinnt: 0, trifftZu: 0, greift: 0 });
    expect(w.get('r2')).toEqual({ gewinnt: 0, trifftZu: 0, greift: 0 });
  });
});

describe('erhebeRegelWirkung — Sperren', () => {
  const MIT_SPERRE: TodoRegel[] = [
    regel({
      id: 's1', reihenfolge: 5, beschreibung: 'S1',
      bedingung: { feldId: 'zurueck', op: 'gefuellt' },
      todo: '', sperrt: ['r1'],
    }),
    regel({ id: 'r1', reihenfolge: 10, bedingung: { feldId: 'a', op: 'gefuellt' } }),
    regel({ id: 'r2', reihenfolge: 20, bedingung: { feldId: 'b', op: 'gefuellt' } }),
  ];

  it('ein gesperrter Vorgang zählt in KEINER der beiden Zahlen', () => {
    // Bedingung von r1 erfüllt, aber die Sperre greift: weder gewinnt noch trifft.
    const w = erhebeRegelWirkung(bewerte(MIT_SPERRE, [ctx({ a: 'x', zurueck: 'ja' })]), MIT_SPERRE);
    expect(w.get('r1')).toMatchObject({ gewinnt: 0, trifftZu: 0 });
  });

  it('die Sperre bekommt ihre eigene Zahl statt zweier Nullen', () => {
    const w = erhebeRegelWirkung(bewerte(MIT_SPERRE, [
      ctx({ a: 'x', zurueck: 'ja' }), ctx({ a: 'x', zurueck: 'ja' }), ctx({ a: 'x' }),
    ]), MIT_SPERRE);
    expect(w.get('s1')).toEqual({ gewinnt: 0, trifftZu: 0, greift: 2 });
    expect(w.get('r1')).toMatchObject({ gewinnt: 1, trifftZu: 1 });
  });

  it('eine Totalsperre legt alles still, die Ausnahme überlebt', () => {
    const total: TodoRegel[] = [
      regel({
        id: 's0', reihenfolge: 1, bedingung: { feldId: 'fertig', op: 'gefuellt' },
        todo: '', sperrt: [ALLE_STRAENGE], sperrtNicht: ['r2'],
      }),
      regel({ id: 'r1', reihenfolge: 10, bedingung: { feldId: 'a', op: 'gefuellt' } }),
      regel({ id: 'r2', reihenfolge: 20, bedingung: { feldId: 'b', op: 'gefuellt' } }),
    ];
    const w = erhebeRegelWirkung(bewerte(total, [ctx({ a: 'x', b: 'y', fertig: 'ja' })]), total);
    expect(w.get('r1')).toMatchObject({ trifftZu: 0 });
    expect(w.get('r2')).toMatchObject({ gewinnt: 1, trifftZu: 1 });
    expect(w.get('s0')!.greift).toBe(1);
  });
});

describe('erhebeRegelWirkung — was NICHT gemessen wird', () => {
  it('inaktive Regeln erscheinen gar nicht — „nicht gemessen" ist nicht „null"', () => {
    const regeln = [
      regel({ id: 'r1', reihenfolge: 10 }),
      regel({ id: 'aus', reihenfolge: 20, aktiv: false }),
    ];
    const w = erhebeRegelWirkung(bewerte(regeln, [ctx({ a: 'x' })]), regeln);
    expect(w.has('aus')).toBe(false);
    expect(w.has('r1')).toBe(true);
  });

  it('leerer Bestand liefert Nullen für jede aktive Regel, nicht eine leere Map', () => {
    const regeln = [regel({ id: 'r1', reihenfolge: 10 })];
    const w = erhebeRegelWirkung([], regeln);
    expect(w.get('r1')).toEqual({ gewinnt: 0, trifftZu: 0, greift: 0 });
  });

  it('zwei Läufe über dieselbe Eingabe liefern dasselbe (rein, fester Stichtag)', () => {
    const regeln = [regel({ id: 'r1', reihenfolge: 10 }), regel({ id: 'r2', reihenfolge: 20, bedingung: { feldId: 'b', op: 'gefuellt' } })];
    const v = [ctx({ a: 'x', b: 'y' }), ctx({ b: 'y' })];
    expect([...erhebeRegelWirkung(bewerte(regeln, v), regeln)])
      .toEqual([...erhebeRegelWirkung(bewerte(regeln, v), regeln)]);
  });
});

describe('wirkungsSignatur — wann ein Lauf veraltet', () => {
  const basis = [
    regel({ id: 'r1', reihenfolge: 10 }),
    regel({ id: 'r2', reihenfolge: 20, bedingung: { feldId: 'b', op: 'gefuellt' } }),
  ];
  const sig = (r: readonly TodoRegel[]) => wirkungsSignatur(r, STICHTAG, 'ab').wert;

  it('gleiche Regeln ⇒ gleiche Signatur, unabhängig von der Listen-Reihenfolge', () => {
    expect(sig(basis)).toBe(sig([...basis].reverse()));
  });

  it('Umsortieren entwertet den Lauf', () => {
    const um = basis.map(r => (r.id === 'r2' ? { ...r, reihenfolge: 5 } : r));
    expect(sig(um)).not.toBe(sig(basis));
  });

  it('Deaktivieren, Bedingung ändern und Regelsatz-Wechsel ebenso', () => {
    expect(sig(basis.map(r => (r.id === 'r1' ? { ...r, aktiv: false } : r)))).not.toBe(sig(basis));
    expect(sig(basis.map(r => (r.id === 'r1'
      ? { ...r, bedingung: { feldId: 'z', op: 'gefuellt' as const } } : r)))).not.toBe(sig(basis));
    expect(sig(basis.map(r => (r.id === 'r1' ? { ...r, regelsatz: 'fb' as const } : r)))).not.toBe(sig(basis));
  });

  it('eine geänderte Sperr-Liste ebenso', () => {
    expect(sig(basis.map(r => (r.id === 'r1' ? { ...r, sperrt: ['r2'] } : r)))).not.toBe(sig(basis));
  });

  it('Beschreibung, To-do-Text und Begründung entwerten den Lauf NICHT', () => {
    // Ein teurer Bestandslauf darf nicht an einem Tippfehler im Text sterben.
    const getippt = basis.map(r => ({ ...r, beschreibung: `${r.beschreibung} (neu)`, todo: 'anders' }));
    expect(sig(getippt)).toBe(sig(basis));
  });

  it('anderer Stichtag oder anderer Regelsatz ⇒ andere Signatur', () => {
    expect(wirkungsSignatur(basis, '2026-09-01T00:00:00.000Z', 'ab').wert).not.toBe(sig(basis));
    expect(wirkungsSignatur(basis, STICHTAG, 'fb').wert).not.toBe(sig(basis));
  });
});
