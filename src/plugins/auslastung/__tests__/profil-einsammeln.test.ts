/**
 * Tests fuer profil-einsammeln.ts (v2.6 — PL sammelt MA-Selbst-Profile ein).
 *
 *  - mergeProfilesIntoMitarbeiter: PL-only-Felder bleiben erhalten, MA-Felder
 *    werden ueberschrieben, unauflösbares Kuerzel wird gemeldet (KEIN neuer MA,
 *    verhindert MA80/MA81-Geister), NFC- + Mehrfach-Kuerzel-Match.
 *  - collectUserProfiles: iteriert User-Ordner gegen Mock-Dir-Handles.
 */
import { describe, it, expect } from 'vitest';
import {
  collectUserProfiles,
  mergeProfilesIntoMitarbeiter,
  mergeSelfProfile,
} from '../services/profil-einsammeln';
import type { AnonymMap } from '../services/anonym-map';
import type { AnonymerMitarbeiter, PersoenlichesAuslastungProfil } from '../types';

function anonMap(pairs: Array<[string, string]>): AnonymMap {
  const toAnon = new Map<string, string>();
  const toReal = new Map<string, string>();
  for (const [kuerzel, anon] of pairs) {
    toAnon.set(kuerzel, anon);
    toReal.set(anon, kuerzel);
  }
  return { toAnon, toReal };
}

function makeMa(overrides: Partial<AnonymerMitarbeiter> = {}): AnonymerMitarbeiter {
  return {
    anonId: 'MA01',
    jahresKapazitaet: 800,
    abgemeldet: [],
    manuelleTechnologien: [],
    ausgeblendeteAutoTags: [],
    hauptKategorie: 'IT',
    nebenKategorien: [],
    abschlagProzent: 0,
    virtuelleProjekte: [],
    onboardingAbgeschlossen: true,
    aktiv: true,
    ...overrides,
  };
}

function makeProfil(
  o: Partial<PersoenlichesAuslastungProfil> & { kuerzel: string },
): PersoenlichesAuslastungProfil {
  return {
    version: 1,
    kuerzel: o.kuerzel,
    manuelleTechnologien: o.manuelleTechnologien ?? [],
    ausgeblendeteAutoTags: o.ausgeblendeteAutoTags ?? [],
    hauptKategorie: o.hauptKategorie ?? '',
    nebenKategorien: o.nebenKategorien ?? [],
    antragstypBevorzugt: o.antragstypBevorzugt ?? [],
    updatedAt: o.updatedAt ?? '2026-05-28T00:00:00.000Z',
  };
}

