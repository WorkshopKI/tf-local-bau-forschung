import { describe, it, expect } from 'vitest';
import { buildVerbundTableRows, buildStatusSectionRows } from '../tableGrouping';
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

describe('buildVerbundTableRows (Gruppiert: Verbund)', () => {
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

  it('fasst Verbünde im Status-Modus NICHT zusammen — jedes TV bleibt eine Zeile', () => {
    const input = [
      mk('A', { verbund_id: 'V1', status: st('beantragt') }),
      mk('B', { verbund_id: 'V1', status: st('beantragt') }),
    ];
    const { rows } = buildStatusSectionRows(input);
    expect(rows).toHaveLength(2);
    expect(rows.every(r => r._verbund === undefined)).toBe(true);
  });
});
