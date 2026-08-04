/**
 * Der Status-Katalog als Team-Datei — mit mehreren Schreibern.
 *
 * Der Share ist hier gespiegelt (`share.datei`), die IndexedDB echt: die
 * Datenverlust-Frage sitzt genau zwischen beiden. Geprüft wird, dass keine
 * fremde Fassung verschwindet — weder beim Schreiben noch beim bewussten
 * Übergehen des Konflikts — und dass nichts geschrieben wird, solange der
 * Konflikt offen ist.
 *
 * Der echte Datei-IO (atomicWrite / queryPermission) braucht einen echten
 * Verzeichnis-Handle und bleibt außen vor; er ist eine Ebene tiefer
 * (`sidecar-datei.ts`) und für alle Sidecars derselbe.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBStore } from '@/core/services/storage/idb-store';
import type { StatusKatalogDatei } from '@/core/status/katalog-share';
import type { MappingVersion } from '@/core/status/typen';

/** Der gespiegelte Share: eine Datei, ein Schreibrecht, ein Beobachtungshaken. */
const share: {
  datei: StatusKatalogDatei | null;
  geschrieben: StatusKatalogDatei[];
  schreibrecht: boolean;
  /** Simuliert ein anderes Gerät, das zwischen Vereinigung und Schreiben fertig wird. */
  beimKopfLesen?: () => void;
  kopfLesungen: number;
} = { datei: null, geschrieben: [], schreibrecht: true, kopfLesungen: 0 };

vi.mock('@/core/status/sidecar-datei', () => ({
  leseSidecar: (): Promise<unknown> => Promise.resolve(share.datei),
  schreibeSidecar: (_idb: unknown, _pfad: string, daten: unknown): Promise<boolean> => {
    if (!share.schreibrecht) return Promise.resolve(false);
    share.datei = daten as StatusKatalogDatei;
    share.geschrieben.push(daten as StatusKatalogDatei);
    return Promise.resolve(true);
  },
  leseSidecarKopf: (_idb: unknown, _pfad: string, bytes: number): Promise<string | null> => {
    share.kopfLesungen += 1;
    share.beimKopfLesen?.();
    return Promise.resolve(
      share.datei ? JSON.stringify(share.datei, null, 2).slice(0, bytes) : null,
    );
  },
}));

const {
  istKatalogDatei, uebernehmeKatalogVomShare, synchronisiereKatalogVomShare,
  schreibeKatalogAufShare, vereinigeMitShare, umnummeriereEigeneFassung,
  KATALOG_BACKUP_KEY,
} = await import('@/core/status/katalog-share');
const {
  getAktiveVersionsnummer, listeVersionen, setzeAktiv, speichereVersion, naechsteVersionsnummer,
} = await import('@/core/status/katalog-store');
const { baueSeedVersion } = await import('@/core/status/seed');

beforeEach(async () => {
  const { IDBFactory } = await import('fake-indexeddb');
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  share.datei = null;
  share.geschrieben = [];
  share.schreibrecht = true;
  share.beimKopfLesen = undefined;
  share.kopfLesungen = 0;
});

async function frisch(): Promise<IDBStore> {
  const idb = new IDBStore();
  await idb.open();
  return idb;
}

function fassung(version: number, kommentar: string): MappingVersion {
  return { ...baueSeedVersion(), version, kommentar };
}

/** Schlanke Fassung — für alles, was nicht am Seed-Inhalt hängt. */
function leicht(version: number, autor: string, minute = version): MappingVersion {
  return {
    version,
    autor,
    zeitstempel: `2026-08-04T14:${String(minute).padStart(2, '0')}:00.000Z`,
    felder: [],
    werte: [],
  };
}

function datei(aktiv: number, fassungen: MappingVersion[]): StatusKatalogDatei {
  return { version: 1, aktiv, fassungen, updatedAt: '2026-07-25T00:00:00.000Z' };
}