describe('mergeProfilesIntoMitarbeiter', () => {
  it('aktualisiert MA-Felder, laesst PL-only-Felder unangetastet', () => {
    const current = {
      MA01: makeMa({
        anonId: 'MA01',
        jahresKapazitaet: 1200,
        abschlagProzent: 25,
        aktiv: false,
        abgemeldet: ['2026-Q1'],
        antragstypUeberschreibung: ['FuE'],
        hauptKategorie: 'IT',
        manuelleTechnologien: ['alt'],
      }),
    };
    const profile = [
      makeProfil({
        kuerzel: 'mue',
        hauptKategorie: 'DT',
        nebenKategorien: ['EU'],
        manuelleTechnologien: ['neu'],
        antragstypBevorzugt: ['DS'],
      }),
    ];
    const { next, aktualisiert, neu } = mergeProfilesIntoMitarbeiter(
      current,
      profile,
      anonMap([['MUE', 'MA01']]),
    );

    expect(aktualisiert).toEqual(['MA01']);
    expect(neu).toEqual([]);
    const ma = next.MA01!;
    // MA-Felder uebernommen:
    expect(ma.hauptKategorie).toBe('DT');
    expect(ma.nebenKategorien).toEqual(['EU']);
    expect(ma.manuelleTechnologien).toEqual(['neu']);
    expect(ma.antragstypBevorzugt).toEqual(['DS']);
    // PL-only-Felder erhalten:
    expect(ma.jahresKapazitaet).toBe(1200);
    expect(ma.abschlagProzent).toBe(25);
    expect(ma.aktiv).toBe(false);
    expect(ma.abgemeldet).toEqual(['2026-Q1']);
    expect(ma.antragstypUeberschreibung).toEqual(['FuE']);
  });

  it('legt fuer unauflösbares Kuerzel KEINEN neuen MA an, meldet es als unzuordenbar', () => {
    const { next, aktualisiert, neu, unzuordenbar } = mergeProfilesIntoMitarbeiter(
      {},
      [makeProfil({ kuerzel: 'NEU', hauptKategorie: 'EU' })],
      anonMap([]),
    );
    expect(aktualisiert).toEqual([]);
    expect(neu).toEqual([]);
    expect(unzuordenbar).toEqual(['NEU']);
    expect(Object.keys(next)).toEqual([]);
  });

  it('matcht Umlaut-Kuerzel ueber NFC-Normalisierung (Pitfall #22)', () => {
    // Map-Key NFC, Profil-Kuerzel NFD ("U" + Combining-Diaeresis).
    const nfcKey = 'THÜ'.normalize('NFC');
    const nfdKuerzel = 'TH' + 'Ü';
    const current = { MA05: makeMa({ anonId: 'MA05', hauptKategorie: 'IT' }) };
    const { next, aktualisiert, neu } = mergeProfilesIntoMitarbeiter(
      current,
      [makeProfil({ kuerzel: nfdKuerzel, hauptKategorie: 'LG' })],
      anonMap([[nfcKey, 'MA05']]),
    );
    expect(neu).toEqual([]);
    expect(aktualisiert).toEqual(['MA05']);
    expect(next.MA05!.hauptKategorie).toBe('LG');
  });

  it('meldet mehrere unauflösbare Kuerzel als unzuordenbar, ohne MAs anzulegen', () => {
    const current = { MA01: makeMa({ anonId: 'MA01' }) };
    const { next, neu, unzuordenbar } = mergeProfilesIntoMitarbeiter(
      current,
      [makeProfil({ kuerzel: 'AAA' }), makeProfil({ kuerzel: 'BBB' })],
      anonMap([]),
    );
    expect(neu).toEqual([]);
    expect([...unzuordenbar].sort()).toEqual(['AAA', 'BBB']);
    expect(Object.keys(next)).toEqual(['MA01']);
  });

  it('loest Mehrfach-Kuerzel ("MUE,SCH") ueber das erste Match auf', () => {
    const current = { MA01: makeMa({ anonId: 'MA01', hauptKategorie: 'IT' }) };
    const { next, aktualisiert, neu, unzuordenbar } = mergeProfilesIntoMitarbeiter(
      current,
      [makeProfil({ kuerzel: 'MUE,SCH', hauptKategorie: 'DT' })],
      anonMap([['MUE', 'MA01']]),
    );
    expect(aktualisiert).toEqual(['MA01']);
    expect(neu).toEqual([]);
    expect(unzuordenbar).toEqual([]);
    expect(next.MA01!.hauptKategorie).toBe('DT');
  });

  it('leeres MA-antragstypBevorzugt clobbert die PL-Vorbelegung NICHT', () => {
    // "Wird ersetzt, sobald der MA seine Antragstypen SETZT" — leer = nicht
    // gesetzt, darf die PL-Vorbelegung nicht loeschen (analog hauptKategorie).
    const current = { MA01: makeMa({ anonId: 'MA01', antragstypBevorzugt: ['FuE'] }) };
    const { next } = mergeProfilesIntoMitarbeiter(
      current,
      [makeProfil({ kuerzel: 'mue', antragstypBevorzugt: [] })],
      anonMap([['MUE', 'MA01']]),
    );
    expect(next.MA01!.antragstypBevorzugt).toEqual(['FuE']);
  });

  it('gesetztes MA-antragstypBevorzugt ersetzt die PL-Vorbelegung', () => {
    const current = { MA01: makeMa({ anonId: 'MA01', antragstypBevorzugt: ['FuE'] }) };
    const { next } = mergeProfilesIntoMitarbeiter(
      current,
      [makeProfil({ kuerzel: 'mue', antragstypBevorzugt: ['DS'] })],
      anonMap([['MUE', 'MA01']]),
    );
    expect(next.MA01!.antragstypBevorzugt).toEqual(['DS']);
  });
});

