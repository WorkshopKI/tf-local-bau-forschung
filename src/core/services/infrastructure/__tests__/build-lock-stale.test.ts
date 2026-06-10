/**
 * Unit-Tests für die stufen-spezifische Build-Lock-Stale-Schwelle (v2.61.5).
 *
 * Hintergrund: Ein OOM-Crash mitten im CSV-Import ließ den (share-weiten) Lock
 * liegen — bei der alten globalen 2h-Schwelle blockierte das die ganze
 * Aktualisierung für 2 Stunden. Die CSV-Import-Stufe altert jetzt in ~3 Min
 * (der laufende Import hält sich per 15-s-Heartbeat frisch), während lange
 * Stufen (Embedding-Build) weiter die 2h behalten.
 *
 * `isStale` + `staleThresholdForStufe` sind pure Funktionen → ohne SMB/IDB
 * testbar.
 */
import { describe, it, expect } from 'vitest';
import {
  isStale,
  staleThresholdForStufe,
  STALE_HEARTBEAT_MS,
  CSV_IMPORT_STALE_HEARTBEAT_MS,
} from '../build-lock';
import type { BuildLock } from '../types';

function lock(stufe: string, heartbeatMinutesAgo: number): BuildLock {
  return {
    programm_id: 'p1',
    stufe,
    hostname: 'h',
    kurator_name: 'k',
    gestartet: new Date(Date.now() - heartbeatMinutesAgo * 60_000).toISOString(),
    heartbeat: new Date(Date.now() - heartbeatMinutesAgo * 60_000).toISOString(),
  };
}

describe('staleThresholdForStufe', () => {
  it('csv-import → kurze Schwelle', () => {
    expect(staleThresholdForStufe('csv-import')).toBe(CSV_IMPORT_STALE_HEARTBEAT_MS);
    expect(CSV_IMPORT_STALE_HEARTBEAT_MS).toBe(3 * 60 * 1000);
  });

  it('andere Stufen → 2h-Default', () => {
    expect(staleThresholdForStufe('auslastung-corpus')).toBe(STALE_HEARTBEAT_MS);
    expect(staleThresholdForStufe('irgendwas')).toBe(STALE_HEARTBEAT_MS);
  });
});

describe('isStale — stufen-abhängig', () => {
  it('csv-import: 1 Min alt → nicht stale, 5 Min alt → stale', () => {
    expect(isStale(lock('csv-import', 1))).toBe(false);
    expect(isStale(lock('csv-import', 5))).toBe(true);
  });

  it('embedding-build: 5 Min alt → noch nicht stale, 3 h alt → stale', () => {
    expect(isStale(lock('auslastung-corpus', 5))).toBe(false);
    expect(isStale(lock('auslastung-corpus', 180))).toBe(true);
  });

  it('csv-import altert deutlich schneller als die Default-Stufe (gleiches Alter)', () => {
    const ageMin = 10;
    expect(isStale(lock('csv-import', ageMin))).toBe(true);
    expect(isStale(lock('auslastung-corpus', ageMin))).toBe(false);
  });
});
