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
