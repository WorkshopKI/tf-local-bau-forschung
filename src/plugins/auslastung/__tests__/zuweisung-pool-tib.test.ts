/**
 * Zuweisungs-Worklist: bereits in der CSV gekürzelte Anträge (`tib_kuerz`
 * gesetzt = schon vergeben) gehören nicht in die Liste der zuzuweisenden
 * Anträge. `hatBearbeiterKuerzel` + Verbund-Gruppierung dürfen sie ausschließen.
 */
import { describe, it, expect } from 'vitest';
import { groupFreigegebeneByVerbund, hatBearbeiterKuerzel } from '../services/verbund-aggregation';
import type { KlassifizierungsView } from '../hooks/useKlassifizierungen';
import type { Antrag } from '@/core/services/csv/types';
import type { Klassifizierung } from '../types';

const mkAntrag = (az: string, verbundId: string, tib: string): Antrag =>
  ({
    aktenzeichen: az, verbund_id: verbundId, tib_kuerz: tib,
    programm_id: 'p1', _field_sources: {}, _updated_at: '',
  }) as unknown as Antrag;

const mkView = (az: string, verbundId: string, tib: string): KlassifizierungsView => ({
  antrag: mkAntrag(az, verbundId, tib),
  klassifizierung: { antragId: az, status: 'freigegeben' } as unknown as Klassifizierung,
  confidence: 'high',
});

/** Spiegelt den Cockpit-Filter (freigegeben + nicht gekürzelt). */
const offenePool = (views: KlassifizierungsView[]): KlassifizierungsView[] =>
  views.filter(v => v.klassifizierung.status === 'freigegeben' && !hatBearbeiterKuerzel(v.antrag));

describe('hatBearbeiterKuerzel', () => {
  it('true bei gesetztem Kürzel (inkl. Umlaut)', () => {
    expect(hatBearbeiterKuerzel(mkAntrag('A1', 'V1', 'THÜ'))).toBe(true);
    expect(hatBearbeiterKuerzel(mkAntrag('A1', 'V1', 'abc'))).toBe(true);
  });
  it('false bei leer / nur Whitespace / fehlend', () => {
    expect(hatBearbeiterKuerzel(mkAntrag('A1', 'V1', ''))).toBe(false);
    expect(hatBearbeiterKuerzel(mkAntrag('A1', 'V1', '   '))).toBe(false);
    expect(hatBearbeiterKuerzel({ aktenzeichen: 'A1' } as unknown as Antrag)).toBe(false);
  });
});

describe('Zuweisungs-Worklist schließt gekürzelte Anträge aus', () => {
  it('vollständig gekürzelter Verbund liefert keine Row', () => {
    const rows = groupFreigegebeneByVerbund(
      offenePool([mkView('A1', 'V1', 'THÜ'), mkView('A2', 'V2', '')]),
      new Map(),
    );
    expect(rows.map(r => r.verbundId)).toEqual(['V2']);
  });

  it('teil-gekürzelter Verbund behält nur die offenen TVs', () => {
    const rows = groupFreigegebeneByVerbund(
      offenePool([mkView('A1', 'V1', 'THÜ'), mkView('A2', 'V1', '')]),
      new Map(),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.tvAktenzeichen).toEqual(['A2']);
    expect(rows[0]!.tvCount).toBe(1);
  });
});
