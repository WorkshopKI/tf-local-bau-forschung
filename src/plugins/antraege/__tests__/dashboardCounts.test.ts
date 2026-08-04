import { describe, it, expect } from 'vitest';
import { computeDashboardAggregate } from '@/plugins/home/dashboardAggregate';
import { parseBearbeiterFilter } from '../bearbeiterFilter';
import { REAL_CSV_ANTRAEGE, TEST_TODAY_MS } from './fixtures/real-csv-antraege';
import { asAntragStatusRaw, type AntragListItem, type Verbund } from '@/core/services/csv/types';

const NEUTRAL = parseBearbeiterFilter(undefined, undefined);

describe('computeDashboardAggregate — Grund-Counts', () => {
  it('total zaehlt Begleitung mit', () => {
    const agg = computeDashboardAggregate(REAL_CSV_ANTRAEGE, NEUTRAL, {
      includeAntraege: true, nowMs: TEST_TODAY_MS,
    });
    // 18 = 20 minus 2 Irrlaeufer. Begleit-Stati zaehlen seit v2.402 mit.
    expect(agg.stats.total).toBe(18);
  });
  it('nachforderung zaehlt „NF gestellt"', () => {
    const agg = computeDashboardAggregate(REAL_CSV_ANTRAEGE, NEUTRAL, {
      includeAntraege: true, nowMs: TEST_TODAY_MS,
    });
    expect(agg.stats.nachforderung).toBe(2);
  });
  it('bewilligt zaehlt „bewilligt"', () => {
    const agg = computeDashboardAggregate(REAL_CSV_ANTRAEGE, NEUTRAL, {
      includeAntraege: true, nowMs: TEST_TODAY_MS,
    });
    expect(agg.stats.bewilligt).toBe(4);
  });
  it('offen zaehlt Begleitung mit', () => {
    const agg = computeDashboardAggregate(REAL_CSV_ANTRAEGE, NEUTRAL, {
      includeAntraege: true, nowMs: TEST_TODAY_MS,
    });
    expect(agg.stats.offen).toBe(11);
  });
});

describe('computeDashboardAggregate — Foerderantrag-Domain (CSV-Rohwerte mit Begleitphase)', () => {
  it('inPruefung = 2 (nur techn geprueft + kaufm geprueft; VN-Stati nicht mehr hier)', () => {
    const agg = computeDashboardAggregate(REAL_CSV_ANTRAEGE, NEUTRAL, {
      includeAntraege: true, nowMs: TEST_TODAY_MS,
    });
    expect(agg.stats.inPruefung).toBe(2);
  });
  it('begleitung = 2 unabhaengig vom Profil-Haken', () => {
    const agg = computeDashboardAggregate(REAL_CSV_ANTRAEGE, NEUTRAL, {
      includeAntraege: true, nowMs: TEST_TODAY_MS,
    });
    expect(agg.stats.begleitung).toBe(2);
  });
  it('der Profil-Haken aendert an den Zahlen nichts mehr', () => {
    const opts = { includeAntraege: true, nowMs: TEST_TODAY_MS } as const;
    const ohne = computeDashboardAggregate(REAL_CSV_ANTRAEGE, NEUTRAL, opts);
    const mit = computeDashboardAggregate(
      REAL_CSV_ANTRAEGE, parseBearbeiterFilter(undefined, true), opts,
    );
    expect(mit.stats).toEqual(ohne.stats);
    expect(ohne.stats.begleitung).toBe(2);
    expect(ohne.stats.offen).toBe(11);
  });
});

describe('Bearbeiter-Filter reduziert Counts', () => {
  const data = REAL_CSV_ANTRAEGE;
  it('bearbeiter=ABC → total = 2 (nur tib_kuerz="abc" items, vb_phase!=9)', () => {
    const bearb = parseBearbeiterFilter('ABC', false);
    const agg = computeDashboardAggregate(data, bearb, {
      includeAntraege: true, nowMs: TEST_TODAY_MS,
    });
    expect(agg.stats.total).toBe(2);
  });
  it('bearbeiter=ABC → bewilligt = 1 (nur REAL-018)', () => {
    const bearb = parseBearbeiterFilter('ABC', false);
    const agg = computeDashboardAggregate(data, bearb, {
      includeAntraege: true, nowMs: TEST_TODAY_MS,
    });
    expect(agg.stats.bewilligt).toBe(1);
  });
  it('bearbeiter=ABC → offen = 1 (nur REAL-016)', () => {
    const bearb = parseBearbeiterFilter('ABC', false);
    const agg = computeDashboardAggregate(data, bearb, {
      includeAntraege: true, nowMs: TEST_TODAY_MS,
    });
    expect(agg.stats.offen).toBe(1);
  });
});

