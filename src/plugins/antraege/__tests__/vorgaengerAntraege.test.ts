import { describe, it, expect } from 'vitest';
import {
  normalizeAkronymForMatch,
  findAbgelehnteVorgaenger,
} from '../vorgaengerAntraege';
import { asAntragStatusRaw, type AntragListItem } from '@/core/services/csv/types';

function mk(
  partial: Partial<Omit<AntragListItem, 'status'>> & { aktenzeichen: string; status?: string },
): AntragListItem {
  const { status, ...rest } = partial;
  return {
    programm_id: 'P',
    _updated_at: '2026-01-01T00:00:00Z',
    ...rest,
    ...(status !== undefined ? { status: asAntragStatusRaw(status) } : {}),
  };
}

describe('normalizeAkronymForMatch', () => {
  it('entfernt umschließende Klammern, lowercased, trimmt', () => {
    expect(normalizeAkronymForMatch('(SCULPT)')).toBe('sculpt');
    expect(normalizeAkronymForMatch('SCULPT')).toBe('sculpt');
    expect(normalizeAkronymForMatch('  SCULPT  ')).toBe('sculpt');
    expect(normalizeAkronymForMatch(' (SCULPT) ')).toBe('sculpt');
  });

  it('lässt innere Klammern unberührt', () => {
    expect(normalizeAkronymForMatch('A(B)C')).toBe('a(b)c');
  });

  it('liefert null für leere/whitespace/null-Werte', () => {
    expect(normalizeAkronymForMatch('')).toBeNull();
    expect(normalizeAkronymForMatch('   ')).toBeNull();
    expect(normalizeAkronymForMatch('()')).toBeNull();
    expect(normalizeAkronymForMatch(null)).toBeNull();
    expect(normalizeAkronymForMatch(undefined)).toBeNull();
  });
});

describe('findAbgelehnteVorgaenger', () => {
  const base = (): AntragListItem[] => [
    // Aktiver Verbund SCULPT (NICHT abgelehnt) — kommt aus currentAktenzeichen/-Verbund.
    mk({ aktenzeichen: '16KN128730', akronym: 'SCULPT', status: 'NF gestellt', verbund_id: 'VB-NEW' }),
    mk({ aktenzeichen: '16KN128731', akronym: 'SCULPT', status: 'NL eingegangen', verbund_id: 'VB-NEW' }),
    // Abgelehnter Vorgänger (SCULPT) mit 2 TVs in eigenem Verbund.
    mk({ aktenzeichen: '16KN128720', akronym: '(SCULPT)', status: 'abgelehnt/zurückgezogen', verbund_id: 'VB-OLD', erstentscheidung: '2025-11-13', antragsteller: 'TU Chemnitz' }),
    mk({ aktenzeichen: '16KN128721', akronym: '(SCULPT)', status: 'abgelehnt/zurückgezogen', verbund_id: 'VB-OLD', erstentscheidung: '2025-11-24', antragsteller: 'TU Chemnitz' }),
  ];

  const callForNew = (antraege: AntragListItem[]) =>
    findAbgelehnteVorgaenger({
      currentVerbundId: 'VB-NEW',
      currentAkronym: 'SCULPT',
      currentAktenzeichen: new Set(['16KN128730', '16KN128731']),
      antraege,
    });

  it('findet den geklammerten abgelehnten Vorgänger (Klammer-tolerant)', () => {
    const res = callForNew(base());
    expect(res).toHaveLength(1);
    expect(res[0]!.verbundId).toBe('VB-OLD');
    expect(res[0]!.akronymRaw).toBe('(SCULPT)');
    expect(res[0]!.tvCount).toBe(2);
    // Jüngste Erstentscheidung über die TVs.
    expect(res[0]!.erstentscheidung).toBe('2025-11-24');
    expect(res[0]!.antragsteller).toBe('TU Chemnitz');
    expect(res[0]!.aktenzeichen).toEqual(['16KN128720', '16KN128721']);
  });

  it('matcht NICHT bei bewilligt/Schlussvermerk (nur abgelehnt/zurückgezogen)', () => {
    const antraege = base().map(a =>
      a.verbund_id === 'VB-OLD' ? { ...a, status: asAntragStatusRaw('bewilligt') } : a,
    );
    expect(callForNew(antraege)).toHaveLength(0);

    const antraege2 = base().map(a =>
      a.verbund_id === 'VB-OLD' ? { ...a, status: asAntragStatusRaw('Schlussvermerk') } : a,
    );
    expect(callForNew(antraege2)).toHaveLength(0);
  });

  it('schließt den aktuellen Verbund und dessen TVs aus', () => {
    // Selbst wenn der aktive Verbund einen abgelehnten TV hätte, darf er nicht
    // als eigener Vorgänger erscheinen.
    const antraege = base().concat(
      mk({ aktenzeichen: '16KN128732', akronym: 'SCULPT', status: 'abgelehnt/zurückgezogen', verbund_id: 'VB-NEW' }),
    );
    const res = findAbgelehnteVorgaenger({
      currentVerbundId: 'VB-NEW',
      currentAkronym: 'SCULPT',
      currentAktenzeichen: new Set(['16KN128730', '16KN128731', '16KN128732']),
      antraege,
    });
    expect(res).toHaveLength(1);
    expect(res[0]!.verbundId).toBe('VB-OLD');
  });

  it('gruppiert mehrere abgelehnte Verbünde getrennt, jüngster zuerst', () => {
    const antraege = base().concat(
      mk({ aktenzeichen: '16KN128710', akronym: '(SCULPT)', status: 'abgelehnt/zurückgezogen', verbund_id: 'VB-OLD2', erstentscheidung: '2025-12-01' }),
    );
    const res = callForNew(antraege);
    expect(res).toHaveLength(2);
    expect(res[0]!.verbundId).toBe('VB-OLD2'); // 2025-12-01 jünger
    expect(res[1]!.verbundId).toBe('VB-OLD');
  });

  it('liefert [] bei leerem Akronym', () => {
    const res = findAbgelehnteVorgaenger({
      currentVerbundId: 'VB-NEW',
      currentAkronym: null,
      currentAktenzeichen: new Set(),
      antraege: base(),
    });
    expect(res).toHaveLength(0);
  });

  it('matcht einen Solo-Antrag ohne verbund_id über das Aktenzeichen', () => {
    const antraege: AntragListItem[] = [
      mk({ aktenzeichen: '16KN999100', akronym: 'SOLO', status: 'bearbeitungsreif', verbund_id: 'VB-SOLO-NEW' }),
      mk({ aktenzeichen: '16KN999000', akronym: '(SOLO)', status: 'abgelehnt/zurückgezogen' }),
    ];
    const res = findAbgelehnteVorgaenger({
      currentVerbundId: 'VB-SOLO-NEW',
      currentAkronym: 'SOLO',
      currentAktenzeichen: new Set(['16KN999100']),
      antraege,
    });
    expect(res).toHaveLength(1);
    expect(res[0]!.verbundId).toBe('16KN999000');
    expect(res[0]!.tvCount).toBe(1);
  });
});
