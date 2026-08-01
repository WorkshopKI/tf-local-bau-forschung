/**
 * Die Trigger-Sidecar. Zwei Zusagen werden hier festgehalten:
 *
 * 1. **Herkunft wird mitgeliefert.** Fällt die App auf den lokalen Cache
 *    zurück, sagt sie das (`herkunft: 'cache'`) — ein stiller Rückfall auf einen
 *    alten Stand wäre genau die Unehrlichkeit, die das Vorgangssystem vermeiden
 *    soll.
 * 2. **Erst lokal, dann veröffentlichen.** Ein fehlgeschlagener Share-Write darf
 *    die Arbeit nicht verlieren; er macht sie nur „noch nicht team-weit".
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TriggerZeile } from '@/core/status/typen';

const leseSidecar = vi.fn();
const schreibeSidecar = vi.fn();
vi.mock('@/core/status/sidecar-datei', () => ({
  leseSidecar: (...a: unknown[]) => leseSidecar(...a),
  schreibeSidecar: (...a: unknown[]) => schreibeSidecar(...a),
}));

const {
  ladeTrigger, speichereTrigger, triggerFuerKuerzel, istTriggerDatei, TRIGGER_CACHE_KEY,
} = await import('@/core/status/trigger-share');

const ZEILE = (kuerzel: string, folge: number): TriggerZeile => ({
  kuerzel, folge, prozedur: 'TRG.Status.TV.VB', parameterRoh: '211|74',
  geparst: { art: 'statusSetzen', ebene: '211', status: 74 },
  satz: 'Setze TV-Status (211) auf 74.',
});

/** Minimaler IDB-Doppelgänger — nur `get`/`set`, mehr braucht das Modul nicht. */
function fakeIdb(): { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn>; daten: Map<string, unknown> } {
  const daten = new Map<string, unknown>();
  return {
    daten,
    get: vi.fn(async (k: string) => daten.get(k)),
    set: vi.fn(async (k: string, v: unknown) => { daten.set(k, v); }),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Test-Doppelgänger statt echter IDBStore
const alsStore = (f: ReturnType<typeof fakeIdb>): any => f;

beforeEach(() => {
  leseSidecar.mockReset();
  schreibeSidecar.mockReset();
});

describe('istTriggerDatei', () => {
  it('lehnt alles ab, was nicht die erwartete Form hat', () => {
    expect(istTriggerDatei(null)).toBe(false);
    expect(istTriggerDatei({ format: 2, version: 1, trigger: [] })).toBe(false);
    expect(istTriggerDatei({ format: 1, version: 'x', trigger: [] })).toBe(false);
    expect(istTriggerDatei({ format: 1, version: 1 })).toBe(false);
    expect(istTriggerDatei({ format: 1, version: 1, trigger: [] })).toBe(true);
  });
});

describe('ladeTrigger', () => {
  it('nimmt den Share und aktualisiert dabei den Cache', async () => {
    const idb = fakeIdb();
    const datei = { format: 1, version: 3, importiertAm: 'x', importiertVon: 'MUE', trigger: [ZEILE('AAE', 1)] };
    leseSidecar.mockResolvedValue(datei);

    const stand = await ladeTrigger(alsStore(idb));
    expect(stand.herkunft).toBe('share');
    expect(stand.datei?.version).toBe(3);
    expect(idb.daten.get(TRIGGER_CACHE_KEY)).toEqual(datei);
  });

  it('fällt auf den Cache zurück UND sagt es', async () => {
    const idb = fakeIdb();
    const cache = { format: 1, version: 2, importiertAm: 'x', importiertVon: null, trigger: [] };
    idb.daten.set(TRIGGER_CACHE_KEY, cache);
    leseSidecar.mockResolvedValue(null);

    const stand = await ladeTrigger(alsStore(idb));
    expect(stand.herkunft).toBe('cache');
    expect(stand.datei?.version).toBe(2);
  });

  it('meldet „leer", wenn es weder Share noch Cache gibt', async () => {
    leseSidecar.mockResolvedValue(null);
    const stand = await ladeTrigger(alsStore(fakeIdb()));
    expect(stand).toEqual({ datei: null, herkunft: 'leer' });
  });

  it('überlebt einen werfenden Share-Zugriff und nutzt den Cache', async () => {
    const idb = fakeIdb();
    idb.daten.set(TRIGGER_CACHE_KEY, { format: 1, version: 1, importiertAm: 'x', importiertVon: null, trigger: [] });
    leseSidecar.mockRejectedValue(new Error('offline'));

    const stand = await ladeTrigger(alsStore(idb));
    expect(stand.herkunft).toBe('cache');
  });
});

describe('speichereTrigger', () => {
  it('schreibt erst lokal, dann auf den Share, und zählt die Fassung hoch', async () => {
    const idb = fakeIdb();
    schreibeSidecar.mockResolvedValue(true);

    const { datei, aufShare } = await speichereTrigger(
      alsStore(idb), [ZEILE('AAE', 1)], 'MUE', 2, '2026-08-01T00:00:00.000Z',
    );
    expect(aufShare).toBe(true);
    expect(datei.version).toBe(3);
    expect(datei.importiertVon).toBe('MUE');
    expect(idb.daten.get(TRIGGER_CACHE_KEY)).toEqual(datei);
  });

  it('behält die Arbeit lokal, wenn der Share nicht schreibbar ist', async () => {
    const idb = fakeIdb();
    schreibeSidecar.mockResolvedValue(false);

    const { datei, aufShare } = await speichereTrigger(
      alsStore(idb), [ZEILE('AAE', 1)], null, 0, '2026-08-01T00:00:00.000Z',
    );
    expect(aufShare).toBe(false);
    expect(idb.daten.get(TRIGGER_CACHE_KEY)).toEqual(datei);   // NICHT verloren
    expect(idb.set).toHaveBeenCalledBefore(schreibeSidecar as never);
  });
});

describe('triggerFuerKuerzel', () => {
  const tabelle = [ZEILE('AAE', 2), ZEILE('AAE', 1), ZEILE('ABB', 1)];

  it('liefert die Zeilen eines Kürzels in Folge-Reihenfolge', () => {
    expect(triggerFuerKuerzel(tabelle, 'AAE').map(t => t.folge)).toEqual([1, 2]);
  });

  it('vergleicht NFC-normalisiert und ohne Rücksicht auf Schreibweise', () => {
    expect(triggerFuerKuerzel(tabelle, ' aae ')).toHaveLength(2);
  });

  it('liefert für ein unbekanntes Kürzel eine leere Liste', () => {
    expect(triggerFuerKuerzel(tabelle, 'XYZ')).toEqual([]);
  });
});