describe('mergeSelfProfile', () => {
  it('persoenliches Profil ueberschreibt Self-Felder, PL-only-Felder bleiben aus dem Store', () => {
    const store = makeMa({
      anonId: 'MA01',
      jahresKapazitaet: 1200,
      abschlagProzent: 25,
      aktiv: false,
      antragstypUeberschreibung: ['FuE'],
      hauptKategorie: 'IT',
      manuelleTechnologien: ['alt'],
    });
    const personal = makeProfil({
      kuerzel: 'MUE',
      hauptKategorie: 'DT',
      nebenKategorien: ['EU'],
      antragstypBevorzugt: ['DS'],
      manuelleTechnologien: ['neu'],
    });
    const eff = mergeSelfProfile(store, personal, 'MA01')!;
    expect(eff.hauptKategorie).toBe('DT');
    expect(eff.nebenKategorien).toEqual(['EU']);
    expect(eff.antragstypBevorzugt).toEqual(['DS']);
    expect(eff.manuelleTechnologien).toEqual(['neu']);
    // PL-only erhalten:
    expect(eff.jahresKapazitaet).toBe(1200);
    expect(eff.abschlagProzent).toBe(25);
    expect(eff.aktiv).toBe(false);
    expect(eff.antragstypUeberschreibung).toEqual(['FuE']);
  });

  it('ohne persoenliches Profil → Store-Record unveraendert', () => {
    const store = makeMa({ anonId: 'MA01', hauptKategorie: 'IT' });
    expect(mergeSelfProfile(store, null, 'MA01')).toBe(store);
  });

  it('ohne Store-Record → Default-Base mit Self-Feldern (aktiv, Default-Kapazitaet)', () => {
    const personal = makeProfil({ kuerzel: 'NEU', hauptKategorie: 'EU' });
    const eff = mergeSelfProfile(undefined, personal, 'MA09')!;
    expect(eff.anonId).toBe('MA09');
    expect(eff.hauptKategorie).toBe('EU');
    expect(eff.aktiv).toBe(true);
    expect(eff.jahresKapazitaet).toBe(800);
  });

  it('leeres persoenliches hauptKategorie faellt auf Store-Wert zurueck', () => {
    const store = makeMa({ anonId: 'MA01', hauptKategorie: 'IT' });
    const personal = makeProfil({ kuerzel: 'MUE', hauptKategorie: '' });
    expect(mergeSelfProfile(store, personal, 'MA01')!.hauptKategorie).toBe('IT');
  });

  it('leeres persoenliches antragstypBevorzugt faellt auf PL-Vorbelegung zurueck', () => {
    const store = makeMa({ anonId: 'MA01', antragstypBevorzugt: ['FuE'] });
    const personal = makeProfil({ kuerzel: 'MUE', antragstypBevorzugt: [] });
    expect(mergeSelfProfile(store, personal, 'MA01')!.antragstypBevorzugt).toEqual(['FuE']);
  });

  it('weder Store noch persoenliches Profil → undefined', () => {
    expect(mergeSelfProfile(undefined, null, 'MA01')).toBeUndefined();
  });
});

// ─── collectUserProfiles gegen Mock-Handles ────────────────────────────────

function fileHandle(text: string): unknown {
  return { kind: 'file', getFile: async () => ({ text: async () => text }) };
}

/** User-Home-Ordner-Mock: getDirectoryHandle('ZAH') → File 'auslastung-profil.json'. */
function userDir(profilJson: string | null): unknown {
  const teamflow = {
    kind: 'directory',
    getDirectoryHandle: async () => { throw new Error('no nested dirs'); },
    getFileHandle: async (name: string) => {
      if (profilJson == null || name !== 'auslastung-profil.json') throw new Error('not found');
      return fileHandle(profilJson);
    },
  };
  return {
    kind: 'directory',
    getDirectoryHandle: async (name: string) => {
      if (name === 'ZAH') return teamflow;
      throw new Error('no');
    },
    getFileHandle: async () => { throw new Error('no'); },
  };
}

function rootHandle(entries: Array<{ name: string; kind: 'directory' | 'file'; dir?: unknown }>): unknown {
  return {
    kind: 'directory',
    values: async function* () {
      for (const e of entries) yield { kind: e.kind, name: e.name };
    },
    getDirectoryHandle: async (name: string) => {
      const e = entries.find(x => x.name === name && x.kind === 'directory');
      if (!e || !e.dir) throw new Error('no');
      return e.dir;
    },
  };
}

describe('collectUserProfiles', () => {
  it('liest valide Profile, ueberspringt fehlende/ungueltige + Datei-Eintraege', async () => {
    const valid1 = JSON.stringify(makeProfil({ kuerzel: 'AAA', hauptKategorie: 'IT' }));
    const valid2 = JSON.stringify(makeProfil({ kuerzel: 'BBB', hauptKategorie: 'DT' }));
    const root = rootHandle([
      { name: 'alice', kind: 'directory', dir: userDir(valid1) },
      { name: 'bob', kind: 'directory', dir: userDir(valid2) },
      { name: 'charlie', kind: 'directory', dir: userDir(null) },          // kein Profil
      { name: 'dave', kind: 'directory', dir: userDir('{ kaputt') },        // invalides JSON
      { name: 'readme.txt', kind: 'file' },                                 // Datei → skip
    ]);

    const profile = await collectUserProfiles(root as unknown as FileSystemDirectoryHandle);
    expect(profile.map(p => p.kuerzel).sort()).toEqual(['AAA', 'BBB']);
  });

  it('ueberspringt Profile mit falscher version', async () => {
    const wrongVersion = JSON.stringify({ ...makeProfil({ kuerzel: 'AAA' }), version: 2 });
    const root = rootHandle([
      { name: 'alice', kind: 'directory', dir: userDir(wrongVersion) },
    ]);
    const profile = await collectUserProfiles(root as unknown as FileSystemDirectoryHandle);
    expect(profile).toEqual([]);
  });
});
