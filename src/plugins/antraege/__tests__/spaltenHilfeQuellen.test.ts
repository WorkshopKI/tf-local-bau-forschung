import { describe, it, expect } from 'vitest';
import { baueSpaltenHilfe } from '@/plugins/antraege/spaltenHilfe';
import { FRIST_GRUND } from '@/core/services/csv/frist-ergebnis';
import type { CsvSchema } from '@/core/services/csv/types';

const SCHEMA: CsvSchema = {
  id: 'S1', programm_id: 'zim', csv_source_name: 'zim.csv', is_master: true,
  join_key: 'aktenzeichen', priority: 1, created_at: '2026-01-01T00:00:00.000Z',
  column_mapping: {
    D_AAE: { canonical: 'antragsdatum', type: 'date', label: 'Antrags\r\neingang' },
    D_XTE: { custom: 'alle_an_trage_da', type: 'date', label: 'alle An-träge da' },
  },
};

describe('Frist-Spalte — feste Codes, Beschriftung aus dem Schema', () => {
  it('nimmt das Label der Label-XLS, wo das Schema die Spalte führt', () => {
    const felder = baueSpaltenHilfe({ schemas: [SCHEMA] }).get('frist')?.felder ?? [];
    expect(felder.map(f => f.code)).toEqual(['D_AAE', 'D_XTE', 'D_VBE']);
    expect(felder.find(f => f.code === 'D_AAE')?.label).toBe('Antrags eingang');
    expect(felder.find(f => f.code === 'D_XTE')?.label).toBe('alle An-träge da');
  });

  it('behält die Hand-Beschriftung, wo das Schema die Spalte nicht führt', () => {
    const mitSchema = baueSpaltenHilfe({ schemas: [SCHEMA] }).get('frist')?.felder ?? [];
    expect(mitSchema.find(f => f.code === 'D_VBE')?.label).toBe('Eingang Verwendungsnachweis');
    const ohne = baueSpaltenHilfe({ schemas: [] }).get('frist')?.felder ?? [];
    expect(ohne.find(f => f.code === 'D_AAE')?.label).toBe('Antragseingang');
  });
});

describe('FRIST_GRUND nennt Code und Klartext', () => {
  it('sagt, welche Spalten fehlen — nicht nur ihre Codes', () => {
    expect(FRIST_GRUND.ohneEingang).toContain('D_AAE (Antragseingang)');
    expect(FRIST_GRUND.ohneEingang).toContain('D_XTE');
    expect(FRIST_GRUND.ohneVnEingang).toContain('D_VBE, Eingang Verwendungsnachweis');
  });
});
