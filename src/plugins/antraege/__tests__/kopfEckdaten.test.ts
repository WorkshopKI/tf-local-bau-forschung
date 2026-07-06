/**
 * Eckdaten-Zeile des Verbund-Kopfes (Journey-Paket 2 Phase 6).
 *
 * Reine Ableitung: Programm/Typ · TV-Anzahl · Antragsdatum · Beantragt (T€).
 * Fehlende Werte werden ausgelassen (kein „—"). Plus der kompakte Euro-Formatter.
 */
import { describe, it, expect } from 'vitest';
import type { Antrag } from '@/core/services/csv/types';
import { buildKopfEckdaten, formatEuroKompakt } from '../kopfEckdaten';

function tv(fields: Record<string, unknown>): Antrag {
  return fields as unknown as Antrag;
}

describe('formatEuroKompakt', () => {
  it('ab 1000 → Tausend-Euro (gerundet)', () => {
    expect(formatEuroKompakt(812000)).toBe('812 T€');
    expect(formatEuroKompakt(1500)).toBe('2 T€'); // rundet
    expect(formatEuroKompakt(1543436)).toBe('1.543 T€');
  });
  it('unter 1000 → volle Euro', () => {
    expect(formatEuroKompakt(500)).toBe('500 €');
    expect(formatEuroKompakt(0)).toBe('0 €');
  });
});

describe('buildKopfEckdaten', () => {
  it('leere TV-Liste → keine Segmente', () => {
    expect(buildKopfEckdaten({ tvs: [], unterprogramm: null })).toEqual([]);
  });

  it('nur TV-Anzahl, wenn sonst nichts bekannt ist', () => {
    expect(buildKopfEckdaten({ tvs: [tv({}), tv({})], unterprogramm: null })).toEqual(['2 Teilvorhaben']);
  });

  it('fehlende Werte werden ausgelassen (kein „—")', () => {
    const segs = buildKopfEckdaten({ tvs: [tv({ antragsdatum: '' })], unterprogramm: null });
    expect(segs).toEqual(['1 Teilvorhaben']);
    expect(segs.join(' ')).not.toContain('—');
  });

  it('volle Eckdaten: Programm/Typ · TV · Antragsdatum · Beantragt (T€)', () => {
    const segs = buildKopfEckdaten({
      tvs: [tv({ vb_phase: '3', antragsdatum: '2025-11-11', 'beantragte kosten': '812.000' })],
      unterprogramm: 'ZIM FuE-Projekte',
    });
    expect(segs[0]).toBe('FuE · ZIM FuE-Projekte');
    expect(segs).toContain('1 Teilvorhaben');
    expect(segs).toContain('Antragsdatum 11.11.2025');
    expect(segs).toContain('Beantragt 812 T€');
  });

  it('Kosten summieren über mehrere TVs', () => {
    const segs = buildKopfEckdaten({
      tvs: [
        tv({ 'beantragte kosten': '500.000' }),
        tv({ 'beantragte kosten': '312.000' }),
      ],
      unterprogramm: null,
    });
    expect(segs).toContain('Beantragt 812 T€');
  });

  it('Unterprogramm ohne VB-Phase → Programm/Typ = nur Unterprogramm', () => {
    const segs = buildKopfEckdaten({ tvs: [tv({})], unterprogramm: 'ZIM FuE-Projekte' });
    expect(segs[0]).toBe('ZIM FuE-Projekte');
  });

  it('VB-Phase ohne Unterprogramm → Programm/Typ = nur Phase-Label', () => {
    const segs = buildKopfEckdaten({ tvs: [tv({ vb_phase: '3' })], unterprogramm: null });
    expect(segs[0]).toBe('FuE');
  });
});
