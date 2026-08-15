/**
 * Spaltenprofile der Fördertabelle — benannte Voreinstellungen auf dem
 * Sichtbarkeits-Store, nicht eine zweite Spaltenverwaltung.
 *
 * Die Prüfungen hier halten drei Zusagen: kein Profil nennt eine Spalte, die es
 * nicht gibt; die Erkennung hängt nicht an der Reihenfolge; und „eigene Auswahl"
 * ist erreichbar, aber nicht wählbar.
 */
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SPALTEN_PROFIL,
  EIGENE_AUSWAHL,
  SPALTEN_PROFILE,
  erkenneProfil,
  keysVonProfil,
  spaltenProfilOptionen,
} from '../spaltenProfile';
import {
  ANTRAG_TABLE_COLUMNS,
  DEFAULT_VISIBLE_COLUMN_KEYS,
  LOCKED_COLUMN_KEYS,
} from '../tableColumns';

const REGISTRY_KEYS = new Set(ANTRAG_TABLE_COLUMNS.map(c => c.key));

describe('Spaltenprofile — Inhalt', () => {
  it('nennt in jedem Profil nur Spalten, die es wirklich gibt', () => {
    for (const profil of SPALTEN_PROFILE) {
      const unbekannt = profil.keys().filter(k => !REGISTRY_KEYS.has(k));
      if (unbekannt.length > 0) {
        expect.fail(`Profil „${profil.id}" nennt unbekannte Spalten: ${unbekannt.join(', ')}`);
      }
    }
  });

  it('führt in jedem Profil die gelockten Spalten mit', () => {
    // Der Store erzwingt sie ohnehin — ein Profil, das sie ausließe, wäre nach
    // dem Setzen sofort „eigene Auswahl", weil der Store eine andere Menge hält.
    for (const profil of SPALTEN_PROFILE) {
      const fehlend = LOCKED_COLUMN_KEYS.filter(k => !profil.keys().includes(k));
      if (fehlend.length > 0) {
        expect.fail(`Profil „${profil.id}" laesst gelockte Spalten aus: ${fehlend.join(', ')}`);
      }
    }
  });

  it('nennt in keinem Profil eine Spalte doppelt', () => {
    for (const profil of SPALTEN_PROFILE) {
      const keys = profil.keys();
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it('führt die Frist in jedem Arbeits-Profil', () => {
    // Sie ist der Grund für den ganzen Umbau — ein Profil ohne sie wäre ein
    // Rückschritt hinter den Ausgangszustand.
    const ohne = SPALTEN_PROFILE.filter(p => !p.keys().includes('frist')).map(p => p.id);
    if (ohne.length > 0) expect.fail(`Profile ohne Frist-Spalte: ${ohne.join(', ')}`);
  });

  it('hält „Alle" wirklich auf allen festen Spalten — und NUR auf ihnen', () => {
    // Kuratierte Ordner-Spalten (`katstatus:`) und eigene (`frei_`) gehören
    // bewusst nicht dazu: welche es gibt, entscheidet nicht der Code.
    expect(new Set(keysVonProfil('alle'))).toEqual(REGISTRY_KEYS);
  });

  it('deckt sich das Profil „Standard" mit der Werkseinstellung', () => {
    expect(new Set(keysVonProfil('standard'))).toEqual(new Set(DEFAULT_VISIBLE_COLUMN_KEYS));
  });
});

describe('erkenneProfil', () => {
  it('erkennt jedes Profil an seiner eigenen Liste', () => {
    for (const profil of SPALTEN_PROFILE) {
      expect(erkenneProfil(profil.keys())).toBe(profil.id);
    }
  });

  it('ist reihenfolge-unabhängig — die gespeicherte Liste ist Toggle-Reihenfolge', () => {
    const gedreht = [...keysVonProfil('triage')].reverse();
    expect(erkenneProfil(gedreht)).toBe('triage');
  });

  it('meldet eigene Auswahl, sobald eine Spalte dazukommt oder fehlt', () => {
    const triage = keysVonProfil('triage');
    expect(erkenneProfil([...triage, 'foerdersumme'])).toBeNull();
    expect(erkenneProfil(triage.slice(0, -1))).toBeNull();
  });

  it('zählt eine eigene Spalte mit — sie verändert den Satz', () => {
    expect(erkenneProfil([...keysVonProfil('triage'), 'frei_test'])).toBeNull();
  });

  it('meldet für eine leere Auswahl kein Profil', () => {
    expect(erkenneProfil([])).toBeNull();
  });

  it('die Werkseinstellung ist der Standard, nicht „eigene"', () => {
    // Sonst stünde der Auslieferungszustand als Abweichung am Darstellungs-Knopf.
    expect(erkenneProfil(DEFAULT_VISIBLE_COLUMN_KEYS)).toBe(DEFAULT_SPALTEN_PROFIL);
  });
});

describe('Optionen der Achse', () => {
  it('bietet „Eigene" NUR an, wenn sie gerade zutrifft', () => {
    expect(spaltenProfilOptionen('triage').map(o => o.key)).not.toContain(EIGENE_AUSWAHL);
    expect(spaltenProfilOptionen(null).map(o => o.key)).toContain(EIGENE_AUSWAHL);
  });

  it('hält die Menü-Reihenfolge der Profil-Liste', () => {
    expect(spaltenProfilOptionen('standard').map(o => o.key))
      .toEqual(SPALTEN_PROFILE.map(p => p.id));
  });

  it('liefert für eine unbekannte Id keine Keys, statt zu werfen', () => {
    expect(keysVonProfil(EIGENE_AUSWAHL)).toEqual([]);
    expect(keysVonProfil('gibtesnicht')).toEqual([]);
  });
});
