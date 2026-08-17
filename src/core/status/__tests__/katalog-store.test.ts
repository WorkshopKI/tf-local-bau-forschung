/**
 * Persistenz des Status-Katalogs gegen fake-indexeddb (IDBStore v11). Läuft im
 * Projekt `isolated` (frische IDB-Welt je Test).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBStore } from '@/core/services/storage/idb-store';
import {
  ladeAktiveVersion, ladeGespeicherteFassung, sorgeFuerGespeicherteFassung,
  listeVersionen, speichereVersion, getVersion,
  setzeAktiv, getAktiveVersionsnummer, naechsteVersionsnummer,
  ladeUnkuratiert, speichereUnkuratiert,
} from '@/core/status/katalog-store';
import { baueSeedVersion } from '@/core/status/seed';
import type { UnkuratierterFund } from '@/core/status/typen';

async function frisch(): Promise<IDBStore> {
  const idb = new IDBStore();
  await idb.open();
  return idb;
}

beforeEach(async () => {
  const { IDBFactory } = await import('fake-indexeddb');
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});

describe('Katalog-Store', () => {
  it('sorgeFuerGespeicherteFassung seedet Version 1 und aktiviert sie', async () => {
    const idb = await frisch();
    const v = await sorgeFuerGespeicherteFassung(idb);
    expect(v.version).toBe(1);
    expect(await getAktiveVersionsnummer(idb)).toBe(1);
    expect(await listeVersionen(idb)).toHaveLength(1);
  });

  // Der Kaltstart-Fall: `initStatusKatalog` und `ensureListViewProjection`
  // lesen, BEVOR der Ordner freigegeben ist. Schriebe das Lesen den Seed fest,
  // wäre der Auslieferungsstand die kuratierte Fassung 1 (siehe v4.85.1).
  it('ladeAktiveVersion liefert den Seed, ohne ihn abzulegen', async () => {
    const idb = await frisch();
    const v = await ladeAktiveVersion(idb);
    expect(v.version).toBe(1);
    expect(await getAktiveVersionsnummer(idb)).toBeNull();
    expect(await listeVersionen(idb)).toHaveLength(0);
    expect(await ladeGespeicherteFassung(idb)).toBeNull();
  });

  it('lädt beim zweiten Mal die gespeicherte Fassung (kein Re-Seed)', async () => {
    const idb = await frisch();
    await sorgeFuerGespeicherteFassung(idb);
    // Aktive Version editieren (Kommentar) und als v1 zurückschreiben.
    const v1 = await getVersion(idb, 1);
    expect(v1).not.toBeNull();
    await speichereVersion(idb, { ...v1!, kommentar: 'editiert' });
    expect((await ladeAktiveVersion(idb)).kommentar).toBe('editiert');
    expect((await sorgeFuerGespeicherteFassung(idb)).kommentar).toBe('editiert');
    expect(await listeVersionen(idb)).toHaveLength(1);
  });

  it('speichert neue Versionen und aktiviert sie', async () => {
    const idb = await frisch();
    await sorgeFuerGespeicherteFassung(idb);
    const nr = await naechsteVersionsnummer(idb);
    expect(nr).toBe(2);
    const v2 = { ...baueSeedVersion(), version: nr, kommentar: 'v2' };
    await speichereVersion(idb, v2);
    await setzeAktiv(idb, nr);
    expect(await getAktiveVersionsnummer(idb)).toBe(2);
    expect((await ladeAktiveVersion(idb)).kommentar).toBe('v2');
    expect(await listeVersionen(idb)).toHaveLength(2);
  });

  it('puffert Unkuratiertes im kv-Key (roundtrip)', async () => {
    const idb = await frisch();
    expect(await ladeUnkuratiert(idb)).toEqual([]);
    const funde: UnkuratierterFund[] = [
      { id: 'status::sonderfall', feldId: 'status', wert: 'Sonderfall', erstmalsGesehen: '2026-07-24T00:00:00.000Z' },
    ];
    await speichereUnkuratiert(idb, funde);
    expect(await ladeUnkuratiert(idb)).toEqual(funde);
  });
});
