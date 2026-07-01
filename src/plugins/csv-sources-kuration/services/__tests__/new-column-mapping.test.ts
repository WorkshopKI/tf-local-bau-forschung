/**
 * Tests für das additive Übernehmen neuer CSV-Spalten in ein bestehendes Schema.
 *
 * Kern-Garantie: das bestehende `column_mapping` (inkl. Label/Gruppen-Pfad) bleibt
 * unverändert; nur die neuen Keys kommen mit korrektem canonical/custom/ignore +
 * type dazu.
 */
import { describe, it, expect } from 'vitest';
import type { ColumnMapping, CsvSchema } from '@/core/services/csv/types';
import type { PerColumnDecision } from '../../wizard/useCsvWizardState';
import {
  buildNewColumnEntry,
  mergeNewColumns,
  adoptNewColumnsAsIgnoredMapping,
  rebuildMapping,
  decisionFromEntry,
} from '../new-column-mapping';
import { validateHeaders } from '../csv-drift-check';

const EXISTING: ColumnMapping = {
  AKZ: { canonical: 'aktenzeichen', type: 'string', trackHistory: false },
  STATUS: { canonical: 'status', type: 'string', trackHistory: true, label: 'Status' },
  FOERDER_2024: {
    custom: 'foerdersumme_2024',
    type: 'number',
    label: 'Fördersumme 2024',
    group_path: ['Finanzen', '2024'],
  },
  EXPORT_TS: { ignore: true },
};

describe('buildNewColumnEntry', () => {
  it('maps ignore mode', () => {
    expect(buildNewColumnEntry('FOO', { mode: 'ignore' })).toEqual({ ignore: true });
  });

  it('maps canonical mode with type + trackHistory defaults', () => {
    const d: PerColumnDecision = { mode: 'canonical', canonical: 'frist_datum', type: 'date' };
    expect(buildNewColumnEntry('FRIST', d)).toEqual({
      canonical: 'frist_datum',
      type: 'date',
      trackHistory: false,
    });
  });

  it('maps custom mode using the trimmed custom name', () => {
    const d: PerColumnDecision = { mode: 'custom', custom: '  mein_feld  ', type: 'string' };
    expect(buildNewColumnEntry('MEIN_FELD', d)).toEqual({
      custom: 'mein_feld',
      type: 'string',
      trackHistory: false,
    });
  });

  it('falls back to lowercased column name when custom name is empty', () => {
    const d: PerColumnDecision = { mode: 'custom', custom: '', type: 'string' };
    expect(buildNewColumnEntry('GKO_AZX_GK', d)).toEqual({
      custom: 'gko_azx_gk',
      type: 'string',
      trackHistory: false,
    });
  });

  it('treats canonical mode without a target as custom passthrough', () => {
    const d = { mode: 'canonical' } as PerColumnDecision;
    expect(buildNewColumnEntry('DDSID_10', d)).toEqual({
      custom: 'ddsid_10',
      type: 'string',
      trackHistory: false,
    });
  });

  it('does not emit label/group_path for new columns', () => {
    const entry = buildNewColumnEntry('NEU', { mode: 'custom', custom: 'neu', type: 'string' });
    expect(entry).not.toHaveProperty('label');
    expect(entry).not.toHaveProperty('group_path');
  });
});

describe('mergeNewColumns', () => {
  it('preserves every existing entry byte-for-byte', () => {
    const merged = mergeNewColumns(EXISTING, {
      DDSID_10: { mode: 'custom', custom: 'ddsid_10', type: 'string' },
    });
    for (const key of Object.keys(EXISTING)) {
      expect(merged[key]).toEqual(EXISTING[key]);
    }
    // Label/Gruppen-Pfad des bestehenden Custom-Feldes bleiben erhalten.
    expect(merged.FOERDER_2024?.group_path).toEqual(['Finanzen', '2024']);
    expect(merged.STATUS?.label).toBe('Status');
  });

  it('adds new keys with the resolved entry shape', () => {
    const merged = mergeNewColumns(EXISTING, {
      ZUW_MU_FST: { mode: 'custom', custom: 'zuw_mu_fst', type: 'number' },
      BEWILLIGT_AM: { mode: 'canonical', canonical: 'bewilligung_datum', type: 'date' },
      JUNK: { mode: 'ignore' },
    });
    expect(merged.ZUW_MU_FST).toEqual({ custom: 'zuw_mu_fst', type: 'number', trackHistory: false });
    expect(merged.BEWILLIGT_AM).toEqual({ canonical: 'bewilligung_datum', type: 'date', trackHistory: false });
    expect(merged.JUNK).toEqual({ ignore: true });
    // Spaltenzahl = alt + neu, keine verlorenen Keys.
    expect(Object.keys(merged)).toHaveLength(Object.keys(EXISTING).length + 3);
  });

  it('returns a fresh object (no mutation of the input mapping)', () => {
    const before = JSON.stringify(EXISTING);
    const merged = mergeNewColumns(EXISTING, { X: { mode: 'ignore' } });
    expect(merged).not.toBe(EXISTING);
    expect(JSON.stringify(EXISTING)).toBe(before);
  });
});

