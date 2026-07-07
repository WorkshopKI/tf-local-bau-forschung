/**
 * Kompakt-Listenmodus (Journey-Paket 2 Phase 8) — reine Logik.
 *
 * Ohne DOM: Label-Ableitung, clientseitiger Sicht-Filter, Zeilen-VM. `nowMs`
 * wird für die Frist explizit injiziert (deterministisch, wie im
 * `fristAnzeige`-Test).
 */
import { describe, it, expect } from 'vitest';
import type { AntragListItem } from '@/core/services/csv/types';
import { MS_PER_DAY } from '@/core/services/csv/frist';
import {
  kompaktLabel,
  matchesKompaktFilter,
  filterKompaktItems,
  buildKompaktRow,
  buildKompaktGroups,
  filterKompaktGroups,
  type KompaktItem,
} from '../kompaktRows';

const ANTRAGSDATUM = '2026-01-01T00:00:00.000Z';
const ANTRAGSDATUM_MS = new Date(ANTRAGSDATUM).getTime();
/** `now`, so dass die 90-Tage-Antragsfrist noch `restTage` entfernt ist. */
function nowFor(restTage: number): number {
  return ANTRAGSDATUM_MS + (90 - restTage) * MS_PER_DAY;
}

// Lockeres `extra` (roher String für `status`) wie im fristAnzeige-Test — der
// gebrandete `AntragStatusRaw` wird per finalem `as AntragListItem` gesetzt.
function item(extra?: Record<string, unknown>): KompaktItem {
  return {
    aktenzeichen: 'AZ-1',
    programm_id: 'P',
    status: 'beantragt',
    antragsdatum: ANTRAGSDATUM,
    ...extra,
  } as AntragListItem;
}

describe('kompaktLabel — Akronym mit Aktenzeichen-Fallback', () => {
  it('Akronym vorhanden → getrimmtes Akronym', () => {
    expect(kompaktLabel({ akronym: '  SCULPT  ', aktenzeichen: 'AZ-9' })).toBe('SCULPT');
  });
  it('leeres / fehlendes Akronym → Aktenzeichen', () => {
    expect(kompaktLabel({ akronym: '   ', aktenzeichen: 'AZ-9' })).toBe('AZ-9');
    expect(kompaktLabel({ aktenzeichen: 'AZ-9' })).toBe('AZ-9');
  });
});

describe('matchesKompaktFilter — clientseitiger Substring-Filter', () => {
  const it0 = { akronym: 'DIVA NOTE', aktenzeichen: 'ZKN12345' };
  it('leere Query → immer true', () => {
    expect(matchesKompaktFilter(it0, '')).toBe(true);
    expect(matchesKompaktFilter(it0, '   ')).toBe(true);
  });
  it('Substring im Akronym (case-insensitiv)', () => {
    expect(matchesKompaktFilter(it0, 'diva')).toBe(true);
    expect(matchesKompaktFilter(it0, 'NOTE')).toBe(true);
  });
  it('Substring im Aktenzeichen (Fallback-Feld)', () => {
    expect(matchesKompaktFilter(it0, 'zkn123')).toBe(true);
  });
  it('kein Treffer → false', () => {
    expect(matchesKompaktFilter(it0, 'xyz')).toBe(false);
  });
});

describe('filterKompaktItems — Reihenfolge + Umfang', () => {
  const items = [
    { akronym: 'DIVA NOTE', aktenzeichen: 'AZ-1' },
    { akronym: 'SCULPT', aktenzeichen: 'AZ-2' },
    { akronym: 'AIRES', aktenzeichen: 'AZ-3' },
  ];
  it('leere Query → alle (stabile Reihenfolge, neue Referenz)', () => {
    const out = filterKompaktItems(items, '');
    expect(out).toEqual(items);
    expect(out).not.toBe(items);
  });
  it('filtert clientseitig ohne umzusortieren', () => {
    expect(filterKompaktItems(items, 's').map(i => i.akronym)).toEqual(['SCULPT', 'AIRES']);
  });
});

