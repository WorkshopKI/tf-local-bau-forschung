/**
 * Tests für das Quartals-Bucketing des Home-Rückstands-Balkens: verteilt die
 * eigenen offenen Anträge nach Alter ihres Antragsdatums auf vier Segmente
 * (aktuell · Q-1 · Q-2 · Q-3 und älter).
 */
import { describe, it, expect } from 'vitest';
import type { AntragVorgang } from '../useDashboardData';
import {
  antragsdatumToQuartalNum,
  currentQuartalNum,
  quartalBucketIndex,
  bucketMeineAntraege,
} from '../quartalBuckets';

/** Fixer „Jetzt": 15.07.2026 → Q3/2026 (quartalIndex 2 → year*4+2 = 8106). */
const NOW = new Date('2026-07-15T12:00:00Z');

function antrag(id: string, antragsdatum: string | undefined, tv_count?: number): AntragVorgang {
  return { id, antragsdatum, ...(tv_count !== undefined ? { tv_count } : {}) } as AntragVorgang;
}

describe('antragsdatumToQuartalNum', () => {
  it('parst YYYY-MM-DD in eine sortierbare Quartalszahl', () => {
    expect(antragsdatumToQuartalNum('2026-01-05')).toBe(2026 * 4 + 0); // Q1
    expect(antragsdatumToQuartalNum('2026-04-30')).toBe(2026 * 4 + 1); // Q2
    expect(antragsdatumToQuartalNum('2026-07-01')).toBe(2026 * 4 + 2); // Q3
    expect(antragsdatumToQuartalNum('2026-12-31')).toBe(2026 * 4 + 3); // Q4
  });

  it('akzeptiert auch YYYY/MM/DD und ignoriert eine Uhrzeit', () => {
    expect(antragsdatumToQuartalNum('2025/10/09')).toBe(2025 * 4 + 3);
    expect(antragsdatumToQuartalNum('2026-07-15T08:00:00Z')).toBe(2026 * 4 + 2);
  });

  it('gibt null bei fehlendem/unplausiblem Datum', () => {
    expect(antragsdatumToQuartalNum(undefined)).toBeNull();
    expect(antragsdatumToQuartalNum(null)).toBeNull();
    expect(antragsdatumToQuartalNum('')).toBeNull();
    expect(antragsdatumToQuartalNum('keine-datum')).toBeNull();
    expect(antragsdatumToQuartalNum('2026-13-01')).toBeNull();
    expect(antragsdatumToQuartalNum('2026-00-01')).toBeNull();
  });
});

describe('currentQuartalNum', () => {
  it('nutzt den UTC-Kalender (deterministisch, TZ-unabhängig)', () => {
    expect(currentQuartalNum(NOW)).toBe(2026 * 4 + 2);
    expect(currentQuartalNum(new Date('2026-01-01T00:00:00Z'))).toBe(2026 * 4 + 0);
    expect(currentQuartalNum(new Date('2025-12-31T23:59:59Z'))).toBe(2025 * 4 + 3);
  });
});

describe('quartalBucketIndex', () => {
  it('ordnet aktuelles Quartal, Q-1, Q-2 korrekt zu', () => {
    expect(quartalBucketIndex('2026-08-01', NOW)).toBe(0); // Q3/2026 = aktuell
    expect(quartalBucketIndex('2026-05-15', NOW)).toBe(1); // Q2/2026 = Q-1
    expect(quartalBucketIndex('2026-02-15', NOW)).toBe(2); // Q1/2026 = Q-2
  });

  it('fasst Q-3 und alles Ältere zu Bucket 3 zusammen (kein Cap)', () => {
    expect(quartalBucketIndex('2025-11-01', NOW)).toBe(3); // Q4/2025 = Q-3
    expect(quartalBucketIndex('2024-01-01', NOW)).toBe(3); // weit älter als Q-7
  });

  it('gibt null für zukünftige oder undatierbare Anträge', () => {
    expect(quartalBucketIndex('2026-11-01', NOW)).toBeNull(); // Q4/2026 = Zukunft
    expect(quartalBucketIndex(undefined, NOW)).toBeNull();
  });
});

describe('bucketMeineAntraege', () => {
  it('verteilt Anträge auf die vier Buckets und summiert TVs', () => {
    const antraege = [
      antrag('A', '2026-08-01', 3), // aktuell
      antrag('B', '2026-05-01', 2), // Q-1
      antrag('C', '2026-04-10'),    // Q-1, tv_count default 1
      antrag('D', '2025-06-01', 5), // Q-3+
    ];
    const { buckets, totalAntraege, totalTvs } = bucketMeineAntraege(antraege, NOW);

    expect(buckets[0].count).toBe(1);
    expect(buckets[0].tvs).toBe(3);
    expect(buckets[1].count).toBe(2);
    expect(buckets[1].tvs).toBe(3); // 2 + default 1
    expect(buckets[2].count).toBe(0);
    expect(buckets[3].count).toBe(1);
    expect(buckets[3].tvs).toBe(5);

    expect(totalAntraege).toBe(4);
    expect(totalTvs).toBe(11);
    expect(buckets[1].rows.map((r) => r.id)).toEqual(['B', 'C']);
  });

  it('schließt undatierbare/zukünftige Anträge aus den Summen aus', () => {
    const antraege = [
      antrag('A', '2026-05-01', 2), // Q-1
      antrag('X', undefined, 9),    // undatierbar → raus
      antrag('Y', '2026-12-01', 4), // Zukunft → raus
    ];
    const { buckets, totalAntraege, totalTvs } = bucketMeineAntraege(antraege, NOW);
    expect(totalAntraege).toBe(1);
    expect(totalTvs).toBe(2);
    expect(buckets[1].count).toBe(1);
  });

  it('liefert vier leere Buckets bei leerer Eingabe', () => {
    const { buckets, totalAntraege, totalTvs } = bucketMeineAntraege([], NOW);
    expect(buckets).toHaveLength(4);
    expect(totalAntraege).toBe(0);
    expect(totalTvs).toBe(0);
    expect(buckets.every((b) => b.count === 0)).toBe(true);
  });
});
