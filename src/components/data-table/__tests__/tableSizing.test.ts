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
