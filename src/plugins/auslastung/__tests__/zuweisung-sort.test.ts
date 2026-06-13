/**
 * Tests fuer zuweisung-sort.ts — die Sortier-Comparatoren der Zuweisungs-
 * Worklist (Tab „Anträge zuweisen"). Fokus: korrekte Reihenfolge je Key,
 * leere Werte ans Ende, FKZ-Tiebreak, Kategorie nach konfigurierter Reihenfolge,
 * Sicherheit auf-/absteigend nach numerischem confidence.
 */
import { describe, it, expect } from 'vitest';
import {
  buildZuweisungSortOptions,
  buildSortChips,
  sortChipValue,
  nextSortKeyForClick,
  DEFAULT_ZUWEISUNG_SORT,
  type ZuweisungSortKey,
} from '../services/matching';
import type { VerbundZuweisungRow } from '../services/verbund';
import type { Klassifizierung } from '../types';

function makeRow(
  overrides: Partial<VerbundZuweisungRow> & Pick<VerbundZuweisungRow, 'leadAktenzeichen'>,
  opts: { primaer?: string; confidence?: number | null } = {},
): VerbundZuweisungRow {
  const klassifizierung: Klassifizierung = {
    antragId: overrides.leadAktenzeichen,
    vorgeschlagenePrimaer:
      opts.confidence == null
        ? null
        : { kategorieId: opts.primaer ?? 'IT', confidence: opts.confidence, methode: 'regel' },
    vorgeschlageneAspekte: [],
    freigegebenePrimaer: opts.primaer ?? 'IT',
    freigegebeneAspekte: [],
    status: 'freigegeben',
  };
  return {
    verbundId: overrides.leadAktenzeichen,
    akronym: '',
    verbundTitel: '',
    antragsdatum: '',
    tvAktenzeichen: [overrides.leadAktenzeichen],
    tvCount: 1,
    confidence: 'high',
    manuell: false,
    ...overrides,
    klassifizierung,
  };
}

/** Kategorie-Rank wie aus config.ueberKategorien (id → Index). */
const KAT_RANK = new Map([['IT', 0], ['DT', 1], ['EU', 2], ['LG', 3], ['NM', 4]]);
const OPTIONS = buildZuweisungSortOptions(KAT_RANK);

function sortBy(key: ZuweisungSortKey, rows: VerbundZuweisungRow[]): string[] {
  const compare = OPTIONS.find(o => o.key === key)!.compare;
  return [...rows].sort(compare).map(r => r.leadAktenzeichen);
}

