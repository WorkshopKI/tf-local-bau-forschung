import { describe, it, expect } from 'vitest';
import { classifyField, adminBadgeLabel } from '../felderKuration';
import type { DisplayRow } from '../buildDisplayRows';

function row(field: string, label = field): DisplayRow {
  return { field, label, value: '', rawValue: null, sourceSchemaId: undefined, isCanonical: false };
}

describe('classifyField', () => {
  it('erkennt Duplikate per Label inkl. dupOf', () => {
    const c = classifyField(row('gesamtkosten', 'Gesamtkosten'));
    expect(c).toEqual({ admin: true, kind: 'duplikat', dupOf: 'beantragte Kosten' });
  });

  it('matcht label-tolerant (Groß/Klein, Trenner)', () => {
    expect(classifyField(row('x', 'VB Beginn')).kind).toBe('duplikat');
    expect(classifyField(row('x', 'vb-beginn')).kind).toBe('duplikat');
  });

  it('erkennt Duplikate/Rohfelder per Fixture-Key', () => {
    expect(classifyField(row('antragsteller_ast', 'Org Ast'))).toMatchObject({ kind: 'duplikat', dupOf: 'Antragsteller' });
    expect(classifyField(row('akz_intern', 'Akz'))).toMatchObject({ admin: true, kind: 'roh' });
  });

  it('lässt unbekannte Felder normal (sichtbar)', () => {
    expect(classifyField(row('akronym', 'Akronym'))).toEqual({ admin: false });
  });
});

describe('adminBadgeLabel', () => {
  it('mappt kind → Badge-Text', () => {
    expect(adminBadgeLabel({ admin: true, kind: 'duplikat' })).toBe('Duplikat');
    expect(adminBadgeLabel({ admin: true, kind: 'roh' })).toBe('Roh');
    expect(adminBadgeLabel({ admin: false })).toBeNull();
  });
});
