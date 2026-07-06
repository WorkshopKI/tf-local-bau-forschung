/**
 * View-Default-Sortierung (Journey-Paket 2 Phase 4).
 *
 * „Offen" (meine_offenen) → Frist aufsteigend (dringendste zuerst); „Alle" →
 * Antragseingang absteigend (neueste zuerst). Bestehende explizite Nutzer-
 * Overrides behalten Vorrang (`getEffectiveSortKey`).
 */
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SORT_BY_VIEW,
  isSortAllowedForView,
  getSortOptionsForView,
} from '../sort';
import { getEffectiveSortKey } from '../store';

describe('DEFAULT_SORT_BY_VIEW — Phase-4-Defaults', () => {
  it('„Offen" (meine_offenen) → Frist aufsteigend', () => {
    expect(DEFAULT_SORT_BY_VIEW.meine_offenen).toBe('frist_asc');
  });
  it('„Alle" → Antragseingang absteigend (neueste zuerst)', () => {
    expect(DEFAULT_SORT_BY_VIEW.alle).toBe('antrag_desc');
  });
  it('Antragsdatum-Sort ist für „Alle" erlaubt + im Dropdown sichtbar', () => {
    expect(isSortAllowedForView('antrag_desc', 'alle')).toBe(true);
    expect(getSortOptionsForView('alle').some(o => o.key === 'antrag_desc')).toBe(true);
  });
});

describe('getEffectiveSortKey — Override vor Default', () => {
  it('kein Override → View-Default', () => {
    expect(getEffectiveSortKey('alle', {})).toBe('antrag_desc');
    expect(getEffectiveSortKey('meine_offenen', {})).toBe('frist_asc');
  });
  it('expliziter Nutzer-Override gewinnt', () => {
    expect(getEffectiveSortKey('alle', { alle: 'akronym_asc' })).toBe('akronym_asc');
  });
  it('ungültiger Override (für die View nicht erlaubt) fällt auf Default zurück', () => {
    // bewilligung_* ist nur in bewilligt_jahr/alle erlaubt → in meine_offenen verworfen
    expect(getEffectiveSortKey('meine_offenen', { meine_offenen: 'bewilligung_desc' })).toBe('frist_asc');
  });
});
