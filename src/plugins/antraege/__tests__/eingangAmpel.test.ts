import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import {
  getEingangAmpel,
  daysSinceEingang,
  getAmpelBucket,
  countByAmpelBucket,
} from '../eingangAmpel';
import { isIrrlaeufer } from '@/core/utils/vb-phase-mappings';
import { parseBearbeiterFilter } from '../bearbeiterFilter';
import { SEED_ANTRAEGE, TEST_TODAY } from './fixtures/seed-antraege';
import { REAL_CSV_ANTRAEGE } from './fixtures/real-csv-antraege';
import type { AntragListItem } from '@/core/services/csv/types';

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(TEST_TODAY));
});
afterAll(() => {
  vi.useRealTimers();
});

function mk(p: Partial<AntragListItem> & { aktenzeichen: string }): AntragListItem {
  return { programm_id: 'P', _updated_at: '2026-01-01T00:00:00Z', ...p };
}

describe('getEingangAmpel — Schwellen', () => {
  it('≤30d & open → gruen', () => {
    expect(getEingangAmpel(mk({
      aktenzeichen: 'A', status: 'eingereicht', antragsdatum: '2026-04-20',
    }))).toBe('gruen');
  });
  it('31-60d & open → gelb', () => {
    expect(getEingangAmpel(mk({
      aktenzeichen: 'A', status: 'eingereicht', antragsdatum: '2026-04-01',
    }))).toBe('gelb');
  });
  it('61-90d & open → orange', () => {
    expect(getEingangAmpel(mk({
      aktenzeichen: 'A', status: 'eingereicht', antragsdatum: '2026-03-01',
    }))).toBe('orange');
  });
  it('>90d & open → rot', () => {
    expect(getEingangAmpel(mk({
      aktenzeichen: 'A', status: 'eingereicht', antragsdatum: '2026-01-01',
    }))).toBe('rot');
  });
});

describe('getEingangAmpel — Ausschluesse → null', () => {
  it('bewilligung_datum gesetzt → null', () => {
    expect(getEingangAmpel(mk({
      aktenzeichen: 'A', status: 'bewilligt', antragsdatum: '2026-01-01',
      bewilligung_datum: '2026-03-01',
    }))).toBeNull();
  });
  it('antragsdatum fehlt → null', () => {
    expect(getEingangAmpel(mk({
      aktenzeichen: 'A', status: 'eingereicht',
    }))).toBeNull();
  });
  it('antragsdatum ungueltig → null', () => {
    expect(getEingangAmpel(mk({
      aktenzeichen: 'A', status: 'eingereicht', antragsdatum: 'nicht-ein-datum',
    }))).toBeNull();
  });
  it('antragsdatum in der Zukunft → null', () => {
    expect(getEingangAmpel(mk({
      aktenzeichen: 'A', status: 'eingereicht', antragsdatum: '2099-01-01',
    }))).toBeNull();
  });
  it('Status abgelehnt (closed) → null, auch ohne bewilligung_datum', () => {
    expect(getEingangAmpel(mk({
      aktenzeichen: 'A', status: 'abgelehnt', antragsdatum: '2026-04-20',
    }))).toBeNull();
  });
  it('Foerderantrag "Schlussvermerk" (abgeschlossen) → null', () => {
    expect(getEingangAmpel(mk({
      aktenzeichen: 'A', status: 'Schlussvermerk', antragsdatum: '2026-04-20',
    }))).toBeNull();
  });
  it('Foerderantrag "abgelehnt/zurückgezogen" (abgeschlossen) → null', () => {
    expect(getEingangAmpel(mk({
      aktenzeichen: 'A', status: 'abgelehnt/zurückgezogen', antragsdatum: '2026-04-20',
    }))).toBeNull();
  });
  // Hinweis: Foerderantrag "Ablehnung" zaehlt jetzt als entscheidung (offen),
  // nicht mehr als final-closed — die Ampel SOLL hier sichtbar bleiben.
});

describe('getEingangAmpel — Foerderantrag Status-Werte (offene Stati)', () => {
  it('"beantragt" mit antragsdatum → Ampel zaehlt', () => {
    expect(getEingangAmpel(mk({
      aktenzeichen: 'A', status: 'beantragt', antragsdatum: '2026-04-20',
    }))).toBe('gruen');
  });
  it('"VN geprüft" mit antragsdatum → Ampel zaehlt', () => {
    expect(getEingangAmpel(mk({
      aktenzeichen: 'A', status: 'VN geprüft', antragsdatum: '2026-04-01',
    }))).toBe('gelb');
  });
  it('"NF gestellt" mit antragsdatum → Ampel zaehlt', () => {
    expect(getEingangAmpel(mk({
      aktenzeichen: 'A', status: 'NF gestellt', antragsdatum: '2026-03-01',
    }))).toBe('orange');
  });
  it('"bewilligungsreif" (entscheidung) mit antragsdatum → Ampel zaehlt', () => {
    expect(getEingangAmpel(mk({
      aktenzeichen: 'A', status: 'bewilligungsreif', antragsdatum: '2026-01-01',
    }))).toBe('rot');
  });
  it('"Ablehnung" (entscheidung — noch im Verfahren, nicht final) → Ampel zaehlt', () => {
    expect(getEingangAmpel(mk({
      aktenzeichen: 'A', status: 'Ablehnung', antragsdatum: '2026-04-20',
    }))).toBe('gruen');
  });
  it('"Widerruf" (entscheidung — noch im Verfahren) → Ampel zaehlt', () => {
    expect(getEingangAmpel(mk({
      aktenzeichen: 'A', status: 'Widerruf', antragsdatum: '2026-01-01',
    }))).toBe('rot');
  });
});

