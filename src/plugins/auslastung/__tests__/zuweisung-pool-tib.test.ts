/**
 * Verteil-Pool (geteilt von Klassifizieren + Zuweisen): rollierendes
 * Antragsdatum-Fenster (`verteilCutoffDatum` / `istZuVerteilen`) + kein
 * `tib_kuerz` + kein ausgeschlossener Status. Das Fenster gleitet über den
 * Jahreswechsel — ein Dezember-Antrag bleibt im Januar sichtbar.
 */
import { describe, it, expect } from 'vitest';
import {
  groupFreigegebeneByVerbund,
  hatBearbeiterKuerzel,
  istZuVerteilen,
  verteilCutoffDatum,
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
    antragsdatum: opts.datum ?? '2026-02-15',
    status: opts.status ?? 'beantragt',
    programm_id: 'p1', _field_sources: {}, _updated_at: '',
  }) as unknown as Antrag;

const mkView = (az: string, opts: AntragOpts = {}): KlassifizierungsView => ({
  antrag: mkAntrag(az, opts),
  klassifizierung: { antragId: az, status: 'freigegeben' } as unknown as Klassifizierung,
  confidence: 'high',
});

/** Spiegelt den Cockpit-/Klassifizierungs-Pool exakt. */
const pool = (views: KlassifizierungsView[], cutoff: string | null): KlassifizierungsView[] =>
  views.filter(v => v.klassifizierung.status === 'freigegeben'
    && (cutoff === null || istZuVerteilen(v.antrag, cutoff)));

describe('hatBearbeiterKuerzel', () => {
  it('true bei gesetztem Kürzel (inkl. Umlaut), false bei leer/fehlend', () => {
    expect(hatBearbeiterKuerzel(mkAntrag('A1', { tib: 'THÜ' }))).toBe(true);
    expect(hatBearbeiterKuerzel(mkAntrag('A1', { tib: '   ' }))).toBe(false);
    expect(hatBearbeiterKuerzel({ aktenzeichen: 'A1' } as unknown as Antrag)).toBe(false);
  });
});

describe('verteilCutoffDatum (rollierendes Fenster)', () => {
  it('6-Monats-Fenster ab Quartalsende, gleitet über den Jahreswechsel', () => {
    expect(verteilCutoffDatum('2026-Q1', 6)).toBe('2025-10-01'); // Q1 endet März → 6 Mon. zurück = Okt Vorjahr
    expect(verteilCutoffDatum('2026-Q2', 6)).toBe('2026-01-01');
    expect(verteilCutoffDatum('2026-Q4', 6)).toBe('2026-07-01');
  });
  it('null bei ungültigem Quartal-Format', () => {
    expect(verteilCutoffDatum('kaputt', 6)).toBeNull();
  });
});

describe('istZuVerteilen (Pool-Gate mit Cutoff)', () => {
  const cutoff = verteilCutoffDatum('2026-Q1', 6)!; // '2025-10-01'

  it('Dezember-Vorjahr-Antrag im Januar-Fenster → true (der Jahreswechsel-Fall)', () => {
    expect(istZuVerteilen(mkAntrag('A1', { datum: '2025-12-22' }), cutoff)).toBe(true);
  });
  it('Antrag vor dem Fenster → false', () => {
    expect(istZuVerteilen(mkAntrag('A1', { datum: '2025-09-30' }), cutoff)).toBe(false);
  });
  it('gesetztes tib_kuerz → false', () => {
    expect(istZuVerteilen(mkAntrag('A1', { datum: '2026-02-01', tib: 'THÜ' }), cutoff)).toBe(false);
  });
  it('ausgeschlossener Status (irrläufer / abgelehnt) → false', () => {
    expect(istZuVerteilen(mkAntrag('A1', { status: 'irrläufer' }), cutoff)).toBe(false);
    expect(istZuVerteilen(mkAntrag('A1', { status: 'abgelehnt/zurückgezogen' }), cutoff)).toBe(false);
  });
});

describe('Zuweisungs-Worklist = Klassifizierungs-Pool', () => {
  const cutoff = verteilCutoffDatum('2026-Q1', 6)!;

  it('gekürzelt / vor-Fenster / ausgeschlossen → keine Row; Dez-Vorjahr bleibt', () => {
    const views = [
      mkView('A1', { verbundId: 'V1', tib: 'THÜ' }),            // gekürzelt → raus
      mkView('A2', { verbundId: 'V2', datum: '2025-06-01' }),   // vor Fenster → raus
      mkView('A3', { verbundId: 'V3', status: 'irrläufer' }),   // Status → raus
      mkView('A4', { verbundId: 'V4', datum: '2025-12-22' }),   // Dez Vorjahr → bleibt
      mkView('A5', { verbundId: 'V5' }),                        // aktuell → bleibt
    ];
    const rows = groupFreigegebeneByVerbund(pool(views, cutoff), new Map());
    expect(rows.map(r => r.verbundId)).toEqual(['V4', 'V5']);
  });

  it('cutoff===null → kein Datums-Filter (identisch zur Klassifizierungs-Liste)', () => {
    const views = [mkView('A1', { verbundId: 'V1', datum: '2020-01-01' })];
    const rows = groupFreigegebeneByVerbund(pool(views, null), new Map());
    expect(rows.map(r => r.verbundId)).toEqual(['V1']);
  });
});
