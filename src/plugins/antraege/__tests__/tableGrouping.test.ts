import { MS_TAG } from '@/core/utils/zeitEinheiten';
import { describe, it, expect } from 'vitest';
import {
  buildVerbundTableRows,
  buildStatusSectionRows,
  buildFristSectionRows,
  buildNetzwerkSectionRows,
  buildKuerzelSectionRows,
  OHNE_LAUFENDE_FRIST,
} from '../tableGrouping';
import { statusPhaseForAntrag, STATUS_SECTION_ORDER } from '../antragGroups';
import { asAntragStatusRaw } from '@/core/services/csv/types';
import type { AntragListItem, Verbund } from '@/core/services/csv/types';

const EN_DASH = '–';

function mk(aktenzeichen: string, opts: Partial<AntragListItem> = {}): AntragListItem {
  return {
    aktenzeichen,
    programm_id: 'P',
    _updated_at: '2026-01-01T00:00:00Z',
    ...opts,
  };
}

const st = (s: string): AntragListItem['status'] => asAntragStatusRaw(s);

describe('buildVerbundTableRows (Ansicht: Antrag)', () => {
  it('kollabiert Multi-TV-Verbund zu einer Zeile, Solo-Antrag bleibt eigene Zeile', () => {
    const input = [
      mk('A', { verbund_id: 'V1', antragsdatum: '2026-01-10', status: st('beantragt') }),
      mk('B', { verbund_id: 'V1', antragsdatum: '2026-02-10', status: st('beantragt') }),
      mk('C'),
    ];
    const rows = buildVerbundTableRows(input, new Map());
    expect(rows).toHaveLength(2);

    const verbundRow = rows[0]!;
    expect(verbundRow._verbund).toBeDefined();
    expect(verbundRow._verbund!.tvCount).toBe(2);
    expect(verbundRow._verbund!.fkzRange).toBe(`A${EN_DASH}B`);
    // Antragsdatum = spätestes TV-Datum (v2.36-Semantik).
    expect(verbundRow.antragsdatum).toBe('2026-02-10');

    const soloRow = rows[1]!;
    expect(soloRow.aktenzeichen).toBe('C');
    expect(soloRow._verbund).toBeUndefined();
  });

  it('Antrag mit verbund_id aber nur 1 TV bleibt eine normale Zeile (kein _verbund)', () => {
    const rows = buildVerbundTableRows([mk('X', { verbund_id: 'V9' })], new Map());
    expect(rows).toHaveLength(1);
    expect(rows[0]!.aktenzeichen).toBe('X');
    expect(rows[0]!._verbund).toBeUndefined();
  });

  it('nutzt Akronym + FKZ + dominanten Status aus dem Verbund-Record falls vorhanden', () => {
    const verbundById = new Map<string, Verbund>([
      ['V1', {
        verbund_id: 'V1',
        programm_id: 'P',
        akronym: 'ACME',
        status: st('bewilligt'),
        teilantrags_ids: ['A', 'B'],
        _updated_at: '2026-01-01',
      }],
    ]);
    const input = [
      mk('A', { verbund_id: 'V1', status: st('beantragt'), akronym: 'tv-akronym' }),
      mk('B', { verbund_id: 'V1', status: st('beantragt') }),
    ];
    const rows = buildVerbundTableRows(input, verbundById);
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.akronym).toBe('ACME');
    // verbundFkz bevorzugt die gepflegte verbund_id vor der TV-FKZ-Range.
    expect(row._verbund!.fkzRange).toBe('V1');
    // dominantStatus bevorzugt den Verbund-Status.
    expect(row.status).toBe(st('bewilligt'));
  });

  /**
   * KITED (ZKN125314): drei Teilvorhaben, das zweite mit negativem PreCheck. Die
   * verdichtete Zeile entsteht aus `...lead` — sie erbte damit den PreCheck des
   * ERSTEN Teilvorhabens und meldete „positiv", während ein Antrag des Verbunds
   * abgelehnt wurde.
   */
  it('faltet den TV-PreCheck über alle Teilvorhaben — ein negativer schlägt durch', () => {
    const input = [
      mk('16KN125320', { verbund_id: 'V1', precheck_tv_status_label: 'pre-check positiv', precheck_tv_status_datum: '2026-01-22' }),
      mk('16KN125321', { verbund_id: 'V1', precheck_tv_status_label: 'pre-check negativ', precheck_tv_status_datum: '2026-01-22' }),
      mk('16KN125322', { verbund_id: 'V1', precheck_tv_status_label: 'pre-check positiv', precheck_tv_status_datum: '2026-01-22' }),
    ];
    const row = buildVerbundTableRows(input, null)[0]!;
    expect(row.precheck_tv_status_label).toBe('pre-check negativ');
  });

  it('lässt den PreCheck der Lead-Zeile stehen, wenn kein Teilvorhaben widerspricht', () => {
    const input = [
      mk('A', { verbund_id: 'V1', precheck_tv_status_label: 'pre-check positiv' }),
      mk('B', { verbund_id: 'V1', precheck_tv_status_label: 'pre-check positiv' }),
    ];
    expect(buildVerbundTableRows(input, null)[0]!.precheck_tv_status_label).toBe('pre-check positiv');
  });

  it('trägt kein Teilvorhaben einen PreCheck, erfindet die Faltung keinen', () => {
    const input = [mk('A', { verbund_id: 'V1' }), mk('B', { verbund_id: 'V1' })];
    expect(buildVerbundTableRows(input, null)[0]!.precheck_tv_status_label).toBeUndefined();
  });
});