describe('adoptNewColumnsAsIgnoredMapping (headless Auto-Adopt im Auto-Refresh)', () => {
  it('übernimmt jede neue Spalte als { ignore: true }', () => {
    const merged = adoptNewColumnsAsIgnoredMapping(EXISTING, ['NEU_1', 'NEU_2']);
    expect(merged.NEU_1).toEqual({ ignore: true });
    expect(merged.NEU_2).toEqual({ ignore: true });
  });

  it('erhält bestehende Einträge byte-genau', () => {
    const merged = adoptNewColumnsAsIgnoredMapping(EXISTING, ['NEU']);
    for (const key of Object.keys(EXISTING)) {
      expect(merged[key]).toEqual(EXISTING[key]);
    }
  });

  it('mutiert das Eingabe-Mapping nicht (frisches Objekt)', () => {
    const before = JSON.stringify(EXISTING);
    const merged = adoptNewColumnsAsIgnoredMapping(EXISTING, ['NEU']);
    expect(merged).not.toBe(EXISTING);
    expect(JSON.stringify(EXISTING)).toBe(before);
  });

  it('ist idempotent: zweites Anwenden mit denselben Spalten ändert die Key-Menge nicht', () => {
    const once = adoptNewColumnsAsIgnoredMapping(EXISTING, ['NEU']);
    const twice = adoptNewColumnsAsIgnoredMapping(once, ['NEU']);
    expect(Object.keys(twice).sort()).toEqual(Object.keys(once).sort());
    expect(twice.NEU).toEqual({ ignore: true });
  });

  it('leeres newColumns → gleiches Mapping (frisches Objekt)', () => {
    const merged = adoptNewColumnsAsIgnoredMapping(EXISTING, []);
    expect(merged).toEqual(EXISTING);
    expect(merged).not.toBe(EXISTING);
  });

  it('Drift-Idempotenz: nach Adopt sind die Spalten keine newColumns mehr', () => {
    const headers = [...Object.keys(EXISTING), 'NEU_1', 'NEU_2'];
    const merged = adoptNewColumnsAsIgnoredMapping(EXISTING, ['NEU_1', 'NEU_2']);
    const schema: CsvSchema = {
      id: 'q-test',
      programm_id: 'p1',
      csv_source_name: 'Testquelle',
      is_master: true,
      join_key: 'aktenzeichen',
      priority: 1,
      column_mapping: merged,
      created_at: '2026-01-01T00:00:00.000Z',
    };
    const v = validateHeaders(schema, headers);
    expect(v.newColumns).toEqual([]);
    expect(v.missingFromCsv).toEqual([]);
  });
});

describe('rebuildMapping (Re-Mapping aller Spalten)', () => {
  it('stuft ein Custom-Feld auf ein Standardfeld hoch und erhält Label/Gruppen-Pfad', () => {
    // FOERDER_2024 war custom mit Label + group_path → wird auf canonical foerdersumme umgestellt.
    const next = rebuildMapping(EXISTING, {
      FOERDER_2024: { mode: 'canonical', canonical: 'foerdersumme', type: 'number' },
    });
    expect(next.FOERDER_2024).toEqual({
      canonical: 'foerdersumme',
      type: 'number',
      trackHistory: false,
      label: 'Fördersumme 2024',
      group_path: ['Finanzen', '2024'],
    });
  });

  it('überschreibt bestehende Einträge (anders als mergeNewColumns)', () => {
    const next = rebuildMapping(EXISTING, {
      EXPORT_TS: { mode: 'canonical', canonical: 'bewilligung_datum', type: 'date' },
    });
    expect(next.EXPORT_TS).toEqual({
      canonical: 'bewilligung_datum',
      type: 'date',
      trackHistory: false,
    });
  });

  it('erhält required beim Re-Mapping der Join-Key-Spalte', () => {
    const withRequired: ColumnMapping = {
      FKZ: { canonical: 'aktenzeichen', type: 'string', required: true },
    };
    const next = rebuildMapping(withRequired, {
      FKZ: { mode: 'canonical', canonical: 'aktenzeichen', type: 'string' },
    });
    expect(next.FKZ?.required).toBe(true);
  });

  it('lässt Bestands-Einträge ohne Decision (Orphans) unangetastet', () => {
    // Nur eine Spalte wird neu entschieden → die übrigen bleiben byte-genau.
    const next = rebuildMapping(EXISTING, {
      AKZ: { mode: 'canonical', canonical: 'aktenzeichen', type: 'string' },
    });
    expect(next.STATUS).toEqual(EXISTING.STATUS);
    expect(next.FOERDER_2024).toEqual(EXISTING.FOERDER_2024);
    expect(next.EXPORT_TS).toEqual(EXISTING.EXPORT_TS);
  });

  it('mappt neue Spalten ohne Bestand via buildNewColumnEntry', () => {
    const next = rebuildMapping(EXISTING, {
      D_AZ1_1: { mode: 'canonical', canonical: 'erstentscheidung', type: 'date' },
    });
    expect(next.D_AZ1_1).toEqual({ canonical: 'erstentscheidung', type: 'date', trackHistory: false });
  });

  it('mutiert das Eingabe-Mapping nicht', () => {
    const before = JSON.stringify(EXISTING);
    const next = rebuildMapping(EXISTING, { AKZ: { mode: 'ignore' } });
    expect(next).not.toBe(EXISTING);
    expect(JSON.stringify(EXISTING)).toBe(before);
  });
});

describe('decisionFromEntry (Mapping → Editor-Decision)', () => {
  it('roundtrip canonical', () => {
    expect(decisionFromEntry({ canonical: 'status', type: 'string', trackHistory: true })).toEqual({
      mode: 'canonical',
      canonical: 'status',
      type: 'string',
      trackHistory: true,
    });
  });

  it('roundtrip custom', () => {
    expect(decisionFromEntry({ custom: 'foo', type: 'number' })).toEqual({
      mode: 'custom',
      custom: 'foo',
      type: 'number',
      trackHistory: undefined,
    });
  });

  it('roundtrip ignore', () => {
    expect(decisionFromEntry({ ignore: true })).toEqual({ mode: 'ignore' });
  });
});