/** Ausgangslage: lokal v12 aktiv, auf dem Share zusätzlich TPs v13. */
async function ausgangslage(): Promise<IDBStore> {
  const idb = await frisch();
  await speichereVersion(idb, leicht(12, 'AB'));
  await setzeAktiv(idb, 12);
  share.datei = datei(13, [leicht(12, 'AB'), leicht(13, 'TP', 20)]);
  return idb;
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

describe('vereinigeMitShare (Vorschritt vor der Nummernvergabe)', () => {
  it('holt die fremde Fassung in den lokalen Cache', async () => {
    const idb = await ausgangslage();
    const { uebernommen } = await vereinigeMitShare(idb);
    expect(uebernommen).toEqual([13]);
    expect((await listeVersionen(idb)).map(v => v.version)).toEqual([12, 13]);
  });

  it('verhindert, dass dieselbe Nummer zweimal vergeben wird', async () => {
    const idb = await ausgangslage();
    expect(await naechsteVersionsnummer(idb), 'ohne Vereinigung').toBe(13);
    await vereinigeMitShare(idb);
    expect(await naechsteVersionsnummer(idb), 'nach der Vereinigung').toBe(14);
  });

  it('ist ohne Share ein No-op', async () => {
    const idb = await frisch();
    share.datei = null;
    expect(await vereinigeMitShare(idb)).toEqual({ datei: null, uebernommen: [] });
  });
});

describe('schreibeKatalogAufShare (read-before-write)', () => {
  it('nimmt eine lokal unbekannte fremde Fassung in Datei UND Cache auf', async () => {
    const idb = await frisch();
    await speichereVersion(idb, leicht(12, 'AB'));
    await setzeAktiv(idb, 12);
    share.datei = datei(11, [leicht(11, 'TP', 5), leicht(12, 'AB')]);

    const ergebnis = await schreibeKatalogAufShare(idb, { basisVersion: 12 });

    expect(ergebnis.art).toBe('geschrieben');
    expect((await listeVersionen(idb)).map(v => v.version)).toEqual([11, 12]);
    expect(share.geschrieben[0]?.fassungen.map(f => f.version)).toEqual([11, 12]);
  });

  it('schreibt NICHT, wenn jemand zwischenzeitlich veröffentlicht hat', async () => {
    const idb = await ausgangslage();

    const ergebnis = await schreibeKatalogAufShare(idb, { basisVersion: 12 });

    expect(ergebnis).toEqual({
      art: 'konflikt',
      konflikt: {
        fremde: { version: 13, autor: 'TP', zeitstempel: '2026-08-04T14:20:00.000Z' },
        basis: 12,
        grund: 'neuer-stand',
      },
    });
    expect(share.geschrieben, 'nichts geschrieben').toEqual([]);
    // Die eigene Arbeit steht unverändert im Cache — und die fremde ist trotz
    // des Konflikts übernommen, damit ihr Rückweg offen bleibt.
    const nummern = (await listeVersionen(idb)).map(v => v.version);
    expect(nummern).toEqual([12, 13]);
  });

  it('„trotzdem veröffentlichen": eigene Nummer oben, fremde Fassung bleibt in der Datei', async () => {
    const idb = await ausgangslage();
    // So läuft der echte Ablauf: vereinigen, hochzählen, lokal festschreiben.
    await vereinigeMitShare(idb);
    const nr = await naechsteVersionsnummer(idb);
    await speichereVersion(idb, leicht(nr, 'AB', 30));
    await setzeAktiv(idb, nr);

    const ergebnis = await schreibeKatalogAufShare(idb, { basisVersion: nr });

    expect(ergebnis.art).toBe('geschrieben');
    expect(nr).toBe(14);
    const geschrieben = share.geschrieben[0]!;
    expect(geschrieben.aktiv).toBe(14);
    expect(geschrieben.fassungen.map(f => f.version)).toEqual([12, 13, 14]);
  });

  it('meldet einen Konflikt, wenn der Aktiv-Zeiger sich zwischen Prüfung und Schreiben bewegt', async () => {
    const idb = await ausgangslage();
    await vereinigeMitShare(idb);
    await speichereVersion(idb, leicht(14, 'AB', 30));
    await setzeAktiv(idb, 14);
    // Genau in dem Moment, in dem die späte Nachprüfung liest, wird der Share
    // fremd fortgeschrieben.
    share.beimKopfLesen = () => {
      if (share.kopfLesungen > 1) return;
      share.datei = datei(15, [leicht(12, 'AB'), leicht(13, 'TP', 20), leicht(15, 'TP', 40)]);
    };

    const ergebnis = await schreibeKatalogAufShare(idb, { basisVersion: 14 });

    expect(ergebnis.art).toBe('konflikt');
    expect(share.geschrieben, 'nichts geschrieben').toEqual([]);
    expect((await listeVersionen(idb)).map(v => v.version)).toContain(15);
  });

  it('ohne Share bleibt es beim bisherigen Verhalten — nur lokal, kein Konflikt', async () => {
    const idb = await frisch();
    await speichereVersion(idb, leicht(12, 'AB'));
    await setzeAktiv(idb, 12);
    share.datei = null;
    share.schreibrecht = false;

    expect(await schreibeKatalogAufShare(idb, { basisVersion: 12 })).toEqual({ art: 'nur-lokal' });
  });

  it('meldet dieselbe Nummer mit anderem Inhalt, statt eine der beiden zu verlieren', async () => {
    const idb = await frisch();
    await speichereVersion(idb, leicht(13, 'AB', 0));
    await setzeAktiv(idb, 13);
    share.datei = datei(13, [leicht(13, 'TP', 20)]);

    const ergebnis = await schreibeKatalogAufShare(idb, { basisVersion: 13 });

    expect(ergebnis.art === 'konflikt' && ergebnis.konflikt.grund).toBe('nummern-kollision');
    expect(share.geschrieben).toEqual([]);
  });
});

describe('Auflösung der beiden Wege', () => {
  it('„fremde Fassung laden" aktiviert die fremde Fassung', async () => {
    const idb = await ausgangslage();
    await synchronisiereKatalogVomShare(idb);
    expect(await getAktiveVersionsnummer(idb)).toBe(13);
    expect((await listeVersionen(idb)).map(v => v.version)).toEqual([12, 13]);
  });

  it('Umnummerieren rettet beide Fassungen aus einer Nummern-Kollision', async () => {
    const idb = await frisch();
    await speichereVersion(idb, leicht(13, 'AB', 0));
    await setzeAktiv(idb, 13);
    const fremd = leicht(13, 'TP', 20);

    const neueNr = await umnummeriereEigeneFassung(idb, 13, fremd);

    expect(neueNr).toBe(14);
    const alle = await listeVersionen(idb);
    expect(alle.map(v => v.version)).toEqual([13, 14]);
    expect(alle.find(v => v.version === 13)?.autor, 'die fremde behält ihre Nummer').toBe('TP');
    expect(alle.find(v => v.version === 14)?.autor, 'die eigene wandert nach oben').toBe('AB');
    expect(await getAktiveVersionsnummer(idb), 'aktiv folgt der eigenen').toBe(14);
  });
});
