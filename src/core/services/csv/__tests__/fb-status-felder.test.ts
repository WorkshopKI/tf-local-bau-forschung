import { describe, it, expect } from 'vitest';
import { resolveFbStatusFelder, computeFbStatus, FB_STATUS_CODES, type FbStatusFeld } from '../fb-status-felder';
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

describe('resolveFbStatusFelder', () => {
  it('loest Custom-gemappte Spalte auf und nutzt entry.label als Badge-Label', () => {
    const felder = resolveFbStatusFelder([
      schema({ 'D_ABLT': { custom: 'fb_ablt', label: 'Ablehnung' } }),
    ]);
    expect(felder).toEqual<FbStatusFeld[]>([{ feld: 'fb_ablt', code: 'D_ABLT', label: 'Ablehnung' }]);
  });

  it('Fallback auf den Code, wenn kein Label gesetzt ist', () => {
    const felder = resolveFbStatusFelder([schema({ 'D_ZBT': { custom: 'fb_zbt' } })]);
    expect(felder).toEqual<FbStatusFeld[]>([{ feld: 'fb_zbt', code: 'D_ZBT', label: 'D_ZBT' }]);
  });

  it('unterscheidet D_XPC+ und D_XPC- (das + bleibt im normCode erhalten)', () => {
    const felder = resolveFbStatusFelder([
      schema({
        'D_XPC+': { custom: 'plus' },
        'D_XPC-': { custom: 'minus' },
      }),
    ]);
    const byCode = Object.fromEntries(felder.map(f => [f.code, f.feld]));
    expect(byCode['D_XPC+']).toBe('plus');
    expect(byCode['D_XPC-']).toBe('minus');
  });

  it('matcht D_AET NFC-unabhaengig (dekomponiertes Ae im Spalten-Header)', () => {
    // 'D_ÄT' in NFD: D _ A + combining diaeresis (U+0308) + T
    const decomposed = 'D_ÄT';
    const felder = resolveFbStatusFelder([schema({ [decomposed]: { custom: 'fb_aet' } })]);
    expect(felder).toHaveLength(1);
    expect(felder[0]?.feld).toBe('fb_aet');
  });

  it('ignoriert nicht gemappte Codes und ignore:true', () => {
    const felder = resolveFbStatusFelder([
      schema({ 'D_ALS': { custom: 'als' }, 'D_ALU': { custom: 'alu', ignore: true } }),
    ]);
    expect(felder.map(f => f.code)).toEqual(['D_ALS']);
  });

  it('liefert Felder in FB_STATUS_CODES-Reihenfolge', () => {
    const felder = resolveFbStatusFelder([
      schema({ 'D_ZBT': { custom: 'z' }, 'D_ALS': { custom: 'a' }, 'D_ABLT': { custom: 'b' } }),
    ]);
    const order = felder.map(f => f.code);
    // Reihenfolge folgt FB_STATUS_CODES (D_ALS < D_ABLT < D_ZBT), nicht der Map.
    expect(order.indexOf('D_ALS')).toBeLessThan(order.indexOf('D_ABLT'));
    expect(order.indexOf('D_ABLT')).toBeLessThan(order.indexOf('D_ZBT'));
  });
});

describe('computeFbStatus', () => {
  const felder: FbStatusFeld[] = [
    { feld: 'a', code: 'D_ALS', label: 'Erste' },
    { feld: 'b', code: 'D_ABLT', label: 'Zweite' },
    { feld: 'c', code: 'D_ZBT', label: 'Dritte' },
  ];

  it('liefert null, wenn kein Feld ein gueltiges Datum traegt', () => {
    expect(computeFbStatus({ a: '', b: 'kein datum', c: undefined }, felder)).toBeNull();
  });

  it('waehlt das juengste Datum und gibt dessen Label + ISO-Datum zurueck', () => {
    const fb = computeFbStatus({ a: '2024-01-01', b: '2026-05-10', c: '2025-12-31' }, felder);
    expect(fb).toEqual({ label: 'Zweite', datum: '2026-05-10' });
  });

  it('akzeptiert deutsches Datumsformat (DD.MM.YYYY) und normalisiert nach ISO', () => {
    const fb = computeFbStatus({ a: '15.03.2026', b: '01.01.2020' }, felder);
    expect(fb).toEqual({ label: 'Erste', datum: '2026-03-15' });
  });

  it('ueberspringt ungueltige Datums-Strings', () => {
    const fb = computeFbStatus({ a: '2026-06-01', b: '99.99.9999', c: 'foo' }, felder);
    expect(fb).toEqual({ label: 'Erste', datum: '2026-06-01' });
  });

  it('bei Gleichstand gewinnt der frueher gelistete Code', () => {
    const fb = computeFbStatus({ a: '2026-06-01', b: '2026-06-01' }, felder);
    expect(fb?.label).toBe('Erste');
  });

  it('ignoriert nicht-string-Werte', () => {
    const fb = computeFbStatus({ a: 12345, b: '2026-02-02' } as Record<string, unknown>, felder);
    expect(fb).toEqual({ label: 'Zweite', datum: '2026-02-02' });
  });
});

describe('FB_STATUS_CODES', () => {
  it('enthaelt die 11 erwarteten Legacy-Spalten', () => {
    expect(FB_STATUS_CODES).toHaveLength(11);
    expect(FB_STATUS_CODES).toContain('D_XPC+');
    expect(FB_STATUS_CODES).toContain('D_XPC-');
  });
});
