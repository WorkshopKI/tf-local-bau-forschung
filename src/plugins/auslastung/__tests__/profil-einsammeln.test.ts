/**
 * Tests fuer profil-einsammeln.ts (v2.6 — PL sammelt MA-Selbst-Profile ein).
 *
 *  - mergeProfilesIntoMitarbeiter: PL-only-Felder bleiben erhalten, MA-Felder
 *    werden ueberschrieben, unbekanntes Kuerzel legt neuen MA an, NFC-Match.
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

  it('legt fuer unbekanntes Kuerzel einen neuen aktiven MA an', () => {
    const { next, aktualisiert, neu } = mergeProfilesIntoMitarbeiter(
      {},
      [makeProfil({ kuerzel: 'NEU', hauptKategorie: 'EU' })],
      anonMap([]),
    );
    expect(aktualisiert).toEqual([]);
    expect(neu).toHaveLength(1);
    const id = neu[0]!;
    expect(id).toBe('MA01');
    expect(next[id]!.aktiv).toBe(true);
    expect(next[id]!.jahresKapazitaet).toBe(800);
    expect(next[id]!.hauptKategorie).toBe('EU');
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

  it('vergibt disjunkte anonIds fuer mehrere neue Profile', () => {
    const current = { MA01: makeMa({ anonId: 'MA01' }) };
    const { neu } = mergeProfilesIntoMitarbeiter(
      current,
      [makeProfil({ kuerzel: 'AAA' }), makeProfil({ kuerzel: 'BBB' })],
      anonMap([]),
    );
    expect(new Set(neu).size).toBe(2);
    expect(neu).not.toContain('MA01');
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