describe('zuweisung-sort', () => {
  it('Default ist Akronym aufsteigend', () => {
    expect(DEFAULT_ZUWEISUNG_SORT).toBe('akronym_asc');
    expect(OPTIONS).toHaveLength(8);
  });

  it('akronym_asc: A→Z, leere Akronyme ans Ende, FKZ-Tiebreak', () => {
    const rows = [
      makeRow({ leadAktenzeichen: 'FKZ3', akronym: 'Zeta' }),
      makeRow({ leadAktenzeichen: 'FKZ1', akronym: '' }),
      makeRow({ leadAktenzeichen: 'FKZ2', akronym: 'Alpha' }),
      makeRow({ leadAktenzeichen: 'FKZ0', akronym: '' }),
    ];
    // Alpha, Zeta, dann die beiden leeren — leere untereinander per FKZ.
    expect(sortBy('akronym_asc', rows)).toEqual(['FKZ2', 'FKZ3', 'FKZ0', 'FKZ1']);
  });

  it('fkz_asc: Lead-Förderkennzeichen alphanumerisch aufsteigend', () => {
    const rows = [
      makeRow({ leadAktenzeichen: '16DS261141' }),
      makeRow({ leadAktenzeichen: '16AB100000' }),
      makeRow({ leadAktenzeichen: '16KN127430' }),
    ];
    expect(sortBy('fkz_asc', rows)).toEqual(['16AB100000', '16DS261141', '16KN127430']);
  });

  it('titel_asc: Verbundtitel A→Z, leere Titel ans Ende', () => {
    const rows = [
      makeRow({ leadAktenzeichen: 'F1', verbundTitel: '' }),
      makeRow({ leadAktenzeichen: 'F2', verbundTitel: 'Brennstoffzelle' }),
      makeRow({ leadAktenzeichen: 'F3', verbundTitel: 'Antriebsstrang' }),
    ];
    expect(sortBy('titel_asc', rows)).toEqual(['F3', 'F2', 'F1']);
  });

  it('antragsdatum_desc: neueste zuerst, leere Datümer ans Ende, FKZ-Tiebreak', () => {
    const rows = [
      makeRow({ leadAktenzeichen: 'F1', antragsdatum: '2026-01-15' }),
      makeRow({ leadAktenzeichen: 'F2', antragsdatum: '2026-05-20' }),
      makeRow({ leadAktenzeichen: 'FKZ-B', antragsdatum: '' }),
      makeRow({ leadAktenzeichen: 'F3', antragsdatum: '2026-03-10' }),
      makeRow({ leadAktenzeichen: 'FKZ-A', antragsdatum: '' }),
    ];
    // Neueste zuerst, dann die beiden leeren — leere untereinander per FKZ.
    expect(sortBy('antragsdatum_desc', rows)).toEqual(['F2', 'F3', 'F1', 'FKZ-A', 'FKZ-B']);
  });

  it('antragsdatum_asc: älteste zuerst, leere Datümer ans Ende, FKZ-Tiebreak', () => {
    const rows = [
      makeRow({ leadAktenzeichen: 'F1', antragsdatum: '2026-01-15' }),
      makeRow({ leadAktenzeichen: 'F2', antragsdatum: '2026-05-20' }),
      makeRow({ leadAktenzeichen: 'FKZ-B', antragsdatum: '' }),
      makeRow({ leadAktenzeichen: 'F3', antragsdatum: '2026-03-10' }),
      makeRow({ leadAktenzeichen: 'FKZ-A', antragsdatum: '' }),
    ];
    // Älteste zuerst, leere bleiben (wie desc) am Ende — leere untereinander per FKZ.
    expect(sortBy('antragsdatum_asc', rows)).toEqual(['F1', 'F3', 'F2', 'FKZ-A', 'FKZ-B']);
  });

  it('kategorie_asc: nach konfigurierter Kategorie-Reihenfolge, unbekannte ans Ende', () => {
    const rows = [
      makeRow({ leadAktenzeichen: 'F1' }, { primaer: 'EU' }),
      makeRow({ leadAktenzeichen: 'F2' }, { primaer: 'IT' }),
      makeRow({ leadAktenzeichen: 'F3' }, { primaer: 'XX' }), // nicht im Rank → ans Ende
      makeRow({ leadAktenzeichen: 'F4' }, { primaer: 'DT' }),
    ];
    expect(sortBy('kategorie_asc', rows)).toEqual(['F2', 'F4', 'F1', 'F3']);
  });

  it('sicherheit_asc: niedrigste confidence zuerst, fehlende (null) ganz oben', () => {
    const rows = [
      makeRow({ leadAktenzeichen: 'F1' }, { confidence: 0.9 }),
      makeRow({ leadAktenzeichen: 'F2' }, { confidence: 0.3 }),
      makeRow({ leadAktenzeichen: 'F3' }, { confidence: null }), // → -1, ganz vorn
      makeRow({ leadAktenzeichen: 'F4' }, { confidence: 0.6 }),
    ];
    expect(sortBy('sicherheit_asc', rows)).toEqual(['F3', 'F2', 'F4', 'F1']);
  });

  it('sicherheit_desc: höchste confidence zuerst', () => {
    const rows = [
      makeRow({ leadAktenzeichen: 'F1' }, { confidence: 0.3 }),
      makeRow({ leadAktenzeichen: 'F2' }, { confidence: 0.9 }),
      makeRow({ leadAktenzeichen: 'F3' }, { confidence: 0.6 }),
    ];
    expect(sortBy('sicherheit_desc', rows)).toEqual(['F2', 'F3', 'F1']);
  });

  it('FKZ-Tiebreak bei gleicher Sicherheit', () => {
    const rows = [
      makeRow({ leadAktenzeichen: 'FKZ-B' }, { confidence: 0.5 }),
      makeRow({ leadAktenzeichen: 'FKZ-A' }, { confidence: 0.5 }),
    ];
    expect(sortBy('sicherheit_desc', rows)).toEqual(['FKZ-A', 'FKZ-B']);
  });
});

