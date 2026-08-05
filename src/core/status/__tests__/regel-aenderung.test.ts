/**
 * Was diese Datei festnagelt:
 *
 * 1. **Verglichen wird der To-do-TEXT, nicht die Regel-Id.** Wandert dieselbe
 *    Aufgabe von einer Regel zu einer anderen mit gleichem Wortlaut, ändert sich
 *    für niemanden etwas — eine gemeldete Änderung wäre dort eine Falschmeldung.
 * 2. **„Kein To-do" ist ein Zustand**, kein fehlender Wert: der Übergang von und
 *    zu `null` wird gezählt und benannt.
 * 3. **Die Bilanz ist deterministisch** — der Export wird verglichen, also darf
 *    dieselbe Eingabe nie eine andere Reihenfolge liefern.
 * 4. Der ganze Weg wird gegen die **echte Engine** gestellt, nicht gegen
 *    handgeschriebene Ergebnisse: Bedingungsänderung, Umsortierung und
 *    Deaktivierung müssen sich in der Bilanz wiederfinden.
 */
import { describe, it, expect } from 'vitest';
import { vergleicheFassungen, type VerglichenerVorgang } from '@/core/status/regel-aenderung';
import { ermittleTodo } from '@/core/status/todo-engine';
import type { BedingungsKontext } from '@/core/status/bedingung';
import type { TodoRegel } from '@/core/status/typen';

const STICHTAG = '2026-08-01T00:00:00.000Z';

const regel = (p: Partial<TodoRegel> & { id: string; reihenfolge: number }): TodoRegel => ({
  beschreibung: p.id, bedingung: { feldId: 'a', op: 'gefuellt' },
  todo: `todo-${p.id}`, zustaendig: [], aktiv: true, ...p,
});

const ctx = (werte: Record<string, string>): BedingungsKontext =>
  new Map(Object.entries(werte).map(([k, v]) => [k, [v]]));

/** Der Weg der Oberfläche: EIN Durchgang, beide Fassungen über denselben Kontext. */
function stelleGegenueber(
  alt: readonly TodoRegel[], neu: readonly TodoRegel[], vorgaenge: BedingungsKontext[],
): VerglichenerVorgang[] {
  return vorgaenge.map((c, i) => ({
    aktenzeichen: `AZ-${i}`,
    vorher: ermittleTodo(alt, c, STICHTAG),
    nachher: ermittleTodo(neu, c, STICHTAG),
  }));
}

describe('vergleicheFassungen — was sich ändert', () => {
  const ALT = [regel({ id: 'r1', reihenfolge: 10, todo: 'A' })];

  it('gleiche Fassung ⇒ keine Änderung, aber eine Aussage über die Grundmenge', () => {
    const b = vergleicheFassungen(stelleGegenueber(ALT, ALT, [ctx({ a: 'x' }), ctx({})]));
    expect(b).toEqual({ gesamt: 2, geaendert: 0, gruppen: [] });
  });

  it('geänderte Bedingung erscheint als Übergang mit Beispiel', () => {
    const neu = [regel({ id: 'r1', reihenfolge: 10, todo: 'A', bedingung: { feldId: 'b', op: 'gefuellt' } })];
    const b = vergleicheFassungen(stelleGegenueber(ALT, neu, [ctx({ a: 'x' }), ctx({ a: 'x' })]));
    expect(b.geaendert).toBe(2);
    expect(b.gruppen).toHaveLength(1);
    expect(b.gruppen[0]).toMatchObject({ vorher: 'A', nachher: null, anzahl: 2 });
    expect(b.gruppen[0]?.beispiele).toEqual(['AZ-0', 'AZ-1']);
  });

  it('Umsortieren ändert das Ergebnis und wird gemeldet', () => {
    const alt = [
      regel({ id: 'r1', reihenfolge: 10, todo: 'A' }),
      regel({ id: 'r2', reihenfolge: 20, todo: 'B', bedingung: { feldId: 'b', op: 'gefuellt' } }),
    ];
    const neu = alt.map(r => (r.id === 'r2' ? { ...r, reihenfolge: 5 } : r));
    const b = vergleicheFassungen(stelleGegenueber(alt, neu, [ctx({ a: 'x', b: 'y' })]));
    expect(b.gruppen[0]).toMatchObject({ vorher: 'A', nachher: 'B', anzahl: 1 });
  });

  it('Deaktivieren führt auf „kein To-do", und das steht als Wort da', () => {
    const neu = ALT.map(r => ({ ...r, aktiv: false }));
    const b = vergleicheFassungen(stelleGegenueber(ALT, neu, [ctx({ a: 'x' })]));
    expect(b.gruppen[0]).toMatchObject({ vorher: 'A', nachher: null });
  });

  it('eine neue Regel holt Vorgänge aus „kein To-do" heraus', () => {
    const neu = [...ALT, regel({ id: 'r2', reihenfolge: 20, todo: 'B', bedingung: { feldId: 'b', op: 'gefuellt' } })];
    const b = vergleicheFassungen(stelleGegenueber(ALT, neu, [ctx({ b: 'y' })]));
    expect(b.gruppen[0]).toMatchObject({ vorher: null, nachher: 'B', anzahl: 1 });
  });
});

