/**
 * Unit-Test fuer den `applyFristDatumFallback`-Helper.
 *
 * Domain-Entscheidung (phasen-aware Frist):
 * - Antragsphase: `frist_datum = antragsdatum + 90 Tage` (Bearbeitungs-SLA)
 * - Begleitphase: `frist_datum = vn_eingang_datum + 6 Monate` (VN-Frist)
 * - Wenn Quellfeld fehlt: kein `frist_datum`.
 *
 * Explizit gesetztes `frist_datum` (z.B. Dev-Fixture `status-aktive-mini`)
 * gewinnt — Fallback greift nur bei leerem Feld.
 */
import { describe, it, expect } from 'vitest';
import { applyFristDatumFallback } from '../merger/helpers';
import { asAntragStatusRaw, type Antrag } from '../types';

function mk(partial: Partial<Antrag>): Antrag {
  return {
    aktenzeichen: 'TEST',
    programm_id: 'P',
    _updated_at: '2026-05-12T00:00:00Z',
    _field_sources: {},
    ...partial,
  };
}

describe('applyFristDatumFallback — Antragsphase', () => {
  it('setzt frist_datum auf antragsdatum + 90 Tage', () => {
    const a = mk({
      antragsdatum: '2026-01-15',
      status: asAntragStatusRaw('beantragt'),
      _field_sources: { antragsdatum: 'fixture-real-anb' },
    });
    applyFristDatumFallback(a);
    // 2026-01-15 + 90 Tage = 2026-04-15
    expect(a.frist_datum).toBe('2026-04-15T00:00:00.000Z');
    expect(a._field_sources.frist_datum).toBe('fixture-real-anb');
  });

  it('laesst explizit gesetztes frist_datum unveraendert (Dev-Fixture-Fall)', () => {
    const a = mk({
      antragsdatum: '2026-01-15',
      frist_datum: '2026-08-01',
      status: asAntragStatusRaw('beantragt'),
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
      status: asAntragStatusRaw('beantragt'),
      _field_sources: { antragsdatum: 'master' },
    });
    applyFristDatumFallback(a);
    // 2026-03-01 + 90 Tage = 2026-05-30
    expect(a.frist_datum).toBe('2026-05-30T00:00:00.000Z');
  });

  it('macht nichts wenn antragsdatum fehlt', () => {
    const a = mk({ status: asAntragStatusRaw('beantragt') });
    applyFristDatumFallback(a);
    expect(a.frist_datum).toBeUndefined();
    expect(a._field_sources.frist_datum).toBeUndefined();
  });

  it('macht nichts wenn antragsdatum leer-String', () => {
    const a = mk({ antragsdatum: '', status: asAntragStatusRaw('beantragt') });
    applyFristDatumFallback(a);
    expect(a.frist_datum).toBeUndefined();
  });

  it('uebernimmt die Quelle vom antragsdatum-Feld', () => {
    const a = mk({
      antragsdatum: '2026-02-20',
      status: asAntragStatusRaw('beantragt'),
      _field_sources: { antragsdatum: 'fixture-real-bgl' },
    });
    applyFristDatumFallback(a);
    expect(a._field_sources.frist_datum).toBe('fixture-real-bgl');
  });
});

describe('applyFristDatumFallback — Begleitphase (VN/ZB)', () => {
  it('nutzt vn_eingang_datum + 6 Monate fuer VN-Antraege', () => {
    const a = mk({
      antragsdatum: '2023-01-15',           // alt, irrelevant
      vn_eingang_datum: '2026-01-15',
      status: asAntragStatusRaw('VN geprüft'),
      _field_sources: { antragsdatum: 'master', vn_eingang_datum: 'fixture-real-bgl' },
    });
    applyFristDatumFallback(a);
    // 2026-01-15 + 6 Monate = 2026-07-15
    expect(a.frist_datum).toBe('2026-07-15T00:00:00.000Z');
    expect(a._field_sources.frist_datum).toBe('fixture-real-bgl');
  });

  it('kein frist_datum wenn VN-Status aber vn_eingang_datum leer', () => {
    const a = mk({
      antragsdatum: '2023-01-15',
      status: asAntragStatusRaw('VN geprüft'),
      _field_sources: { antragsdatum: 'master' },
    });
    applyFristDatumFallback(a);
    expect(a.frist_datum).toBeUndefined();
    expect(a._field_sources.frist_datum).toBeUndefined();
  });

  it('Pattern-Match: "VN angefordert" wird als Begleitphase erkannt', () => {
    const a = mk({
      vn_eingang_datum: '2026-02-01',
      status: asAntragStatusRaw('VN angefordert'),
      _field_sources: { vn_eingang_datum: 'bgl' },
    });
    applyFristDatumFallback(a);
    // 2026-02-01 + 6 Monate = 2026-08-01
    expect(a.frist_datum).toBe('2026-08-01T00:00:00.000Z');
  });

  it('ZB-Stati matchen ebenfalls die Begleitphase', () => {
    const a = mk({
      vn_eingang_datum: '2026-03-10',
      status: asAntragStatusRaw('ZB eingegangen'),
      _field_sources: { vn_eingang_datum: 'bgl' },
    });
    applyFristDatumFallback(a);
    expect(a.frist_datum).toBe('2026-09-10T00:00:00.000Z');
  });
});
