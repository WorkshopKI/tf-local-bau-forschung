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

const HAUPT = '_intern/status-katalog.json';
const ARCHIV = '_intern/status-katalog-archiv.json';

/**
 * Der gespiegelte Share. Seit der Rotation (v2.414) liegen dort ZWEI Dateien,
 * deshalb ein Ablagefach je Pfad — `datei` bleibt als Kurzform für die
 * Hauptdatei, damit die älteren Fälle unverändert lesbar sind.
 *
 * `archivSchreibrecht` getrennt vom allgemeinen: „das Archiv lässt sich nicht
 * schreiben" ist der Fall, in dem NICHT rotiert werden darf.
 */
const share: {
  dateien: Map<string, unknown>;
  datei: StatusKatalogDatei | null;
  geschrieben: StatusKatalogDatei[];
  schreibrecht: boolean;
  archivSchreibrecht: boolean;
  /** Das Archiv IST da, ließ sich aber nicht lesen (SMB-Aussetzer, kaputtes
   *  JSON). Getrennt vom Schreibrecht, weil es der andere Weg in denselben
   *  Verlust ist — siehe die Rotations-Tests. */
  archivLesbar: boolean;
  /** Simuliert ein anderes Gerät, das zwischen Vereinigung und Schreiben fertig wird. */
  beimKopfLesen?: () => void;
  kopfLesungen: number;
} = {
  dateien: new Map(), datei: null, geschrieben: [],
  schreibrecht: true, archivSchreibrecht: true, archivLesbar: true, kopfLesungen: 0,
};

