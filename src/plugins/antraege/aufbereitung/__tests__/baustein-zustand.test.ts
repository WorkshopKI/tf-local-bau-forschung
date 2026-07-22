/**
 * Die reinen Übergänge des Baustein-Zustands (kein React, kein IDB).
 *
 * Vorher lag dieser Zustand als zwölf `useState` im Hook und war nur über das
 * gerenderte UI prüfbar — genau deshalb konnten Fälle wie „Neu aufbereiten hat einen
 * Baustein vergessen" unbemerkt durchrutschen. Hier sind sie einzeln nagelbar.
 *
 * Die Regression zu v2.301.1 („Extern-Importe überleben Neu aufbereiten") sitzt NICHT
 * hier, sondern bei `uebernehmeExterneRecherchen` in `store.test.ts`: die externen
 * Importe hängen am Run, nicht am Baustein-Zustand. Der Test unten sichert nur die
 * Kehrseite ab — dass „Neu aufbereiten" wirklich alle Bausteine erfasst.
 */
import { describe, it, expect } from 'vitest';
import {
  FEHLT, alsFelder, fuelleAusCache, initialerZustand, setzeAlleUi, setzeSkill, setzeUi,
} from '../baustein-zustand';
import { BAUSTEIN_IDS, BAUSTEIN_KATALOG, bausteinCachePraefixe } from '../baustein-katalog';
import type { SkillRecord } from '@/core/services/skills';

