import { describe, it, expect } from 'vitest';
import {
  resolveStatusDatumFelder,
  resolveStatusDatumGruppen,
  computeStatusDatum,
  STATUS_DATUM_GRUPPEN,
  FB_STATUS_CODES,
  PRECHECK_STATUS_CODES,
  type StatusDatumFeld,
} from '../status-datum-gruppen';
import type { CsvSchema, ColumnMapping } from '../types';

function schema(column_mapping: ColumnMapping, opts?: Partial<CsvSchema>): CsvSchema {
  return {
    id: 's1',
    programm_id: 'P',
    csv_source_name: 'src',
    is_master: true,
    join_key: 'aktenzeichen',
    priority: 0,
    column_mapping,
    created_at: '2026-01-01T00:00:00Z',
    ...opts,
  };
}

describe('resolveStatusDatumFelder', () => {
  it('loest Custom-gemappte Spalte auf und nutzt entry.label als Badge-Label', () => {
    const felder = resolveStatusDatumFelder([
      schema({ 'D_ABLT': { custom: 'fb_ablt', label: 'Ablehnung' } }),
    ], ['D_ABLT']);
    expect(felder).toEqual<StatusDatumFeld[]>([{ feld: 'fb_ablt', code: 'D_ABLT', label: 'Ablehnung' }]);
  });

  it('Fallback auf den Code, wenn kein Label gesetzt ist', () => {
    const felder = resolveStatusDatumFelder([schema({ 'D_ZBT': { custom: 'fb_zbt' } })], ['D_ZBT']);
    expect(felder).toEqual<StatusDatumFeld[]>([{ feld: 'fb_zbt', code: 'D_ZBT', label: 'D_ZBT' }]);
  });

  it('unterscheidet D_PC+, D_PC? und D_PC- (+ und ? bleiben, - wird gestrippt)', () => {
    const felder = resolveStatusDatumFelder([
      schema({
        'D_PC+': { custom: 'plus' },
        'D_PC?': { custom: 'frage' },
        'D_PC-': { custom: 'minus' },
      }),
    ], ['D_PC+', 'D_PC?', 'D_PC-']);
    const byCode = Object.fromEntries(felder.map(f => [f.code, f.feld]));
    expect(byCode['D_PC+']).toBe('plus');
    expect(byCode['D_PC?']).toBe('frage');
    expect(byCode['D_PC-']).toBe('minus');
  });

  it('unterscheidet D_XPC+, D_XPC? und D_XPC-', () => {
    const felder = resolveStatusDatumFelder([
      schema({ 'D_XPC+': { custom: 'xp' }, 'D_XPC?': { custom: 'xf' }, 'D_XPC-': { custom: 'xm' } }),
    ], ['D_XPC+', 'D_XPC?', 'D_XPC-']);
    const byCode = Object.fromEntries(felder.map(f => [f.code, f.feld]));
    expect(byCode['D_XPC+']).toBe('xp');
    expect(byCode['D_XPC?']).toBe('xf');
    expect(byCode['D_XPC-']).toBe('xm');
  });

  it('matcht D_AET NFC-unabhaengig (dekomponiertes Ae im Spalten-Header)', () => {
    const decomposed = 'D_ÄT'.normalize('NFD'); // D _ A + combining diaeresis + T
    const felder = resolveStatusDatumFelder([schema({ [decomposed]: { custom: 'fb_aet' } })], ['D_ÄT']);
    expect(felder).toHaveLength(1);
    expect(felder[0]?.feld).toBe('fb_aet');
  });

  it('ignoriert nicht gemappte Codes und ignore:true; behaelt codes-Reihenfolge', () => {
    const felder = resolveStatusDatumFelder([
      schema({ 'D_ALU': { custom: 'alu', ignore: true }, 'D_ALS': { custom: 'als' }, 'D_PCQ': { custom: 'pcq' } }),
    ], ['D_PCQ', 'D_ALS', 'D_ALU']);
    expect(felder.map(f => f.code)).toEqual(['D_PCQ', 'D_ALS']);
  });
});

