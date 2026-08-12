/**
 * Gemerkte Größe des ziehbaren Suchfelds (v3.50).
 *
 * Ein gespeicherter Unsinn (Fremdformat, Alt-Eintrag, von Hand editierter
 * localStorage) darf das Feld nie unbedienbar klein machen — dann lieber
 * gar keine gemerkte Größe und das Feld füllt wie bisher den freien Platz.
 */
import { describe, it, expect } from 'vitest';
import {
  FELD_MIN_BREITE,
  FELD_MIN_HOEHE,
  parseFeldGroesse,
  serializeFeldGroesse,
} from '../suchseite-utils';

describe('parseFeldGroesse', () => {
  it('nimmt eine gültige Größe', () => {
    expect(parseFeldGroesse('{"w":640,"h":120}')).toEqual({ w: 640, h: 120 });
  });

  it('rundet auf ganze Pixel', () => {
    expect(parseFeldGroesse('{"w":640.4,"h":120.6}')).toEqual({ w: 640, h: 121 });
  });

  it('verwirft alles, was kein Maß ist', () => {
    expect(parseFeldGroesse(null)).toBeNull();
    expect(parseFeldGroesse('')).toBeNull();
    expect(parseFeldGroesse('kaputt')).toBeNull();
    expect(parseFeldGroesse('[]')).toBeNull();
    expect(parseFeldGroesse('{"w":"640","h":120}')).toBeNull();
    expect(parseFeldGroesse('{"w":640}')).toBeNull();
  });

  it('verwirft Maße unter dem Kleinstmaß, statt ein unbedienbares Feld zu bauen', () => {
    expect(parseFeldGroesse(`{"w":${FELD_MIN_BREITE - 1},"h":120}`)).toBeNull();
    expect(parseFeldGroesse(`{"w":640,"h":${FELD_MIN_HOEHE - 1}}`)).toBeNull();
    // Genau auf dem Kleinstmaß ist gültig.
    expect(parseFeldGroesse(`{"w":${FELD_MIN_BREITE},"h":${FELD_MIN_HOEHE}}`))
      .toEqual({ w: FELD_MIN_BREITE, h: FELD_MIN_HOEHE });
  });

  it('ist round-trip-fest', () => {
    const g = { w: 720, h: 96 };
    expect(parseFeldGroesse(serializeFeldGroesse(g))).toEqual(g);
  });
});
