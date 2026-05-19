/**
 * Unit-Test fuer den `applyFristDatumFallback`-Helper. Domain-Entscheidung:
 * `frist_datum` spiegelt `antragsdatum` (D_AAE), wenn kein Schema eine eigene
 * Frist-Spalte mappt — damit die SLA-Views/Sortierung mit den Master-Daten
 * funktionieren, ohne dass jeder Schema-Autor `frist_datum` explizit mappen
 * muss.
 */
import { describe, it, expect } from 'vitest';
import { applyFristDatumFallback } from '../merger/helpers';
import type { Antrag } from '../types';

function mk(partial: Partial<Antrag>): Antrag {
  return {
    aktenzeichen: 'TEST',
    programm_id: 'P',
    _updated_at: '2026-05-12T00:00:00Z',
    _field_sources: {},
    ...partial,
  };
}

describe('applyFristDatumFallback', () => {
  it('setzt frist_datum auf antragsdatum, wenn frist_datum leer ist', () => {
    const a = mk({
      antragsdatum: '2026-01-15',
      _field_sources: { antragsdatum: 'fixture-real-anb' },
    });
    applyFristDatumFallback(a);
    expect(a.frist_datum).toBe('2026-01-15');
    expect(a._field_sources.frist_datum).toBe('fixture-real-anb');
  });

  it('laesst explizit gesetztes frist_datum unveraendert (Dev-Fixture-Fall)', () => {
    const a = mk({
      antragsdatum: '2026-01-15',
      frist_datum: '2026-08-01',
      _field_sources: { antragsdatum: 'master', frist_datum: 'status-aktive-mini' },
    });
    applyFristDatumFallback(a);
    expect(a.frist_datum).toBe('2026-08-01');
    expect(a._field_sources.frist_datum).toBe('status-aktive-mini');
  });

  it('greift bei leerem-String-frist_datum', () => {
    const a = mk({
      antragsdatum: '2026-03-01',
      frist_datum: '',
      _field_sources: { antragsdatum: 'master' },
    });
    applyFristDatumFallback(a);
    expect(a.frist_datum).toBe('2026-03-01');
  });

  it('macht nichts wenn antragsdatum fehlt', () => {
    const a = mk({});
    applyFristDatumFallback(a);
    expect(a.frist_datum).toBeUndefined();
    expect(a._field_sources.frist_datum).toBeUndefined();
  });

  it('macht nichts wenn antragsdatum leer-String', () => {
    const a = mk({ antragsdatum: '' });
    applyFristDatumFallback(a);
    expect(a.frist_datum).toBeUndefined();
  });

  it('uebernimmt die Quelle vom antragsdatum-Feld', () => {
    const a = mk({
      antragsdatum: '2026-02-20',
      _field_sources: { antragsdatum: 'fixture-real-bgl' },
    });
    applyFristDatumFallback(a);
    expect(a._field_sources.frist_datum).toBe('fixture-real-bgl');
  });
});
