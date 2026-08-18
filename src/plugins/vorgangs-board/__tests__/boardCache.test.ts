/**
 * Der Sitzungs-Cache des Boards — geprüft wird, **wann er NICHT gilt**.
 *
 * Ein Cache, der zu selten trifft, kostet Zeit; einer, der zu oft trifft, zeigt
 * falsche Zahlen. Der zweite Fehler ist der teurere, deshalb steht hier für jede
 * Achse des Schlüssels ein eigener Fall — und für die eine Verschärfung
 * gegenüber dem Vorbild (Cold Start vs. leerer Betrachtungsbereich) zwei.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  useBoardCache, cacheGilt, BOARD_CACHE_TTL_MS,
} from '@/plugins/vorgangs-board/boardCache';
import type { BoardCacheDaten } from '@/plugins/vorgangs-board/boardCache';
import type { MappingVersion } from '@/core/status';

const VERSION = { version: 3, zeitstempel: '2026-08-01T00:00:00.000Z' } as MappingVersion;

const daten = (n: number): BoardCacheDaten => ({
  version: VERSION,
  zeilen: Array.from({ length: n }, () => ({})) as BoardCacheDaten['zeilen'],
  ausgeblendet: 0,
  ladeMs: 1234,
});

describe('boardCache', () => {
  beforeEach(() => {
    useBoardCache.getState().entwerten();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-18T10:00:00.000Z'));
  });
  afterEach(() => { vi.useRealTimers(); });

  it('ein frischer Schluessel gilt, ein fremder nicht', () => {
    useBoardCache.getState().setzen('a', daten(5), 5);
    expect(cacheGilt(useBoardCache.getState(), 'a', Date.now())).toBe(true);
    // Jede Achse des Schluessels — Fassung, Bereich, Generation, Stichtag —
    // landet in derselben Zeichenkette; ein Unterschied irgendwo trifft hier.
    expect(cacheGilt(useBoardCache.getState(), 'b', Date.now())).toBe(false);
  });

  it('nach der TTL gilt er nicht mehr', () => {
    useBoardCache.getState().setzen('a', daten(5), 5);
    vi.advanceTimersByTime(BOARD_CACHE_TTL_MS - 1000);
    expect(cacheGilt(useBoardCache.getState(), 'a', Date.now())).toBe(true);
    vi.advanceTimersByTime(2000);
    expect(cacheGilt(useBoardCache.getState(), 'a', Date.now())).toBe(false);
  });

  it('ein Cold Start (nichts gelesen) stellt NICHT scharf', () => {
    // Der Fall, an dem der Anträge-Store schon einmal gescheitert ist (v2.21.3):
    // die IDB ist noch leer, und ein scharfer leerer Eintrag hielte die Seite
    // bis zum Reload leer.
    useBoardCache.getState().setzen('a', daten(0), 0);
    expect(useBoardCache.getState().standAt).toBe(0);
    expect(cacheGilt(useBoardCache.getState(), 'a', Date.now())).toBe(false);
  });

  it('ein Bereich, der ALLES ausschliesst, stellt sehr wohl scharf', () => {
    // Hier liegt der Unterschied zum Vorbild: null Zeilen, aber 900 gelesene
    // Sätze ist eine echte, stabile Antwort — sie soll nicht bei jedem Besuch
    // neu erarbeitet werden. Nach `zeilen.length` wäre beides ununterscheidbar.
    useBoardCache.getState().setzen('a', { ...daten(0), ausgeblendet: 900 }, 900);
    expect(useBoardCache.getState().standAt).toBeGreaterThan(0);
    expect(cacheGilt(useBoardCache.getState(), 'a', Date.now())).toBe(true);
  });

  it('entwerten macht ihn ungueltig (der Weg des Fehlerpfads)', () => {
    useBoardCache.getState().setzen('a', daten(5), 5);
    useBoardCache.getState().entwerten();
    expect(cacheGilt(useBoardCache.getState(), 'a', Date.now())).toBe(false);
    expect(useBoardCache.getState().daten).toBeNull();
  });

  it('berechnetAm traegt den Zeitpunkt des Laufs', () => {
    useBoardCache.getState().setzen('a', daten(5), 5);
    expect(useBoardCache.getState().berechnetAm).toBe(Date.now());
    vi.advanceTimersByTime(180_000);
    expect(Date.now() - useBoardCache.getState().berechnetAm).toBe(180_000);
  });
});
