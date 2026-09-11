/**
 * Der Abgleich der Status-Fassung mit dem Share — bei jeder Datenaktualisierung.
 *
 * `initStatusKatalog` läuft in `App.tsx` VOR dem Ordner-Picker: auf einer
 * frischen Installation gibt es dort kein Handle, nach einem Browser-Neustart
 * steht die FSAPI-Berechtigung unter `file://` wieder auf `prompt`. Bis v6.57.2
 * setzte deshalb EIN Nachlauf nach dem Grant nach — und dabei blieb es für die
 * Sitzung: eine tagsüber veröffentlichte Fassung sah ein anderer Rechner erst
 * beim nächsten Start. `holeNeuereFassung` läuft jetzt am Anfang jeder
 * Datenaktualisierung (über `zieheFassungNach`).
 *
 * Der Share ist gespiegelt wie in `katalog-share.test.ts`, die IndexedDB echt.
 * Läuft im Projekt `isolated`: der Abgleich führt einen Lauf-Merker im Modul.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBStore } from '@/core/services/storage/idb-store';
import type { StatusKatalogDatei } from '@/core/status/katalog-share';
import type { MappingVersion } from '@/core/status/typen';

const HAUPT = '_intern/status-katalog.json';

// Ohne den Flag ist die ganze Schicht ein No-op — hier geht es um ihr Verhalten.
vi.mock('@/config/feature-flags', async importActual => {
  const actual = await importActual<typeof import('@/config/feature-flags')>();
  return { ...actual, isStatusCockpitEnabled: () => true };
});

const share: {
  /** `null` = kein Handle oder keine Datei (beides „nichts zu holen"). */
  datei: StatusKatalogDatei | null;
  /** Datei da, aber nicht lesbar — der Kaltstart mit Permission auf `prompt`. */
  lesbar: boolean;
  vollLesungen: number;
  kopfLesungen: number;
} = { datei: null, lesbar: true, vollLesungen: 0, kopfLesungen: 0 };

vi.mock('@/core/status/sidecar-datei', () => ({
  leseSidecar: (_idb: unknown, pfad: string): Promise<unknown> => {
    if (pfad !== HAUPT) return Promise.resolve(null);
    share.vollLesungen += 1;
    return Promise.resolve(share.lesbar ? share.datei : null);
  },
  leseSidecarLage: (_idb: unknown, pfad: string): Promise<unknown> => {
    if (pfad !== HAUPT) return Promise.resolve({ status: 'leer' });
    if (!share.lesbar) return Promise.resolve({ status: 'unlesbar' });
    share.vollLesungen += 1;
    return Promise.resolve(
      share.datei == null ? { status: 'leer' } : { status: 'ok', daten: share.datei },
    );
  },
  leseSidecarKopf: (_idb: unknown, _pfad: string, bytes: number): Promise<string | null> => {
    share.kopfLesungen += 1;
    if (!share.lesbar || !share.datei) return Promise.resolve(null);
    return Promise.resolve(JSON.stringify(share.datei, null, 2).slice(0, bytes));
  },
  schreibeSidecar: (): Promise<boolean> => Promise.resolve(false),
}));

const {
  initStatusKatalog, holeNeuereFassung, resetKatalogNachlaufFuerTests,
  getAktiveVersion, setStatusKatalogSnapshot, getAktiveVersionsnummer,
} = await import('@/core/status');
const { baueSeedVersion } = await import('@/core/status/seed');

/** Eine Team-Fassung, erkennbar an Nummer und Kommentar. */
function fassung(nr: number): MappingVersion {
  return { ...baueSeedVersion(), version: nr, kommentar: `Team-Fassung ${nr}` };
}

function teamDatei(nr: number, weitere: number[] = []): StatusKatalogDatei {
  return {
    version: 1,
    aktiv: nr,
    fassungen: [...weitere.map(fassung), fassung(nr)],
    updatedAt: '2026-08-01T00:00:00.000Z',
  };
}

async function frisch(): Promise<IDBStore> {
  const idb = new IDBStore();
  await idb.open();
  return idb;
}

beforeEach(async () => {
  const { IDBFactory } = await import('fake-indexeddb');
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  share.datei = null;
  share.lesbar = true;
  share.vollLesungen = 0;
  share.kopfLesungen = 0;
  resetKatalogNachlaufFuerTests();
  setStatusKatalogSnapshot(null);
});

