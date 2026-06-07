/**
 * Tests fuer den Schema-basierten Resolver der Vollstaendigkeits-Felder.
 * Kernfall: D_XTEC/D_ADV koennen als Standard- ODER als Eigenes Feld gemappt
 * sein — der Resolver findet das tatsaechliche Antrag-Feld ueber den Spalten-CODE.
 */
import { describe, it, expect } from 'vitest';
import type { CsvSchema } from '@/core/services/csv/types';
import { resolveVollstaendigkeitsFelder } from '../services/vollstaendigkeit-felder';

function schema(over: Partial<CsvSchema> & { column_mapping: CsvSchema['column_mapping'] }): CsvSchema {
  return {
    id: 's1',
    programm_id: 'p1',
    csv_source_name: 'Test',
    is_master: false,
    join_key: 'aktenzeichen',
    priority: 0,
    ...over,
  } as CsvSchema;
}

describe('resolveVollstaendigkeitsFelder', () => {
  it('löst D_XTEC/D_ADV als Eigenes Feld auf (Custom-Key) — der gemeldete Real-Fall', () => {
    const s = schema({ is_master: true, column_mapping: {
      D_XTEC: { custom: 'alle_antrage_in_c16_eingegeben', type: 'date' },
      D_ADV: { custom: 'antrag_in_c16_eingestellt', type: 'date' },
    } });
    expect(resolveVollstaendigkeitsFelder([s])).toEqual({
      xtecFeld: 'alle_antrage_in_c16_eingegeben',
      advFeld: 'antrag_in_c16_eingestellt',
      erwarteteTvsFeld: 'anz_erw_tv',
      xtecGefunden: true,
      advGefunden: true,
      erwarteteTvsGefunden: false,
    });
  });

  it('löst Standardfeld-Mapping auf (canonical d_xtec/d_adv)', () => {
    const s = schema({ is_master: true, column_mapping: {
      D_XTEC: { canonical: 'd_xtec', type: 'date' },
      D_ADV: { canonical: 'd_adv', type: 'date' },
    } });
    expect(resolveVollstaendigkeitsFelder([s])).toEqual({
      xtecFeld: 'd_xtec', advFeld: 'd_adv', erwarteteTvsFeld: 'anz_erw_tv',
      xtecGefunden: true, advGefunden: true, erwarteteTvsGefunden: false,
    });
  });

  it('Fallback auf d_xtec/d_adv (+ *Gefunden=false), wenn keine D_XTEC/D_ADV-Spalte existiert', () => {
    const s = schema({ is_master: true, column_mapping: {
      D_AAE: { canonical: 'antragsdatum', type: 'date' },
    } });
    expect(resolveVollstaendigkeitsFelder([s])).toEqual({
      xtecFeld: 'd_xtec', advFeld: 'd_adv', erwarteteTvsFeld: 'anz_erw_tv',
      xtecGefunden: false, advGefunden: false, erwarteteTvsGefunden: false,
    });
  });

  it('löst T_XAT (erwartete TV-Anzahl) als Eigenes Feld auf; T_XAT+ matcht NICHT', () => {
    const s = schema({ is_master: true, column_mapping: {
      D_XTEC: { custom: 'alle_antrage_in_c16_eingegeben', type: 'date' },
      D_ADV: { custom: 'antrag_in_c16_eingestellt', type: 'date' },
      T_XAT: { custom: 'anz_erw_tv', type: 'number' },
      'T_XAT+': { custom: 'anz_erw_tv_inkl_assoz', type: 'number' },
    } });
    const r = resolveVollstaendigkeitsFelder([s]);
    expect(r.erwarteteTvsFeld).toBe('anz_erw_tv');
    expect(r.erwarteteTvsGefunden).toBe(true);
  });

  it('nur T_XAT+ vorhanden → kein T_XAT-Treffer (Fallback, nicht gefunden)', () => {
    const s = schema({ is_master: true, column_mapping: {
      'T_XAT+': { custom: 'anz_erw_tv_inkl_assoz', type: 'number' },
    } });
    const r = resolveVollstaendigkeitsFelder([s]);
    expect(r.erwarteteTvsFeld).toBe('anz_erw_tv');
    expect(r.erwarteteTvsGefunden).toBe(false);
  });

  it('ignore=true wird übersprungen → Fallback + nicht gefunden', () => {
    const s = schema({ is_master: true, column_mapping: {
      D_XTEC: { custom: 'x', ignore: true, type: 'date' },
    } });
    const r = resolveVollstaendigkeitsFelder([s]);
    expect(r.xtecFeld).toBe('d_xtec');
    expect(r.xtecGefunden).toBe(false);
  });

  it('Master-Schema gewinnt vor Secondary', () => {
    const sec = schema({ id: 'sec', is_master: false, column_mapping: {
      D_XTEC: { custom: 'sekundaer_feld', type: 'date' },
    } });
    const master = schema({ id: 'm', is_master: true, column_mapping: {
      D_XTEC: { canonical: 'd_xtec', type: 'date' },
    } });
    expect(resolveVollstaendigkeitsFelder([sec, master]).xtecFeld).toBe('d_xtec');
  });

  it('Spalten-Code-Match ist case-insensitiv + ignoriert Trennzeichen', () => {
    const s = schema({ is_master: true, column_mapping: {
      'd-xtec': { custom: 'foo', type: 'date' },
    } });
    expect(resolveVollstaendigkeitsFelder([s]).xtecFeld).toBe('foo');
  });

  it('leeres Schema-Array → kanonische Defaults + nicht gefunden', () => {
    expect(resolveVollstaendigkeitsFelder([])).toEqual({
      xtecFeld: 'd_xtec', advFeld: 'd_adv', erwarteteTvsFeld: 'anz_erw_tv',
      xtecGefunden: false, advGefunden: false, erwarteteTvsGefunden: false,
    });
  });
});
