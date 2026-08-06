import { describe, it, expect } from 'vitest';
import {
  FILTER_BAUM_ROOT, baueFilterBaum, checkedAusWerten, gruppenKnotenId, werteAusChecked,
  wertKnotenId, type FilterBaum,
} from '../filterBaum';

/** Jahr-vor-Bindestrich, sonst ungruppiert — das Muster der Datumsspalte. */
const jahr = (v: string): string | null => (/^\d{4}-\d{2}$/.test(v) ? v.slice(0, 4) : null);
const identisch = (v: string): string => v;

describe('baueFilterBaum', () => {
  it('uebernimmt die Reihenfolge der Kandidaten, statt neu zu sortieren', () => {
    // Die Sortier-Hoheit liegt bei `filterSort`; ordnete der Baum zusaetzlich um,
    // gaebe es zwei Stellen, die dasselbe behaupten.
    const { items, rootId } = baueFilterBaum(
      ['2024-08', '2024-07', '2023-12'], jahr, identisch,
    );
    expect(items[rootId]?.children).toEqual([gruppenKnotenId('2024'), gruppenKnotenId('2023')]);
    expect(items[gruppenKnotenId('2024')]?.children)
      .toEqual([wertKnotenId('2024-08'), wertKnotenId('2024-07')]);
  });

  it('haengt ungruppierte Werte als Blaetter HINTER die Ordner', () => {
    const { items, rootId } = baueFilterBaum(['2024-08', '(leer)'], jahr, identisch);
    expect(items[rootId]?.children).toEqual([gruppenKnotenId('2024'), wertKnotenId('(leer)')]);
    expect(items[wertKnotenId('(leer)')]?.isFolder).toBe(false);
  });

  it('beschriftet Blaetter ueber formatLabel, Ordner ueber den Gruppenschluessel', () => {
    const { items } = baueFilterBaum(['2024-08'], jahr, () => 'August');
    expect(items[wertKnotenId('2024-08')]?.name).toBe('August');
    expect(items[gruppenKnotenId('2024')]?.name).toBe('2024');
  });

  it('legt eine Wurzel an, auch wenn es keine Kandidaten gibt', () => {
    const { items, rootId } = baueFilterBaum([], jahr, identisch);
    expect(rootId).toBe(FILTER_BAUM_ROOT);
    expect(items[FILTER_BAUM_ROOT]?.children).toEqual([]);
  });
});

describe('baueFilterBaum — die Zahlen', () => {
  const KANDIDATEN = ['2024-08', '2024-07', '2023-12', '(leer)'];
  const ZAHLEN = new Map([['2024-08', 3], ['2024-07', 5], ['(leer)', 2]]);

  /** Die Wurzel traegt keine Zahl — dieselbe Verengung wie im `trailing`-Slot. */
  const anzahl = (baum: FilterBaum, id: string): number | undefined => {
    const d = baum.items[id]?.data;
    return d && d.art !== 'wurzel' ? d.anzahl : undefined;
  };

  it('das Blatt traegt seine Zahl, ein fehlender Eintrag zaehlt als 0', () => {
    const baum = baueFilterBaum(KANDIDATEN, jahr, identisch, ZAHLEN);
    expect(anzahl(baum, wertKnotenId('2024-08'))).toBe(3);
    // '2023-12' steht in keiner Zahl-Map — der Wert bleibt trotzdem waehlbar.
    expect(anzahl(baum, wertKnotenId('2023-12'))).toBe(0);
  });

  it('der Ordner traegt die Summe seiner Kinder', () => {
    const baum = baueFilterBaum(KANDIDATEN, jahr, identisch, ZAHLEN);
    expect(anzahl(baum, gruppenKnotenId('2024'))).toBe(8);
    expect(anzahl(baum, gruppenKnotenId('2023'))).toBe(0);
  });

  it('bei gefilterter Kandidatenliste zaehlt der Ordner nur die SICHTBAREN Kinder', () => {
    // Das Suchfeld im Dropdown verkleinert die Liste; die Jahreszahl soll zu dem
    // passen, was unter ihr steht — nicht zum Gesamtjahr.
    const baum = baueFilterBaum(['2024-08'], jahr, identisch, ZAHLEN);
    expect(anzahl(baum, gruppenKnotenId('2024'))).toBe(3);
  });

  it('der ungruppierte Sentinel traegt seine eigene Zahl und geht in keine Summe ein', () => {
    const baum = baueFilterBaum(KANDIDATEN, jahr, identisch, ZAHLEN);
    expect(anzahl(baum, wertKnotenId('(leer)'))).toBe(2);
    expect(anzahl(baum, gruppenKnotenId('2024'))).toBe(8);
  });

  it('ohne Zahlen bleibt `anzahl` ueberall undefined (Rueckwaerts-Kompatibilitaet)', () => {
    const baum = baueFilterBaum(KANDIDATEN, jahr, identisch);
    expect(anzahl(baum, wertKnotenId('2024-08'))).toBeUndefined();
    expect(anzahl(baum, gruppenKnotenId('2024'))).toBeUndefined();
  });
});

describe('checkedAusWerten / werteAusChecked', () => {
  const kandidaten = ['2024-08', '2024-07', '(leer)'];

  it('laeuft rund: Werte → Blatt-Ids → dieselben Werte', () => {
    const werte = new Set(['2024-08', '(leer)']);
    const ids = checkedAusWerten(kandidaten, werte);
    expect(ids).toEqual([wertKnotenId('2024-08'), wertKnotenId('(leer)')]);
    expect(werteAusChecked(kandidaten, ids, werte)).toEqual(werte);
  });

  it('ignoriert Ordner-Ids — nur Blaetter zaehlen', () => {
    const ids = [gruppenKnotenId('2024'), wertKnotenId('2024-07')];
    expect(werteAusChecked(kandidaten, ids, new Set())).toEqual(new Set(['2024-07']));
  });

  it('laesst Werte ausserhalb der Kandidaten unangetastet', () => {
    // Die Suche verkleinert die Kandidatenliste, die Auswahl bleibt die volle:
    // ein Klick bei aktiver Suche darf nicht still alles Ausgeblendete loeschen.
    const sichtbar = ['2024-08'];
    const bisher = new Set(['2024-08', '2019-03']);
    expect(werteAusChecked(sichtbar, [], bisher)).toEqual(new Set(['2019-03']));
  });
});