describe('computeDashboardAggregate — leere Eingaben', () => {
  it('beide leer → alle counts 0', () => {
    const agg = computeDashboardAggregate([], NEUTRAL, {
      includeAntraege: true, nowMs: TEST_TODAY_MS,
    });
    expect(agg.stats).toEqual({
      total: 0, offen: 0, inPruefung: 0, nachforderung: 0, begleitung: 0, bewilligt: 0,
    });
  });
  it('includeAntraege=false → Antraege werden ignoriert', () => {
    const agg = computeDashboardAggregate(REAL_CSV_ANTRAEGE, NEUTRAL, {
      includeAntraege: false, nowMs: TEST_TODAY_MS,
    });
    expect(agg.stats.total).toBe(0);
  });
});

describe('computeDashboardAggregate — Verbund-Clustering in meineAntraege', () => {
  function mkAntrag(p: Partial<Omit<AntragListItem, 'status'>> & { aktenzeichen: string; status: string }): AntragListItem {
    const { status, ...rest } = p;
    return {
      programm_id: 'P',
      _updated_at: '2026-05-01T00:00:00Z',
      ...rest,
      status: asAntragStatusRaw(status),
    };
  }

  it('TVs gleicher verbund_id werden auf einen Eintrag reduziert', () => {
    const tvs: AntragListItem[] = [
      mkAntrag({ aktenzeichen: 'V-001', status: 'beantragt', antragsdatum: '2026-04-01',
        verbund_id: 'VB-A', akronym: 'PROJEKT-A' }),
      mkAntrag({ aktenzeichen: 'V-002', status: 'beantragt', antragsdatum: '2026-04-01',
        verbund_id: 'VB-A', akronym: 'PROJEKT-A' }),
      mkAntrag({ aktenzeichen: 'V-003', status: 'beantragt', antragsdatum: '2026-04-01',
        verbund_id: 'VB-A', akronym: 'PROJEKT-A' }),
      mkAntrag({ aktenzeichen: 'S-001', status: 'beantragt', antragsdatum: '2026-04-01',
        akronym: 'SOLO' }),
    ];
    const agg = computeDashboardAggregate(tvs, NEUTRAL, {
      includeAntraege: true, nowMs: TEST_TODAY_MS,
    });
    expect(agg.meineAntraege).toHaveLength(2);          // 1 Verbund + 1 Solo
    expect(agg.stats.offen).toBe(4);                    // alle 4 zaehlen weiter
  });

  it('Lead-TV bekommt tv_count = Anzahl aller TVs im Verbund', () => {
    const tvs: AntragListItem[] = [
      mkAntrag({ aktenzeichen: 'V-001', status: 'beantragt', antragsdatum: '2026-04-01',
        verbund_id: 'VB-A' }),
      mkAntrag({ aktenzeichen: 'V-002', status: 'beantragt', antragsdatum: '2026-04-01',
        verbund_id: 'VB-A' }),
      mkAntrag({ aktenzeichen: 'V-003', status: 'beantragt', antragsdatum: '2026-04-01',
        verbund_id: 'VB-A' }),
    ];
    const agg = computeDashboardAggregate(tvs, NEUTRAL, {
      includeAntraege: true, nowMs: TEST_TODAY_MS,
    });
    expect(agg.meineAntraege).toHaveLength(1);
    expect(agg.meineAntraege[0]?.tv_count).toBe(3);
    expect(agg.meineAntraege[0]?.verbund_id).toBe('VB-A');
  });

  it('Solo-Antraege bekommen tv_count = 1', () => {
    const tvs: AntragListItem[] = [
      mkAntrag({ aktenzeichen: 'S-001', status: 'beantragt', antragsdatum: '2026-04-01' }),
      mkAntrag({ aktenzeichen: 'S-002', status: 'beantragt', antragsdatum: '2026-04-02' }),
    ];
    const agg = computeDashboardAggregate(tvs, NEUTRAL, {
      includeAntraege: true, nowMs: TEST_TODAY_MS,
    });
    expect(agg.meineAntraege).toHaveLength(2);
    expect(agg.meineAntraege.every(a => a.tv_count === 1)).toBe(true);
  });

  it('Sortierung nach Frist: ältester Eingang oben, Verbund-Lead = ältester TV', () => {
    const tvs: AntragListItem[] = [
      // Solo, neu eingegangen → Frist weiter weg
      mkAntrag({ aktenzeichen: 'S-001', status: 'beantragt', antragsdatum: '2026-05-01' }),
      // Verbund: Frist ab spätestem TV (2026-03-01) → früher als Solo (2026-05-01) → oben.
      mkAntrag({ aktenzeichen: 'V-001', status: 'beantragt', antragsdatum: '2026-01-01',
        verbund_id: 'VB-A' }),
      mkAntrag({ aktenzeichen: 'V-002', status: 'beantragt', antragsdatum: '2026-03-01',
        verbund_id: 'VB-A' }),
    ];
    const agg = computeDashboardAggregate(tvs, NEUTRAL, {
      includeAntraege: true, nowMs: TEST_TODAY_MS,
    });
    // Verbund oben; repräsentiert vom ersten TV (V-001), tv_count = 2.
    expect(agg.meineAntraege[0]?.id).toBe('V-001');
    expect(agg.meineAntraege[0]?.tv_count).toBe(2);
    // Solo darunter
    expect(agg.meineAntraege[1]?.id).toBe('S-001');
  });

  it('Verbund-Frist = spätestes TV-Antragsdatum + 90 Tage (zuletzt eingegangenes TV)', () => {
    const tvs: AntragListItem[] = [
      mkAntrag({ aktenzeichen: 'V-001', status: 'beantragt', antragsdatum: '2026-01-01',
        verbund_id: 'VB-A' }),
      mkAntrag({ aktenzeichen: 'V-002', status: 'beantragt', antragsdatum: '2026-03-01',
        verbund_id: 'VB-A' }),
    ];
    const agg = computeDashboardAggregate(tvs, NEUTRAL, {
      includeAntraege: true, nowMs: TEST_TODAY_MS,
    });
    expect(agg.meineAntraege).toHaveLength(1);
    // max(antragsdatum) = 2026-03-01 + 90 Tage = 2026-05-30 (NICHT das frühere 2026-01-01).
    expect(agg.meineAntraege[0]?.deadline).toBe('2026-05-30T00:00:00.000Z');
  });

  it('Verbund zählt nur EINMAL als Frist-Kandidat (dringend), nicht pro TV', () => {
    const tvs: AntragListItem[] = [
      // Alle drei TVs überfällig (2025) → gemeinsame Verbund-Frist, EIN Kandidat.
      mkAntrag({ aktenzeichen: 'V-001', status: 'beantragt', antragsdatum: '2025-01-01',
        verbund_id: 'VB-A' }),
      mkAntrag({ aktenzeichen: 'V-002', status: 'beantragt', antragsdatum: '2025-02-01',
        verbund_id: 'VB-A' }),
      mkAntrag({ aktenzeichen: 'V-003', status: 'beantragt', antragsdatum: '2025-03-01',
        verbund_id: 'VB-A' }),
    ];
    const agg = computeDashboardAggregate(tvs, NEUTRAL, {
      includeAntraege: true, nowMs: TEST_TODAY_MS,
    });
    expect(agg.dringend).toHaveLength(1);
    // Repräsentant = erstes offenes TV des Verbundes (Input-Reihenfolge).
    expect(agg.dringend[0]?.id).toBe('V-001');
  });
});

