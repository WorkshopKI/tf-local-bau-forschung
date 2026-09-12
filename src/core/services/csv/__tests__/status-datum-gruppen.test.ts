import { describe, it, expect } from 'vitest';
import {
  resolveStatusDatumFelder,
  resolveStatusDatumGruppen,
  computeStatusDatum,
  STATUS_DATUM_GRUPPEN,
  FB_STATUS_CODES,
  PRECHECK_TV_STATUS_CODES,
  PRECHECK_VB_STATUS_CODES,
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
  it('enthaelt FB- und BEIDE PreCheck-Gruppen mit den richtigen Slim-Keys', () => {
    const ids = STATUS_DATUM_GRUPPEN.map(g => g.id);
    expect(ids).toEqual(['fb', 'precheck_tv', 'precheck_vb']);
    const fb = STATUS_DATUM_GRUPPEN.find(g => g.id === 'fb')!;
    const tv = STATUS_DATUM_GRUPPEN.find(g => g.id === 'precheck_tv')!;
    const vb = STATUS_DATUM_GRUPPEN.find(g => g.id === 'precheck_vb')!;
    expect([fb.labelKey, fb.datumKey]).toEqual(['fb_status_label', 'fb_status_datum']);
    expect([tv.labelKey, tv.datumKey]).toEqual(['precheck_tv_status_label', 'precheck_tv_status_datum']);
    expect([vb.labelKey, vb.datumKey]).toEqual(['precheck_vb_status_label', 'precheck_vb_status_datum']);
  });

  /**
   * Die Trennlinie ist die **Ebene des Katalogs**, nicht eine Auswahl von Hand:
   * `D_PC*` ist `ebene: 'tv'`, `D_XPC*` ist `ebene: 'verbund'`. Landete ein
   * `X`-Code wieder in der TV-Liste, wäre die alte Vermischung zurück — und mit
   * ihr die 256 verdeckten negativen TV-PreChecks.
   */
  it('trennt TV- und Verbund-Codes sauber am X-Präfix', () => {
    expect(FB_STATUS_CODES).toHaveLength(11);
    expect(PRECHECK_TV_STATUS_CODES).toHaveLength(6);
    expect(PRECHECK_VB_STATUS_CODES).toHaveLength(3);
    expect(PRECHECK_TV_STATUS_CODES).toContain('D_PC?');
    expect(PRECHECK_VB_STATUS_CODES).toContain('D_XPC?');
    expect(PRECHECK_TV_STATUS_CODES.every(c => !c.startsWith('D_X'))).toBe(true);
    expect(PRECHECK_VB_STATUS_CODES.every(c => c.startsWith('D_X'))).toBe(true);
    // Kein Code steht in beiden — sonst zählte er doppelt.
    expect(PRECHECK_TV_STATUS_CODES.filter(c => PRECHECK_VB_STATUS_CODES.includes(c))).toEqual([]);
  });

  it('resolveStatusDatumGruppen loest die Gruppen unabhaengig auf (D_XPC+ in FB und PC-Verbund)', () => {
    const gruppen = resolveStatusDatumGruppen([
      schema({ 'D_XPC+': { custom: 'xpc_plus', label: 'XPC+' } }),
    ]);
    const fb = gruppen.find(g => g.labelKey === 'fb_status_label')!;
    const vb = gruppen.find(g => g.labelKey === 'precheck_vb_status_label')!;
    const tv = gruppen.find(g => g.labelKey === 'precheck_tv_status_label');
    // D_XPC+ steht in der FB- UND in der Verbund-PreCheck-Liste → beide lösen auf.
    expect(fb.felder.find(f => f.code === 'D_XPC+')?.feld).toBe('xpc_plus');
    expect(vb.felder.find(f => f.code === 'D_XPC+')?.feld).toBe('xpc_plus');
    // Die TV-Gruppe bleibt leer — sie kennt den Code nicht mehr.
    expect(tv?.felder ?? []).toEqual([]);
  });
});
