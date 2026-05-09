import { describe, it, expect } from 'vitest';
import type { AntragListItem } from '@/core/services/csv/types';
import {
  parseBearbeiterFilter,
  antragMatchesBearbeiter,
  applyBearbeiterFilter,
  hasAnyKuerzelData,
} from '../bearbeiterFilter';

function makeAntrag(extra: Record<string, unknown>): AntragListItem {
  return {
    aktenzeichen: '16KN0001',
    programm_id: 'p1',
    _updated_at: '2026-01-01',
    ...extra,
  } as AntragListItem;
}

describe('parseBearbeiterFilter', () => {
  it('treats empty / undefined as inactive', () => {
    expect(parseBearbeiterFilter(undefined, false).active).toBe(false);
    expect(parseBearbeiterFilter('', false).active).toBe(false);
    expect(parseBearbeiterFilter('   ', false).active).toBe(false);
  });

  it('treats "alle" (case-insensitive) as inactive', () => {
    expect(parseBearbeiterFilter('alle', false).active).toBe(false);
    expect(parseBearbeiterFilter('ALLE', false).active).toBe(false);
    expect(parseBearbeiterFilter('  Alle  ', true).active).toBe(false);
  });

  it('parses a single token, uppercased', () => {
    const m = parseBearbeiterFilter('mue', false);
    expect(m.active).toBe(true);
    expect(m.tokens).toEqual(['MUE']);
    expect(m.includeBegleitung).toBe(false);
  });

  it('parses comma-separated tokens, trimmed and uppercased', () => {
    const m = parseBearbeiterFilter(' mue, sch , ko ', true);
    expect(m.active).toBe(true);
    expect(m.tokens).toEqual(['MUE', 'SCH', 'KO']);
    expect(m.includeBegleitung).toBe(true);
  });

  it('drops empty tokens between commas', () => {
    const m = parseBearbeiterFilter('mue,,sch', false);
    expect(m.tokens).toEqual(['MUE', 'SCH']);
  });
});

describe('antragMatchesBearbeiter', () => {
  const mode = parseBearbeiterFilter('MUE, SCH', false);
  const modeWithBegleitung = parseBearbeiterFilter('MUE', true);

  it('passes everything when filter is inactive', () => {
    const inactive = parseBearbeiterFilter('alle', false);
    expect(antragMatchesBearbeiter(makeAntrag({}), inactive)).toBe(true);
    expect(antragMatchesBearbeiter(makeAntrag({ TiB_KUERZ: 'XYZ' }), inactive)).toBe(true);
  });

  it('matches on TiB_KUERZ', () => {
    expect(antragMatchesBearbeiter(makeAntrag({ TiB_KUERZ: 'MUE' }), mode)).toBe(true);
  });

  it('matches on BIB_KUERZ', () => {
    expect(antragMatchesBearbeiter(makeAntrag({ BIB_KUERZ: 'sch' }), mode)).toBe(true);
  });

  it('matches case-insensitively', () => {
    expect(antragMatchesBearbeiter(makeAntrag({ TiB_KUERZ: 'mue' }), mode)).toBe(true);
    expect(antragMatchesBearbeiter(makeAntrag({ BIB_KUERZ: 'Sch' }), mode)).toBe(true);
  });

  it('does NOT match Begleitung-Spalten by default', () => {
    expect(antragMatchesBearbeiter(makeAntrag({ ZTP_KUERZ: 'MUE' }), mode)).toBe(false);
    expect(antragMatchesBearbeiter(makeAntrag({ PFM_KUERZ: 'MUE' }), mode)).toBe(false);
  });

  it('matches Begleitung-Spalten when includeBegleitung is true', () => {
    expect(antragMatchesBearbeiter(makeAntrag({ ZTP_KUERZ: 'MUE' }), modeWithBegleitung)).toBe(true);
    expect(antragMatchesBearbeiter(makeAntrag({ PFM_KUERZ: 'MUE' }), modeWithBegleitung)).toBe(true);
  });

  it('does NOT match when no KUERZ column has the token', () => {
    expect(antragMatchesBearbeiter(makeAntrag({ TiB_KUERZ: 'XYZ' }), mode)).toBe(false);
  });

  it('does NOT match when antrag has no KUERZ columns at all', () => {
    expect(antragMatchesBearbeiter(makeAntrag({}), mode)).toBe(false);
  });

  it('ignores non-string KUERZ values', () => {
    expect(antragMatchesBearbeiter(makeAntrag({ TiB_KUERZ: 123 }), mode)).toBe(false);
    expect(antragMatchesBearbeiter(makeAntrag({ BIB_KUERZ: null }), mode)).toBe(false);
  });

  // Regression: CSV-Mapping mit `col.toLowerCase()`-Fallback erzeugt Antrag-
  // Properties wie `tib_kuerz` / `ztp_kuerz` (lowercase). Match muss
  // case-insensitive über den Property-Key laufen.
  it('matches lowercase property keys (CSV-Mapping-Fallback)', () => {
    const m = parseBearbeiterFilter('AM', true);
    expect(antragMatchesBearbeiter(makeAntrag({ ztp_kuerz: 'AM' }), m)).toBe(true);
    expect(antragMatchesBearbeiter(makeAntrag({ tib_kuerz: 'AM' }), m)).toBe(true);
    expect(antragMatchesBearbeiter(makeAntrag({ bib_kuerz: 'AM' }), m)).toBe(true);
    expect(antragMatchesBearbeiter(makeAntrag({ pfm_kuerz: 'AM' }), m)).toBe(true);
  });

  it('matches mixed-case property keys', () => {
    const m = parseBearbeiterFilter('AM', false);
    expect(antragMatchesBearbeiter(makeAntrag({ Tib_Kuerz: 'AM' }), m)).toBe(true);
    expect(antragMatchesBearbeiter(makeAntrag({ TIB_KUERZ: 'AM' }), m)).toBe(true);
  });

  it('does NOT match Begleitung lowercase when includeBegleitung=false', () => {
    const m = parseBearbeiterFilter('AM', false);
    expect(antragMatchesBearbeiter(makeAntrag({ ztp_kuerz: 'AM' }), m)).toBe(false);
    expect(antragMatchesBearbeiter(makeAntrag({ pfm_kuerz: 'AM' }), m)).toBe(false);
  });
});