describe('computeDashboardAggregate — verbund_titel im AntragVorgang', () => {
  function mkAntrag(p: Partial<Omit<AntragListItem, 'status'>> & { aktenzeichen: string; status: string }): AntragListItem {
    const { status, ...rest } = p;
    return {
      programm_id: 'P',
      _updated_at: '2026-05-01T00:00:00Z',
      ...rest,
      status: asAntragStatusRaw(status),
    };
  }

  function mkVerbund(id: string, titel?: string): Verbund {
    return {
      verbund_id: id,
      programm_id: 'P',
      titel,
      teilantrags_ids: [],
      _field_sources: {},
      _updated_at: '2026-05-01T00:00:00Z',
    };
  }

  it('verbund_titel wird aus verbundById gemappt wenn vorhanden', () => {
    const tvs: AntragListItem[] = [
      mkAntrag({ aktenzeichen: 'V-001', status: 'beantragt', antragsdatum: '2026-04-01',
        verbund_id: 'VB-A', akronym: 'PROJEKT' }),
    ];
    const verbundById = new Map<string, Verbund>();
    verbundById.set('VB-A', mkVerbund('VB-A', 'KI-gestuetzte Projektverwaltung'));
    const agg = computeDashboardAggregate(tvs, NEUTRAL, {
      includeAntraege: true, nowMs: TEST_TODAY_MS, verbundById,
    });
    expect(agg.meineAntraege[0]?.verbund_titel).toBe('KI-gestuetzte Projektverwaltung');
  });

  it('verbund_titel ist undefined wenn Verbund nicht in verbundById', () => {
    const tvs: AntragListItem[] = [
      mkAntrag({ aktenzeichen: 'V-001', status: 'beantragt', antragsdatum: '2026-04-01',
        verbund_id: 'VB-UNKNOWN' }),
    ];
    const verbundById = new Map<string, Verbund>();
    const agg = computeDashboardAggregate(tvs, NEUTRAL, {
      includeAntraege: true, nowMs: TEST_TODAY_MS, verbundById,
    });
    expect(agg.meineAntraege[0]?.verbund_titel).toBeUndefined();
  });

  it('verbund_titel ist undefined wenn Titel-Feld leer ist', () => {
    const tvs: AntragListItem[] = [
      mkAntrag({ aktenzeichen: 'V-001', status: 'beantragt', antragsdatum: '2026-04-01',
        verbund_id: 'VB-A' }),
    ];
    const verbundById = new Map<string, Verbund>();
    verbundById.set('VB-A', mkVerbund('VB-A', '   '));   // nur Whitespace
    const agg = computeDashboardAggregate(tvs, NEUTRAL, {
      includeAntraege: true, nowMs: TEST_TODAY_MS, verbundById,
    });
    expect(agg.meineAntraege[0]?.verbund_titel).toBeUndefined();
  });

  it('verbund_titel ist undefined wenn keine verbundById uebergeben wurde', () => {
    const tvs: AntragListItem[] = [
      mkAntrag({ aktenzeichen: 'V-001', status: 'beantragt', antragsdatum: '2026-04-01',
        verbund_id: 'VB-A' }),
    ];
    const agg = computeDashboardAggregate(tvs, NEUTRAL, {
      includeAntraege: true, nowMs: TEST_TODAY_MS,
    });
    expect(agg.meineAntraege[0]?.verbund_titel).toBeUndefined();
  });
});

describe('computeDashboardAggregate — KUERZ-Detection', () => {
  it('anyKuerzelSeen=true wenn mindestens ein Antrag tib_kuerz hat', () => {
    const agg = computeDashboardAggregate(REAL_CSV_ANTRAEGE, NEUTRAL, {
      includeAntraege: true, nowMs: TEST_TODAY_MS,
    });
    expect(agg.anyKuerzelSeen).toBe(true);
  });
  it('anyKuerzelSeen=false bei Antraegen ohne KUERZ', () => {
    const ohneKuerz = REAL_CSV_ANTRAEGE.map(a => {
      const { tib_kuerz: _t, bib_kuerz: _b, ztp_kuerz: _z, pfm_kuerz: _p, ...rest } = a;
      return rest;
    });
    const agg = computeDashboardAggregate(ohneKuerz, NEUTRAL, {
      includeAntraege: true, nowMs: TEST_TODAY_MS,
    });
    expect(agg.anyKuerzelSeen).toBe(false);
  });
});
