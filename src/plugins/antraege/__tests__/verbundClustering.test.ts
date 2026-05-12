import { describe, it, expect } from 'vitest';
import { applyVerbundClustering } from '../verbundClustering';
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
    // Vor Clustering: K1 (V1) — L (single) — K2 (V1)
    const input = [
      mk('K1', 'V1'),
      mk('L'),
      mk('K2', 'V1'),
    ];
    // K2 wandert direkt unter K1 (innerhalb-Sort nach Aktenzeichen)
    expect(az(applyVerbundClustering(input))).toEqual(['K1', 'K2', 'L']);
  });

  it('Position eines Verbund-Clusters wird vom ersten Vorkommen bestimmt', () => {
    // Sortiert nach (fiktivem) Datum: 16KN131520 (249d KEDRA), 16KN131521 (246d KEDRA),
    // 16KN126727 (236d KOMPaSS), 16KN126728 (236d KOMPaSS), 16KN110646 (235d single),
    // 16KN126729 (235d KOMPaSS)
    const input = [
      mk('16KN131520', 'V-KEDRA'),
      mk('16KN131521', 'V-KEDRA'),
      mk('16KN126727', 'V-KOMPASS'),
      mk('16KN126728', 'V-KOMPASS'),
      mk('16KN110646'), // Einzeln
      mk('16KN126729', 'V-KOMPASS'),
    ];
    // KOMPaSS-Cluster bleibt an Position 3 (erstes Vorkommen), 126729 rückt hinzu
    expect(az(applyVerbundClustering(input))).toEqual([
      '16KN131520',
      '16KN131521',
      '16KN126727',
      '16KN126728',
      '16KN126729',
      '16KN110646',
    ]);
  });

  it('Innerhalb eines Clusters wird nach Aktenzeichen aufsteigend sortiert', () => {
    // Eingabe mit umgekehrter Aktenzeichen-Reihenfolge im Cluster
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

  it('Verbund mit nur einem TV verhält sich wie Einzelantrag', () => {
    const input = [
      mk('A'),
      mk('B', 'V-SOLO'),
      mk('C'),
    ];
    expect(az(applyVerbundClustering(input))).toEqual(['A', 'B', 'C']);
  });

  it('Leeres Array → leeres Array', () => {
    expect(applyVerbundClustering([])).toEqual([]);
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
