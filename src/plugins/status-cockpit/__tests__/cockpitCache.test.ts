/**
 * Der Sitzungs-Cache der Vorgangs-Regeln. Schwester von `bestandsAblage.test.ts`;
 * die Begründung der Fälle steht dort.
 *
 * Der eine eigene Fall hier: gecacht wird **nur der Bestand**, nie die Fassung.
 * Sie ist auf dieser Seite das Arbeitsstück.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  useCockpitCache, cockpitCacheGilt, COCKPIT_CACHE_TTL_MS,
} from '@/plugins/status-cockpit/cockpitCache';
import type { Bestand } from '@/plugins/status-cockpit/useStatusCockpit';

const bestand = (n: number): Bestand => ({
  verbundFelder: Array.from({ length: n }, () => ({})) as Bestand['verbundFelder'],
  schemas: [],
  vorkommen: new Map(),
  zuletzt: new Map(),
  csvSpalten: new Map(),
  programmAntraege: new Map(),
  antraegeOhneProgramm: 0,
  programmUneinheitlich: [],
});

describe('cockpitCache', () => {
  beforeEach(() => {
    useCockpitCache.getState().entwerten();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-18T10:00:00.000Z'));
  });
  afterEach(() => { vi.useRealTimers(); });

  it('gilt beim gleichen Schluessel, nicht beim fremden', () => {
    useCockpitCache.getState().setzen('3|ts|0', bestand(12), 12);
    expect(cockpitCacheGilt(useCockpitCache.getState(), '3|ts|0', Date.now())).toBe(true);
    // Andere Fassungsnummer …
    expect(cockpitCacheGilt(useCockpitCache.getState(), '4|ts|0', Date.now())).toBe(false);
    // … oder eine neue Bestands-Generation (CSV-Import).
    expect(cockpitCacheGilt(useCockpitCache.getState(), '3|ts|1', Date.now())).toBe(false);
  });

  it('nach der TTL nicht mehr', () => {
    useCockpitCache.getState().setzen('k', bestand(12), 12);
    vi.advanceTimersByTime(COCKPIT_CACHE_TTL_MS + 1);
    expect(cockpitCacheGilt(useCockpitCache.getState(), 'k', Date.now())).toBe(false);
  });

  it('ein leerer Lauf stellt nicht scharf', () => {
    useCockpitCache.getState().setzen('k', bestand(0), 0);
    expect(cockpitCacheGilt(useCockpitCache.getState(), 'k', Date.now())).toBe(false);
  });

  it('entwerten wirkt sofort', () => {
    useCockpitCache.getState().setzen('k', bestand(12), 12);
    useCockpitCache.getState().entwerten();
    expect(cockpitCacheGilt(useCockpitCache.getState(), 'k', Date.now())).toBe(false);
  });
});