describe('daysSinceEingang', () => {
  it('berechnet korrekt fuer ISO-Datum', () => {
    expect(daysSinceEingang(mk({
      aktenzeichen: 'A', status: 'eingereicht', antragsdatum: '2026-05-02',
    }))).toBe(10);
  });
  it('null fuer fehlendes antragsdatum', () => {
    expect(daysSinceEingang(mk({ aktenzeichen: 'A', status: 'eingereicht' }))).toBeNull();
  });
  it('null fuer ungueltiges antragsdatum', () => {
    expect(daysSinceEingang(mk({
      aktenzeichen: 'A', status: 'eingereicht', antragsdatum: 'foo',
    }))).toBeNull();
  });
});

describe('getAmpelBucket — Mapping der 4 Stufen auf 3 Buckets', () => {
  it('gruen → frisch', () => {
    expect(getAmpelBucket(mk({
      aktenzeichen: 'A', status: 'eingereicht', antragsdatum: '2026-04-20',
    }))).toBe('frisch');
  });
  it('gelb → warnung', () => {
    expect(getAmpelBucket(mk({
      aktenzeichen: 'A', status: 'eingereicht', antragsdatum: '2026-04-01',
    }))).toBe('warnung');
  });
  it('orange → warnung', () => {
    expect(getAmpelBucket(mk({
      aktenzeichen: 'A', status: 'eingereicht', antragsdatum: '2026-03-01',
    }))).toBe('warnung');
  });
  it('rot → kritisch', () => {
    expect(getAmpelBucket(mk({
      aktenzeichen: 'A', status: 'eingereicht', antragsdatum: '2026-01-01',
    }))).toBe('kritisch');
  });
  it('null → null (z.B. bewilligt)', () => {
    expect(getAmpelBucket(mk({
      aktenzeichen: 'A', status: 'bewilligt', antragsdatum: '2026-04-20',
      bewilligung_datum: '2026-04-25',
    }))).toBeNull();
  });
});

describe('countByAmpelBucket — Konsistenz mit getEingangAmpel', () => {
  for (const [name, data] of [
    ['Bauantraege', SEED_ANTRAEGE],
    ['Foerderantraege', REAL_CSV_ANTRAEGE],
  ] as const) {
    it(`${name}: frisch == #(getEingangAmpel === 'gruen', ohne Irrlaeufer)`, () => {
      const expected = data.filter(a =>
        !isIrrlaeufer(a.vb_phase) && getEingangAmpel(a) === 'gruen'
      ).length;
      expect(countByAmpelBucket([...data], 'frisch')).toBe(expected);
    });
    it(`${name}: warnung == #(getEingangAmpel === 'gelb' || 'orange', ohne Irrlaeufer)`, () => {
      const expected = data.filter(a => {
        if (isIrrlaeufer(a.vb_phase)) return false;
        const e = getEingangAmpel(a);
        return e === 'gelb' || e === 'orange';
      }).length;
      expect(countByAmpelBucket([...data], 'warnung')).toBe(expected);
    });
    it(`${name}: kritisch == #(getEingangAmpel === 'rot', ohne Irrlaeufer)`, () => {
      const expected = data.filter(a =>
        !isIrrlaeufer(a.vb_phase) && getEingangAmpel(a) === 'rot'
      ).length;
      expect(countByAmpelBucket([...data], 'kritisch')).toBe(expected);
    });
  }
});

describe('countByAmpelBucket — Bearbeiter-Filter', () => {
  it('bearbeiter=ABC reduziert Counts auf tib_kuerz="abc"-Items', () => {
    const bearb = parseBearbeiterFilter('ABC', false);
    // *-016 ist offen + bearbeiter-match. Welcher Bucket es ist, haengt
    // vom antragsdatum der Fixture ab — wir testen nur die Reduktion.
    const frisch = countByAmpelBucket([...SEED_ANTRAEGE], 'frisch', bearb);
    const warnung = countByAmpelBucket([...SEED_ANTRAEGE], 'warnung', bearb);
    const kritisch = countByAmpelBucket([...SEED_ANTRAEGE], 'kritisch', bearb);
    expect(frisch + warnung + kritisch).toBeLessThanOrEqual(2);
  });
});
