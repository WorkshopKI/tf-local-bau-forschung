/**
 * Unit-Tests fuer die phasen-aware Frist-Berechnung.
 *
 * Zwei Phasen, zwei Quellen:
 * - Antragsphase → antragsdatum + 90 Tage
 * - Begleitphase (VN/ZB) → vn_eingang_datum + 6 Monate
 * - Quelle leer → null
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import {
  addDays,
  addMonths,
  computeFristDatum,
  computeVerbundFristDatum,
  daysUntilFristAware,
  verbundAntragsdatum,
  verbundWirksamerEingang,
  wirksamerEingang,
} from '../frist';
import { asAntragStatusRaw, type AntragListItem } from '../types';

const TEST_TODAY = '2026-05-12';

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(TEST_TODAY));
});
afterAll(() => {
  vi.useRealTimers();
});

function mk(partial: Partial<Omit<AntragListItem, 'status'>> & { status?: string }): AntragListItem {
  const { status, ...rest } = partial;
  return {
    aktenzeichen: 'TEST',
    programm_id: 'P',
    _updated_at: '2026-05-12T00:00:00Z',
    ...rest,
    ...(status !== undefined ? { status: asAntragStatusRaw(status) } : {}),
  };
}

describe('addDays / addMonths', () => {
  it('addDays addiert N Tage zum ISO-Datum', () => {
    expect(addDays('2026-01-15', 90)).toBe('2026-04-15T00:00:00.000Z');
  });
  it('addDays returnt null bei ungueltigem Input', () => {
    expect(addDays('foo', 5)).toBeNull();
  });
  it('addMonths addiert 6 Monate kalendarisch', () => {
    expect(addMonths('2026-01-15', 6)).toBe('2026-07-15T00:00:00.000Z');
  });
  it('addMonths: 31.01 + 1 Monat = 03.03 (JS-rollover, nicht 28.02!)', () => {
    // Bekannter JS-Quirk: Date.UTC(2026, 1, 31) = 2026-03-03. Wir
    // dokumentieren das Verhalten so wie es ist — fuer die VN-Frist-
    // Berechnung praktisch irrelevant, weil VN-Eingangsdaten typisch
    // nicht auf dem 31. liegen.
    expect(addMonths('2026-01-31', 1)).toBe('2026-03-03T00:00:00.000Z');
  });
  it('addMonths returnt null bei ungueltigem Input', () => {
    expect(addMonths('foo', 6)).toBeNull();
  });
});

describe('computeFristDatum — Antragsphase', () => {
  it('antragsdatum + 90 Tage fuer offene Status', () => {
    const a = mk({ status: 'beantragt', antragsdatum: '2026-01-15' });
    expect(computeFristDatum(a)).toBe('2026-04-15T00:00:00.000Z');
  });
  it('auch fuer in_pruefung-Stati', () => {
    const a = mk({ status: 'techn geprüft', antragsdatum: '2026-02-01' });
    expect(computeFristDatum(a)).toBe('2026-05-02T00:00:00.000Z');
  });
  it('auch fuer nachforderung-Stati', () => {
    const a = mk({ status: 'NF gestellt', antragsdatum: '2026-03-01' });
    expect(computeFristDatum(a)).toBe('2026-05-30T00:00:00.000Z');
  });
  it('null wenn antragsdatum fehlt', () => {
    const a = mk({ status: 'beantragt' });
    expect(computeFristDatum(a)).toBeNull();
  });
  it('null wenn antragsdatum leer-String', () => {
    const a = mk({ status: 'beantragt', antragsdatum: '' });
    expect(computeFristDatum(a)).toBeNull();
  });
});

describe('computeFristDatum — Begleitphase', () => {
  it('vn_eingang_datum + 6 Monate fuer VN-Stati', () => {
    const a = mk({
      status: 'VN geprüft',
      antragsdatum: '2023-01-15',           // alt, irrelevant
      vn_eingang_datum: '2026-01-15',
    });
    expect(computeFristDatum(a)).toBe('2026-07-15T00:00:00.000Z');
  });
  it('auch fuer VN techn. geprueft', () => {
    const a = mk({
      status: 'VN techn. geprüft',
      vn_eingang_datum: '2026-02-10',
    });
    expect(computeFristDatum(a)).toBe('2026-08-10T00:00:00.000Z');
  });
  it('Pattern-Match: "VN angefordert" funktioniert ueber Begleitungs-Pattern', () => {
    const a = mk({
      status: 'VN angefordert',
      vn_eingang_datum: '2026-03-01',
    });
    expect(computeFristDatum(a)).toBe('2026-09-01T00:00:00.000Z');
  });
  it('ZB-Stati matchen ebenfalls', () => {
    const a = mk({
      status: 'ZB eingegangen',
      vn_eingang_datum: '2025-12-01',
    });
    expect(computeFristDatum(a)).toBe('2026-06-01T00:00:00.000Z');
  });
  it('null wenn VN-Status aber vn_eingang_datum fehlt (kein Fallback auf antragsdatum)', () => {
    const a = mk({
      status: 'VN geprüft',
      antragsdatum: '2023-01-15',
      // kein vn_eingang_datum
    });
    expect(computeFristDatum(a)).toBeNull();
  });
});

describe('daysUntilFristAware', () => {
  // TEST_TODAY = 2026-05-12
  it('positiv = Zeit uebrig', () => {
    const a = mk({ status: 'beantragt', antragsdatum: '2026-03-01' });
    // frist_datum = 2026-05-30 → 18 Tage uebrig
    expect(daysUntilFristAware(a)).toBe(18);
  });
  it('negativ = ueberfaellig', () => {
    const a = mk({ status: 'beantragt', antragsdatum: '2026-01-01' });
    // frist_datum = 2026-04-01 → 41 Tage ueberfaellig
    expect(daysUntilFristAware(a)).toBe(-41);
  });
  it('null wenn computeFristDatum null returnt', () => {
    const a = mk({ status: 'beantragt' });
    expect(daysUntilFristAware(a)).toBeNull();
  });
  it('VN-Antrag mit gesetztem vn_eingang_datum', () => {
    const a = mk({
      status: 'VN geprüft',
      vn_eingang_datum: '2026-02-01',
    });
    // frist_datum = 2026-08-01 → 81 Tage uebrig
    expect(daysUntilFristAware(a)).toBe(81);
  });
});

describe('verbundAntragsdatum', () => {
  it('liefert das spaeteste antragsdatum ueber alle TVs (zuletzt eingegangenes TV)', () => {
    const tvs = [
      { antragsdatum: '2026-01-15' },
      { antragsdatum: '2026-03-20' },
      { antragsdatum: '2026-02-01' },
    ];
    expect(verbundAntragsdatum(tvs)).toBe('2026-03-20');
  });
  it('ignoriert leere / fehlende antragsdatum-Werte', () => {
    const tvs = [
      { antragsdatum: '2026-01-15' },
      { antragsdatum: '' },
      {},
      { antragsdatum: '2026-02-28' },
    ];
    expect(verbundAntragsdatum(tvs)).toBe('2026-02-28');
  });
  it('ignoriert ungueltige Datumswerte', () => {
    const tvs = [
      { antragsdatum: 'foo' },
      { antragsdatum: '2026-01-10' },
    ];
    expect(verbundAntragsdatum(tvs)).toBe('2026-01-10');
  });
  it('null wenn kein TV ein antragsdatum hat', () => {
    expect(verbundAntragsdatum([{}, { antragsdatum: '' }])).toBeNull();
  });
  it('Solo-TV: liefert dessen antragsdatum', () => {
    expect(verbundAntragsdatum([{ antragsdatum: '2026-04-01' }])).toBe('2026-04-01');
  });
});

describe('computeVerbundFristDatum', () => {
  it('Antragsphase: max-antragsdatum + 90 Tage (spaetestes TV bestimmt die Frist)', () => {
    const tvs = [
      mk({ status: 'beantragt', antragsdatum: '2026-01-15' }),
      mk({ status: 'beantragt', antragsdatum: '2026-02-01' }),
    ];
    // max = 2026-02-01 → +90 Tage = 2026-05-02
    expect(computeVerbundFristDatum(tvs, tvs[0]!)).toBe('2026-05-02T00:00:00.000Z');
  });
  it('Solo / einzelnes TV ist identisch zu computeFristDatum (kein Regress)', () => {
    const a = mk({ status: 'beantragt', antragsdatum: '2026-01-15' });
    expect(computeVerbundFristDatum([a], a)).toBe(computeFristDatum(a));
  });
  it('Begleitphase: per-TV VN-Frist, NICHT max-antragsdatum (Regel nur Antragsphase)', () => {
    const rep = mk({
      status: 'VN geprüft',
      antragsdatum: '2023-01-15',
      vn_eingang_datum: '2026-01-15',
    });
    const tvs = [
      rep,
      // spaeteres antragsdatum darf die VN-Frist NICHT verschieben
      mk({ status: 'VN geprüft', antragsdatum: '2026-04-01', vn_eingang_datum: '2026-01-15' }),
    ];
    // bleibt VN-Frist des representative: 2026-01-15 + 6 Monate = 2026-07-15
    expect(computeVerbundFristDatum(tvs, rep)).toBe('2026-07-15T00:00:00.000Z');
  });
  it('null wenn Antragsphase und kein TV ein antragsdatum hat', () => {
    const rep = mk({ status: 'beantragt' });
    expect(computeVerbundFristDatum([rep], rep)).toBeNull();
  });
});

/**
 * Der wirksame Eingang: das SPÄTERE von Antragseingang und „alle Anträge da".
 * So startet die AB-Mappe ihre Zählungen — bearbeitet werden kann erst, wenn
 * alles vorliegt.
 */