describe('buildStatusSectionRows (Gruppiert: Status)', () => {
  it('bucketet jedes TV nach eigenem Status in Phase-Reihenfolge; leere Phasen ausgelassen', () => {
    const input = [
      mk('A', { status: st('bewilligt') }),
      mk('B', { status: st('beantragt') }),
      mk('C', { status: st('nf gestellt') }),
    ];
    const { rows, sectionOf } = buildStatusSectionRows(input);
    expect(rows).toHaveLength(3);
    // Reihenfolge folgt STATUS_SECTION_ORDER: Vor Entscheidung(B) → NF(C) → Bewilligt(A).
    expect(rows.map(r => r.aktenzeichen)).toEqual(['B', 'C', 'A']);
    expect(sectionOf(rows[0]!)).toBe('vor-entscheidung');

    // Phasen-Rang ist monoton nicht-fallend (Sections kontiguierlich).
    const rank = (label: string): number => (STATUS_SECTION_ORDER as readonly string[]).indexOf(label);
    let prev = -1;
    for (const r of rows) {
      const k = rank(statusPhaseForAntrag(r));
      expect(k).toBeGreaterThanOrEqual(prev);
      prev = k;
    }
  });

  it('fasst Verbünde im Status-Modus NICHT zusammen — das macht die Ansicht-Achse', () => {
    const input = [
      mk('A', { verbund_id: 'V1', status: st('beantragt') }),
      mk('B', { verbund_id: 'V1', status: st('beantragt') }),
    ];
    const { rows } = buildStatusSectionRows(input);
    expect(rows).toHaveLength(2);
    expect(rows.every(r => r._verbund === undefined)).toBe(true);
  });

  it('beschriftet die Bänder, statt die rohe Abschnitts-Id zu zeigen', () => {
    const { labelOf } = buildStatusSectionRows([mk('A', { status: st('beantragt') })]);
    expect(labelOf('vor-entscheidung')).toBe('Vor Entscheidung');
    expect(labelOf('abgelehnt-zurueckgezogen')).toBe('Abgelehnt/Zurückgezogen');
  });
});