describe('applyBearbeiterFilter', () => {
  const list: AntragListItem[] = [
    makeAntrag({ aktenzeichen: '1', TiB_KUERZ: 'MUE' }),
    makeAntrag({ aktenzeichen: '2', BIB_KUERZ: 'SCH' }),
    makeAntrag({ aktenzeichen: '3', ZTP_KUERZ: 'MUE' }),
    makeAntrag({ aktenzeichen: '4', TiB_KUERZ: 'XYZ' }),
    makeAntrag({ aktenzeichen: '5' }),
  ];

  it('returns all when filter is inactive', () => {
    const inactive = parseBearbeiterFilter('alle', false);
    expect(applyBearbeiterFilter(list, inactive)).toHaveLength(5);
  });

  it('keeps only Bearbeiter-matches by default', () => {
    const m = parseBearbeiterFilter('MUE', false);
    const result = applyBearbeiterFilter(list, m);
    expect(result.map(a => a.aktenzeichen)).toEqual(['1']);
  });

  it('keeps Bearbeiter + Begleitung when includeBegleitung', () => {
    const m = parseBearbeiterFilter('MUE', true);
    const result = applyBearbeiterFilter(list, m);
    expect(result.map(a => a.aktenzeichen).sort()).toEqual(['1', '3']);
  });

  it('matches multiple tokens (OR)', () => {
    const m = parseBearbeiterFilter('MUE, SCH', false);
    const result = applyBearbeiterFilter(list, m);
    expect(result.map(a => a.aktenzeichen).sort()).toEqual(['1', '2']);
  });
});

describe('hasAnyKuerzelData', () => {
  it('returns false when list is empty', () => {
    expect(hasAnyKuerzelData([], false)).toBe(false);
    expect(hasAnyKuerzelData([], true)).toBe(false);
  });

  it('returns false when no antrag has any KUERZ field', () => {
    const list = [makeAntrag({}), makeAntrag({ aktenzeichen: 'X', titel: 'Foo' })];
    expect(hasAnyKuerzelData(list, false)).toBe(false);
    expect(hasAnyKuerzelData(list, true)).toBe(false);
  });

  it('returns true when at least one antrag has TiB_KUERZ or BIB_KUERZ', () => {
    expect(hasAnyKuerzelData([makeAntrag({ TiB_KUERZ: 'MUE' })], false)).toBe(true);
    expect(hasAnyKuerzelData([makeAntrag({ BIB_KUERZ: 'SCH' })], false)).toBe(true);
  });

  it('ignores Begleitung when includeBegleitung=false', () => {
    expect(hasAnyKuerzelData([makeAntrag({ ZTP_KUERZ: 'MUE' })], false)).toBe(false);
    expect(hasAnyKuerzelData([makeAntrag({ PFM_KUERZ: 'MUE' })], false)).toBe(false);
  });

  it('includes Begleitung when includeBegleitung=true', () => {
    expect(hasAnyKuerzelData([makeAntrag({ ZTP_KUERZ: 'MUE' })], true)).toBe(true);
    expect(hasAnyKuerzelData([makeAntrag({ PFM_KUERZ: 'MUE' })], true)).toBe(true);
  });

  it('ignores empty / whitespace-only KUERZ values', () => {
    expect(hasAnyKuerzelData([makeAntrag({ TiB_KUERZ: '' })], false)).toBe(false);
    expect(hasAnyKuerzelData([makeAntrag({ TiB_KUERZ: '   ' })], false)).toBe(false);
  });

  it('ignores non-string values', () => {
    expect(hasAnyKuerzelData([makeAntrag({ TiB_KUERZ: 42 })], false)).toBe(false);
    expect(hasAnyKuerzelData([makeAntrag({ BIB_KUERZ: null })], false)).toBe(false);
  });

  // Regression: Property-Keys können je nach Column-Mapping uppercase
  // (`ZTP_KUERZ`), lowercase (`ztp_kuerz`) oder gemischt sein. Detection
  // muss alle Varianten finden.
  it('detects lowercase property keys', () => {
    expect(hasAnyKuerzelData([makeAntrag({ ztp_kuerz: 'AM' })], true)).toBe(true);
    expect(hasAnyKuerzelData([makeAntrag({ tib_kuerz: 'X' })], false)).toBe(true);
  });

  it('lowercase Begleitung ignored when includeBegleitung=false', () => {
    expect(hasAnyKuerzelData([makeAntrag({ ztp_kuerz: 'AM' })], false)).toBe(false);
    expect(hasAnyKuerzelData([makeAntrag({ pfm_kuerz: 'AM' })], false)).toBe(false);
  });

  it('detects mixed-case property keys', () => {
    expect(hasAnyKuerzelData([makeAntrag({ Tib_Kuerz: 'X' })], false)).toBe(true);
  });
});
