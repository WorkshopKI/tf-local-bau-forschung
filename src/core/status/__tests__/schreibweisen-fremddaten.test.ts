import { describe, it, expect, afterEach } from 'vitest';
import { setStatusKatalogSnapshot } from '../snapshot';
import { getStatusCategory } from '@/core/utils/status-canonical';
import type { MappingVersion, StatusWertEintrag } from '../typen';

/** Eine Fassung, die Code 72 nur unter der ABKÜRZUNG führt — genau der Stand,
 *  den der Daten-Share am 2026-08-04 als Fassung 12 auslieferte. Im Bestand
 *  steht dort 15× die Langform und 0× die Abkürzung. */
const KURZFORM: StatusWertEintrag = {
  id: 'status::stellungnahme zur rücknahmeempf.',
  feldId: 'status',
  wert: 'stellungnahme zur rücknahmeempf.',
  varianten: ['Stellungnahme zur Rücknahmeempf.'],
  kategorie: 'entscheidung',
  code: 72,
  zahPhaseId: 'entscheidung',
  prominenz: 'normal',
  aktiv: true,
  unkuratiert: false,
};

function fassung(werte: StatusWertEintrag[]): MappingVersion {
  return {
    version: 1,
    autor: 'test',
    zeitstempel: '2026-08-04T00:00:00.000Z',
    kommentar: '',
    felder: [{
      feldId: 'status', label: 'TV-Status', typ: 'wert', ebene: 'tv',
      prominenzDefault: 'normal', aktiv: true, unkuratiert: false,
    }],
    werte,
  };
}

afterEach(() => { setStatusKatalogSnapshot(null); });

describe('Schreibweisen eines codierten Werts kommen aus dem Code-Katalog', () => {
  it('die amtliche Langform löst auf, auch wenn die Fassung sie nicht führt', () => {
    setStatusKatalogSnapshot(fassung([KURZFORM]));
    expect(getStatusCategory('Stellungnahme zur Rücknahmeempfehlung')).toBe('in_pruefung');
  });

  it('die kuratierte Schreibweise löst weiterhin auf', () => {
    setStatusKatalogSnapshot(fassung([KURZFORM]));
    expect(getStatusCategory('stellungnahme zur rücknahmeempf.')).toBe('in_pruefung');
  });

  it('eine umgehängte Phase ändert die Arbeitsliste NICHT', () => {
    // Bis v4.86 gewann hier die Fassung: Code 72 an `abgeschlossen` gehängt
    // hieß Arbeitsliste `abgeschlossen`. Genau dieser Weg ist mit v4.87 zu —
    // die Arbeitsliste hängt am Code. Ergänzt werden weiterhin NUR
    // Schreibweisen, nie Kategorien.
    setStatusKatalogSnapshot(fassung([{ ...KURZFORM, zahPhaseId: 'abgeschlossen' }]));
    expect(getStatusCategory('Stellungnahme zur Rücknahmeempfehlung')).toBe('in_pruefung');
  });
});
