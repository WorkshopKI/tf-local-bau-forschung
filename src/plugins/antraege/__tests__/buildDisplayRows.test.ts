/**
 * buildDisplayRows: Custom-Field-Label-Resolution mit Schema-Lookup.
 *
 * Kritischer Pfad: Slug-Field-Namen verlieren Umlaute + Klammern
 * (kunstliche_intelligenz_ki_tv_ebene). Das echte XLS-Label aus dem
 * Schema-Mapping ("Künstliche Intelligenz (KI)") muss bevorzugt werden.
 */
import { describe, it, expect } from 'vitest';
import { buildDisplayRows } from '../alleFelder/buildDisplayRows';
import type { Antrag, CsvSchema } from '@/core/services/csv/types';

function makeAntrag(fields: Partial<Antrag> & Record<string, unknown>): Antrag {
  return {
    aktenzeichen: 'A1',
    programm_id: 'p1',
    _field_sources: {},
    _updated_at: new Date().toISOString(),
    ...fields,
  } as Antrag;
}

function makeSchema(opts: {
  id: string;
  isMaster?: boolean;
  priority?: number;
  mapping?: CsvSchema['column_mapping'];
}): CsvSchema {
  return {
    id: opts.id,
    programm_id: 'p1',
    csv_source_name: opts.id,
    is_master: opts.isMaster ?? false,
    join_key: 'aktenzeichen',
    priority: opts.priority ?? 0,
    column_mapping: opts.mapping ?? {},
    encoding: 'UTF-8',
    separator: ';',
    created_at: new Date().toISOString(),
  };
}

describe('buildDisplayRows — Custom-Label-Resolution', () => {
  it('Ohne Schemas: Fallback auf prettyfied Slug', () => {
    const antrag = makeAntrag({ kunstliche_intelligenz_ki_tv_ebene: 'Y' });
    const rows = buildDisplayRows(antrag);
    const ki = rows.find(r => r.field === 'kunstliche_intelligenz_ki_tv_ebene');
    // Fallback: Title-Case ohne Umlaut (Slug-Pretty)
    expect(ki?.label).toBe('Kunstliche Intelligenz Ki Tv Ebene');
  });

  it('Mit Schema-Label: nutzt das echte XLS-Label (mit Umlaut + Klammer)', () => {
    const antrag = makeAntrag({
      _field_sources: { kunstliche_intelligenz_ki_tv_ebene: 'src-1' },
      kunstliche_intelligenz_ki_tv_ebene: 'Y',
    } as Partial<Antrag> & Record<string, unknown>);
    const schema = makeSchema({
      id: 'src-1',
      mapping: {
        'Künstliche': {
          custom: 'kunstliche_intelligenz_ki_tv_ebene',
          type: 'string',
          label: 'Künstliche Intelligenz (KI)',
        },
      },
    });
    const rows = buildDisplayRows(antrag, [schema]);
    const ki = rows.find(r => r.field === 'kunstliche_intelligenz_ki_tv_ebene');
    expect(ki?.label).toBe('Künstliche Intelligenz (KI)');
  });

  it('Source-Schema ohne Label → Fallback auf prettyfied Slug', () => {
    const antrag = makeAntrag({
      _field_sources: { cloud_computing_tv_ebene: 'src-1' },
      cloud_computing_tv_ebene: 'J',
    } as Partial<Antrag> & Record<string, unknown>);
    const schema = makeSchema({
      id: 'src-1',
      mapping: {
        'Cloud Comp': {
          custom: 'cloud_computing_tv_ebene',
          type: 'string',
          // KEIN label
        },
      },
    });
    const rows = buildDisplayRows(antrag, [schema]);
    const cloud = rows.find(r => r.field === 'cloud_computing_tv_ebene');
    expect(cloud?.label).toBe('Cloud Computing Tv Ebene');
  });

  it('Mehrere Schemas: Master-Schema-Label gewinnt vor Secondary', () => {
    const antrag = makeAntrag({
      // _field_sources fehlt → muss über Rang-Reihenfolge auflösen
      big_data_analyse_tv_ebene: 'X',
    });
    const masterSchema = makeSchema({
      id: 'master',
      isMaster: true,
      priority: 100,
      mapping: {
        'Big Data A': {
          custom: 'big_data_analyse_tv_ebene',
          type: 'string',
          label: 'Big Data Analyse',
        },
      },
    });
    const secondarySchema = makeSchema({
      id: 'secondary',
      priority: 50,
      mapping: {
        'Big Data A': {
          custom: 'big_data_analyse_tv_ebene',
          type: 'string',
          label: 'WRONG LABEL',
        },
      },
    });
    const rows = buildDisplayRows(antrag, [secondarySchema, masterSchema]);
    const bd = rows.find(r => r.field === 'big_data_analyse_tv_ebene');
    expect(bd?.label).toBe('Big Data Analyse');
  });

  it('Source-Schema-Label gewinnt vor Master, wenn _field_sources gesetzt ist', () => {
    const antrag = makeAntrag({
      _field_sources: { x_field: 'secondary' },
      x_field: 'X',
    } as Partial<Antrag> & Record<string, unknown>);
    const masterSchema = makeSchema({
      id: 'master',
      isMaster: true,
      priority: 100,
      mapping: {
        'X': { custom: 'x_field', type: 'string', label: 'X aus Master' },
      },
    });
    const secondarySchema = makeSchema({
      id: 'secondary',
      priority: 10,
      mapping: {
        'X': { custom: 'x_field', type: 'string', label: 'X aus Source' },
      },
    });
    const rows = buildDisplayRows(antrag, [masterSchema, secondarySchema]);
    const x = rows.find(r => r.field === 'x_field');
    // _field_sources zeigt auf "secondary" → dessen Label gewinnt, obwohl
    // Master höhere Priority hat.
    expect(x?.label).toBe('X aus Source');
  });

  it('Canonical Field bekommt sein Canonical-Label (kein Schema-Lookup)', () => {
    const antrag = makeAntrag({ titel: 'Mein Projekt' });
    const rows = buildDisplayRows(antrag, []);
    const titel = rows.find(r => r.field === 'titel');
    expect(titel).toBeDefined();
    expect(titel?.label).not.toBe('Titel'); // sollte echte Bezeichnung sein
    expect(titel?.label.toLowerCase()).toContain('titel');
  });
});
