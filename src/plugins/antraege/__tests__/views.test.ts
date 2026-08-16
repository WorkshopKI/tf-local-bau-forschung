import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { getView, viewCount, viewCounts, type ViewKey } from '../views';
import { parseBearbeiterFilter } from '../bearbeiterFilter';
import { REAL_CSV_ANTRAEGE, TEST_TODAY } from './fixtures/real-csv-antraege';
import { isOpenStatus } from '@/core/utils/status-canonical';
import { fristTageVon } from '../fristAnzeige';

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(TEST_TODAY));
});
afterAll(() => {
  vi.useRealTimers();
});

/** Erwartete Counts pro View gegen die CSV-Rohwert-Fixture.
 *  Die Fixture führt 3× „VN geprüft" (Kategorie begleitung); eine davon
 *  (REAL-014) ist zugleich Irrläufer (vb_phase=9). Antragsphase = offen ohne
 *  Begleitung: 11 − 2 = 9 bzw. 13 − 3 = 10. */
const EXPECTED: Record<ViewKey, { withPreFilter: number; withoutPreFilter: number }> = {
  meine_offenen: { withPreFilter: 9, withoutPreFilter: 10 },
  // „Fristen" = alles mit LAUFENDER Uhr ausserhalb der Begleitphase — also die
  // Vereinigung der frueheren Sichten „Diese Woche" und „Ueberfaellig" plus
  // allem, was noch Zeit hat.
  fristen: { withPreFilter: 7, withoutPreFilter: 8 },
  begleitung: { withPreFilter: 2, withoutPreFilter: 3 },
  alle: { withPreFilter: 18, withoutPreFilter: 20 },
};

describe('viewCount', () => {
  for (const key of Object.keys(EXPECTED) as ViewKey[]) {
    const exp = EXPECTED[key];
    it(`${key} mit Pre-Filter (vb_phase=9 ausgeblendet) → ${exp.withPreFilter}`, () => {
      expect(viewCount(key, [...REAL_CSV_ANTRAEGE], undefined, true)).toBe(exp.withPreFilter);
    });
    it(`${key} OHNE Pre-Filter (Irrlaeufer sichtbar) → ${exp.withoutPreFilter}`, () => {
      expect(viewCount(key, [...REAL_CSV_ANTRAEGE], undefined, false)).toBe(exp.withoutPreFilter);
    });
  }
});

describe('viewCount — Edge-Cases', () => {
  it('leerer Array → 0 fuer alle Views', () => {
    for (const v of ['meine_offenen', 'alle', 'fristen', 'begleitung'] as ViewKey[]) {
      expect(viewCount(v, [], undefined, true)).toBe(0);
    }
  });
  it('Antrag ohne status → faellt aus isOpenStatus / meine_offenen', () => {
    const noStatus = [{
      aktenzeichen: 'X', programm_id: 'P', _updated_at: '2026-01-01T00:00:00Z',
    }];
    expect(viewCount('meine_offenen', noStatus as never, undefined, true)).toBe(0);
  });
  it('Default-Wert fuer applyVbPhasePreFilter ist true', () => {
    expect(viewCount('alle', [...REAL_CSV_ANTRAEGE])).toBe(EXPECTED.alle.withPreFilter);
  });
});

describe('Bearbeiter-Filter', () => {
  // Bearbeiter='ABC' matcht items mit tib_kuerz='abc'
  const bearb = parseBearbeiterFilter('ABC', false);
  it('viewCount(alle, bearbeiter=ABC) — nur tib_kuerz="abc" Items', () => {
    // Items mit tib_kuerz='abc': REAL-016, REAL-018
    expect(viewCount('alle', [...REAL_CSV_ANTRAEGE], bearb, true)).toBe(2);
  });
  it('viewCount(meine_offenen, bearbeiter=ABC) — nur das offene davon (REAL-016)', () => {
    expect(viewCount('meine_offenen', [...REAL_CSV_ANTRAEGE], bearb, true)).toBe(1);
  });
  it('viewCount(begleitung, bearbeiter=ABC) — keins der beiden ist in Begleitung', () => {
    expect(viewCount('begleitung', [...REAL_CSV_ANTRAEGE], bearb, true)).toBe(0);
  });
});

