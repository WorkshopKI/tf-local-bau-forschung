/**
 * Der Weg zur Detailseite (siehe `detailPfad.ts`).
 *
 * Der Anlass ist gemessen: das Vorgangs-Board schickte die Verbund-Nummer in den
 * Aktenzeichen-Slot, und `#/antraege/ZDS26026` endete in „nicht gefunden". Die
 * Fälle hier sind genau die Verzweigungen, die das Bauteil entscheidet.
 */
import { describe, it, expect } from 'vitest';
import { antragDetailPfad, ANTRAEGE_ROUTE } from '../detailPfad';
import { pseudoVerbundIdFor } from '../pseudoVerbund';

describe('antragDetailPfad', () => {
  it('nimmt für einen Verbund die Verbund-Route', () => {
    expect(antragDetailPfad({ verbundId: 'ZDS26026', aktenzeichen: '16DS260261' }))
      .toBe('/antraege/verbund/ZDS26026');
  });

  it('nimmt ohne Verbund die Antrags-Route', () => {
    expect(antragDetailPfad({ verbundId: null, aktenzeichen: '16EP250023' }))
      .toBe('/antraege/16EP250023');
  });

  it('behandelt einen Pseudo-Verbund als Standalone-Antrag', () => {
    // `__pseudo__…` ist die synthetische Hülle um einen einzelnen Antrag — in der
    // Verbund-Route fände sie niemand.
    expect(antragDetailPfad({
      verbundId: pseudoVerbundIdFor('16EP250023'),
      aktenzeichen: '16EP250023',
    })).toBe('/antraege/16EP250023');
  });

  it('behandelt einen leeren Verbund-Schlüssel wie keinen', () => {
    expect(antragDetailPfad({ verbundId: '', aktenzeichen: '16EP250023' }))
      .toBe('/antraege/16EP250023');
  });

  it('kodiert Sonderzeichen in beiden Routen', () => {
    expect(antragDetailPfad({ verbundId: 'Z/K 1' })).toBe('/antraege/verbund/Z%2FK%201');
    expect(antragDetailPfad({ aktenzeichen: '16A B/2' })).toBe('/antraege/16A%20B%2F2');
  });

  it('hängt den Sprung-Anker an, wo einer gewünscht ist', () => {
    expect(antragDetailPfad({ verbundId: 'ZDS26026', ziel: 'meilensteine' }))
      .toBe('/antraege/verbund/ZDS26026?ziel=meilensteine');
    expect(antragDetailPfad({ aktenzeichen: '16DS260261', ziel: 'meilensteine' }))
      .toBe('/antraege/16DS260261?ziel=meilensteine');
  });

  it('fällt ohne jeden Schlüssel auf die Liste zurück', () => {
    expect(antragDetailPfad({})).toBe(ANTRAEGE_ROUTE);
    expect(antragDetailPfad({ verbundId: null, aktenzeichen: null })).toBe(ANTRAEGE_ROUTE);
  });
});
