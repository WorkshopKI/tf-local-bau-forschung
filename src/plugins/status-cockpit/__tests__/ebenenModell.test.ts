/**
 * Die Ebenen-Karte muss **denselben Entwurf** beschreiben wie der Baum daneben.
 *
 * Bis v4.119 kamen die Zeilen aus dem Entwurf, die Code-Zuordnung aber aus dem
 * Snapshot der AKTIVEN Fassung (`phaseFuerCode`). Ein umgehängter, noch nicht
 * gespeicherter Code blieb dadurch am alten Schritt stehen; zeigte er auf eine
 * Phase, die der Entwurf gar nicht führt, verschwand er aus JEDER Zeile und
 * wurde auch von „läuft ohne Verfahrensschritt" nicht erfasst — die Summe war
 * dann kleiner als die Zahl in der Zeile „Status", ohne dass die Seite es sagte.
 *
 * Die Tests hier halten drei Zusagen fest: die Zuordnung folgt dem Entwurf, die
 * Summe geht immer auf, und jede Zahl nennt den Grund, der wirklich zutrifft.
 */
import { describe, it, expect } from 'vitest';
import { baueEbenenUebersicht } from '../ebenenModell';
import { KATEGORIE_REIHENFOLGE } from '@/core/utils/status-category-labels';
import type { MappingVersion, StatusFeldEintrag, StatusWertEintrag, ZahPhase } from '@/core/status';

const phase = (p: Partial<ZahPhase> & { id: string }): ZahPhase => ({
  label: p.id, reihenfolge: 10, zieltageRelevant: false, ...p,
});

const wert = (p: Partial<StatusWertEintrag> & { id: string }): StatusWertEintrag => ({
  feldId: 'status', wert: p.id, kategorie: 'offen', prominenz: 'normal',
  aktiv: true, unkuratiert: false, ...p,
});

const feld = (p: Partial<StatusFeldEintrag> & { feldId: string }): StatusFeldEintrag => ({
  label: p.feldId, typ: 'datum', ebene: 'tv', rollen: [],
  prominenzDefault: 'normal', aktiv: true, unkuratiert: false, ...p,
});

const version = (p: Partial<MappingVersion> = {}): MappingVersion => ({
  version: 7, autor: null, zeitstempel: 'x', felder: [], werte: [], ...p,
});

/** Eine belegte Spalten-Map — leer wäre seit v4.120 „unbeantwortbar". */
const spalten = (...ids: string[]): Map<string, string[]> =>
  new Map(ids.map(id => [id, [id]]));

