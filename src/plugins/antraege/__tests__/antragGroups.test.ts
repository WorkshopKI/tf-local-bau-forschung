import { describe, it, expect } from 'vitest';
import {
  applyVerbundClustering,
  buildAntragGroups,
  formatFkzRange,
  takeGroupsUntil,
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

function mkKn(aktenzeichen: string, vb_phase?: number, verbund_id?: string, akronym?: string): AntragListItem {
  return {
    aktenzeichen,
    programm_id: 'P',
    _updated_at: '2026-01-01T00:00:00Z',
    ...(vb_phase !== undefined ? { vb_phase } : {}),
    ...(verbund_id ? { verbund_id } : {}),
    ...(akronym !== undefined ? { akronym } : {}),
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

  it('mode=none → jeder TV eigene Solo-Gruppe (backward-compat zu flat:true)', () => {
    const input = [mk('K1', 'V1'), mk('K2', 'V1'), mk('A')];
    const groups = buildAntragGroups(input, { mode: 'none' });
    expect(groups).toHaveLength(3);
    expect(groups.map(g => g.tvs.map(t => t.aktenzeichen))).toEqual([['K1'], ['K2'], ['A']]);
    expect(groups.every(g => g.verbundId === null && g.netzwerkId === null)).toBe(true);
  });

  it('flat:true bleibt als Alias zu mode=none erhalten', () => {
    const input = [mk('K1', 'V1'), mk('K2', 'V1')];
    const a = buildAntragGroups(input, { flat: true });
    const b = buildAntragGroups(input, { mode: 'none' });
    expect(a.map(g => g.tvs.map(t => t.aktenzeichen)))
      .toEqual(b.map(g => g.tvs.map(t => t.aktenzeichen)));
  });
});

describe('buildAntragGroups — mode=netzwerk', () => {
  it('clustert 16KN-Anträge nach 4-Ziffer-Netzwerk-ID, Cluster-Position folgt erstem Vorkommen', () => {
    const input = [
      mkKn('16KN106201', 1),
      mkKn('16KN106227', 2),
      mkKn('16EP123456'),
      mkKn('16KN106202', 2),
      mkKn('16KN999901', 1),
    ];
    const groups = buildAntragGroups(input, { mode: 'netzwerk' });
    // Reihenfolge: NW1062 (an Position des ersten 16KN1062-Antrags) → 16EP solo → NW9999.
    // Default-Mode 'netzwerk' sortiert NICHT nach Größe.
    expect(groups).toHaveLength(3);
    expect(groups[0]!.netzwerkId).toBe('1062');
    expect(groups[0]!.tvs.map(t => t.aktenzeichen))
      .toEqual(['16KN106201', '16KN106202', '16KN106227']);
    expect(groups[1]!.netzwerkId).toBeNull();
    expect(groups[1]!.tvs.map(t => t.aktenzeichen)).toEqual(['16EP123456']);
    expect(groups[2]!.netzwerkId).toBe('9999');
    expect(groups[2]!.tvs.map(t => t.aktenzeichen)).toEqual(['16KN999901']);
  });

  it('mode=netzwerk lässt kleines Netzwerk an erster Position, wenn es zuerst auftrat (kein Größen-Sort)', () => {
    const input = [
      // Kleines Netzwerk 9999 zuerst (1 Mitglied)
      mkKn('16KN999901', 1),
      // Großes Netzwerk 1062 danach (3 Mitglieder)
      mkKn('16KN106201', 1),
      mkKn('16KN106202', 2),
      mkKn('16KN106227', 2),
    ];
    const groups = buildAntragGroups(input, { mode: 'netzwerk' });
    expect(groups.map(g => g.netzwerkId)).toEqual(['9999', '1062']);
  });

  it('mode=netzwerk-by-size sortiert Netzwerke nach Mitglieder-Zahl desc, Solos ans Ende', () => {
    const input = [
      mkKn('16KN106201', 1),
      mkKn('16KN106227', 2),
      mkKn('16EP123456'),
      mkKn('16KN106202', 2),
      mkKn('16KN999901', 1),
    ];
    const groups = buildAntragGroups(input, { mode: 'netzwerk-by-size' });
    expect(groups).toHaveLength(3);
    expect(groups[0]!.netzwerkId).toBe('1062');
    expect(groups[1]!.netzwerkId).toBe('9999');
    expect(groups[2]!.netzwerkId).toBeNull();
    expect(groups[2]!.tvs.map(t => t.aktenzeichen)).toEqual(['16EP123456']);
  });

  it('mode=netzwerk-by-size: Tie-Break nach Netzwerk-ID asc bei gleich großen Netzwerken', () => {
    const input = [
      // Netzwerk 5555: 2 Mitglieder
      mkKn('16KN555527', 2),
      mkKn('16KN555528', 2),
      // Netzwerk 1111: 4 Mitglieder → ganz oben
      mkKn('16KN111127', 2),
      mkKn('16KN111128', 2),
      mkKn('16KN111129', 2),
      mkKn('16KN111130', 2),
      // Netzwerk 2222: 2 Mitglieder → Tie mit 5555, Tie-Break nach Netzwerk-ID → vor 5555
      mkKn('16KN222227', 2),
      mkKn('16KN222228', 2),
    ];
    const groups = buildAntragGroups(input, { mode: 'netzwerk-by-size' });
    expect(groups.map(g => g.netzwerkId)).toEqual(['1111', '2222', '5555']);
    expect(groups.map(g => g.tvs.length)).toEqual([4, 2, 2]);
  });

  it('netzwerkLabel reflektiert beide Phasen wenn Lead-P1 + Lead-P2 vertreten', () => {
    const input = [
      mkKn('16KN106201', 1),
      mkKn('16KN106202', 2),
      mkKn('16KN106227', 2),
    ];
    const groups = buildAntragGroups(input, { mode: 'netzwerk' });
    expect(groups[0]!.netzwerkLabel).toBe('Netzwerk 1062 · Phase 1 + 2');
  });

  it('netzwerkLabel zeigt nur eine Phase wenn nur eine vertreten', () => {
    const input = [mkKn('16KN106201', 1), mkKn('16KN106203', 1)];
    const groups = buildAntragGroups(input, { mode: 'netzwerk' });
    expect(groups[0]!.netzwerkLabel).toBe('Netzwerk 1062 · Phase 1');
  });

  it('nicht-16KN-Anträge bleiben Solo (verbundId/netzwerkId null)', () => {
    const input = [mkKn('16EP100000'), mkKn('16DS200000'), mkKn('16DL300000')];
    const groups = buildAntragGroups(input, { mode: 'netzwerk' });
    expect(groups).toHaveLength(3);
    expect(groups.every(g => g.verbundId === null && g.netzwerkId === null)).toBe(true);
  });

  it('fkzRange auch im Netzwerk-Modus korrekt', () => {
    const input = [
      mkKn('16KN106227', 2),
      mkKn('16KN106201', 1),
      mkKn('16KN106203', 2),
    ];
    const groups = buildAntragGroups(input, { mode: 'netzwerk' });
    expect(groups[0]!.fkzRange).toBe('16KN106201–16KN106227');
  });

  it('Netzwerk-Supergruppe enthält subGroups (Verbund + Einzelantrag)', () => {
    const input = [
      mkKn('16KN106201', 1, 'V-LEAD'),    // Lead-Phase-1, im Verbund V-LEAD
      mkKn('16KN106203', 2, 'V-LEAD'),    // Schwester im Verbund V-LEAD
      mkKn('16KN106205', 2, 'V-OTHER'),   // anderer Verbund
      mkKn('16KN106207', 2, 'V-OTHER'),
      mkKn('16KN106209', 2),              // Einzelantrag
    ];
    const groups = buildAntragGroups(input, { mode: 'netzwerk' });
    expect(groups).toHaveLength(1);
    const supergroup = groups[0]!;
    expect(supergroup.netzwerkId).toBe('1062');
    expect(supergroup.subGroups).toBeDefined();
    expect(supergroup.subGroups).toHaveLength(3);
    // Reihenfolge: Lead-Verbund zuerst, dann V-OTHER (alphabetisch),
    // dann Einzelantrag (auch alphabetisch).
    const sg = supergroup.subGroups!;
    expect(sg[0]!.verbundId).toBe('V-LEAD');
    expect(sg[0]!.tvs.map(t => t.aktenzeichen)).toEqual(['16KN106201', '16KN106203']);
    expect(sg[1]!.verbundId).toBe('V-OTHER');
    expect(sg[1]!.tvs.map(t => t.aktenzeichen)).toEqual(['16KN106205', '16KN106207']);
    expect(sg[2]!.verbundId).toBeNull();
    expect(sg[2]!.tvs.map(t => t.aktenzeichen)).toEqual(['16KN106209']);
  });

  it('Netzwerk-Supergruppe: flat tvs entspricht subGroups.flatMap(tvs)', () => {
    const input = [
      mkKn('16KN106201', 1, 'V-A'),
      mkKn('16KN106203', 2, 'V-A'),
      mkKn('16KN106205', 2),
    ];
    const groups = buildAntragGroups(input, { mode: 'netzwerk' });
    const supergroup = groups[0]!;
    expect(supergroup.tvs).toEqual(supergroup.subGroups!.flatMap(g => g.tvs));
  });

  it('Solo-Anträge ohne 16KN-Präfix haben subGroups undefined', () => {
    const groups = buildAntragGroups([mkKn('16EP100000')], { mode: 'netzwerk' });
    expect(groups[0]!.subGroups).toBeUndefined();
    expect(groups[0]!.netzwerkId).toBeNull();
  });

  it('netzwerkLabel nutzt VB_KURZNAM-Akronym des Phase-1-Leads', () => {
    const input = [
      mkKn('16KN106203', 2, undefined, 'PartnerA'),
      mkKn('16KN106201', 1, undefined, 'INNOWERK'),  // Lead Phase 1
      mkKn('16KN106202', 2, undefined, 'INNOWERK-II'),  // Lead Phase 2 (sollte ignoriert werden)
    ];
    const groups = buildAntragGroups(input, { mode: 'netzwerk' });
    expect(groups[0]!.netzwerkLabel).toBe('INNOWERK · Phase 1 + 2');
  });

  it('netzwerkLabel fällt auf "Netzwerk <id>" zurück wenn kein Lead im Snapshot', () => {
    const input = [
      mkKn('16KN106227', 2, undefined, 'PartnerA'),
      mkKn('16KN106229', 2, undefined, 'PartnerB'),
    ];
    const groups = buildAntragGroups(input, { mode: 'netzwerk' });
    expect(groups[0]!.netzwerkLabel).toBe('Netzwerk 1062 · Phase 2');
  });

  it('netzwerkLabel kommt aus Cross-Programm-Index, auch wenn kein Lead im Snapshot ist', () => {
    const input = [
      mkKn('16KN106227', 2, undefined, 'PartnerA'),
      mkKn('16KN106229', 2, undefined, 'PartnerB'),
    ];
    const netzwerkNames = new Map([['1062', 'INNOWERK']]);
    const groups = buildAntragGroups(input, { mode: 'netzwerk', netzwerkNames });
    expect(groups[0]!.netzwerkLabel).toBe('INNOWERK · Phase 2');
  });

  it('Index-Wert hat Vorrang vor Lead-Akronym im Snapshot', () => {
    const input = [
      mkKn('16KN106201', 1, undefined, 'LokalAusSnapshot'),
    ];
    const netzwerkNames = new Map([['1062', 'AusIndex']]);
    const groups = buildAntragGroups(input, { mode: 'netzwerk', netzwerkNames });
    expect(groups[0]!.netzwerkLabel).toBe('AusIndex · Phase 1');
  });

  it('Sub-Gruppen-Sortierung: Sub-Gruppe mit Lead zuerst, sonst nach erstem-Aktenzeichen', () => {
    const input = [
      mkKn('16KN106207', 2, 'V-LATE'),    // späteres FKZ, kein Lead
      mkKn('16KN106203', 2, 'V-EARLY'),   // früheres FKZ, kein Lead
      mkKn('16KN106205', 2, 'V-EARLY'),
      mkKn('16KN106201', 1, 'V-LEAD'),    // Lead-Verbund (Suffix 01 + vb_phase 1)
      mkKn('16KN106209', 2, 'V-LEAD'),
    ];
    const groups = buildAntragGroups(input, { mode: 'netzwerk' });
    const sg = groups[0]!.subGroups!;
    expect(sg[0]!.verbundId).toBe('V-LEAD');
    // V-EARLY vor V-LATE (16KN106203 < 16KN106207)
    expect(sg[1]!.verbundId).toBe('V-EARLY');
    expect(sg[2]!.verbundId).toBe('V-LATE');
  });
});

describe('takeGroupsUntil', () => {
  function build(tvCounts: number[]): import('../antragGroups').AntragGroup[] {
    let counter = 0;
    return tvCounts.map(n => ({
      verbundId: null,
      netzwerkId: null,
      netzwerkLabel: null,
      tvs: Array.from({ length: n }, () => mk(`AZ${++counter}`)),
      fkzRange: '',
    }));
  }

  it('leere Eingabe → leeres Ergebnis', () => {
    expect(takeGroupsUntil([], 60)).toEqual([]);
  });

  it('targetVisibleTvs ≤ 0 → leeres Ergebnis', () => {
    expect(takeGroupsUntil(build([2, 3]), 0)).toEqual([]);
    expect(takeGroupsUntil(build([2, 3]), -1)).toEqual([]);
  });

  it('Boundary-Gruppe wird vollständig mitgenommen (Overshoot akzeptiert)', () => {
    const all = build([20, 50, 10]); // Total 80 TVs
    const taken = takeGroupsUntil(all, 30);
    expect(taken.map(g => g.tvs.length)).toEqual([20, 50]); // 70 TVs > 30, aber zweite Gruppe komplett
  });

  it('exakte Treffer-Grenze: stoppt bei genau erreichter TV-Zahl', () => {
    const all = build([30, 20, 10]);
    expect(takeGroupsUntil(all, 30).map(g => g.tvs.length)).toEqual([30]);
  });

  it('targetVisibleTvs grösser als Total → alle Gruppen', () => {
    const all = build([5, 5, 5]);
    expect(takeGroupsUntil(all, 1000)).toEqual(all);
  });

  it('erste Gruppe alleine groesser als target → wird trotzdem mitgenommen', () => {
    const all = build([200, 10]);
    expect(takeGroupsUntil(all, 60).map(g => g.tvs.length)).toEqual([200]);
  });
});
