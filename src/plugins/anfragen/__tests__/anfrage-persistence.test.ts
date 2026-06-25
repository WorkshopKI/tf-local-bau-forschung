/**
 * Phase 1 — `Anfrage`-Persistenz im generischen kv-Store (Prefix `anfrage:`).
 * Nutzt fake-indexeddb; Welt vor jedem Test resetten.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBStore } from '@/core/services/storage';
import { createAnfrage, deleteAnfrage, getAnfrage, listAnfragen, putAnfrage } from '../persistence';

async function freshIdb(): Promise<IDBStore> {
  const s = new IDBStore();
  await s.open();
  return s;
}

beforeEach(async () => {
  const { IDBFactory } = await import('fake-indexeddb');
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});

describe('Anfrage-Persistenz (kv-Store, Prefix anfrage:)', () => {
  it('round-trip: put → get liefert die identische Anfrage (Defaults gesetzt)', async () => {
    const idb = await freshIdb();
    const a = createAnfrage(
      { absenderEmail: 'x@y.de', betreff: 'Re: Test', hatAnhaenge: 2, originalMd: '# Body' },
      '2026-06-25T10:00:00.000Z',
    );
    await putAnfrage(idb, a);
    const back = await getAnfrage(idb, a.id);
    expect(back).toEqual(a);
    expect(back?.status).toBe('aufgenommen');
    expect(back?.mapping).toEqual([]);
    expect(back?.finaleAntwort).toBe('');
  });

  it('listAnfragen liefert alle, neueste (erstelltAm) zuerst', async () => {
    const idb = await freshIdb();
    const alt = createAnfrage({ absenderEmail: 'a@a.de', betreff: 'alt', hatAnhaenge: 0, originalMd: '' }, '2026-06-20T08:00:00.000Z');
    const neu = createAnfrage({ absenderEmail: 'b@b.de', betreff: 'neu', hatAnhaenge: 0, originalMd: '' }, '2026-06-25T08:00:00.000Z');
    await putAnfrage(idb, alt);
    await putAnfrage(idb, neu);
    const list = await listAnfragen(idb);
    expect(list.map(x => x.betreff)).toEqual(['neu', 'alt']);
  });

  it('deleteAnfrage entfernt nur den Ziel-Key', async () => {
    const idb = await freshIdb();
    const a = createAnfrage({ absenderEmail: 'a@a.de', betreff: 'A', hatAnhaenge: 0, originalMd: '' });
    const b = createAnfrage({ absenderEmail: 'b@b.de', betreff: 'B', hatAnhaenge: 0, originalMd: '' });
    await putAnfrage(idb, a);
    await putAnfrage(idb, b);
    await deleteAnfrage(idb, a.id);
    expect(await getAnfrage(idb, a.id)).toBeNull();
    expect(await getAnfrage(idb, b.id)).not.toBeNull();
  });

  it('listAnfragen ignoriert fremde kv-Keys (kein Store-Bruch)', async () => {
    const idb = await freshIdb();
    await idb.set('doc:foo', { id: 'foo' });
    await idb.set('workflow-run:ga:az-1', { aktenzeichen: 'az-1' });
    const a = createAnfrage({ absenderEmail: 'a@a.de', betreff: 'A', hatAnhaenge: 0, originalMd: '' });
    await putAnfrage(idb, a);
    expect((await listAnfragen(idb)).length).toBe(1);
    expect(await idb.get('doc:foo')).toEqual({ id: 'foo' });
  });
});
