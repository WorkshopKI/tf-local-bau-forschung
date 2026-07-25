/**
 * Der Status-Katalog als Team-Datei. Der eigentliche Share-IO (atomicWrite /
 * queryPermission) braucht einen echten Verzeichnis-Handle und ist hier nicht
 * abgedeckt — geprüft werden die Struktur-Validierung und die Übernahme in den
 * lokalen Cache, weil dort die Datenverlust-Frage sitzt.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBStore } from '@/core/services/storage/idb-store';
import {
  istKatalogDatei, uebernehmeKatalogVomShare, KATALOG_BACKUP_KEY,
  type StatusKatalogDatei,
} from '@/core/status/katalog-share';
import {
  getAktiveVersionsnummer, listeVersionen, setzeAktiv, speichereVersion,
} from '@/core/status/katalog-store';
import { baueSeedVersion } from '@/core/status/seed';
import type { MappingVersion } from '@/core/status/typen';

beforeEach(async () => {
  const { IDBFactory } = await import('fake-indexeddb');
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});

async function frisch(): Promise<IDBStore> {
  const idb = new IDBStore();
  await idb.open();
  return idb;
}

function fassung(version: number, kommentar: string): MappingVersion {
  return { ...baueSeedVersion(), version, kommentar };
}

function datei(aktiv: number, fassungen: MappingVersion[]): StatusKatalogDatei {
  return { version: 1, aktiv, fassungen, updatedAt: '2026-07-25T00:00:00.000Z' };
}

describe('istKatalogDatei', () => {
  it('akzeptiert eine wohlgeformte Datei', () => {
    expect(istKatalogDatei(datei(1, [baueSeedVersion()]))).toBe(true);
  });

  it('lehnt fremdes Dateiformat, leere Fassungsliste und Strukturfehler ab', () => {
    expect(istKatalogDatei(null)).toBe(false);
    expect(istKatalogDatei({ version: 2, aktiv: 1, fassungen: [baueSeedVersion()] })).toBe(false);
    expect(istKatalogDatei({ version: 1, aktiv: 1, fassungen: [] })).toBe(false);
    expect(istKatalogDatei({ version: 1, aktiv: 1, fassungen: [{ version: 1 }] })).toBe(false);
    expect(istKatalogDatei({ version: 1, fassungen: [baueSeedVersion()] })).toBe(false);
  });
});

describe('uebernehmeKatalogVomShare', () => {
  it('schreibt die Team-Fassungen in den Cache und setzt den Aktiv-Zeiger', async () => {
    const idb = await frisch();
    await uebernehmeKatalogVomShare(idb, datei(2, [fassung(1, 'a'), fassung(2, 'b')]));
    expect((await listeVersionen(idb)).map(v => v.version)).toEqual([1, 2]);
    expect(await getAktiveVersionsnummer(idb)).toBe(2);
  });

  it('sichert den lokalen Stand einmalig, bevor gleichnummerige Fassungen überschrieben werden', async () => {
    const idb = await frisch();
    await speichereVersion(idb, fassung(1, 'lokal kuratiert'));
    await setzeAktiv(idb, 1);

    await uebernehmeKatalogVomShare(idb, datei(1, [fassung(1, 'team')]));

    const backup = await idb.get<{ fassungen: MappingVersion[] }>(KATALOG_BACKUP_KEY);
    expect(backup?.fassungen[0]?.kommentar).toBe('lokal kuratiert');
    // Die Team-Fassung gilt jetzt.
    expect((await listeVersionen(idb))[0]?.kommentar).toBe('team');
  });

  it('sichert nur beim ERSTEN Mal — ein zweiter Abgleich überschreibt die Sicherung nicht', async () => {
    const idb = await frisch();
    await speichereVersion(idb, fassung(1, 'original'));
    await setzeAktiv(idb, 1);
    await uebernehmeKatalogVomShare(idb, datei(1, [fassung(1, 'team A')]));
    await uebernehmeKatalogVomShare(idb, datei(1, [fassung(1, 'team B')]));

    const backup = await idb.get<{ fassungen: MappingVersion[] }>(KATALOG_BACKUP_KEY);
    expect(backup?.fassungen[0]?.kommentar).toBe('original');
  });

  it('lässt lokale Fassungen mit unbekannter Nummer stehen, statt sie zu verwerfen', async () => {
    const idb = await frisch();
    await speichereVersion(idb, fassung(7, 'nur lokal'));
    await setzeAktiv(idb, 7);

    await uebernehmeKatalogVomShare(idb, datei(2, [fassung(1, 'team'), fassung(2, 'team')]));

    const nummern = (await listeVersionen(idb)).map(v => v.version);
    expect(nummern).toContain(7);
    expect(await getAktiveVersionsnummer(idb)).toBe(2);
  });

  it('legt keine Sicherung an, wenn lokal noch nichts stand', async () => {
    const idb = await frisch();
    await uebernehmeKatalogVomShare(idb, datei(1, [fassung(1, 'team')]));
    expect(await idb.get(KATALOG_BACKUP_KEY)).toBeNull();
  });

  it('fällt auf die erste Fassung zurück, wenn der Aktiv-Zeiger ins Leere zeigt', async () => {
    const idb = await frisch();
    await uebernehmeKatalogVomShare(idb, datei(99, [fassung(3, 'team')]));
    expect(await getAktiveVersionsnummer(idb)).toBe(3);
  });
});
