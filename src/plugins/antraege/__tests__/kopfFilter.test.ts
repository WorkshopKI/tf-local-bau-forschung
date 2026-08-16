import { describe, it, expect, beforeEach } from 'vitest';
import { alsStand, alsAuswahl, useKopfFilter } from '../kopfFilter';

describe('Spaltenkopf-Auswahl — zwei Formen desselben Stands', () => {
  it('läuft in beide Richtungen', () => {
    const auswahl = { frist: ['2026-01', '2026-02'], status: ['a'] };
    expect(alsAuswahl(alsStand(auswahl))).toEqual(auswahl);
  });

  it('kennt für „kein Filter" genau eine Schreibweise', () => {
    // Ein leeres Set und ein fehlender Schlüssel sind dasselbe — sonst trüge
    // ein gemerkter Reiter eine Auswahl, die keine ist, und träfe sich selbst
    // nicht mehr.
    expect(alsStand({ frist: [] })).toEqual({});
    expect(alsAuswahl({ frist: new Set<string>() })).toEqual({});
  });

  it('sortiert die Werte — die Klick-Reihenfolge ist keine Aussage', () => {
    expect(alsAuswahl({ frist: new Set(['b', 'a']) })).toEqual({ frist: ['a', 'b'] });
  });
});

describe('Spaltenkopf-Auswahl — Store', () => {
  beforeEach(() => {
    useKopfFilter.setState({ stand: {} });
  });

  it('setzt eine Spalte und nimmt sie mit dem leeren Set wieder heraus', () => {
    useKopfFilter.getState().setzeSpalte('frist', new Set(['2026-01']));
    expect(alsAuswahl(useKopfFilter.getState().stand)).toEqual({ frist: ['2026-01'] });
    useKopfFilter.getState().setzeSpalte('frist', new Set());
    expect(useKopfFilter.getState().stand).toEqual({});
  });

  it('ersetzt beim Anwenden eines Reiters den GANZEN Stand', () => {
    useKopfFilter.getState().setzeSpalte('status', new Set(['x']));
    useKopfFilter.getState().setzeStand({ frist: ['2026-01'] });
    // `status` ist weg, nicht ergänzt: ein Reiter ist ein Arbeitsplatz, kein
    // Zusatzfilter.
    expect(alsAuswahl(useKopfFilter.getState().stand)).toEqual({ frist: ['2026-01'] });
  });
});
