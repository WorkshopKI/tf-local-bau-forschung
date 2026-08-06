import { describe, it, expect } from 'vitest';
import {
  FILTER_BAUM_ROOT, baueFilterBaum, checkedAusWerten, gruppenKnotenId, werteAusChecked,
  wertKnotenId,
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
