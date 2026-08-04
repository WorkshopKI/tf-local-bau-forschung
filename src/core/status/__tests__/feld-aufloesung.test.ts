import { describe, it, expect } from 'vitest';
import {
  baueFeldAufloesung, herkunftVon, sammleVorkommen,
} from '@/core/status/feld-aufloesung';
import { baueSeedVersion } from '@/core/status/seed';
import type { StatusFeldEintrag } from '@/core/status/typen';
import type { ColumnMapping, CsvSchema } from '@/core/services/csv/types';
import { SCHEMA_A_COLUMN_MAPPING } from '@/../docs/fixtures/schema-a';
import { SCHEMA_B_COLUMN_MAPPING } from '@/../docs/fixtures/schema-b';
import { SCHEMA_C_COLUMN_MAPPING } from '@/../docs/fixtures/schema-c';

function schema(id: string, mapping: ColumnMapping, isMaster = false): CsvSchema {
  return {
    id,
    programm_id: 'p1',
    csv_source_name: id,
    is_master: isMaster,
    priority: isMaster ? 100 : 10,
    join_key: 'aktenzeichen',
    column_mapping: mapping,
    created_at: '2026-01-01T00:00:00.000Z',
  };
}

const FIXTURE_SCHEMAS: CsvSchema[] = [
  schema('a', SCHEMA_A_COLUMN_MAPPING, true),
  schema('b', SCHEMA_B_COLUMN_MAPPING),
  schema('c', SCHEMA_C_COLUMN_MAPPING),
];

/**
 * Die Fixture-Schemas mappen bewusst nur einen Ausschnitt (24/21/75 Spalten) —
 * ein echtes C16-Schema mappt die Statusspalten mit. Für die Auflösung selbst
 * braucht es deshalb ein Schema, das sie führt; die Fixtures bleiben für die
 * Kollisions-Fälle zuständig, wo ihre kanonischen Mappings der Punkt sind.
 */
const STATUS_SCHEMA = schema('status', {
  FKZ: { canonical: 'aktenzeichen', type: 'string', required: true },
  D_QS: { type: 'date', label: 'kaufmännische QS erfolgt' },
  'D_PC+': { type: 'date' },
  'D_PC?': { type: 'date' },
  'D_PC-': { type: 'date' },
  'D_XPC+': { type: 'date' },
  'D_ÄT': { type: 'date' },
  D_AAI: { type: 'date' },
  T_AAI: { type: 'string' },
  D_XTEC: { type: 'date' },
  T_HINT: { custom: 'bemerkung_frei', type: 'string' },
});

function feld(p: Partial<StatusFeldEintrag> & { feldId: string }): StatusFeldEintrag {
  return {
    label: p.feldId, typ: 'datum', ebene: 'tv',
    prominenzDefault: 'normal', aktiv: true, unkuratiert: false, ...p,
  };
}

