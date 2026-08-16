/**
 * Die Reiterleiste des Startzustands: welche Reiter es gibt, was an ihnen
 * steht, und welcher nach einem Neustart offen ist.
 *
 * Node-Umgebung, kein React — die Datei unter Test ist rein.
 */
import { describe, expect, it } from 'vitest';
import {
  baueStartReiter, leseStartReiter, startReiterIds, type StartZaehler,
} from '../startReiter';
import { SUCHARTEN, SUCHSPRACHE_GRUPPEN, suchartenDerGruppe } from '../suchsprache';

const ZAEHLER: StartZaehler = { zuletzt: 7, suchsprache: 10, fragen: 3, stoebern: 4 };

describe('startReiterIds', () => {
  it('lässt „Fragen" weg, wo der Build die Frage-Suche nicht mitbringt', () => {
    expect(startReiterIds(false)).not.toContain('fragen');
    expect(startReiterIds(true)).toContain('fragen');
  });

  it('stellt den Wiedereinstieg vor das Stöbern', () => {
    const ids = startReiterIds(true);
    expect(ids.indexOf('zuletzt')).toBeLessThan(ids.indexOf('stoebern'));
    expect(ids[0]).toBe('alle');
  });
});

describe('baueStartReiter', () => {
  it('trägt an jedem Reiter die Zahl seiner eigenen Zeilen', () => {
    const reiter = baueStartReiter(ZAEHLER, true);
    const zahl = Object.fromEntries(reiter.map(r => [r.key, r.count]));
    expect(zahl['zuletzt']).toBe(7);
    expect(zahl['suchsprache']).toBe(10);
    expect(zahl['fragen']).toBe(3);
    expect(zahl['stoebern']).toBe(4);
  });

  it('summiert an „Alle" genau die Reiter, die es auch gibt', () => {
    const mit = baueStartReiter(ZAEHLER, true);
    expect(mit.find(r => r.key === 'alle')?.count).toBe(7 + 10 + 3 + 4);
    // Ohne den Fragen-Reiter dürfen dessen 3 Zeilen auch nicht mitgezählt
    // werden — die Summe verspräche sonst Zeilen, die niemand erreicht.
    const ohne = baueStartReiter(ZAEHLER, false);
    expect(ohne.find(r => r.key === 'alle')?.count).toBe(7 + 10 + 4);
  });

  it('liefert für jeden Reiter eine Beschriftung', () => {
    for (const r of baueStartReiter(ZAEHLER, true)) {
      expect(r.label.length).toBeGreaterThan(0);
    }
  });
});

describe('leseStartReiter', () => {
  it('startet auf „Alle", wenn nichts gemerkt ist', () => {
    expect(leseStartReiter(null, true)).toBe('alle');
  });

  it('gibt einen gemerkten Reiter zurück', () => {
    expect(leseStartReiter('suchsprache', true)).toBe('suchsprache');
  });

  it('verwirft Unsinn aus dem Speicher', () => {
    expect(leseStartReiter('{}', true)).toBe('alle');
    expect(leseStartReiter('', true)).toBe('alle');
  });

  it('verwirft einen Reiter, den DIESER Build nicht anbietet', () => {
    // Variantenwechsel: „fragen" war gemerkt, die Leiste kennt ihn nicht mehr.
    expect(leseStartReiter('fragen', false)).toBe('alle');
    expect(leseStartReiter('fragen', true)).toBe('fragen');
  });
});

describe('suchsprache-Gruppen', () => {
  it('ordnet jede Suchart genau einer angezeigten Gruppe zu', () => {
    const bekannt = new Set(SUCHSPRACHE_GRUPPEN.map(g => g.id));
    for (const s of SUCHARTEN) expect(bekannt.has(s.gruppe)).toBe(true);
  });

  it('lässt keine Gruppe leer — eine Überschrift ohne Zeilen ist ein Loch', () => {
    for (const g of SUCHSPRACHE_GRUPPEN) {
      expect(suchartenDerGruppe(g.id).length).toBeGreaterThan(0);
    }
  });

  it('verteilt die Beispiele vollständig auf die Gruppen', () => {
    const summe = SUCHSPRACHE_GRUPPEN.reduce((n, g) => n + suchartenDerGruppe(g.id).length, 0);
    expect(summe).toBe(SUCHARTEN.length);
  });
});
