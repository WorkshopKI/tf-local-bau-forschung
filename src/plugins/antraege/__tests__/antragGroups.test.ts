import { describe, it, expect } from 'vitest';
import {
  applyVerbundClustering,
  buildAntragGroups,
  formatFkzRange,
} from '../antragGroups';
import type { AntragListItem } from '@/core/services/csv/types';

function mk(aktenzeichen: string, verbund_id?: string): AntragListItem {
  return {
    aktenzeichen,
    programm_id: 'P',
    _updated_at: '2026-01-01T00:00:00Z',
    ...(verbund_id ? { verbund_id } : {}),
  };
}

const az = (items: AntragListItem[]): string[] => items.map(i => i.aktenzeichen);

describe('applyVerbundClustering', () => {
  it('Einzelanträge bleiben in der Eingangs-Reihenfolge', () => {
    const input = [mk('A'), mk('B'), mk('C')];
    expect(az(applyVerbundClustering(input))).toEqual(['A', 'B', 'C']);
  });

  it('TVs gleichen Verbunds werden zur Position des ersten TVs zusammengezogen', () => {
    const input = [
      mk('K1', 'V1'),
      mk('L'),
      mk('K2', 'V1'),
    ];
    expect(az(applyVerbundClustering(input))).toEqual(['K1', 'K2', 'L']);
  });

  it('Innerhalb eines Clusters wird nach Aktenzeichen aufsteigend sortiert', () => {
    const input = [
      mk('Z9', 'V'),
      mk('Z2', 'V'),
      mk('Z5', 'V'),
    ];
    expect(az(applyVerbundClustering(input))).toEqual(['Z2', 'Z5', 'Z9']);
  });

  it('Leerer verbund_id-String zählt als Einzelantrag', () => {
    const input = [
      mk('A'),
      { ...mk('B'), verbund_id: '' },
      mk('C', 'V'),
      mk('D'),
    ];
    expect(az(applyVerbundClustering(input))).toEqual(['A', 'B', 'C', 'D']);
  });

  it('Verschiedene Verbünde behalten ihre relative Reihenfolge', () => {
    const input = [
      mk('A1', 'V1'),
      mk('B1', 'V2'),
      mk('A2', 'V1'),
      mk('B2', 'V2'),
    ];
    expect(az(applyVerbundClustering(input))).toEqual(['A1', 'A2', 'B1', 'B2']);
  });
});

describe('formatFkzRange', () => {
  it('einzelnes Aktenzeichen → kein Dash', () => {
    expect(formatFkzRange([mk('16EP250140')])).toBe('16EP250140');
  });

  it('zwei Aktenzeichen → min–max mit En-Dash', () => {
    expect(formatFkzRange([mk('16KN110645'), mk('16KN110646')])).toBe('16KN110645–16KN110646');
  });

  it('unsortierte Eingabe → trotzdem min/max korrekt', () => {
    expect(formatFkzRange([mk('16KN126729'), mk('16KN126727'), mk('16KN126728')]))
      .toBe('16KN126727–16KN126729');
  });

  it('leere Eingabe → leerer String', () => {
    expect(formatFkzRange([])).toBe('');
  });
});

describe('buildAntragGroups', () => {
  it('Einzelantrag → 1 Gruppe mit 1 TV, verbundId=null', () => {
    const input = [mk('A')];
    const groups = buildAntragGroups(input);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.verbundId).toBeNull();
    expect(groups[0]!.tvs.map(t => t.aktenzeichen)).toEqual(['A']);
    expect(groups[0]!.fkzRange).toBe('A');
  });

  it('Verbund mit 3 TVs → 1 Gruppe, sortiert nach Aktenzeichen, FKZ-Range gesetzt', () => {
    const input = [
      mk('K3', 'V'),
      mk('K1', 'V'),
      mk('K2', 'V'),
    ];
    const groups = buildAntragGroups(input);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.verbundId).toBe('V');
    expect(groups[0]!.tvs.map(t => t.aktenzeichen)).toEqual(['K1', 'K2', 'K3']);
    expect(groups[0]!.fkzRange).toBe('K1–K3');
  });

  it('Solo-Verbund (1 TV mit verbund_id) → Gruppe mit verbundId gesetzt, keine Range', () => {
    const input = [mk('B', 'V-SOLO')];
    const groups = buildAntragGroups(input);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.verbundId).toBe('V-SOLO');
    expect(groups[0]!.fkzRange).toBe('B');
  });

  it('Mix aus Verbund + Einzelantraegen — Cluster-Position vom ersten Vorkommen', () => {
    const input = [
      mk('A'),
      mk('B', 'V1'),
      mk('C'),
      mk('D', 'V1'),
      mk('E', 'V2'),
    ];
    const groups = buildAntragGroups(input);
    expect(groups).toHaveLength(4);
    // Reihenfolge: A (single), V1-cluster (B,D), C (single), V2 (E)
    expect(groups[0]!.verbundId).toBeNull();
    expect(groups[0]!.tvs.map(t => t.aktenzeichen)).toEqual(['A']);
    expect(groups[1]!.verbundId).toBe('V1');
    expect(groups[1]!.tvs.map(t => t.aktenzeichen)).toEqual(['B', 'D']);
    expect(groups[1]!.fkzRange).toBe('B–D');
    expect(groups[2]!.verbundId).toBeNull();
    expect(groups[2]!.tvs.map(t => t.aktenzeichen)).toEqual(['C']);
    expect(groups[3]!.verbundId).toBe('V2');
    expect(groups[3]!.tvs.map(t => t.aktenzeichen)).toEqual(['E']);
  });

  it('Leerer verbund_id-String zählt als Einzelantrag', () => {
    const input = [
      { ...mk('X'), verbund_id: '' },
    ];
    const groups = buildAntragGroups(input);
    expect(groups[0]!.verbundId).toBeNull();
  });

  it('Leere Eingabe → leeres Gruppen-Array', () => {
    expect(buildAntragGroups([])).toEqual([]);
  });
});