describe('vergleicheFassungen — was KEINE Änderung ist', () => {
  it('dieselbe Aufgabe aus einer anderen Regel meldet nichts', () => {
    // Der Regelautor teilt eine Regel in zwei mit gleichem To-do-Text. Im Board
    // ändert sich dadurch nichts, und genau das soll die Bilanz sagen.
    const alt = [regel({ id: 'alt', reihenfolge: 10, todo: 'NF erstellen' })];
    const neu = [regel({ id: 'neu', reihenfolge: 10, todo: 'NF erstellen' })];
    const b = vergleicheFassungen(stelleGegenueber(alt, neu, [ctx({ a: 'x' }), ctx({ a: 'y' })]));
    expect(b.geaendert).toBe(0);
    expect(b.gruppen).toEqual([]);
  });

  it('ein Vorgang ohne To-do in beiden Fassungen zählt als unverändert', () => {
    const r = [regel({ id: 'r1', reihenfolge: 10 })];
    expect(vergleicheFassungen(stelleGegenueber(r, r, [ctx({})])).geaendert).toBe(0);
  });
});

describe('vergleicheFassungen — Form der Bilanz', () => {
  it('sortiert nach Häufigkeit, deterministisch bei Gleichstand', () => {
    const b = vergleicheFassungen([
      { aktenzeichen: 'a', vorher: erg('A'), nachher: erg('B') },
      { aktenzeichen: 'b', vorher: erg('C'), nachher: erg('D') },
      { aktenzeichen: 'c', vorher: erg('C'), nachher: erg('D') },
    ]);
    expect(b.gruppen.map(g => `${g.vorher}>${g.nachher}`)).toEqual(['C>D', 'A>B']);
  });

  it('führt höchstens drei Beispiele je Übergang', () => {
    const viele = Array.from({ length: 9 }, (_, i) => ({
      aktenzeichen: `AZ-${i}`, vorher: erg('A'), nachher: erg('B'),
    }));
    const g = vergleicheFassungen(viele).gruppen[0];
    expect(g?.anzahl).toBe(9);
    expect(g?.beispiele).toHaveLength(3);
  });

  it('leere Eingabe ⇒ Nullen, keine Ausnahme', () => {
    expect(vergleicheFassungen([])).toEqual({ gesamt: 0, geaendert: 0, gruppen: [] });
  });

  it('zwei Läufe über dieselbe Eingabe liefern dasselbe', () => {
    const e = [{ aktenzeichen: 'a', vorher: erg('A'), nachher: erg('B') }];
    expect(vergleicheFassungen(e)).toEqual(vergleicheFassungen(e));
  });
});

/** Ein minimales Engine-Ergebnis — nur das Feld, das der Vergleich liest. */
function erg(todo: string | null) {
  return {
    todo, regelId: null, beschreibung: null, zustaendig: [], wartetAuf: null,
    belege: [], gesperrtDurch: [], weitereTreffer: [], quelle: 'regel' as const,
  };
}
