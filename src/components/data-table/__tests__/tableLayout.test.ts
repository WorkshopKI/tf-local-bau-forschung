/**
 * Sicherungen für die drei Größen-Modi der `SortableTable`.
 *
 * Bis zum Schnitt standen sie nur als Tabelle im Dateikopf und waren allein per
 * Auge prüfbar. Die Layout-WIRKUNG (staucht die Tabelle wirklich?) bleibt eine
 * Frage an eine echte Engine — geprüft wird hier, dass jeder Modus die Stil-
 * Eigenschaften setzt, von denen diese Wirkung abhängt.
 */
import { describe, it, expect } from 'vitest';
import {
  leiteModus,
  leiteTabellenStil,
  wrapperKlassen,
  istScrollModus,
} from '../tableLayout';
import type { TableSizing } from '../tableSizing';

const SIZING: TableSizing = {
  colPercent: { a: '50.0000%', b: '50.0000%' },
  desiredWidth: 1284,
  floorWidth: 720,
};

describe('leiteModus', () => {
  it('gepinnte Breite schlägt fitContentWidth', () => {
    expect(leiteModus(true, true)).toBe('gepinnt');
    expect(leiteModus(true, false)).toBe('gepinnt');
  });

  it('ohne Pin entscheidet fitContentWidth zwischen Scroll und Einpassen', () => {
    expect(leiteModus(false, true)).toBe('scroll');
    expect(leiteModus(false, false)).toBe('einpassen');
  });

  it('nur der Einpass-Modus darf nicht überlaufen', () => {
    expect(istScrollModus('einpassen')).toBe(false);
    expect(istScrollModus('scroll')).toBe(true);
    expect(istScrollModus('gepinnt')).toBe(true);
  });
});

describe('leiteTabellenStil', () => {
  it('rendert in jedem Modus fixed + collapse', () => {
    for (const modus of ['gepinnt', 'scroll', 'einpassen'] as const) {
      const s = leiteTabellenStil({ modus, sizing: SIZING, totalWidth: 900 });
      expect(s.tableLayout).toBe('fixed');
      expect(s.borderCollapse).toBe('collapse');
    }
  });

  it('gepinnt: exakte Pixelbreite, kein Schrumpfen, KEIN min-width', () => {
    const s = leiteTabellenStil({ modus: 'gepinnt', sizing: SIZING, totalWidth: 900 });
    expect(s.width).toBe('900px');
    expect(s.flex).toBe('0 0 auto');
    // Ein min-width hier hielte die Tabelle über der gezogenen Breite fest.
    expect(s.minWidth).toBeUndefined();
  });

  it('scroll: Wunschbreite in Pixeln, füllt den Container als Untergrenze', () => {
    const s = leiteTabellenStil({ modus: 'scroll', sizing: SIZING, totalWidth: null });
    expect(s.width).toBe('1284px');
    expect(s.minWidth).toBe('100%');
    expect(s.flex).toBe('0 0 auto');
  });

  it('rechnet die Griffbreite NICHT mehr heraus — der Griff steht neben dem Scroller', () => {
    const s = leiteTabellenStil({ modus: 'scroll', sizing: SIZING, totalWidth: null });
    expect(String(s.minWidth)).not.toContain('calc');
  });

  it('einpassen: Wunschbreite, aber schrumpfbar bis zum Boden', () => {
    const s = leiteTabellenStil({ modus: 'einpassen', sizing: SIZING, totalWidth: null });
    expect(s.width).toBe('1284px');
    expect(s.minWidth).toBe('720px');
    // `0 1 auto` ist der Unterschied zu den Scroll-Modi: nur hier greift flex-shrink.
    expect(s.flex).toBe('0 1 auto');
  });

  it('rendert die Tabellenbreite NIE prozentual — das löst in der w-max-Zeile zirkulär auf', () => {
    for (const modus of ['gepinnt', 'scroll', 'einpassen'] as const) {
      const s = leiteTabellenStil({ modus, sizing: SIZING, totalWidth: 900 });
      expect(String(s.width)).not.toContain('%');
    }
  });
});

describe('wrapperKlassen', () => {
  it('lässt die Zeile in den Scroll-Modi über den Container hinauswachsen', () => {
    for (const modus of ['scroll', 'gepinnt'] as const) {
      expect(wrapperKlassen(modus)).toContain('w-max');
      expect(wrapperKlassen(modus)).toContain('min-w-full');
    }
  });

  it('füllt im Einpass-Modus den Container und erlaubt das Schrumpfen', () => {
    const k = wrapperKlassen('einpassen');
    expect(k).toContain('w-full');
    expect(k).toContain('min-w-0');
    expect(k).not.toContain('w-max');
  });
});
