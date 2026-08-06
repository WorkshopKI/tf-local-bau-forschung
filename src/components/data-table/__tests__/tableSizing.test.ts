/**
 * Sicherungen für die Spaltenbreiten-Rechnung der `SortableTable`.
 *
 * Die Layout-Wirkung selbst (staucht die Tabelle wirklich?) lässt sich in jsdom
 * nicht prüfen — es gibt keine Layout-Engine. Getestet wird deshalb der
 * rechnerische Kern: dass die `<col>` als Prozent herauskommen (der Grund, warum
 * die Tabelle überhaupt schrumpfen kann) und die Verhältnisse stimmen.
 */
import { describe, it, expect } from 'vitest';
import {
  computeTableSizing,
  effectiveColumnWidth,
  verteileUeberschuss,
  DEFAULT_COLUMN_WIDTH,
  RESPONSIVE_MIN_WIDTH,
} from '../tableSizing';
import type { SortableColumn } from '../types';

interface Row { a: string }

function col(key: string, width?: number): SortableColumn<Row> {
  return {
    key,
    label: key,
    defaultVisible: true,
    sortable: false,
    width,
    accessor: r => r.a,
    render: () => null,
  };
}

/** Die Default-Spalten der Skill-Tabelle: Summe 1284px. */
const SKILL_COLUMNS = [
  col('name', 220), col('kategorie', 150), col('status', 130), col('beschreibung', 360),
  col('version', 80), col('geaendert', 110), col('regeln', 110), col('aktionen', 124),
];

function pctNumber(v: string | undefined): number {
  return Number.parseFloat(v ?? '0');
}

describe('computeTableSizing', () => {
  it('rendert Prozent statt Pixel — sonst wäre die Spaltensumme ein harter Boden', () => {
    const s = computeTableSizing(SKILL_COLUMNS, undefined);
    for (const c of SKILL_COLUMNS) {
      expect(s.colPercent[c.key]).toMatch(/^\d+(\.\d+)?%$/);
    }
  });

  it('summiert die Spalten auf 100 % (± Rundung)', () => {
    const s = computeTableSizing(SKILL_COLUMNS, undefined);
    const sum = SKILL_COLUMNS.reduce((acc, c) => acc + pctNumber(s.colPercent[c.key]), 0);
    expect(sum).toBeCloseTo(100, 2);
  });

  it('hält die Verhältnisse der Pixelbreiten ein', () => {
    const s = computeTableSizing(SKILL_COLUMNS, undefined);
    expect(s.desiredWidth).toBe(1284);
    // Beschreibung (360) ist exakt doppelt so breit wie Name/2 … prüfen wir direkt:
    expect(pctNumber(s.colPercent.beschreibung)).toBeCloseTo((360 / 1284) * 100, 3);
    expect(pctNumber(s.colPercent.name) / pctNumber(s.colPercent.version)).toBeCloseTo(220 / 80, 3);
  });

  it('nimmt User-Overrides vor der Default-Breite', () => {
    const s = computeTableSizing(SKILL_COLUMNS, { name: 420 });
    expect(s.desiredWidth).toBe(1284 - 220 + 420);
    expect(pctNumber(s.colPercent.name)).toBeCloseTo((420 / s.desiredWidth) * 100, 3);
  });

  it('ignoriert unbrauchbare Overrides (0, negativ, NaN)', () => {
    for (const bad of [0, -50, Number.NaN]) {
      expect(effectiveColumnWidth(col('x', 200), { x: bad })).toBe(200);
    }
  });

  it('fällt für Spalten ohne width auf die Default-Breite zurück', () => {
    const s = computeTableSizing([col('a'), col('b', 280)], undefined);
    expect(s.desiredWidth).toBe(DEFAULT_COLUMN_WIDTH + 280);
  });

  it('deckelt den Boden auf die Wunschbreite — schmale Tabellen bekommen keinen künstlichen Mindestbedarf', () => {
    const schmal = computeTableSizing([col('a', 120), col('b', 140), col('c', 140)], undefined);
    expect(schmal.desiredWidth).toBe(400);
    expect(schmal.floorWidth).toBe(400);

    const breit = computeTableSizing(SKILL_COLUMNS, undefined);
    expect(breit.floorWidth).toBe(RESPONSIVE_MIN_WIDTH);
  });

  it('respektiert einen eigenen responsiveMin', () => {
    const s = computeTableSizing(SKILL_COLUMNS, undefined, { responsiveMin: 500 });
    expect(s.floorWidth).toBe(500);
  });

  it('zieht die gerade gezogene Spalte mit ihrer Live-Breite in die Verteilung', () => {
    const s = computeTableSizing(SKILL_COLUMNS, undefined, { draggedKey: 'name', draggedWidth: 400 });
    expect(s.desiredWidth).toBe(1284 - 220 + 400);
    expect(pctNumber(s.colPercent.name)).toBeCloseTo((400 / s.desiredWidth) * 100, 3);
    // Die ungezogenen Spalten geben anteilig ab.
    expect(pctNumber(s.colPercent.version)).toBeCloseTo((80 / s.desiredWidth) * 100, 3);
  });

  it('bleibt bei leerer Spaltenliste harmlos', () => {
    const s = computeTableSizing([], undefined);
    expect(s.colPercent).toEqual({});
    expect(s.desiredWidth).toBe(0);
    expect(s.floorWidth).toBe(0);
  });
});

