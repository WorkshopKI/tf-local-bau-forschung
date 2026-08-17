/**
 * Sicherungen für die Größen-Modi der `SortableTable` und für die gepinnte
 * Kastenbreite.
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
  leiteKastenStil,
  wrapperKlassen,
  istScrollModus,
} from '../tableLayout';
import type { TableSizing } from '../tableSizing';

const SIZING: TableSizing = {
  colPercent: { a: '50.0000%', b: '50.0000%' },
  desiredWidth: 1284,
  renderWidth: 1284,
  floorWidth: 720,
};

describe('leiteModus', () => {
  it('allein fitContentWidth entscheidet zwischen Scroll und Einpassen', () => {
    expect(leiteModus(true)).toBe('scroll');
    expect(leiteModus(false)).toBe('einpassen');
  });

  it('nur der Einpass-Modus darf nicht überlaufen', () => {
    expect(istScrollModus('einpassen')).toBe(false);
    expect(istScrollModus('scroll')).toBe(true);
  });
});

describe('leiteTabellenStil', () => {
  it('rendert in jedem Modus fixed + collapse', () => {
    for (const modus of ['scroll', 'einpassen'] as const) {
      const s = leiteTabellenStil({ modus, sizing: SIZING });
      expect(s.tableLayout).toBe('fixed');
      expect(s.borderCollapse).toBe('collapse');
    }
  });

  it('scroll: Wunschbreite in Pixeln, füllt den Container als Untergrenze', () => {
    const s = leiteTabellenStil({ modus: 'scroll', sizing: SIZING });
    expect(s.width).toBe('1284px');
    expect(s.minWidth).toBe('100%');
    expect(s.flex).toBe('0 0 auto');
  });

  it('scroll: nimmt die BEZUGSGRÖSSE der Prozente, nicht die Spaltensumme', () => {
    // Bei verteiltem Überschuss beziehen sich die `<col>`-Prozente auf den
    // Container. Stünde hier die Spaltensumme, bekäme jede Spalte ihren
    // Prozentsatz von einer anderen Zahl — alle wären um denselben Faktor zu
    // schmal (nachgemessen: 1147/1602).
    const mitUeberschuss: TableSizing = { ...SIZING, desiredWidth: 1147, renderWidth: 1602 };
    const s = leiteTabellenStil({ modus: 'scroll', sizing: mitUeberschuss });
    expect(s.width).toBe('1602px');
  });

  it('rechnet die Griffbreite NICHT mehr heraus — der Griff steht neben dem Scroller', () => {
    const s = leiteTabellenStil({ modus: 'scroll', sizing: SIZING });
    expect(String(s.minWidth)).not.toContain('calc');
  });

  it('einpassen: Wunschbreite als Basis, schrumpfbar bis zum Boden', () => {
    const s = leiteTabellenStil({ modus: 'einpassen', sizing: SIZING });
    expect(s.width).toBe('1284px');
    expect(s.minWidth).toBe('720px');
  });

  it('einpassen WÄCHST auch — sonst bleibt rechts eine Lücke', () => {
    // Der `flex-grow`-Anteil ist der Unterschied zum Scroll-Modus und zum
    // früheren `0 1 auto`: ohne ihn stand die Tabelle bei ihrer Wunschbreite
    // still, sobald die Spaltensumme kleiner war als der Container.
    expect(leiteTabellenStil({ modus: 'einpassen', sizing: SIZING }).flex).toBe('1 1 auto');
    expect(leiteTabellenStil({ modus: 'scroll', sizing: SIZING }).flex).toBe('0 0 auto');
  });

  it('rendert die Tabellenbreite NIE prozentual — das löst in der w-max-Zeile zirkulär auf', () => {
    for (const modus of ['scroll', 'einpassen'] as const) {
      const s = leiteTabellenStil({ modus, sizing: SIZING });
      expect(String(s.width)).not.toContain('%');
    }
  });

  it('kennt die gepinnte Breite nicht mehr — die hängt am Kasten', () => {
    // Vorher pinnte der Griff die TABELLE, während der Kasten containerbreit
    // stehen blieb: zwischen letzter Spalte und Rahmen klaffte die gezogene
    // Breite als leere Fläche. Ein Pin darf die Tabelle deshalb nicht mehr
    // erreichen — sie füllt in jedem Zustand ihren Kasten.
    for (const modus of ['scroll', 'einpassen'] as const) {
      const s = leiteTabellenStil({ modus, sizing: SIZING });
      expect(s.width).toBe(`${modus === 'scroll' ? SIZING.renderWidth : SIZING.desiredWidth}px`);
    }
  });
});

describe('leiteKastenStil', () => {
  it('ohne Pin setzt er gar keine Breite — der Kasten füllt seinen Platz', () => {
    expect(leiteKastenStil(null)).toEqual({});
  });

  it('mit Pin die gezogene Pixelbreite, gedeckelt auf den verfügbaren Platz', () => {
    const s = leiteKastenStil(900);
    expect(s.width).toBe('900px');
    // Ohne Deckel spannte ein Pin, der breiter ist als der Platz, die Seite auf.
    expect(s.maxWidth).toBe('100%');
  });

  it('pinnt nie prozentual — sonst wäre die Breite ihre eigene Bezugsgröße', () => {
    expect(String(leiteKastenStil(900).width)).not.toContain('%');
  });
});

describe('wrapperKlassen', () => {
  it('lässt die Zeile im Scroll-Modus über den Container hinauswachsen', () => {
    expect(wrapperKlassen('scroll')).toContain('w-max');
    expect(wrapperKlassen('scroll')).toContain('min-w-full');
  });

  it('füllt im Einpass-Modus den Container und erlaubt das Schrumpfen', () => {
    const k = wrapperKlassen('einpassen');
    expect(k).toContain('w-full');
    expect(k).toContain('min-w-0');
    expect(k).not.toContain('w-max');
  });
});
