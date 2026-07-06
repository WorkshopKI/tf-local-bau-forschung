/**
 * Verbund-Merge + Feld-Kennzahlen (Journey-Paket 2 Phase 7, aus VerbundAlleFelder
 * herausgelöst). Deckt die divergente Aggregation, die TV-spezifische Ausblendung
 * und die „mit Werten"-Zählung der Kontext-Vorschau ab.
 */
import { describe, it, expect } from 'vitest';
import type { Antrag } from '@/core/services/csv/types';
import { mergeAntraegeForDisplay, verbundFelderStats } from '../verbundMerge';

function tv(fields: Record<string, unknown>): Antrag {
  return { ...fields, aktenzeichen: 'AZ', programm_id: 'P', _field_sources: {}, _updated_at: '' } as unknown as Antrag;
}

describe('mergeAntraegeForDisplay', () => {
  it('einheitliche Werte bleiben, divergente werden „a / b"', () => {
    const merged = mergeAntraegeForDisplay([
      tv({ kooperation: 'ja', region: 'Nord' }),
      tv({ kooperation: 'ja', region: 'Süd' }),
    ]) as unknown as Record<string, unknown>;
    expect(merged.kooperation).toBe('ja');
    expect(merged.region).toBe('Nord / Süd');
  });

  it('leere Werte über alle TVs → null', () => {
    const merged = mergeAntraegeForDisplay([tv({ leerfeld: '' }), tv({})]) as unknown as Record<string, unknown>;
    expect(merged.leerfeld).toBeNull();
  });
});

describe('verbundFelderStats', () => {
  it('zählt angezeigte Felder (TV-spezifische raus) + davon mit Werten', () => {
    const stats = verbundFelderStats([
      tv({ kooperation: 'ja', leerfeld: '', titel: 'T1' }), // titel = TV-spezifisch → ausgeblendet
      tv({ kooperation: '', titel: 'T2' }),
    ], []);
    // kooperation (Wert) + leerfeld (leer, „—") = 2 Felder; nur kooperation hat einen Wert.
    expect(stats).toEqual({ gesamt: 2, mitWerten: 1 });
  });

  it('leere TV-Liste → 0/0', () => {
    expect(verbundFelderStats([], [])).toEqual({ gesamt: 0, mitWerten: 0 });
  });
});
