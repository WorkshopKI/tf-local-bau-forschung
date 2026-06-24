import { describe, it, expect } from 'vitest';
import {
  normLabel,
  isFlagGroupPath,
  isBoolishGroup,
  isFlagGroup,
  flagBucket,
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
  it('matcht echte Schemas mit Ebenen-Suffix (includes, nicht exakt)', () => {
    expect(isFlagGroupPath(['Zukunftstechnologien (TV-Ebene)', 'Digitale Wirtschaft'])).toBe(true);
    expect(isFlagGroupPath(['Technologie-Kennzeichen (VB-Ebene)'])).toBe(true);
  });
});

describe('isBoolishGroup / isFlagGroup (inhaltsbasiert)', () => {
  it('erkennt eine Gruppe mit reinen Y/N-Werten als Flags — auch ohne Flag-Label/-Typ', () => {
    const rows = [
      row({ field: 'a', rawValue: 'N' }),
      row({ field: 'b', rawValue: 'Y' }),
      row({ field: 'c', rawValue: 'N / N' }),
    ];
    expect(isBoolishGroup(rows)).toBe(true);
    expect(isFlagGroup({ path: ['Handwerk / Start-Up'], label: 'Handwerk / Start-Up', rows })).toBe(true);
  });
  it('lässt normale Gruppen (Text/Zahlen/Daten) in Ruhe', () => {
    const rows = [row({ field: 'akronym', rawValue: 'OptiTool' }), row({ field: 'kosten', rawValue: '280000' })];
    expect(isBoolishGroup(rows)).toBe(false);
    expect(isFlagGroup({ path: ['Finanzen'], label: 'Finanzen', rows })).toBe(false);
  });
  it('ein einzelnes Y/N-Feld wird gefaltet (Schwelle ≥1)', () => {
    expect(isBoolishGroup([row({ field: 'x', rawValue: 'N' })])).toBe(true);
  });
  it('Finanz-Nullen (Zahlen/„0") sind NICHT boolish', () => {
    expect(isBoolishGroup([row({ field: 'a', rawValue: '0' }), row({ field: 'b', rawValue: '0' })])).toBe(false);
    expect(isBoolishGroup([row({ field: 'a', rawValue: 'N' }), row({ field: 'b', rawValue: '0' })])).toBe(false);
  });
});

describe('flagBucket (kuratierte 4-Bucket-Taxonomie)', () => {
  it('mappt jede Flag-Familie in ihren Mockup-Bucket', () => {
    expect(flagBucket({ path: ['Zukunftstechnologien (TV-Ebene)', 'Digitale Wirtschaft'], label: 'KI' })).toBe('Zukunftstechnologien (TV-/VB-Ebene)');
    expect(flagBucket({ path: ['Handwerk / Start-Up'], label: 'Handwerk / Installation (nur FuE)' })).toBe('Handwerk / Start-Up');
    expect(flagBucket({ path: ['Deskriptorenformular ÖA für FuE (TV-Ebene)'], label: 'Ausgewählt vom PT' })).toBe('Deskriptorenformular ÖA für FuE');
    expect(flagBucket({ path: ['Öffentlichkeitswirkung'], label: 'Projektinhalt mit sehr guter Öffentlichkeitswirkung (FuE)' })).toBe('Sonstige Kennzeichen');
    expect(flagBucket({ path: ['Referent'], label: 'besonders repräsentativer Geschäftsführer/Netzwerkmanager (NW)' })).toBe('Sonstige Kennzeichen');
  });
  it('faltet die Stray-Gruppen per GRUPPEN-Label (nicht Deskriptor-Text) in „Sonstige Kennzeichen"', () => {
    // flagBucket sieht nur group_path + group.label — am echten Bestand heißt die
    // Gruppe „Referent › Referent" (Deskriptor-Text mit Geschäftsführer/… steckt in den Rows).
    expect(flagBucket({ path: ['Referent', 'Referent'], label: 'Referent › Referent' })).toBe('Sonstige Kennzeichen');
    expect(flagBucket({ path: ['Sonstige Kennzeichen'], label: 'Sonstige Kennzeichen' })).toBe('Sonstige Kennzeichen');
  });
  it('fällt auf den bereinigten Top-Level-group_path zurück, wenn kein Keyword greift', () => {
    expect(flagBucket({ path: ['Spezialkennzeichen TV-Ebene'], label: 'x' })).toBe('Spezialkennzeichen');
    expect(flagBucket({ path: [], label: 'y' })).toBe('Sonstige Kennzeichen');
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

  it('sortiert Unterbereiche in kanonischer Bucket-Reihenfolge', () => {
    const out = assembleFlagCluster([
      { row: row({ field: 'b_tv', label: 'B', rawValue: 'N' }), subgroup: 'Handwerk / Start-Up' },
      { row: row({ field: 's_vb', label: 'S', rawValue: 'N' }), subgroup: 'Sonstige Kennzeichen' },
      { row: row({ field: 'a_tv', label: 'A', rawValue: 'N' }), subgroup: 'Zukunftstechnologien (TV-/VB-Ebene)' },
    ]);
    expect(out.map(s => s.name)).toEqual([
      'Zukunftstechnologien (TV-/VB-Ebene)', 'Handwerk / Start-Up', 'Sonstige Kennzeichen',
    ]);
  });

  it('reinigt „TV-Ebene"/„VB-Ebene" aus Deskriptor-Labels (echte Schemas)', () => {
    const out = assembleFlagCluster([
      { row: row({ field: 'add_tv', label: 'Additive Fertigung / 3D-Druck TV-Ebene', rawValue: 'N' }), subgroup: 'Zukunftstechnologien (TV-/VB-Ebene)' },
      { row: row({ field: 'add_vb', label: 'Additive Fertigung / 3D-Druck VB-Ebene', rawValue: 'N' }), subgroup: 'Zukunftstechnologien (TV-/VB-Ebene)' },
    ]);
    expect(out[0]!.total).toBe(1); // TV+VB über das gereinigte Label gemerged
    expect(out[0]!.descriptors[0]!.label).toBe('Additive Fertigung / 3D-Druck');
  });
});