describe('buildNetzwerkSectionRows (Gruppiert: NW)', () => {
  // 16KN<4 Ziffern Netzwerk><2 Ziffern Position>; 01/02 + vb_phase 1/2 = Lead.
  const lead = (nid: string, phase: number, akronym: string): AntragListItem =>
    mk(`16KN${nid}0${phase}`, { vb_phase: phase, akronym });
  const tv = (nid: string, pos: string): AntragListItem => mk(`16KN${nid}${pos}`);

  it('bändert nach Netzwerk-Id und benennt das Band nach dem Lead-Akronym', () => {
    const input = [lead('1062', 1, 'INNOWERK'), tv('1062', '27')];
    const { rows, sectionOf, labelOf } = buildNetzwerkSectionRows(input, null);
    expect(rows).toHaveLength(2);
    expect(sectionOf(rows[0]!)).toBe('1062');
    expect(labelOf('1062')).toBe('INNOWERK · Phase 1');
  });

  it('fällt ohne bekannten Lead auf die technische Bezeichnung zurück', () => {
    const { labelOf } = buildNetzwerkSectionRows([tv('1062', '27')], null);
    expect(labelOf('1062')).toBe('Netzwerk 1062');
  });

  it('sammelt ALLE Zeilen ohne 16KN-Netzwerk in EINEM Abschluss-Abschnitt', () => {
    // Solos stehen in der Eingabe zwischen den Netzwerken — in der Tabelle
    // ergäbe das sonst pro Solo-Lauf ein eigenes „Ohne Netzwerk"-Band.
    const input = [
      mk('16EP100001'),
      tv('1062', '27'),
      mk('16EP100002'),
      tv('2000', '31'),
      mk('16EP100003'),
    ];
    const { rows, sectionOf, labelOf } = buildNetzwerkSectionRows(input, null);
    expect(rows.map(r => sectionOf(r))).toEqual([
      '1062', '2000', '__ohne_netzwerk__', '__ohne_netzwerk__', '__ohne_netzwerk__',
    ]);
    expect(labelOf('__ohne_netzwerk__')).toBe('Ohne Netzwerk');
  });

  it('nimmt den Netzwerk-Namen aus dem Cross-Programm-Index, wenn kein Lead im Bestand ist', () => {
    const index = new Map([['1062', 'INNOWERK']]);
    const { labelOf } = buildNetzwerkSectionRows([tv('1062', '27')], index);
    expect(labelOf('1062')).toBe('INNOWERK');
  });

  it('verliert keine Zeile — Summenprobe über alle Abschnitte', () => {
    const input = [lead('1062', 1, 'A'), tv('1062', '27'), tv('2000', '31'), mk('16EP100001')];
    const { rows, sectionOf } = buildNetzwerkSectionRows(input, null);
    const proSektion = new Map<string, number>();
    for (const r of rows) proSektion.set(sectionOf(r), (proSektion.get(sectionOf(r)) ?? 0) + 1);
    expect([...proSektion.values()].reduce((a, b) => a + b, 0)).toBe(input.length);
  });
});