describe('Ebenen-Karte — die Zuordnung folgt dem ENTWURF', () => {
  /**
   * Code 11 liegt in der Auslieferung auf `eingang`. Dieser Entwurf kennt
   * `eingang` gar nicht mehr und hat den Code auf einen selbst angelegten
   * Schritt gezogen — genau der Zustand, den der Baum zeigt und die Karte
   * bis v4.119 nicht sah.
   */
  const umgehaengt = version({
    zahPhasen: [phase({ id: 'neu', label: 'Frisch geschnitten' })],
    werte: [
      wert({ id: 'tv', feldId: 'status', code: 11, zahPhaseId: 'neu' }),
      wert({ id: 'vb', feldId: 'verbund_status', code: 11, zahPhaseId: 'neu' }),
    ],
  });

  it('zeigt den Code am Schritt des Entwurfs, nicht an dem der aktiven Fassung', () => {
    const u = baueEbenenUebersicht(umgehaengt, spalten('D_AAE'), null, 0);
    expect(u.schritte).toHaveLength(1);
    expect(u.schritte[0]!.codeAnzahl).toBe(1);
    expect(u.ohneSchritt.codeAnzahl).toBe(0);
  });

  it('zählt einen Code EINMAL, obwohl er zwei Katalogzeilen hat', () => {
    const u = baueEbenenUebersicht(umgehaengt, spalten('D_AAE'), null, 0);
    const summe = u.schritte.reduce((n, s) => n + s.codeAnzahl, 0) + u.ohneSchritt.codeAnzahl;
    expect(summe).toBe(1);
  });

  it('verliert einen verwaisten Code nicht, sondern weist ihn aus', () => {
    const v = version({
      zahPhasen: [phase({ id: 'a' })],
      werte: [
        wert({ id: 'x', code: 11, zahPhaseId: 'a' }),
        wert({ id: 'y', code: 12, zahPhaseId: 'geloescht' }),
      ],
    });
    const u = baueEbenenUebersicht(v, spalten('D_AAE'), null, 0);
    expect(u.verwaist).toBe(1);
    // Die Summe geht trotzdem auf — der Verwaiste läuft unter „ohne Schritt".
    const summe = u.schritte.reduce((n, s) => n + s.codeAnzahl, 0) + u.ohneSchritt.codeAnzahl;
    expect(summe).toBe(2);
  });

  it('führt die Arbeitslisten in Taxonomie-Reihenfolge, nicht in Einfüge-Reihenfolge', () => {
    const u = baueEbenenUebersicht(umgehaengt, spalten('D_AAE'), null, 0);
    for (const s of [...u.schritte, u.ohneSchritt]) {
      const raenge = s.arbeitslisten.map(a => KATEGORIE_REIHENFOLGE.indexOf(a.kategorie));
      expect(raenge).toEqual([...raenge].sort((a, b) => a - b));
    }
  });
});

describe('Ebenen-Karte — jede Zahl nennt ihren Grund', () => {
  const mitRuhe = version({
    zahPhasen: [phase({ id: 'a' })],
    felder: [
      feld({ feldId: 'D_AAE', code: 'AAE' }),                 // gemappt, wach
      feld({ feldId: 'D_YE', code: 'YE' }),                   // ungemappt
      feld({ feldId: 'D_INFOB', code: 'INFOB', ruht: true }), // stillgelegt
    ],
    werte: [wert({ id: 'x', code: 11, zahPhaseId: 'a' })],
  });

  it('trennt „keine Spalte im Export" von „die PL hat entschieden"', () => {
    const u = baueEbenenUebersicht(mitRuhe, spalten('D_AAE'), null, 0);
    const hinweis = u.fremd.find(z => z.name === 'Kürzel')!.hinweis!;
    expect(hinweis).toContain('1 ohne Spalte im Export');
    expect(hinweis).toContain('1 von der PL stillgelegt');
  });

  it('sagt „unbekannt" statt einer Zahl, wenn keine CSV-Spalten geladen sind', () => {
    const u = baueEbenenUebersicht(mitRuhe, new Map(), null, 0);
    expect(u.fremd.find(z => z.name === 'Kürzel')!.hinweis).toContain('unbekannt');
  });

  it('führt die Trigger als Fremddaten und die To-do-Regeln als eigene Achse', () => {
    const u = baueEbenenUebersicht(mitRuhe, spalten('D_AAE'), null, 2447);
    expect(u.fremd.map(z => z.name)).toContain('Trigger');
    expect(u.fremd.find(z => z.name === 'Trigger')!.wert).toBe('2447');
    // To-do-Regeln sind PL-editierbare Fassungsdaten — C16 kennt sie nicht.
    expect(u.eigen.map(z => z.name)).toContain('To-do-Regeln');
    expect(u.fremd.map(z => z.name)).not.toContain('To-do-Regeln');
  });

  it('nennt die Zahl der Arbeitslisten aus der Taxonomie, nicht als Literal', () => {
    const u = baueEbenenUebersicht(mitRuhe, spalten('D_AAE'), null, 0);
    expect(u.eigen.find(z => z.name === 'Arbeitsliste')!.wert)
      .toBe(String(KATEGORIE_REIHENFOLGE.length));
  });
});
