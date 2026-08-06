/**
 * Suche, Zähler und Rubrik-Schalter des Spalten-Pickers.
 */
import { describe, it, expect } from 'vitest';
import {
  gruppiereSpalten,
  normalisiereSuche,
  filtereRubriken,
  zaehleSichtbar,
  rubrikZielZustand,
  wendeRubrikSchalterAn,
} from '../columnPickerLogik';
import type { SortableColumn } from '../types';

interface Row { a: string }

function col(key: string, label: string, gruppe?: string, locked?: boolean): SortableColumn<Row> {
  return {
    key, label, gruppe, locked,
    defaultVisible: true, sortable: false,
    accessor: r => r.a, render: () => null,
  };
}

const SPALTEN = [
  col('fkz', 'FKZ', 'Antrag', true),
  col('akronym', 'Akronym', 'Antrag'),
  col('foerdergeber', 'Fördergeber', 'Antrag'),
  col('frist', 'Frist', 'Termine'),
  col('bewilligung', 'Bewilligungsdatum', 'Termine'),
];

describe('normalisiereSuche', () => {
  it('macht Groß-/Kleinschreibung und Diakritika egal', () => {
    expect(normalisiereSuche('  FÖRDER ')).toBe(normalisiereSuche('forder'));
    expect(normalisiereSuche('Prüfung')).toBe('prufung');
  });
});

describe('filtereRubriken', () => {
  const rubriken = gruppiereSpalten(SPALTEN);

  it('findet „Fördergeber" auch ohne Umlaut', () => {
    const r = filtereRubriken(rubriken, 'fordergeber');
    expect(r).toHaveLength(1);
    expect(r[0]!.columns.map(c => c.key)).toEqual(['foerdergeber']);
  });

  it('lässt Rubriken ohne Treffer ganz weg', () => {
    const r = filtereRubriken(rubriken, 'datum');
    expect(r.map(x => x.name)).toEqual(['Termine']);
  });

  it('behält bei einem Rubrik-Treffer alle ihre Spalten', () => {
    const r = filtereRubriken(rubriken, 'termine');
    expect(r).toHaveLength(1);
    expect(r[0]!.columns).toHaveLength(2);
  });

  it('gibt bei leerem Begriff die Eingabe unverändert zurück (gleiche Identität)', () => {
    expect(filtereRubriken(rubriken, '   ')).toBe(rubriken);
  });

  it('liefert eine leere Liste, wenn nichts passt', () => {
    expect(filtereRubriken(rubriken, 'zzz')).toEqual([]);
  });
});

describe('zaehleSichtbar', () => {
  it('zählt nur Schlüssel, die es auch als Spalte gibt', () => {
    // `katstatus:alt` stammt aus einer früheren Katalogfassung — ohne die
    // Einschränkung stünde da „3 von 5" bei nur 2 sichtbaren Spalten.
    expect(zaehleSichtbar(SPALTEN, ['fkz', 'frist', 'katstatus:alt'])).toBe(2);
  });

  it('ist 0 bei leerer Auswahl', () => {
    expect(zaehleSichtbar(SPALTEN, [])).toBe(0);
  });

  it('zählt doppelte Schlüssel nur einmal — der Picker hängt erzwungene Spalten an', () => {
    expect(zaehleSichtbar(SPALTEN, ['fkz', 'frist', 'fkz'])).toBe(2);
  });
});

describe('rubrikZielZustand', () => {
  const antrag = SPALTEN.filter(c => c.gruppe === 'Antrag');

  it('schaltet auf „alle an", solange eine schaltbare Spalte fehlt', () => {
    expect(rubrikZielZustand(antrag, ['fkz', 'akronym'])).toBe('alleAn');
  });

  it('schaltet auf „alle aus", wenn alle schaltbaren drin sind', () => {
    expect(rubrikZielZustand(antrag, ['akronym', 'foerdergeber'])).toBe('alleAus');
  });

  it('lässt `locked` außen vor — sonst wäre eine Rubrik nie „ganz aus"', () => {
    // FKZ ist locked und NICHT in der Auswahl; trotzdem gilt die Rubrik als voll.
    expect(rubrikZielZustand(antrag, ['akronym', 'foerdergeber'])).toBe('alleAus');
  });
});

describe('wendeRubrikSchalterAn', () => {
  const antrag = SPALTEN.filter(c => c.gruppe === 'Antrag');

  it('nimmt beim Einschalten nur das Fehlende dazu und behält die Reihenfolge', () => {
    expect(wendeRubrikSchalterAn(antrag, ['frist', 'akronym'], 'alleAn'))
      .toEqual(['frist', 'akronym', 'foerdergeber']);
  });

  it('entfernt beim Ausschalten nur die schaltbaren Spalten der Rubrik', () => {
    expect(wendeRubrikSchalterAn(antrag, ['fkz', 'akronym', 'foerdergeber', 'frist'], 'alleAus'))
      .toEqual(['fkz', 'frist']);
  });

  it('lässt eine gelockte Spalte auch beim Ausschalten stehen', () => {
    expect(wendeRubrikSchalterAn(antrag, ['fkz'], 'alleAus')).toEqual(['fkz']);
  });
});