// Der Snapshot ist ein Modul-Register (Phasen, Kategorien, Code-Schnitt). Wer
// ihn setzt, räumt ihn weg — sonst liest die nächste Datei im selben Worker die
// Fassung dieser Tests statt der Auslieferung.
afterEach(() => {
  setStatusKatalogSnapshot(null);
  resetKatalogNachlaufFuerTests();
});

describe('Fassungs-Abgleich mit dem Share', () => {
  it('holt die Team-Fassung, wenn der Startlauf vor dem Grant leer ausging', async () => {
    const idb = await frisch();
    // Kaltstart: Datei liegt da, ist aber (noch) nicht lesbar.
    share.datei = teamDatei(7);
    share.lesbar = false;
    await initStatusKatalog(idb);
    expect(getAktiveVersion()?.version).toBe(1);
    expect(await getAktiveVersionsnummer(idb)).toBeNull();

    // Jetzt ist der Ordner freigegeben — die erste Datenaktualisierung holt nach.
    share.lesbar = true;
    expect(await holeNeuereFassung(idb)).toBe(7);
    expect(getAktiveVersion()?.version).toBe(7);
    expect(getAktiveVersion()?.kommentar).toBe('Team-Fassung 7');
    expect(await getAktiveVersionsnummer(idb)).toBe(7);
  });

  it('holt eine Fassung, die im Lauf der Sitzung veröffentlicht wurde', async () => {
    // Der gemeldete Fall: die Projektleitung veröffentlicht tagsüber, dieser
    // Rechner läuft seit dem Morgen. Bis v6.57.2 sah er Fassung 5 erst beim
    // nächsten Start.
    const idb = await frisch();
    share.datei = teamDatei(4);
    await initStatusKatalog(idb);
    expect(getAktiveVersion()?.version).toBe(4);

    share.datei = teamDatei(5, [4]);
    expect(await holeNeuereFassung(idb)).toBe(5);
    expect(getAktiveVersion()?.kommentar).toBe('Team-Fassung 5');
    expect(await getAktiveVersionsnummer(idb)).toBe(5);
  });

  it('liest bei gleicher Nummer nur den Dateikopf — bei jedem Lauf', async () => {
    const idb = await frisch();
    share.datei = teamDatei(4);
    await initStatusKatalog(idb);
    const voll = share.vollLesungen;

    expect(await holeNeuereFassung(idb)).toBeNull();
    expect(await holeNeuereFassung(idb)).toBeNull();
    expect(share.kopfLesungen).toBe(2);
    expect(share.vollLesungen).toBe(voll);
  });

  it('liest nur den Dateikopf, wenn es nichts zu holen gibt', async () => {
    const idb = await frisch();
    share.lesbar = false;
    await initStatusKatalog(idb);
    const vorher = share.vollLesungen;

    expect(await holeNeuereFassung(idb)).toBeNull();
    expect(share.kopfLesungen).toBe(1);
    expect(share.vollLesungen).toBe(vorher);
    expect(getAktiveVersion()?.version).toBe(1);
  });

  it('läuft nicht zweimal nebeneinander', async () => {
    const idb = await frisch();
    share.datei = teamDatei(7);
    share.lesbar = false;
    await initStatusKatalog(idb);

    share.lesbar = true;
    const ergebnisse = await Promise.all([holeNeuereFassung(idb), holeNeuereFassung(idb)]);
    expect(ergebnisse.filter(e => e !== null)).toEqual([7]);
    expect(share.kopfLesungen).toBe(1);
  });

  it('zieht die kuratierten ZAH-Phasen mit, nicht nur die Kürzel', async () => {
    const idb = await frisch();
    const kuratiert = fassung(9);
    kuratiert.zahPhasen = [
      { id: 'eigene', label: 'Vom Team benannt', reihenfolge: 1 },
    ];
    share.datei = { version: 1, aktiv: 9, fassungen: [kuratiert], updatedAt: 'x' };
    share.lesbar = false;
    await initStatusKatalog(idb);
    const { zahPhasenVon } = await import('@/core/status');
    expect(zahPhasenVon().some(p => p.id === 'eigene')).toBe(false);

    share.lesbar = true;
    await holeNeuereFassung(idb);
    expect(zahPhasenVon().some(p => p.id === 'eigene')).toBe(true);
  });
});