describe('gemessene Inhaltsbreiten — Rang in der Kette', () => {
  it('schlägt die gepflegte column.width', () => {
    expect(effectiveColumnWidth(col('x', 200), undefined, { x: 260 })).toBe(260);
  });

  it('unterliegt aber dem gezogenen User-Override', () => {
    expect(effectiveColumnWidth(col('x', 200), { x: 150 }, { x: 260 })).toBe(150);
  });

  it('greift nicht für Spalten, die nicht gemessen wurden', () => {
    expect(effectiveColumnWidth(col('y', 200), undefined, { x: 260 })).toBe(200);
  });

  it('ignoriert unbrauchbare Messwerte (0, negativ, NaN) und fällt auf die width zurück', () => {
    for (const bad of [0, -50, Number.NaN]) {
      expect(effectiveColumnWidth(col('x', 200), undefined, { x: bad })).toBe(200);
    }
  });

  it('fließt in die Wunschbreite und damit in die Prozent-Verteilung ein', () => {
    const s = computeTableSizing(SKILL_COLUMNS, undefined, { gemessen: { name: 300 } });
    expect(s.desiredWidth).toBe(1284 - 220 + 300);
    expect(pctNumber(s.colPercent.name)).toBeCloseTo((300 / s.desiredWidth) * 100, 3);
  });

  it('gilt auch während eines Drags für die NICHT gezogenen Spalten', () => {
    // Ohne `gemessen` im Live-Aufruf fielen die Nachbarn mitten im Zug auf ihre
    // gepflegte Breite zurück und sprängen sichtbar.
    const s = computeTableSizing(SKILL_COLUMNS, undefined, {
      gemessen: { name: 300, version: 200 },
      draggedKey: 'name',
      draggedWidth: 400,
    });
    expect(s.desiredWidth).toBe(1284 - 220 - 80 + 400 + 200);
    expect(pctNumber(s.colPercent.version)).toBeCloseTo((200 / s.desiredWidth) * 100, 3);
  });
});

describe('verteileUeberschuss', () => {
  const basis = (...t: [string, number, number][]): { key: string; breite: number; hunger: number }[] =>
    t.map(([key, breite, hunger]) => ({ key, breite, hunger }));

  it('rührt nichts an, wenn der Container schmaler ist als die Spaltensumme', () => {
    const r = verteileUeberschuss(basis(['a', 200, 50], ['b', 300, 0]), 400);
    expect(r.breiten).toEqual({ a: 200, b: 300 });
    expect(r.fueller).toBe(0);
  });

  it('gibt jeder hungrigen Spalte genau ihren Fehlbetrag, wenn der Platz reicht', () => {
    // Summe 500, Container 700 → 200 Überschuss, Hunger 30+20 = 50.
    const r = verteileUeberschuss(basis(['a', 200, 30], ['b', 300, 20]), 700);
    expect(r.breiten).toEqual({ a: 230, b: 320 });
    // Was keine Spalte brauchen kann, bleibt liegen — es fließt NICHT zurück in
    // die Verteilung, sonst wären wir wieder beim proportionalen Aufblasen.
    expect(r.fueller).toBe(150);
  });

  it('teilt anteilig und deckelt bei knappem Platz auf den eigenen Bedarf', () => {
    // Überschuss 60, Hunger 90+30 = 120 → a bekommt 45, b bekommt 15.
    const r = verteileUeberschuss(basis(['a', 100, 90], ['b', 100, 30]), 260);
    expect(r.breiten.a).toBeCloseTo(145, 6);
    expect(r.breiten.b).toBeCloseTo(115, 6);
    expect(r.fueller).toBeCloseTo(0, 6);
  });

  it('lässt satte Spalten unangetastet — der Platz geht nur an abgeschnittene', () => {
    const r = verteileUeberschuss(basis(['schmal', 80, 0], ['breit', 300, 200]), 700);
    expect(r.breiten.schmal).toBe(80);
    expect(r.breiten.breit).toBe(500);
  });

  it('parkt alles im Füller, wenn keine Spalte hungrig ist', () => {
    const r = verteileUeberschuss(basis(['a', 100, 0], ['b', 100, 0]), 500);
    expect(r.breiten).toEqual({ a: 100, b: 100 });
    expect(r.fueller).toBe(300);
  });

  it('behandelt negativen Hunger wie keinen', () => {
    const r = verteileUeberschuss(basis(['a', 100, -40], ['b', 100, 50]), 300);
    expect(r.breiten.a).toBe(100);
    expect(r.breiten.b).toBe(150);
  });
});

