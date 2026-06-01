/**
 * Tests für das additive Übernehmen neuer CSV-Spalten in ein bestehendes Schema.
 *
 * Kern-Garantie: das bestehende `column_mapping` (inkl. Label/Gruppen-Pfad) bleibt
 * unverändert; nur die neuen Keys kommen mit korrektem canonical/custom/ignore +
 * type dazu.
 */
import { describe, it, expect } from 'vitest';
import type { ColumnMapping } from '@/core/services/csv/types';
import type { PerColumnDecision } from '../../wizard/useCsvWizardState';
import { buildNewColumnEntry, mergeNewColumns } from '../new-column-mapping';

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