describe('viewCount — der Profil-Haken blendet nichts mehr aus', () => {
  // „vn geprüft" → Kategorie begleitung. isOpenStatus schließt Begleitung ein;
  // die Sichtbarkeit hängt seit v2.404 an der Sicht, nicht am Profil-Haken.
  const data = [
    { aktenzeichen: 'BEGLEIT-1', programm_id: 'P', status: 'vn geprüft', _updated_at: '2026-01-01T00:00:00Z' },
    { aktenzeichen: 'OFFEN-1', programm_id: 'P', status: 'techn geprüft', _updated_at: '2026-01-01T00:00:00Z' },
  ] as never;

  it('includeBegleitung=false zählt Begleitung genauso mit wie true', () => {
    const aus = parseBearbeiterFilter('alle', false);
    const an = parseBearbeiterFilter('alle', true);
    expect(viewCount('meine_offenen', data, aus, true)).toBe(1);
    expect(viewCount('meine_offenen', data, an, true)).toBe(1);
  });

  it('ohne bearbeiter-Mode identisch', () => {
    expect(viewCount('meine_offenen', data, undefined, true)).toBe(1);
  });

  it('begleitung zählt den Begleitphase-Datensatz, unabhängig vom Profil-Haken', () => {
    expect(viewCount('begleitung', data, undefined, true)).toBe(1);
  });
});

describe('getView — Fallback', () => {
  it('liefert bekannten View', () => {
    expect(getView('alle').key).toBe('alle');
  });
  it('liefert Fallback bei unbekanntem Key', () => {
    expect(getView('fantasie' as ViewKey).key).toBe('alle');
  });
});

describe('Antragsphase und Begleitung teilen isOpenStatus auf', () => {
  const antragsphase = getView('meine_offenen');
  const begleitung = getView('begleitung');

  it('sind disjunkt', () => {
    const doppelt = REAL_CSV_ANTRAEGE.filter(
      a => antragsphase.predicate(a) && begleitung.predicate(a),
    );
    expect(doppelt).toEqual([]);
  });

  it('ergeben zusammen genau isOpenStatus', () => {
    const zusammen = REAL_CSV_ANTRAEGE.filter(
      a => antragsphase.predicate(a) || begleitung.predicate(a),
    ).length;
    const offen = REAL_CSV_ANTRAEGE.filter(a => isOpenStatus(a.status)).length;
    expect(zusammen).toBe(offen);
  });

  it('viewCounts stimmt je Sicht mit viewCount überein', () => {
    const counts = viewCounts([...REAL_CSV_ANTRAEGE], undefined, true);
    for (const key of Object.keys(EXPECTED) as ViewKey[]) {
      expect(counts[key]).toBe(viewCount(key, [...REAL_CSV_ANTRAEGE], undefined, true));
    }
  });
});

describe('Die Fristen-Sicht rechnet die Antragsphase, nie die Begleitung', () => {
  // Eigene Daten statt der Fixture: hier ist je ein Begleit-Datensatz gebaut,
  // der ohne den Guard sicher zählen WÜRDE — beide tragen ein Antragsdatum und
  // damit eine laufende Uhr.
  const daten = [
    { aktenzeichen: 'B-ALT', programm_id: 'P', status: 'VN geprüft', antragsdatum: '2026-01-01', _updated_at: '2026-01-01T00:00:00Z' },
    { aktenzeichen: 'B-FENSTER', programm_id: 'P', status: 'Widerruf', antragsdatum: '2026-02-14', _updated_at: '2026-01-01T00:00:00Z' },
    // Gegenprobe aus der Antragsphase, damit der Test nicht nur Nullen prüft.
    { aktenzeichen: 'A-ALT', programm_id: 'P', status: 'techn geprüft', antragsdatum: '2026-01-01', _updated_at: '2026-01-01T00:00:00Z' },
  ] as never;

  it('„Fristen" enthält keine Begleitung', () => {
    expect(viewCount('fristen', daten, undefined, true)).toBe(1);
  });

  it('dieselben Datensätze zählen sehr wohl in der Sicht „Begleitung"', () => {
    expect(viewCount('begleitung', daten, undefined, true)).toBe(2);
  });

  it('viewCounts zieht dieselbe Grenze wie viewCount', () => {
    const counts = viewCounts(daten, undefined, true);
    expect(counts.fristen).toBe(1);
    expect(counts.begleitung).toBe(2);
  });
});

describe('„Fristen" fasst zusammen, was vorher zwei Reiter waren', () => {
  const fristen = getView('fristen');

  it('enthält jeden überfälligen und jeden diese Woche fälligen Antrag', () => {
    const drin = REAL_CSV_ANTRAEGE.filter(a => fristen.predicate(a));
    // Die beiden früheren Sicht-Definitionen, hier als Prüfmaß nachgebaut.
    const frueher = REAL_CSV_ANTRAEGE.filter(a => {
      const t = fristTageVon(a);
      return t !== null && t <= 6 && !drin.every(d => d.aktenzeichen !== a.aktenzeichen);
    });
    for (const a of frueher) expect(drin).toContain(a);
    expect(frueher.length).toBeGreaterThan(0);
  });

  it('nimmt keinen Antrag ohne laufende Uhr auf', () => {
    for (const a of REAL_CSV_ANTRAEGE.filter(x => fristen.predicate(x))) {
      expect(fristTageVon(a)).not.toBeNull();
    }
  });
});