describe('baueFeldAufloesung', () => {
  it('löst eine gemappte Code-Spalte auf ihren Record-Key auf', () => {
    // Ohne `canonical`/`custom` legt `resolveFieldKey` die Spalte kleingeschrieben ab.
    const a = baueFeldAufloesung([STATUS_SCHEMA], [feld({ feldId: 'D_QS', code: 'QS' })]);
    expect(a.get('D_QS')?.recordKey).toBe('d_qs');
  });

  it('folgt einem custom-Mapping statt zu raten', () => {
    const a = baueFeldAufloesung([STATUS_SCHEMA], [feld({ feldId: 'T_HINT', typ: 'text', code: 'HINT' })]);
    expect(a.get('T_HINT')?.recordKey).toBe('bemerkung_frei');
  });

  it('hält die Sonderzeichen-Codes auseinander', () => {
    const felder = ['D_PC+', 'D_PC?', 'D_PC-', 'D_XPC+', 'D_ÄT'].map(f => feld({ feldId: f, code: f.slice(2) }));
    const a = baueFeldAufloesung([STATUS_SCHEMA], felder);
    const keys = felder.map(f => a.get(f.feldId)?.recordKey);
    expect(keys).toEqual(['d_pc+', 'd_pc?', 'd_pc-', 'd_xpc+', 'd_ät']);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('löst die Begleit-Textspalte mit auf', () => {
    const a = baueFeldAufloesung(
      [STATUS_SCHEMA], [feld({ feldId: 'D_AAI', code: 'AAI', textSpalte: 'T_AAI' })],
    );
    expect(a.get('D_AAI')?.recordKey).toBe('d_aai');
    expect(a.get('D_AAI')?.textKey).toBe('t_aai');
  });

  it('respektiert quelleKey (Verbund-Status liegt im Record unter „status")', () => {
    const a = baueFeldAufloesung(FIXTURE_SCHEMAS, [
      feld({ feldId: 'verbund_status', typ: 'wert', ebene: 'verbund', quelleKey: 'status' }),
    ]);
    expect(a.get('verbund_status')?.recordKey).toBe('status');
  });

  it('lässt kanonische Felder auf ihrem eigenen Key', () => {
    const a = baueFeldAufloesung(FIXTURE_SCHEMAS, [feld({ feldId: 'antragsdatum', code: 'AAE' })]);
    expect(a.get('antragsdatum')?.recordKey).toBe('antragsdatum');
  });

  it('löst eine Kollision zugunsten des kanonischen Feldes auf', () => {
    // `D_AAE` ist in den Fixtures auf `antragsdatum` gemappt: beide Felder
    // zeigten auf denselben Record-Key. Der Code-Eintrag muss weichen, sonst
    // zählte dasselbe Ereignis doppelt.
    const a = baueFeldAufloesung(FIXTURE_SCHEMAS, [
      feld({ feldId: 'D_AAE', code: 'AAE' }),
      feld({ feldId: 'antragsdatum' }),
    ]);
    expect(a.has('D_AAE')).toBe(false);
    expect(a.get('antragsdatum')?.recordKey).toBe('antragsdatum');
  });

  it('erzeugt aus dem Auslieferungs-Seed keine doppelten Record-Keys', () => {
    const a = baueFeldAufloesung(FIXTURE_SCHEMAS, baueSeedVersion().felder);
    const keys = [...a.values()].map(v => v.recordKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('wirft bei einer Spalte, die kein Schema kennt, nicht — sie bleibt sie selbst', () => {
    const a = baueFeldAufloesung(FIXTURE_SCHEMAS, [feld({ feldId: 'D_GIBTSNICHT', code: 'GIBTSNICHT' })]);
    expect(a.get('D_GIBTSNICHT')?.recordKey).toBe('D_GIBTSNICHT');
  });
});

describe('herkunftVon', () => {
  it('leitet ohne explizite Angabe aus der Ebene ab', () => {
    expect(herkunftVon(feld({ feldId: 'x', ebene: 'verbund' }))).toBe('verbund-record');
    expect(herkunftVon(feld({ feldId: 'x', ebene: 'tv' }))).toBe('tv-record');
  });

  it('lässt die explizite Angabe gewinnen', () => {
    expect(herkunftVon(feld({ feldId: 'x', ebene: 'verbund', herkunft: 'tv-record' })))
      .toBe('tv-record');
  });
});

describe('sammleVorkommen', () => {
  const VB = { status: 'beantragt' };
  const TVS = [
    { aktenzeichen: 'TV1', record: { d_xtec: '01.02.2026', d_qs: '', status: 'in prüfung' } },
    { aktenzeichen: 'TV2', record: { d_xtec: '01.02.2026', d_qs: '05.03.2026', status: 'beantragt' } },
  ];

  it('meldet ein Verbund-Feld aus dem TV-Record genau EINMAL, ohne tvId', () => {
    const felder = [feld({ feldId: 'd_xtec', ebene: 'verbund', herkunft: 'tv-record', code: 'XTEC' })];
    const v = sammleVorkommen(felder, VB, TVS);
    expect(v).toHaveLength(1);
    expect(v[0]?.tvId).toBeUndefined();
    expect(v[0]?.wert).toBe('01.02.2026');
  });

  it('meldet TV-Felder je Teilvorhaben — leere Werte fallen weg', () => {
    const felder = [feld({ feldId: 'd_qs', ebene: 'tv', code: 'QS' })];
    const v = sammleVorkommen(felder, VB, TVS);
    expect(v).toHaveLength(1);
    expect(v[0]?.tvId).toBe('TV2');
  });

  it('liest ein Verbund-Feld aus dem Verbund-Record, wenn die Herkunft das sagt', () => {
    const felder = [feld({ feldId: 'verbund_status', typ: 'wert', ebene: 'verbund', quelleKey: 'status' })];
    const v = sammleVorkommen(felder, VB, TVS);
    expect(v).toHaveLength(1);
    expect(v[0]?.wert).toBe('beantragt');
  });

  it('nimmt den ersten TV, der überhaupt einen Wert trägt', () => {
    const felder = [feld({ feldId: 'd_qs', ebene: 'verbund', herkunft: 'tv-record' })];
    const v = sammleVorkommen(felder, VB, TVS);
    expect(v).toHaveLength(1);
    expect(v[0]?.wert).toBe('05.03.2026');
  });

  it('nutzt die Auflösung, wenn eine übergeben wird', () => {
    // Das Feld heißt `D_QS`, im Record steht der Wert unter `d_qs` — ohne
    // Auflösung fände `sammleVorkommen` nichts.
    const felder = [feld({ feldId: 'D_QS', ebene: 'tv', code: 'QS' })];
    expect(sammleVorkommen(felder, VB, TVS)).toEqual([]);
    const aufloesung = baueFeldAufloesung([STATUS_SCHEMA], felder);
    expect(sammleVorkommen(felder, VB, TVS, aufloesung).map(x => x.wert)).toEqual(['05.03.2026']);
  });

  it('liefert den Begleittext mit, wenn er gefüllt ist', () => {
    const felder = [feld({ feldId: 'd_aai', ebene: 'tv', textSpalte: 't_aai' })];
    const tvs = [{ aktenzeichen: 'TV1', record: { d_aai: '01.01.2026', t_aai: 'ID-4711' } }];
    const v = sammleVorkommen(felder, {}, tvs, new Map([
      ['d_aai', { recordKey: 'd_aai', textKey: 't_aai' }],
    ]));
    expect(v[0]?.text).toBe('ID-4711');
  });
});
