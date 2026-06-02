/**
 * Zuweisungs-Worklist nutzt denselben „zu verteilen"-Pool wie die
 * Klassifizierungs-Liste: aktuelles Jahr, KEIN `tib_kuerz`, kein
 * ausgeschlossener Status (`istZuVerteilen`). Bereits gekürzelte/alte/
 * ausgeschlossene Anträge erscheinen in keiner der beiden Listen.
 */
import { describe, it, expect } from 'vitest';
import {
  groupFreigegebeneByVerbund,
  hatBearbeiterKuerzel,
  istZuVerteilen,
  jahrAusQuartal,
} from '../services/verbund-aggregation';
import type { KlassifizierungsView } from '../hooks/useKlassifizierungen';
import type { Antrag } from '@/core/services/csv/types';
import type { Klassifizierung } from '../types';

type AntragOpts = { verbundId?: string; tib?: string; datum?: string; status?: string };

const mkAntrag = (az: string, opts: AntragOpts = {}): Antrag =>
  ({
    aktenzeichen: az,
    verbund_id: opts.verbundId ?? az,
    tib_kuerz: opts.tib ?? '',
    antragsdatum: opts.datum ?? '2026-04-05',
    status: opts.status ?? 'beantragt',
    programm_id: 'p1', _field_sources: {}, _updated_at: '',
  }) as unknown as Antrag;

const mkView = (az: string, opts: AntragOpts = {}): KlassifizierungsView => ({
  antrag: mkAntrag(az, opts),
  klassifizierung: { antragId: az, status: 'freigegeben' } as unknown as Klassifizierung,
  confidence: 'high',
});

/** Spiegelt den Cockpit-/Klassifizierungs-Pool exakt. */
const pool = (views: KlassifizierungsView[], jahr: number | null): KlassifizierungsView[] =>
  views.filter(v => v.klassifizierung.status === 'freigegeben'
    && (jahr === null || istZuVerteilen(v.antrag, jahr)));

describe('hatBearbeiterKuerzel', () => {
  it('true bei gesetztem Kürzel (inkl. Umlaut)', () => {
    expect(hatBearbeiterKuerzel(mkAntrag('A1', { tib: 'THÜ' }))).toBe(true);
  });
  it('false bei leer / nur Whitespace / fehlend', () => {
    expect(hatBearbeiterKuerzel(mkAntrag('A1', { tib: '' }))).toBe(false);
    expect(hatBearbeiterKuerzel(mkAntrag('A1', { tib: '   ' }))).toBe(false);
    expect(hatBearbeiterKuerzel({ aktenzeichen: 'A1' } as unknown as Antrag)).toBe(false);
  });
});

describe('jahrAusQuartal', () => {
  it('parst Jahr aus YYYY-QN, null bei ungültigem Format', () => {
    expect(jahrAusQuartal('2026-Q2')).toBe(2026);
    expect(jahrAusQuartal('kaputt')).toBeNull();
  });
});

describe('istZuVerteilen (Pool-Gate)', () => {
  it('aktuelles Jahr + kein tib + ok-Status → true', () => {
    expect(istZuVerteilen(mkAntrag('A1', { datum: '2026-04-05', status: 'beantragt' }), 2026)).toBe(true);
  });
  it('gesetztes tib_kuerz → false', () => {
    expect(istZuVerteilen(mkAntrag('A1', { tib: 'THÜ' }), 2026)).toBe(false);
  });
  it('falsches Jahr → false', () => {
    expect(istZuVerteilen(mkAntrag('A1', { datum: '2025-12-30' }), 2026)).toBe(false);
  });
  it('ausgeschlossener Status (irrläufer / abgelehnt) → false', () => {
    expect(istZuVerteilen(mkAntrag('A1', { status: 'irrläufer' }), 2026)).toBe(false);
    expect(istZuVerteilen(mkAntrag('A1', { status: 'abgelehnt/zurückgezogen' }), 2026)).toBe(false);
  });
});

describe('Zuweisungs-Worklist = Klassifizierungs-Pool', () => {
  it('gekürzelter / altes-Jahr / ausgeschlossener Antrag liefert keine Row', () => {
    const views = [
      mkView('A1', { verbundId: 'V1', tib: 'THÜ' }),          // gekürzelt → raus
      mkView('A2', { verbundId: 'V2', datum: '2024-01-01' }), // altes Jahr → raus
      mkView('A3', { verbundId: 'V3', status: 'irrläufer' }), // Status → raus
      mkView('A4', { verbundId: 'V4' }),                      // offen → bleibt
    ];
    const rows = groupFreigegebeneByVerbund(pool(views, 2026), new Map());
    expect(rows.map(r => r.verbundId)).toEqual(['V4']);
  });

  it('jahr===null → kein Jahr-/Pool-Filter (identisch zur Klassifizierungs-Liste)', () => {
    const views = [mkView('A1', { verbundId: 'V1', datum: '2024-01-01' })];
    const rows = groupFreigegebeneByVerbund(pool(views, null), new Map());
    expect(rows.map(r => r.verbundId)).toEqual(['V1']);
  });
});