describe('Überschuss in computeTableSizing', () => {
  const COLS = [col('fkz', 140), col('name', 300), col('frist', 60)];

  it('bläst schmale Spalten nicht mehr auf — der Platz geht an die abgeschnittene', () => {
    // Ohne containerBreite bekäme jede Spalte proportional mehr.
    const s = computeTableSizing(COLS, undefined, {
      gemessen: { fkz: 140, name: 300, frist: 60 },
      wunsch: { fkz: 140, name: 420, frist: 60 },
      containerBreite: 700,
    });
    // Bezug ist der Container: 140/700, 420/700, 60/700 … plus Füller.
    expect(pctNumber(s.colPercent.fkz)).toBeCloseTo((140 / 700) * 100, 3);
    expect(pctNumber(s.colPercent.frist)).toBeCloseTo((60 / 700) * 100, 3);
    expect(pctNumber(s.colPercent.name)).toBeCloseTo((420 / 700) * 100, 3);
  });

  it('summiert Spalten UND Füller auf 100 % — darunter bläst der Browser wieder auf', () => {
    const s = computeTableSizing(COLS, undefined, {
      gemessen: { fkz: 140, name: 300, frist: 60 },
      wunsch: { fkz: 140, name: 420, frist: 60 },
      containerBreite: 900,
    });
    const summe = COLS.reduce((n, c) => n + pctNumber(s.colPercent[c.key]), 0)
      + pctNumber(s.fuellerPercent);
    expect(summe).toBeCloseTo(100, 2);
  });

  it('schützt eine gezogene Spalte: ein Override zählt nie als hungrig', () => {
    const s = computeTableSizing(COLS, { name: 200 }, {
      gemessen: { fkz: 140, name: 300, frist: 60 },
      wunsch: { fkz: 140, name: 420, frist: 60 },
      containerBreite: 900,
    });
    // Die schmal gezogene Spalte bleibt bei 200 — der ganze Überschuss wird Füller.
    expect(pctNumber(s.colPercent.name)).toBeCloseTo((200 / 900) * 100, 3);
    expect(pctNumber(s.fuellerPercent)).toBeCloseTo((500 / 900) * 100, 3);
  });

  it('setzt keinen Füller, wenn der Container schmaler ist als die Spalten', () => {
    const s = computeTableSizing(COLS, undefined, {
      gemessen: { fkz: 140, name: 300, frist: 60 },
      wunsch: { fkz: 140, name: 420, frist: 60 },
      containerBreite: 300,
    });
    expect(s.fuellerPercent).toBeUndefined();
    expect(pctNumber(s.colPercent.fkz)).toBeCloseTo((140 / 500) * 100, 3);
  });

  it('lässt ohne wunsch-Map jede Spalte auf ihrer Pixelbreite stehen', () => {
    // Ohne Hunger-Wissen kann keine Spalte etwas gebrauchen → alles wird Füller.
    // Die Prozente ändern sich (Bezug ist jetzt der Container), die PIXEL nicht —
    // und genau das ist die Zusage.
    const s = computeTableSizing(COLS, undefined, { containerBreite: 900 });
    for (const c of COLS) {
      expect((pctNumber(s.colPercent[c.key]) / 100) * 900).toBeCloseTo(c.width!, 2);
    }
    expect(pctNumber(s.fuellerPercent)).toBeCloseTo((400 / 900) * 100, 3);
  });

  it('zieht die gerade gezogene Spalte aus der Hunger-Rechnung heraus', () => {
    // Sonst zöge die Verteilung während des Zugs gegen den Cursor.
    const s = computeTableSizing(COLS, undefined, {
      gemessen: { fkz: 140, name: 300, frist: 60 },
      wunsch: { fkz: 140, name: 420, frist: 60 },
      containerBreite: 900,
      draggedKey: 'name',
      draggedWidth: 250,
    });
    expect(pctNumber(s.colPercent.name)).toBeCloseTo((250 / 900) * 100, 3);
  });
});