describe('verbundWirksamerEingang', () => {
  it('nimmt je TV das spätere, über die TVs das späteste', () => {
    expect(verbundWirksamerEingang([
      { antragsdatum: '2026-01-10', alleAntraegeDa: '2026-02-20' },
      { antragsdatum: '2026-03-01', alleAntraegeDa: null },
      { antragsdatum: '2026-01-05', alleAntraegeDa: undefined },
    ])).toBe('2026-03-01');
    expect(verbundWirksamerEingang([
      { antragsdatum: '2026-01-10', alleAntraegeDa: '2026-04-01' },
      { antragsdatum: '2026-03-01', alleAntraegeDa: null },
    ])).toBe('2026-04-01');
  });

  it('ist ohne D_XTE dasselbe wie verbundAntragsdatum', () => {
    const tvs = [{ antragsdatum: '2026-01-15' }, { antragsdatum: '2026-03-20' }, { antragsdatum: '' }];
    expect(verbundWirksamerEingang(tvs.map(t => ({ ...t, alleAntraegeDa: null }))))
      .toBe(verbundAntragsdatum(tvs));
  });

  it('liefert null, wenn kein TV ein lesbares Datum trägt', () => {
    expect(verbundWirksamerEingang([])).toBeNull();
    expect(verbundWirksamerEingang([{ antragsdatum: 'kaputt', alleAntraegeDa: '' }])).toBeNull();
  });
});