describe('buildKompaktRow — Zeilen-VM (Label + relative Frist)', () => {
  it('offener Antrag mit Rest-Frist → Frist gesetzt (gefärbt wie Punkt)', () => {
    const vm = buildKompaktRow(item({ akronym: 'SCULPT' }), nowFor(6));
    expect(vm.label).toBe('SCULPT');
    expect(vm.frist).toEqual({ text: 'in 6 T', ampel: 'orange' });
  });

  it('terminaler Status → Frist null (leerer rechter Slot)', () => {
    const vm = buildKompaktRow(item({ akronym: 'ALT', status: 'Schlussvermerk' }), nowFor(6));
    expect(vm.label).toBe('ALT');
    expect(vm.frist).toBeNull();
  });

  it('offen ohne Antragsdatum → Frist null (nicht erfunden)', () => {
    expect(buildKompaktRow(item({ antragsdatum: '' }), nowFor(6)).frist).toBeNull();
  });

  it('Verbund-Id abgeleitet (leer → null)', () => {
    expect(buildKompaktRow(item({ verbund_id: 'VB-7' })).verbundId).toBe('VB-7');
    expect(buildKompaktRow(item({ verbund_id: '' })).verbundId).toBeNull();
    expect(buildKompaktRow(item()).verbundId).toBeNull();
  });

  it('Label-Fallback auf Aktenzeichen ohne Akronym', () => {
    expect(buildKompaktRow(item({ aktenzeichen: 'AZ-42' })).label).toBe('AZ-42');
  });
});

/** Voll-Item mit Aktenzeichen + optionalen Feldern (Verbund-Cluster brauchen `verbund_id`). */
function av(az: string, extra?: Record<string, unknown>): AntragListItem {
  return {
    aktenzeichen: az,
    programm_id: 'P',
    status: 'beantragt',
    antragsdatum: ANTRAGSDATUM,
    ...extra,
  } as AntragListItem;
}

describe('buildKompaktGroups — ein Eintrag pro Verbund', () => {
  it('clustert TVs gleicher verbund_id zu einer Gruppe (Lead = erstes Vorkommen)', () => {
    const groups = buildKompaktGroups([
      av('AZ-1', { akronym: 'SCULPT', verbund_id: 'VB-1' }),
      av('AZ-2', { akronym: 'SCULPT', verbund_id: 'VB-1' }),
      av('AZ-3', { akronym: 'DIVA', verbund_id: 'VB-2' }),
    ], nowFor(6));
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({
      verbundId: 'VB-1', label: 'SCULPT', tvCount: 2, leadAktenzeichen: 'AZ-1', key: 'AZ-1',
    });
    expect(groups[0]!.memberAktenzeichen).toEqual(['AZ-1', 'AZ-2']);
    expect(groups[1]).toMatchObject({ verbundId: 'VB-2', label: 'DIVA', tvCount: 1 });
  });

  it('Solo-Antrag (ohne verbund_id) → eigene Gruppe, verbundId null', () => {
    const groups = buildKompaktGroups([av('AZ-9', { akronym: 'SOLO' })], nowFor(6));
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ verbundId: null, tvCount: 1, leadAktenzeichen: 'AZ-9' });
  });

  it('Frist kommt vom Lead-TV (terminal → null)', () => {
    const rest = buildKompaktGroups([
      av('AZ-1', { akronym: 'X', verbund_id: 'VB-1' }),
      av('AZ-2', { akronym: 'X', verbund_id: 'VB-1' }),
    ], nowFor(6));
    expect(rest[0]!.frist).toEqual({ text: 'in 6 T', ampel: 'orange' });
    const term = buildKompaktGroups([av('AZ-3', { status: 'Schlussvermerk' })], nowFor(6));
    expect(term[0]!.frist).toBeNull();
  });
});

describe('filterKompaktGroups — Filter auf Label + Mitglieds-Aktenzeichen', () => {
  const groups = buildKompaktGroups([
    av('ZKN-1', { akronym: 'SCULPT', verbund_id: 'VB-1' }),
    av('ZKN-2', { akronym: 'SCULPT', verbund_id: 'VB-1' }),
    av('ZKN-3', { akronym: 'DIVA', verbund_id: 'VB-2' }),
  ]);
  it('leere Query → alle (neue Referenz)', () => {
    const out = filterKompaktGroups(groups, '');
    expect(out).toHaveLength(2);
    expect(out).not.toBe(groups);
  });
  it('Treffer im Label (Lead-Akronym)', () => {
    expect(filterKompaktGroups(groups, 'diva').map(g => g.verbundId)).toEqual(['VB-2']);
  });
  it('Treffer in einem Mitglieds-Aktenzeichen (auch Nicht-Lead)', () => {
    expect(filterKompaktGroups(groups, 'zkn-2').map(g => g.verbundId)).toEqual(['VB-1']);
  });
  it('kein Treffer → leer', () => {
    expect(filterKompaktGroups(groups, 'xyz')).toEqual([]);
  });
});
