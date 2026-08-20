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
    // 18 = 20 minus 2 Irrlaeufer. Begleit-Stati zaehlen seit v2.404 mit.
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
      // Verbund: Frist des knappsten TV (2026-01-01) → früher als Solo → oben.
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

  /**
   * **Die Verbund-Frist ist die des knappsten TV — wie in der Fördertabelle.**
   *
   * Bis v4.131 rechnete die Startseite hier ihre eigene Regel: `max(antragsdatum
   * über alle TVs) + 90`. Die Zielseite rechnet dagegen je TV gegen den
   * WIRKSAMEN Eingang (`max(D_AAE, D_XTE)`) und nimmt davon das Minimum
   * (`criticalFristErgebnis`). Beide meinen dasselbe fachlich — „bearbeitet
   * werden kann erst, wenn alles da ist" —, aber die Zielseite drückt es über
   * das gepflegte Feld `D_XTE` aus statt über eine Näherung. Wo `D_XTE` fehlt,
   * liefen die zwei Rechnungen auseinander: am Bestand gemessen bei 6 von 32
   * Anträgen, bis zu 17 Tage. Die Karte sagt „Sortierung: Frist" und sortierte
   * anders als die Liste, in die ihr „Alle →" führt.
   *
   * Zwei Ableitungen derselben Größe — die eine musste weg, und die Zielseite
   * ist die Referenz.
   */
  it('Verbund-Frist = knappster TV, wie `criticalFristErgebnis` in der Liste', () => {
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
    // min über die TVs: 2026-01-01 + 90 = 2026-04-01 (V-002 läge bei 2026-05-30).
    expect(agg.meineAntraege[0]?.deadline).toBe('2026-04-01T00:00:00.000Z');
  });

  it('`D_XTE` („alle Anträge da") trägt die Uhr, wo es gepflegt ist', () => {
    const tvs: AntragListItem[] = [
      mkAntrag({ aktenzeichen: 'V-001', status: 'beantragt', antragsdatum: '2026-01-01',
        verbund_id: 'VB-A', alle_antraege_da: '2026-03-01' }),
      mkAntrag({ aktenzeichen: 'V-002', status: 'beantragt', antragsdatum: '2026-03-01',
        verbund_id: 'VB-A', alle_antraege_da: '2026-03-01' }),
    ];
    const agg = computeDashboardAggregate(tvs, NEUTRAL, {
      includeAntraege: true, nowMs: TEST_TODAY_MS,
    });
    // Wirksamer Eingang beider TVs = 2026-03-01 ⇒ 2026-05-30. Genau die Aussage,
    // die die alte Home-Regel näherte — jetzt aus dem gepflegten Feld.
    expect(agg.meineAntraege[0]?.deadline).toBe('2026-05-30T00:00:00.000Z');
  });

  /**
   * **H0 der Bug-Jagd**: die Startseite ließ die Uhr laufen, wo die Zielseite
   * „angehalten" sagt. Am Bestand betraf das 10 von 32 Anträgen (31 %), und vier
   * davon standen unter den zehn sichtbaren Zeilen der Karte „Meine Anträge" —
   * ganz oben, weil eine seit Monaten überfällige Frist errechnet wurde.
   */
  it('kein Frist-Datum, wo in der Phase keine Frist läuft (angehalten)', () => {
    const tvs: AntragListItem[] = [
      // `Ablehnung` liegt in der ZAH-Phase `entscheidung` (fristLaeuft: false).
      mkAntrag({ aktenzeichen: 'A-001', status: 'Ablehnung', antragsdatum: '2025-01-01' }),
      mkAntrag({ aktenzeichen: 'B-001', status: 'beantragt', antragsdatum: '2026-04-01' }),
    ];
    const agg = computeDashboardAggregate(tvs, NEUTRAL, {
      includeAntraege: true, nowMs: TEST_TODAY_MS,
    });
    const angehalten = agg.meineAntraege.find(a => a.id === 'A-001');
    expect(angehalten?.fristZustand).toBe('angehalten');
    expect(angehalten?.deadline).toBeUndefined();
    expect(angehalten?.fristTage).toBeNull();
    // Und er sinkt ans Ende, statt die Spitze zu besetzen.
    expect(agg.meineAntraege[agg.meineAntraege.length - 1]?.id).toBe('A-001');
    // Er ist auch kein Frist-Kandidat mehr — „dringend" meint laufende Uhren.
    expect(agg.dringend.some(v => v.id === 'A-001')).toBe(false);
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

/*
 * Was laut Kürzeln erledigt ist, zählt nicht mehr als offen (v4.132).
 *
 * Der amtliche Status hinkt manchmal nach: gemessen am 20.08.2026 trugen drei
 * Vorgänge einen Schlussvermerk (`D_VV`) und trotzdem einen offenen `STATUS_TV`
 * — auf der Startseite standen sie mit „vor 240 Tagen" ganz oben.
 */
describe('computeDashboardAggregate — laut Kürzeln erledigt', () => {
  const opts = { includeAntraege: true, nowMs: TEST_TODAY_MS } as const;

  it('ohne die Menge bleibt alles, wie es war', () => {
    const ohne = computeDashboardAggregate(REAL_CSV_ANTRAEGE, NEUTRAL, opts);
    const leer = computeDashboardAggregate(REAL_CSV_ANTRAEGE, NEUTRAL, { ...opts, gesperrt: new Set() });
    expect(leer.stats).toEqual(ohne.stats);
    expect(leer.erledigtLautKuerzeln).toBe(0);
    expect(leer.meineAntraege.map(v => v.id)).toEqual(ohne.meineAntraege.map(v => v.id));
  });

  it('nimmt den Vorgang aus „offen", lässt ihn aber in der Liste', () => {
    const ohne = computeDashboardAggregate(REAL_CSV_ANTRAEGE, NEUTRAL, opts);
    // REAL-003 „techn geprüft" — Antragsphase, also in der Liste.
    const agg = computeDashboardAggregate(
      REAL_CSV_ANTRAEGE, NEUTRAL, { ...opts, gesperrt: new Set(['REAL-003']) },
    );
    expect(agg.erledigtLautKuerzeln).toBe(1);
    expect(agg.stats.offen).toBe(ohne.stats.offen - 1);
    expect(agg.meineAntraege.some(v => v.id === 'REAL-003'), 'sichtbar bleibt er').toBe(true);
    expect(agg.offeneVorgaenge.some(v => v.id === 'REAL-003'), 'als offen nicht').toBe(false);
  });

  it('sortiert ihn ans ENDE der Liste — die Karte verspricht „Sortierung: Frist"', () => {
    const agg = computeDashboardAggregate(
      REAL_CSV_ANTRAEGE, NEUTRAL, { ...opts, gesperrt: new Set(['REAL-003']) },
    );
    expect(agg.meineAntraege[agg.meineAntraege.length - 1]?.id).toBe('REAL-003');
  });

  it('lässt die BEGLEITPHASE unberührt — ein ZuwB sperrt die Kaskade, ohne dass die VN-Prüfung durch wäre', () => {
    // Der Fehler, den die Selbstabnahme fand: weiter oben gefragt meldete die
    // Startseite 13 erledigte statt 3 — zehn davon Begleit-Vorgänge, die in
    // dieser Liste nie standen.
    const ohne = computeDashboardAggregate(REAL_CSV_ANTRAEGE, NEUTRAL, opts);
    const agg = computeDashboardAggregate(
      REAL_CSV_ANTRAEGE, NEUTRAL, { ...opts, gesperrt: new Set(['REAL-002']) },
    );
    expect(agg.erledigtLautKuerzeln, 'REAL-002 ist „VN geprüft"').toBe(0);
    expect(agg.stats.offen).toBe(ohne.stats.offen);
    expect(agg.stats.begleitung).toBe(ohne.stats.begleitung);
  });

  it('rührt einen bereits terminalen Vorgang nicht an', () => {
    const agg = computeDashboardAggregate(
      REAL_CSV_ANTRAEGE, NEUTRAL, { ...opts, gesperrt: new Set(['REAL-010']) },
    );
    expect(agg.erledigtLautKuerzeln, 'REAL-010 traegt „Schlussvermerk"').toBe(0);
  });
});
