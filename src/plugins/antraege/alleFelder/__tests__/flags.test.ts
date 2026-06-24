import { describe, it, expect } from 'vitest';
import {
  normLabel,
  isFlagGroupPath,
  fieldType,
  isLooseFlagRow,
  flagValueIsYes,
  assembleFlagCluster,
} from '../flags';
import type { DisplayRow } from '../buildDisplayRows';
import type { CsvSchema } from '@/core/services/csv/types';

function row(p: Partial<DisplayRow> & { field: string }): DisplayRow {
  return {
    field: p.field,
    label: p.label ?? p.field,
    value: p.value ?? '',
    rawValue: p.rawValue ?? null,
    sourceSchemaId: p.sourceSchemaId,
    isCanonical: p.isCanonical ?? false,
  };
}

const booleanSchema: CsvSchema = {
  id: 's', programm_id: 'p', csv_source_name: 'x', is_master: true, join_key: 'aktenzeichen',
  priority: 1, column_mapping: { COL: { custom: 'boolflag', type: 'boolean' } }, created_at: '',
};

describe('normLabel', () => {
  it('lowercased, ohne Trenner/Sonderzeichen, Umlaute bleiben', () => {
    expect(normLabel('Technologie-Kennzeichen')).toBe('technologiekennzeichen');
    expect(normLabel('beantragte Kosten (Deckblatt)')).toBe('beantragtekostendeckblatt');
    expect(normLabel('Künstliche Intelligenz')).toBe('künstlicheintelligenz');
  });
});

describe('isFlagGroupPath', () => {
  it('erkennt Technologie-Kennzeichen / Zukunftstechnologien als Flag-Root', () => {
    expect(isFlagGroupPath(['Technologie-Kennzeichen', 'Zukunftstechnologien (TV-/VB-Ebene)'])).toBe(true);
    expect(isFlagGroupPath(['Zukunftstechnologien'])).toBe(true);
  });
  it('nicht-Flag-Gruppen + leerer Pfad sind false', () => {
    expect(isFlagGroupPath(['Finanzen'])).toBe(false);
    expect(isFlagGroupPath([])).toBe(false);
  });
});

describe('fieldType / isLooseFlagRow', () => {
  it('fieldType liest den Schema-Typ', () => {
    expect(fieldType('boolflag', [booleanSchema])).toBe('boolean');
    expect(fieldType('unbekannt', [booleanSchema])).toBeUndefined();
  });
  it('zt_-Präfix ODER boolean-Schema-Typ markiert eine Loose-Flag', () => {
    expect(isLooseFlagRow(row({ field: 'zt_ki_tv' }), [])).toBe(true);
    expect(isLooseFlagRow(row({ field: 'boolflag' }), [booleanSchema])).toBe(true);
    expect(isLooseFlagRow(row({ field: 'antragsteller' }), [booleanSchema])).toBe(false);
  });
});

describe('flagValueIsYes', () => {
  it('Y/J/ja/true/1/x sind „Ja"', () => {
    for (const v of ['Y', 'y', 'J', 'ja', 'true', '1', 'x', true, 1]) expect(flagValueIsYes(v)).toBe(true);
  });
  it('N/leer/false/null sind „Nein"', () => {
    for (const v of ['N', 'n', '', false, 0, null, undefined]) expect(flagValueIsYes(v)).toBe(false);
  });
  it('toleriert die Verbund-Merge-Schreibweise „Y / N" (ein TV reicht)', () => {
    expect(flagValueIsYes('Y / N')).toBe(true);
    expect(flagValueIsYes('N / N / N')).toBe(false);
    expect(flagValueIsYes('true / false')).toBe(true);
  });
});

describe('assembleFlagCluster', () => {
  it('merged TV-/VB-Varianten (Key-Basis) zu einem Deskriptor, isYes = ODER', () => {
    const sub = [
      { row: row({ field: 'zt_ki_tv', label: 'Zt Ki Tv', rawValue: 'N' }), subgroup: 'Zukunftstechnologien' },
      { row: row({ field: 'zt_ki_vb', label: 'Zt Ki Vb', rawValue: 'Y' }), subgroup: 'Zukunftstechnologien' },
      { row: row({ field: 'zt_cloud_tv', label: 'Zt Cloud Tv', rawValue: 'N' }), subgroup: 'Zukunftstechnologien' },
    ];
    const [g] = assembleFlagCluster(sub);
    expect(g!.name).toBe('Zukunftstechnologien');
    expect(g!.total).toBe(2); // ki (merged) + cloud
    expect(g!.yesCount).toBe(1); // ki = Y
    const ki = g!.descriptors.find(d => d.label === 'Ki');
    expect(ki?.isYes).toBe(true);
  });

  it('merged identische Labels auch ohne _tv/_vb-Suffix (echte Schemas)', () => {
    const out = assembleFlagCluster([
      { row: row({ field: 'kifoo', label: 'KI', rawValue: 'N' }), subgroup: 'Z' },
      { row: row({ field: 'kibar', label: 'KI', rawValue: 'Y' }), subgroup: 'Z' },
    ]);
    expect(out[0]!.total).toBe(1);
    expect(out[0]!.yesCount).toBe(1);
  });

  it('hält mehrere Unterbereiche in Eingabe-Reihenfolge getrennt', () => {
    const out = assembleFlagCluster([
      { row: row({ field: 'a_tv', label: 'A', rawValue: 'N' }), subgroup: 'Zukunftstechnologien' },
      { row: row({ field: 'b_tv', label: 'B', rawValue: 'N' }), subgroup: 'Handwerk / Start-Up' },
    ]);
    expect(out.map(s => s.name)).toEqual(['Zukunftstechnologien', 'Handwerk / Start-Up']);
  });
});