describe('wirksamerEingang', () => {
  it('nimmt das spätere der beiden Daten', () => {
    expect(wirksamerEingang('2026-01-10', '2026-02-20')).toBe('2026-02-20');
    expect(wirksamerEingang('2026-03-01', '2026-02-20')).toBe('2026-03-01');
  });

  it('fällt ohne „alle Anträge da" auf den Antragseingang zurück', () => {
    // Das ist der heutige Stand — die Regel ist damit abwärtskompatibel.
    expect(wirksamerEingang('2026-01-10', null)).toBe('2026-01-10');
    expect(wirksamerEingang('2026-01-10', '')).toBe('2026-01-10');
    expect(wirksamerEingang('2026-01-10', undefined)).toBe('2026-01-10');
  });

  it('kommt auch mit nur „alle Anträge da" zurecht', () => {
    expect(wirksamerEingang(null, '2026-02-20')).toBe('2026-02-20');
  });

  it('liefert null, wenn keines der beiden Daten brauchbar ist', () => {
    expect(wirksamerEingang(null, null)).toBeNull();
    expect(wirksamerEingang('', '   ')).toBeNull();
    expect(wirksamerEingang('kein Datum', 'auch nicht')).toBeNull();
  });

  it('ignoriert einen unlesbaren Wert, statt am anderen zu scheitern', () => {
    expect(wirksamerEingang('2026-01-10', 'kaputt')).toBe('2026-01-10');
  });

  it('gibt den Rohwert zurück, nicht eine normalisierte Fassung', () => {
    // Der Aufrufer rechnet damit weiter; eine stille Umformatierung wäre ein
    // zweites Datumsformat im Umlauf.
    expect(wirksamerEingang('2026-02-20T09:30:00.000Z', '2026-01-01')).toBe('2026-02-20T09:30:00.000Z');
  });
});
