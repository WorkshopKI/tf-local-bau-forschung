/**
 * Geteilte Gantt-Geometrie: Zeichenbreite und Achse.
 *
 * Der viewBox muss der gemessenen Breite folgen. Bliebe er fest, skalierte ein
 * breites Panel die ganze Zeichnung hoch — samt Schrift und Balken (so gesehen
 * im Prüfblatt der Förderfähigkeit, v2.287.1).
 */
import { describe, expect, it } from 'vitest';
import { GANTT_MIN_BREITE, GANTT_W, macheAchse, zeichenBreite } from '../GanttAchse';

describe('Zeichenbreite', () => {
  it('nimmt die gemessene Breite, damit 1 Einheit 1 Pixel bleibt', () => {
    expect(zeichenBreite(1290)).toBe(1290);
  });

  it('rundet auf ganze Pixel', () => {
    expect(zeichenBreite(1289.6)).toBe(1290);
  });

  it('faellt vor der ersten Messung auf das feste Mass zurueck', () => {
    expect(zeichenBreite(null)).toBe(GANTT_W);
    expect(zeichenBreite(0)).toBe(GANTT_W);
    expect(zeichenBreite(Number.NaN)).toBe(GANTT_W);
  });

  it('haelt einen Sockel, statt in schmalen Panels unlesbar zu werden', () => {
    expect(zeichenBreite(320)).toBe(GANTT_MIN_BREITE);
  });
});

describe('Achse', () => {
  it('laesst die Plotflaeche mit der Zeichenbreite wachsen', () => {
    const schmal = macheAchse(12, 1000);
    const breit = macheAchse(12, 1400);
    expect(breit.mw).toBeGreaterThan(schmal.mw);
    expect(breit.plotRight).toBe(1400 - 16);
  });

  it('haelt den Ursprung fest — M1 liegt immer auf derselben Kante', () => {
    expect(macheAchse(12, 1400).x(1)).toBe(macheAchse(12, 1000).x(1));
  });

  it('bleibt ohne Breitenangabe beim festen Mass', () => {
    expect(macheAchse(12).plotRight).toBe(macheAchse(12, GANTT_W).plotRight);
  });

  it('setzt den letzten Monat vor die rechte Plot-Kante', () => {
    const achse = macheAchse(23, 1290);
    expect(achse.x(24)).toBeCloseTo(achse.plotRight, 6);
  });
});
