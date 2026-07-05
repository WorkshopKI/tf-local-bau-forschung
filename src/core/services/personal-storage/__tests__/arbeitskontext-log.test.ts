import { describe, it, expect } from 'vitest';
import type { IDBStore } from '@/core/services/storage/idb-store';
import {
  mergeArbeitskontext,
  logArbeitskontext,
  listeArbeitskontext,
  clearArbeitskontextLog,
  ARBEITSKONTEXT_LOG_IDB_KEY,
  type ArbeitskontextEintrag,
} from '../arbeitskontext-log';

function eintrag(over: Partial<ArbeitskontextEintrag> = {}): ArbeitskontextEintrag {
  return { typ: 'gutachten', verbundKey: 'VB1', ts: '2026-07-01T10:00:00.000Z', ...over };
}

/** Minimaler In-Memory-IDBStore (nur get/set/delete) — reicht für das Log. */
function makeMockIdb(): IDBStore {
  const store = new Map<string, unknown>();
  return {
    get: async <T>(key: string) => (store.has(key) ? (store.get(key) as T) : null),
    set: async (key: string, value: unknown) => { store.set(key, value); },
    delete: async (key: string) => { store.delete(key); },
  } as unknown as IDBStore;
}

describe('mergeArbeitskontext (Kernlogik)', () => {
  it('dedupliziert pro (typ, verbundKey) — nur der jüngste bleibt', () => {
    const alt = eintrag({ abschnittId: 'A', ts: '2026-07-01T09:00:00.000Z' });
    const neu = eintrag({ abschnittId: 'B', ts: '2026-07-01T11:00:00.000Z' });
    const out = mergeArbeitskontext([alt], neu);
    expect(out).toHaveLength(1);
    expect(out[0]!.abschnittId).toBe('B');
  });

  it('trennt nach typ — gleicher verbundKey, anderer typ bleibt erhalten', () => {
    const ga = eintrag({ typ: 'gutachten' });
    const nf = eintrag({ typ: 'nachforderung', ts: '2026-07-02T10:00:00.000Z' });
    const out = mergeArbeitskontext([ga], nf);
    expect(out).toHaveLength(2);
    expect(out.map(e => e.typ)).toEqual(['nachforderung', 'gutachten']);
  });

  it('sortiert jüngste zuerst', () => {
    const a = eintrag({ verbundKey: 'A', ts: '2026-07-01T08:00:00.000Z' });
    const b = eintrag({ verbundKey: 'B', ts: '2026-07-03T08:00:00.000Z' });
    const c = eintrag({ verbundKey: 'C', ts: '2026-07-02T08:00:00.000Z' });
    const out = mergeArbeitskontext([a, c], b);
    expect(out.map(e => e.verbundKey)).toEqual(['B', 'C', 'A']);
  });

  it('kappt auf cap (älteste fallen raus)', () => {
    const bestehend = Array.from({ length: 5 }, (_, i) =>
      eintrag({ verbundKey: `V${i}`, ts: `2026-07-01T0${i}:00:00.000Z` }));
    const neu = eintrag({ verbundKey: 'NEU', ts: '2026-07-09T00:00:00.000Z' });
    const out = mergeArbeitskontext(bestehend, neu, 3);
    expect(out).toHaveLength(3);
    expect(out[0]!.verbundKey).toBe('NEU');
    // Der älteste (V0) darf nicht mehr enthalten sein.
    expect(out.some(e => e.verbundKey === 'V0')).toBe(false);
  });
});

describe('logArbeitskontext / listeArbeitskontext / clear (IDB)', () => {
  it('schreibt unter dem lokalen Key und liest jüngste zuerst', async () => {
    const idb = makeMockIdb();
    await logArbeitskontext(idb, eintrag({ verbundKey: 'A', ts: '2026-07-01T00:00:00.000Z' }));
    await logArbeitskontext(idb, eintrag({ typ: 'kurzfassung', verbundKey: 'B', ts: '2026-07-02T00:00:00.000Z' }));
    const list = await listeArbeitskontext(idb);
    expect(list.map(e => e.verbundKey)).toEqual(['B', 'A']);
    // Der persistierte Wert liegt unter dem erwarteten (rein lokalen) Key.
    const raw = await idb.get<ArbeitskontextEintrag[]>(ARBEITSKONTEXT_LOG_IDB_KEY);
    expect(Array.isArray(raw)).toBe(true);
  });

  it('respektiert das limit', async () => {
    const idb = makeMockIdb();
    for (let i = 0; i < 5; i++) {
      await logArbeitskontext(idb, eintrag({ verbundKey: `V${i}`, ts: `2026-07-0${i + 1}T00:00:00.000Z` }));
    }
    const list = await listeArbeitskontext(idb, 3);
    expect(list).toHaveLength(3);
  });

  it('clear leert das Log', async () => {
    const idb = makeMockIdb();
    await logArbeitskontext(idb, eintrag());
    await clearArbeitskontextLog(idb);
    expect(await listeArbeitskontext(idb)).toEqual([]);
  });

  it('toleriert kaputten/leeren Store (kein Wurf)', async () => {
    const idb = makeMockIdb();
    await idb.set(ARBEITSKONTEXT_LOG_IDB_KEY, 'kein-array');
    expect(await listeArbeitskontext(idb)).toEqual([]);
  });
});