describe('buildKuerzelSectionRows (Gruppiert: FB / AB)', () => {
  it('sortiert die FB-Abschnitte alphabetisch, „ohne FB" immer zuletzt', () => {
    const input = [
      mk('A', { tib_kuerz: 'ZTP' }),
      mk('B'),
      mk('C', { tib_kuerz: 'BIB' }),
      mk('D', { tib_kuerz: 'ZTP' }),
      mk('E', { tib_kuerz: '   ' }),
    ];
    const { rows, sectionOf, labelOf } = buildKuerzelSectionRows(input, 'tib_kuerz');
    expect(rows.map(r => r.aktenzeichen)).toEqual(['C', 'A', 'D', 'B', 'E']);
    expect(rows.map(r => sectionOf(r))).toEqual([
      'BIB', 'ZTP', 'ZTP', '__ohne_kuerzel__', '__ohne_kuerzel__',
    ]);
    expect(labelOf('BIB')).toBe('BIB');
    expect(labelOf('__ohne_kuerzel__')).toBe('ohne FB');
  });

  it('liest für AB die BIB-Spalte und beschriftet den Rest-Abschnitt entsprechend', () => {
    const input = [mk('A', { bib_kuerz: 'MUE', tib_kuerz: 'THU' }), mk('B', { tib_kuerz: 'THU' })];
    const { sectionOf, labelOf } = buildKuerzelSectionRows(input, 'bib_kuerz');
    expect(sectionOf(input[0]!)).toBe('MUE');
    expect(sectionOf(input[1]!)).toBe('__ohne_kuerzel__');
    expect(labelOf('__ohne_kuerzel__')).toBe('ohne AB');
  });

  it('legt ein Umlaut-Kürzel in BEIDEN Unicode-Normalformen in EINEN Abschnitt', () => {
    // NFC: U+00DC (Ü als ein Zeichen) — NFD: U+0055 U+0308 (U + Kombinierendes Trema).
    const nfc = 'THÜ';
    const nfd = 'THÜ';
    expect(nfc).not.toBe(nfd);
    const input = [mk('A', { tib_kuerz: nfc }), mk('B', { tib_kuerz: nfd })];
    const { rows, sectionOf } = buildKuerzelSectionRows(input, 'tib_kuerz');
    expect(new Set(rows.map(r => sectionOf(r))).size).toBe(1);
    expect(sectionOf(rows[0]!)).toBe(nfc);
  });

  it('verliert keine Zeile — Summenprobe über alle Abschnitte', () => {
    const input = [
      mk('A', { tib_kuerz: 'ZTP' }), mk('B'), mk('C', { tib_kuerz: 'BIB' }), mk('D', { tib_kuerz: 'ZTP' }),
    ];
    const { rows, sectionOf } = buildKuerzelSectionRows(input, 'tib_kuerz');
    const proSektion = new Map<string, number>();
    for (const r of rows) proSektion.set(sectionOf(r), (proSektion.get(sectionOf(r)) ?? 0) + 1);
    expect([...proSektion.values()].reduce((a, b) => a + b, 0)).toBe(input.length);
    expect(rows).toHaveLength(input.length);
  });

  it('gruppiert die verdichteten Zeilen, wenn beide Achsen gesetzt sind', () => {
    // Ansicht „Antrag" + Gruppierung FB: der Verbund zählt als EINE Zeile und
    // landet unter dem Kürzel seines Lead-TVs.
    const verbund = buildVerbundTableRows(
      [
        mk('A', { verbund_id: 'V1', tib_kuerz: 'BIB' }),
        mk('B', { verbund_id: 'V1', tib_kuerz: 'BIB' }),
        mk('C', { tib_kuerz: 'ZTP' }),
      ],
      new Map(),
    );
    const { rows, sectionOf } = buildKuerzelSectionRows(verbund, 'tib_kuerz');
    expect(rows).toHaveLength(2);
    expect(rows.map(r => sectionOf(r))).toEqual(['BIB', 'ZTP']);
    expect(rows[0]!._verbund!.tvCount).toBe(2);
  });
});

/**
 * Gruppierung nach Dringlichkeit (v4.62) — die vierte Sektionierungs-Achse und
 * die einzige, die eine GERECHNETE Größe bändert.
 *
 * Die Grenzfälle stehen hier, weil die Abschnitte und der Ampelpunkt in der
 * Zelle dieselbe Tabelle lesen müssen (`FRIST_AMPEL_STUFEN`). Liefen sie
 * auseinander, stünde eine orange gepunktete Zeile unter „noch ≤ 30 T".
 */