describe('computeStatusDatum', () => {
  const felder: StatusDatumFeld[] = [
    { feld: 'a', code: 'D_ALS', label: 'Erste' },
    { feld: 'b', code: 'D_ABLT', label: 'Zweite' },
    { feld: 'c', code: 'D_ZBT', label: 'Dritte' },
  ];

  it('liefert null, wenn kein Feld ein gueltiges Datum traegt', () => {
    expect(computeStatusDatum({ a: '', b: 'kein datum', c: undefined }, felder)).toBeNull();
  });

  it('waehlt das juengste Datum und gibt dessen Label + ISO-Datum zurueck', () => {
    const fb = computeStatusDatum({ a: '2024-01-01', b: '2026-05-10', c: '2025-12-31' }, felder);
    expect(fb).toEqual({ label: 'Zweite', datum: '2026-05-10' });
  });

  it('akzeptiert deutsches Datumsformat (DD.MM.YYYY) und normalisiert nach ISO', () => {
    const fb = computeStatusDatum({ a: '15.03.2026', b: '01.01.2020' }, felder);
    expect(fb).toEqual({ label: 'Erste', datum: '2026-03-15' });
  });

  it('ueberspringt ungueltige Datums-Strings', () => {
    const fb = computeStatusDatum({ a: '2026-06-01', b: '99.99.9999', c: 'foo' }, felder);
    expect(fb).toEqual({ label: 'Erste', datum: '2026-06-01' });
  });

  it('bei Gleichstand gewinnt der frueher gelistete Code', () => {
    const fb = computeStatusDatum({ a: '2026-06-01', b: '2026-06-01' }, felder);
    expect(fb?.label).toBe('Erste');
  });

  it('ignoriert nicht-string-Werte', () => {
    const fb = computeStatusDatum({ a: 12345, b: '2026-02-02' } as Record<string, unknown>, felder);
    expect(fb).toEqual({ label: 'Zweite', datum: '2026-02-02' });
  });
});

describe('STATUS_DATUM_GRUPPEN (Registry)', () => {
  it('enthaelt FB- und PreCheck-Gruppe mit den richtigen Slim-Keys', () => {
    const ids = STATUS_DATUM_GRUPPEN.map(g => g.id);
    expect(ids).toEqual(['fb', 'precheck']);
    const fb = STATUS_DATUM_GRUPPEN.find(g => g.id === 'fb')!;
    const pc = STATUS_DATUM_GRUPPEN.find(g => g.id === 'precheck')!;
    expect([fb.labelKey, fb.datumKey]).toEqual(['fb_status_label', 'fb_status_datum']);
    expect([pc.labelKey, pc.datumKey]).toEqual(['precheck_status_label', 'precheck_status_datum']);
  });

  it('FB hat 11, PreCheck 9 Codes; PreCheck enthaelt die ?-Codes', () => {
    expect(FB_STATUS_CODES).toHaveLength(11);
    expect(PRECHECK_STATUS_CODES).toHaveLength(9);
    expect(PRECHECK_STATUS_CODES).toContain('D_PC?');
    expect(PRECHECK_STATUS_CODES).toContain('D_XPC?');
  });

  it('resolveStatusDatumGruppen loest beide Gruppen unabhaengig auf (D_XPC+ in beiden)', () => {
    const gruppen = resolveStatusDatumGruppen([
      schema({ 'D_XPC+': { custom: 'xpc_plus', label: 'XPC+' } }),
    ]);
    const fb = gruppen.find(g => g.labelKey === 'fb_status_label')!;
    const pc = gruppen.find(g => g.labelKey === 'precheck_status_label')!;
    // D_XPC+ ist in beiden Code-Listen → beide Gruppen lösen es auf.
    expect(fb.felder.find(f => f.code === 'D_XPC+')?.feld).toBe('xpc_plus');
    expect(pc.felder.find(f => f.code === 'D_XPC+')?.feld).toBe('xpc_plus');
  });
});