describe('BAUSTEIN_KATALOG', () => {
  it('kennt genau die sechs Bausteine — recherchePrompt laeuft ZUERST', () => {
    expect(BAUSTEIN_IDS).toEqual([
      'recherchePrompt', 'aspekte', 'steckbrief', 'zahlen', 'glossar', 'verwertung',
    ]);
  });

  it('jeder Eintrag traegt Seed-Skill, Skill-ID, Cache-Key und Lauf-Adapter', () => {
    for (const id of BAUSTEIN_IDS) {
      const e = BAUSTEIN_KATALOG[id];
      expect(e.id).toBe(id);
      expect(e.seedSkill.id).toBe(e.skillId);
      expect(typeof e.lauf).toBe('function');
      expect(e.cacheKey('A', 'h1')).toContain('A');
    }
  });

  it('Cache-Keys sind je Baustein verschieden (kein Copy-Paste-Kollaps)', () => {
    const keys = BAUSTEIN_IDS.map(id => BAUSTEIN_KATALOG[id].cacheKey('A', 'h1'));
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('bausteinCachePraefixe', () => {
  it('jeder Baustein-Praefix ist echtes Praefix seines Cache-Keys', () => {
    const praefixe = bausteinCachePraefixe('A');
    for (const id of BAUSTEIN_IDS) {
      const key = BAUSTEIN_KATALOG[id].cacheKey('A', 'deadbeef');
      expect(praefixe.some(p => key.startsWith(p))).toBe(true);
    }
  });

  it('nimmt den recherche-import-Cache mit — er haengt am Antrag, ist aber kein Katalog-Baustein', () => {
    expect(bausteinCachePraefixe('A')).toContain('aufbereitung:A:recherche-import:');
  });

  it('kein Praefix traegt noch einen Hash-Rest', () => {
    for (const p of bausteinCachePraefixe('A')) expect(p.endsWith(':')).toBe(true);
  });
});

describe('initialerZustand', () => {
  it('startet mit den Seed-Skills und ueberall `fehlt`', () => {
    const z = initialerZustand();
    for (const id of BAUSTEIN_IDS) {
      expect(z[id].ui.status).toBe('fehlt');
      expect(z[id].skill).toBe(BAUSTEIN_KATALOG[id].seedSkill);
    }
  });
});

describe('setzeUi / setzeSkill', () => {
  it('setzt genau EINEN Baustein und laesst die uebrigen unberuehrt', () => {
    const z = setzeUi(initialerZustand(), 'zahlen', { status: 'laeuft' });
    expect(z.zahlen.ui.status).toBe('laeuft');
    for (const id of BAUSTEIN_IDS.filter(i => i !== 'zahlen')) {
      expect(z[id].ui.status).toBe('fehlt');
    }
  });

  it('der Skill bleibt beim UI-Wechsel stehen (er haengt an der Registry, nicht am Lauf)', () => {
    const eigener = { ...BAUSTEIN_KATALOG.glossar.seedSkill, version: 99 } as SkillRecord;
    const z = setzeUi(setzeSkill(initialerZustand(), 'glossar', eigener), 'glossar', { status: 'ok' });
    expect(z.glossar.skill.version).toBe(99);
  });
});

describe('setzeAlleUi („Neu aufbereiten" / Kontext-Wechsel)', () => {
  it('erfasst JEDEN Baustein — kein vergessener Slot', () => {
    const voll = BAUSTEIN_IDS.reduce(
      (z, id) => setzeUi(z, id, { status: 'ok', daten: { x: 1 } }), initialerZustand(),
    );
    const zurueck = setzeAlleUi(voll, FEHLT);
    for (const id of BAUSTEIN_IDS) expect(zurueck[id].ui.status).toBe('fehlt');
  });

  it('laesst die aufgeloesten Skills stehen — sonst liefe der naechste Lauf wieder auf den Seeds', () => {
    const eigener = { ...BAUSTEIN_KATALOG.aspekte.seedSkill, version: 42 } as SkillRecord;
    const z = setzeAlleUi(setzeSkill(initialerZustand(), 'aspekte', eigener), FEHLT);
    expect(z.aspekte.skill.version).toBe(42);
  });
});

describe('fuelleAusCache (Rehydrierung)', () => {
  it('fuellt leere Slots', () => {
    const z = fuelleAusCache(initialerZustand(), { glossar: { begriffe: [] } as never });
    expect(z.glossar.ui).toEqual({ status: 'ok', daten: { begriffe: [] } });
  });

  it('ueberschreibt einen LAUFENDEN Baustein nicht (spaete Leseantwort)', () => {
    const laeuft = setzeUi(initialerZustand(), 'glossar', { status: 'laeuft' });
    const z = fuelleAusCache(laeuft, { glossar: { begriffe: [] } as never });
    expect(z.glossar.ui.status).toBe('laeuft');
  });

  it('ueberschreibt ein bereits fertiges Ergebnis nicht', () => {
    const fertig = setzeUi(initialerZustand(), 'zahlen', { status: 'ok', daten: { frisch: true } });
    const z = fuelleAusCache(fertig, { zahlen: { alt: true } as never });
    expect(z.zahlen.ui.daten).toEqual({ frisch: true });
  });

  it('ein Miss ist ein No-op — die Rehydrierung loescht nie', () => {
    const fertig = setzeUi(initialerZustand(), 'zahlen', { status: 'ok', daten: { frisch: true } });
    const z = fuelleAusCache(fertig, { zahlen: null });
    expect(z.zahlen.ui).toEqual({ status: 'ok', daten: { frisch: true } });
  });
});

describe('alsFelder (oeffentliche Hook-Oberflaeche)', () => {
  it('liefert genau die sechs Felder, die die Tabs erwarten', () => {
    expect(Object.keys(alsFelder(initialerZustand())).sort()).toEqual(
      ['aspekte', 'glossar', 'recherchePrompt', 'steckbrief', 'verwertung', 'zahlen'],
    );
  });

  it('reicht den UI-Zustand des jeweiligen Slots durch', () => {
    const z = setzeUi(initialerZustand(), 'steckbrief', { status: 'degradiert', rohtext: 'roh' });
    expect(alsFelder(z).steckbrief).toEqual({ status: 'degradiert', rohtext: 'roh' });
  });
});
