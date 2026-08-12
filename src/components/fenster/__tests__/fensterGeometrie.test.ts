/**
 * Die grosse Fensterform. Die angedockte Form prueft weiterhin
 * `help/__tests__/hilfeFensterDokument.test.ts` — sie ist dort seit v2.402
 * beschrieben, und der Umzug nach `components/fenster/` hat sie nicht
 * angefasst. Das ist Absicht: eine gehobene Funktion, deren Bestandstest
 * unveraendert gruen bleibt, ist bewiesen unveraendert.
 */
import { describe, expect, it } from 'vitest';
import {
  GROSS_MIN_BREITE,
  GROSS_MIN_HOEHE,
  berechneGrossGeometrie,
  fensterFeatures,
} from '../fensterGeometrie';

describe('berechneGrossGeometrie', () => {
  it('nimmt 92% der nutzbaren Flaeche und sitzt mittig', () => {
    const g = berechneGrossGeometrie({ availWidth: 1920, availHeight: 1080 });
    expect(g.breite).toBe(1766); // 1920 * 0.92
    expect(g.hoehe).toBe(994); // 1080 * 0.92
    // Mittig: links + breite + links === availWidth (auf Rundung genau)
    expect(g.links).toBe(77);
    expect(g.oben).toBe(43);
    expect(g.links * 2 + g.breite).toBeGreaterThanOrEqual(1919);
    expect(g.links * 2 + g.breite).toBeLessThanOrEqual(1921);
  });

  it('haelt den Boden ein, wenn der Schirm kleiner ist', () => {
    const g = berechneGrossGeometrie({ availWidth: 800, availHeight: 500 });
    expect(g.breite).toBe(GROSS_MIN_BREITE);
    expect(g.hoehe).toBe(GROSS_MIN_HOEHE);
  });

  it('legt die linke Kante nie vor den Schirm-Ursprung', () => {
    // Fenster breiter als die Flaeche: (800-900)/2 waere -50 — die Kopfzeile
    // mit dem Schliessen-Knopf laege dann ausserhalb.
    const g = berechneGrossGeometrie({ availWidth: 800, availHeight: 500, availLeft: 0, availTop: 0 });
    expect(g.links).toBe(0);
    expect(g.oben).toBe(0);
  });

  it('folgt dem zweiten Monitor (availLeft/availTop)', () => {
    const g = berechneGrossGeometrie({
      availWidth: 1920, availHeight: 1080, availLeft: 1920, availTop: 30,
    });
    expect(g.links).toBe(1920 + 77);
    expect(g.oben).toBe(30 + 43);
  });
});

describe('fensterFeatures', () => {
  it('traegt popup=yes und KEIN noopener', () => {
    // noopener macht das Handle null — damit waere die ganze Mechanik tot.
    const f = fensterFeatures(berechneGrossGeometrie({ availWidth: 1920, availHeight: 1080 }));
    expect(f).toContain('popup=yes');
    expect(f).not.toContain('noopener');
    expect(f).toContain('width=1766');
    expect(f).toContain('height=994');
  });
});