describe('buildFristSectionRows (Gruppierung: Frist)', () => {
  /** Antragsdatum auf UTC-Mitternacht → exakte Tages-Arithmetik. Frist der
   *  Antragsphase = Antragsdatum + 90 Tage. */
  const EINGANG = '2026-01-01T00:00:00.000Z';
  const EINGANG_MS = new Date(EINGANG).getTime();
  const TAG_MS = MS_TAG;
  /** `now`, bei dem die 90-Tage-Frist noch `rest` Tage entfernt ist. */
  const nowFor = (rest: number): number => EINGANG_MS + (90 - rest) * TAG_MS;
  /** Offener Antrag mit laufender Uhr. */
  const offen = (az: string): AntragListItem =>
    mk(az, { status: st('beantragt'), antragsdatum: EINGANG });

  it('bändert nach Ampelstufe, dringendste zuerst, „ohne Uhr" ans Ende', () => {
    const now = nowFor(0);
    const input = [
      // Reihenfolge der Eingabe bewusst gemischt.
      mk('GRUEN', { status: st('beantragt'), antragsdatum: '2026-06-01T00:00:00.000Z' }),
      mk('HALT', { status: st('Schlussvermerk'), antragsdatum: EINGANG }),
      mk('ROT', { status: st('beantragt'), antragsdatum: '2025-01-01T00:00:00.000Z' }),
      // +90 Tage → Frist 2026-04-21, also 20 Tage Rest bei now = 2026-04-01.
      mk('GELB', { status: st('beantragt'), antragsdatum: '2026-01-21T00:00:00.000Z' }),
      offen('ORANGE'),
    ];
    const { rows, sectionOf, labelOf } = buildFristSectionRows(input, now);
    expect(rows.map(r => r.aktenzeichen)).toEqual(['ROT', 'ORANGE', 'GELB', 'GRUEN', 'HALT']);
    expect(rows.map(r => sectionOf(r)))
      .toEqual(['rot', 'orange', 'gelb', 'gruen', OHNE_LAUFENDE_FRIST]);
    expect(labelOf('rot')).toBe('überfällig');
    expect(labelOf('orange')).toBe('noch ≤ 14 T');
    expect(labelOf('gelb')).toBe('noch ≤ 30 T');
    expect(labelOf('gruen')).toBe('mehr als 30 T');
    expect(labelOf(OHNE_LAUFENDE_FRIST)).toBe('Ohne laufende Frist');
  });

  it('trifft die Grenzen der Ampel-Tabelle exakt', () => {
    // −1 / 0 / 14 / 15 / 30 / 31 — die Kanten, an denen ein „<" statt „<=" die
    // Zeile in den Nachbar-Abschnitt schöbe.
    const faelle: [number, string][] = [
      [-1, 'rot'], [0, 'orange'], [14, 'orange'],
      [15, 'gelb'], [30, 'gelb'], [31, 'gruen'],
    ];
    for (const [rest, erwartet] of faelle) {
      const { sectionOf, rows } = buildFristSectionRows([offen('X')], nowFor(rest));
      expect(sectionOf(rows[0]!), `Rest ${rest} T`).toBe(erwartet);
    }
  });

  it('legt angehaltene und unberechenbare Zeilen in EINEN Abschluss-Abschnitt', () => {
    // Beide haben keine Restzeit; eine erfundene sortierte sie unter die
    // dringenden (dieselbe Regel wie in `fristTageVon`).
    const input = [
      mk('TERMINAL', { status: st('Schlussvermerk'), antragsdatum: EINGANG }),
      mk('OHNE_DATUM', { status: st('beantragt') }),
    ];
    const { rows, sectionOf } = buildFristSectionRows(input, nowFor(0));
    expect(rows.map(r => sectionOf(r))).toEqual([OHNE_LAUFENDE_FRIST, OHNE_LAUFENDE_FRIST]);
  });

  it('lässt leere Abschnitte weg und verliert keine Zeile', () => {
    const input = [offen('A'), offen('B')];
    const { rows, sectionOf } = buildFristSectionRows(input, nowFor(5));
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map(r => sectionOf(r)))).toEqual(new Set(['orange']));
  });

  it('bändert eine Verbund-Zeile nach der DRINGENDSTEN Frist ihrer Teilvorhaben', () => {
    // Die Zeile zeigt in der Frist-Spalte dieselbe Zahl (`criticalFristErgebnis`);
    // stünde sie unter einem anderen Band, widerspräche das Band der Zelle.
    const verbund = buildVerbundTableRows(
      [
        mk('A', { verbund_id: 'V1', status: st('beantragt'), antragsdatum: '2026-06-01T00:00:00.000Z' }),
        mk('B', { verbund_id: 'V1', status: st('beantragt'), antragsdatum: '2025-01-01T00:00:00.000Z' }),
      ],
      new Map(),
    );
    const { rows, sectionOf } = buildFristSectionRows(verbund, nowFor(0));
    expect(rows).toHaveLength(1);
    expect(rows[0]!._verbund!.tvCount).toBe(2);
    // B ist längst überfällig — der Verbund gilt als überfällig, nicht als grün.
    expect(sectionOf(rows[0]!)).toBe('rot');
  });

  it('gibt für eine fremde Zeile denselben Abschnitt wie der Builder', () => {
    // `sectionOf` bedient sich aus einem Cache; die Tabelle darf ihm trotzdem
    // eine Zeile reichen, die nicht durch den Builder lief.
    const now = nowFor(5);
    const { sectionOf } = buildFristSectionRows([offen('A')], now);
    expect(sectionOf(offen('FREMD'))).toBe('orange');
  });
});