describe('zuweisung-sort: Chip-Modell + Toggle', () => {
  it('buildSortChips: genau 6 Chips, aktives Label == sortChipValue', () => {
    const chips = buildSortChips('akronym_asc');
    expect(chips).toHaveLength(6);
    // Default-Richtungen der umschaltbaren Dimensionen sind ↓.
    expect(chips.map(c => c.label)).toEqual([
      'Akronym (A→Z)', 'FKZ (A→Z)', 'Verbundtitel (A→Z)',
      'Antragsdatum ↓', 'Kategorie', 'Sicherheit ↓',
    ]);
    expect(sortChipValue('akronym_asc')).toBe('Akronym (A→Z)');
  });

  it('buildSortChips: aktive umschaltbare Dimension spiegelt die Richtung (Pfeil + Tooltip)', () => {
    const chips = buildSortChips('antragsdatum_asc');
    const datum = chips.find(c => c.key === 'antragsdatum_asc');
    expect(datum?.label).toBe('Antragsdatum ↑');
    expect(datum?.title).toContain('Alt→Neu');
    // Sicherheit bleibt bei Default-Richtung (↓), da nicht aktiv.
    expect(chips.find(c => c.label === 'Sicherheit ↓')).toBeTruthy();
    expect(sortChipValue('antragsdatum_asc')).toBe('Antragsdatum ↑');
    // Statische Chips tragen keinen Tooltip.
    expect(chips.find(c => c.key === 'akronym_asc')?.title).toBeUndefined();
  });

  it('nextSortKeyForClick: inaktiver Datums-Chip → Default-Richtung (↓ = desc)', () => {
    expect(nextSortKeyForClick('Antragsdatum ↓', 'akronym_asc')).toBe('antragsdatum_desc');
  });

  it('nextSortKeyForClick: erneuter Klick dreht Antragsdatum desc↔asc', () => {
    const a = nextSortKeyForClick('Antragsdatum ↓', 'antragsdatum_desc');
    expect(a).toBe('antragsdatum_asc');
    // Nach dem Toggle zeigt der Chip ↑; erneuter Klick dreht zurück.
    const b = nextSortKeyForClick(sortChipValue(a), a);
    expect(b).toBe('antragsdatum_desc');
  });

  it('nextSortKeyForClick: erneuter Klick dreht Sicherheit desc↔asc', () => {
    const a = nextSortKeyForClick('Sicherheit ↓', 'sicherheit_desc');
    expect(a).toBe('sicherheit_asc');
    const b = nextSortKeyForClick(sortChipValue(a), a);
    expect(b).toBe('sicherheit_desc');
  });

  it('nextSortKeyForClick: statischer Chip wählt ohne Toggle, Re-Klick = No-Op', () => {
    expect(nextSortKeyForClick('FKZ (A→Z)', 'akronym_asc')).toBe('fkz_asc');
    expect(nextSortKeyForClick('FKZ (A→Z)', 'fkz_asc')).toBe('fkz_asc');
  });

  it('nextSortKeyForClick: unbekanntes Label → No-Op (current)', () => {
    expect(nextSortKeyForClick('Quatsch', 'kategorie_asc')).toBe('kategorie_asc');
  });
});
