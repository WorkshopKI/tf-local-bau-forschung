import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

/**
 * **Der Trichter gehört in die Chip-Zeile** (v4.131).
 *
 * Er wird erst in `applyColumnFilters` angewandt — hinter `useFilteredAntraege`
 * und damit hinter allem, was die Chip-Zeile führt — und liegt in localStorage.
 * Gemessen: ein liegengebliebenes `bib_kuerz = MKo` machte aus der vom
 * Startseiten-Widget zugesagten „Kritisch 30" eine Tabelle mit 2 Zeilen.
 * `setActiveView` fasst ihn nicht an (nur den Ampel-Quickfilter) — die Zeile
 * muss ihn also zeigen, sonst filtert er unsichtbar weiter.
 */
describe('Spaltenkopf-Auswahl — sichtbar in der Chip-Zeile', () => {
  const quelle = readFileSync(
    resolve(process.cwd(), 'src/plugins/antraege/AntraegeMain.tsx'), 'utf8',
  );

  it('AntraegeMain baut Chips aus dem Kopf-Stand und kann sie entfernen', () => {
    expect(quelle).toMatch(/const kopfChips = useMemo/);
    expect(quelle).toMatch(/setzeKopfSpalte\(c\.key, new Set\(\)\)/);
  });

  it('zeigt nur Spalten, die die Tabelle gerade führt (sonst wirkungslos)', () => {
    // `applyColumnFilters` überspringt unbekannte Keys (`if (!col) return true`);
    // ein Chip dafür behauptete eine Wirkung, die es nicht gibt.
    expect(quelle).toMatch(/werte\.size > 0 && label\.has\(key\)/);
  });

  it('die Chip-Zeile erscheint auch, wenn NUR ein Trichter steht', () => {
    expect(quelle).toMatch(/kopfChips\.length > 0\) \? \(/);
  });
});