vi.mock('@/core/status/sidecar-datei', () => ({
  leseSidecar: (_idb: unknown, pfad: string): Promise<unknown> =>
    Promise.resolve(pfad === ARCHIV ? (share.dateien.get(ARCHIV) ?? null) : share.datei),
  leseSidecarLage: (_idb: unknown, pfad: string): Promise<unknown> => {
    if (pfad === ARCHIV && !share.archivLesbar) return Promise.resolve({ status: 'unlesbar' });
    const daten = pfad === ARCHIV ? share.dateien.get(ARCHIV) : share.datei;
    return Promise.resolve(daten == null ? { status: 'leer' } : { status: 'ok', daten });
  },
  schreibeSidecar: (_idb: unknown, pfad: string, daten: unknown): Promise<boolean> => {
    if (pfad === ARCHIV) {
      if (!share.schreibrecht || !share.archivSchreibrecht) return Promise.resolve(false);
      share.dateien.set(ARCHIV, daten);
      return Promise.resolve(true);
    }
    if (!share.schreibrecht) return Promise.resolve(false);
    share.datei = daten as StatusKatalogDatei;
    share.dateien.set(HAUPT, daten);
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
  leseKatalogArchiv, KATALOG_BACKUP_KEY,
} = await import('@/core/status/katalog-share');
const { FASSUNGEN_IN_HAUPTDATEI } = await import('@/core/status/katalog-rotation');
const {
  getAktiveVersionsnummer, listeVersionen, setzeAktiv, speichereVersion, naechsteVersionsnummer,
} = await import('@/core/status/katalog-store');
const { baueSeedVersion } = await import('@/core/status/seed');

beforeEach(async () => {
  const { IDBFactory } = await import('fake-indexeddb');
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  share.datei = null;
  share.dateien = new Map();
  share.archivSchreibrecht = true;
  share.archivLesbar = true;
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

describe('Rotation der Fassungsdatei (v2.414)', () => {
  /** n Fassungen lokal ablegen, die letzte aktiv setzen. */
  async function lokalerBestand(n: number, aktiv = n): Promise<void> {
    const idb = await frisch();
    for (let i = 1; i <= n; i += 1) await speichereVersion(idb, { ...leicht(i, 'MUE') });
    await setzeAktiv(idb, aktiv);
  }

  it('unterhalb der Schwelle wird nicht rotiert — kein Archiv angelegt', async () => {
    const idb = await frisch();
    await lokalerBestand(FASSUNGEN_IN_HAUPTDATEI);
    const e = await schreibeKatalogAufShare(idb, {});
    expect(e.art).toBe('geschrieben');
    expect(share.datei?.fassungen).toHaveLength(FASSUNGEN_IN_HAUPTDATEI);
    expect(await leseKatalogArchiv(idb), 'kein Archiv ohne Anlass').toBeNull();
  });

  it('oberhalb bleiben genau n in der Hauptdatei, der Rest steht im Archiv', async () => {
    const idb = await frisch();
    await lokalerBestand(12);
    await schreibeKatalogAufShare(idb, {});
    expect(share.datei?.fassungen.map(f => f.version)).toEqual([5, 6, 7, 8, 9, 10, 11, 12]);
    const archiv = await leseKatalogArchiv(idb);
    expect(archiv?.fassungen.map(f => f.version)).toEqual([1, 2, 3, 4]);
  });

  it('Haupt- und Archivdatei zusammen sind lueckenlos', async () => {
    // Die Invariante, an der alles haengt: die Versionierung existiert, damit
    // man zurueckkann. Eine Rotation, die das nimmt, waere eine Loeschfunktion.
    const idb = await frisch();
    await lokalerBestand(15);
    await schreibeKatalogAufShare(idb, {});
    const archiv = await leseKatalogArchiv(idb);
    const alle = [
      ...(share.datei?.fassungen ?? []), ...(archiv?.fassungen ?? []),
    ].map(f => f.version).sort((a, b) => a - b);
    expect(alle).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
    expect(new Set(alle).size).toBe(15);
  });

  it('ohne Schreibrecht aufs Archiv wird NICHT rotiert', async () => {
    // Lieber eine grosse Datei als eine verlorene Fassung: es gibt keine
    // Transaktion ueber zwei Dateien, also bleibt die Hauptdatei vollstaendig.
    const idb = await frisch();
    share.archivSchreibrecht = false;
    await lokalerBestand(12);
    const e = await schreibeKatalogAufShare(idb, {});
    expect(e.art).toBe('geschrieben');
    expect(share.datei?.fassungen).toHaveLength(12);
    expect(await leseKatalogArchiv(idb)).toBeNull();
  });

  it('ein UNLESBARES Archiv verhindert die Rotation — die alten Fassungen bleiben (v4.12)', async () => {
    // Der andere Weg in denselben Verlust: das Archiv ist da, liess sich aber
    // nicht lesen. Wer daraus „leeres Archiv" macht, schreibt es auf die eine
    // gerade abgeschaelte Fassung zusammen — die frueher ausgelagerten sind aus
    // jedem Lesepfad weg, und zwar besonders dort, wo die lokale Fassungsliste
    // nur die Hauptdatei kennt (Rechner, der den Katalog vom Share bezogen hat).
    const idb = await frisch();
    await lokalerBestand(12);
    await schreibeKatalogAufShare(idb, {});
    const archivVorher = await leseKatalogArchiv(idb);
    expect(archivVorher?.fassungen, 'Vorbedingung: es wurde etwas ausgelagert').toHaveLength(4);

    // Naechster Speichervorgang, Archiv unlesbar.
    share.archivLesbar = false;
    await lokalerBestand(13);
    const e = await schreibeKatalogAufShare(idb, {});

    expect(e.art).toBe('geschrieben');
    // Nicht rotiert ⇒ die Hauptdatei traegt alles, das Archiv ist unveraendert.
    expect(share.datei?.fassungen).toHaveLength(13);
    expect((share.dateien.get(ARCHIV) as { fassungen: unknown[] }).fassungen).toHaveLength(4);
  });

  it('beim naechsten Speichern wird die Rotation erneut versucht', async () => {
    const idb = await frisch();
    share.archivSchreibrecht = false;
    await lokalerBestand(12);
    await schreibeKatalogAufShare(idb, {});
    expect(share.datei?.fassungen).toHaveLength(12);

    share.archivSchreibrecht = true;
    await schreibeKatalogAufShare(idb, {});
    expect(share.datei?.fassungen).toHaveLength(FASSUNGEN_IN_HAUPTDATEI);
    expect((await leseKatalogArchiv(idb))?.fassungen).toHaveLength(4);
  });

  it('die aktive Fassung bleibt in der Hauptdatei, auch wenn sie alt ist', async () => {
    // Der reale Fall: jemand reaktiviert v2 und veroeffentlicht sie.
    const idb = await frisch();
    await lokalerBestand(12, 2);
    await schreibeKatalogAufShare(idb, {});
    expect(share.datei?.fassungen.map(f => f.version)).toContain(2);
    expect((await leseKatalogArchiv(idb))?.fassungen.map(f => f.version)).not.toContain(2);
  });

  it('ein zweiter Lauf haengt an, statt das Archiv zu ersetzen', async () => {
    const idb = await frisch();
    await lokalerBestand(12);
    await schreibeKatalogAufShare(idb, {});
    expect((await leseKatalogArchiv(idb))?.fassungen.map(f => f.version)).toEqual([1, 2, 3, 4]);

    await speichereVersion(idb, { ...leicht(13, 'MUE') });
    await setzeAktiv(idb, 13);
    await schreibeKatalogAufShare(idb, {});
    const archiv = await leseKatalogArchiv(idb);
    expect(archiv?.fassungen.map(f => f.version)).toEqual([1, 2, 3, 4, 5]);
    expect(share.datei?.fassungen.map(f => f.version)).toEqual([6, 7, 8, 9, 10, 11, 12, 13]);
  });

  it('die Hauptdatei bleibt nach istKatalogDatei gueltig', async () => {
    const idb = await frisch();
    await lokalerBestand(20);
    await schreibeKatalogAufShare(idb, {});
    expect(istKatalogDatei(share.datei)).toBe(true);
  });
});
