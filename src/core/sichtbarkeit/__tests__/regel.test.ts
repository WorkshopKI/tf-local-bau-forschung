import { describe, it, expect } from 'vitest';
import {
  OHNE_MARKE, baueIndex, bilanziere, effektiveMarken, ersterSichtbarerReiter,
  filtereReiter, istSichtbar, markenAusListe, markenGleich, markenZuListe, zaehleZugewinn,
} from '../regel';
import type { KatalogEintrag, Marken, Schalter } from '../types';

const AUS: Schalter = { beta: false, experte: false };
const NUR_BETA: Schalter = { beta: true, experte: false };
const NUR_EXP: Schalter = { beta: false, experte: true };
const BEIDE: Schalter = { beta: true, experte: true };

const BETA: Marken = { beta: true };
const EXP: Marken = { experte: true };
const BEIDES: Marken = { beta: true, experte: true };

describe('istSichtbar — die UND-Regel über alle 4×4 Fälle', () => {
  it('Standard ist in jeder Schalterstellung sichtbar', () => {
    for (const s of [AUS, NUR_BETA, NUR_EXP, BEIDE]) {
      expect(istSichtbar(OHNE_MARKE, s)).toBe(true);
    }
  });

  it('beta braucht genau den Beta-Schalter', () => {
    expect(istSichtbar(BETA, AUS)).toBe(false);
    expect(istSichtbar(BETA, NUR_BETA)).toBe(true);
    expect(istSichtbar(BETA, NUR_EXP)).toBe(false);
    expect(istSichtbar(BETA, BEIDE)).toBe(true);
  });

  it('experte braucht genau den Experten-Schalter', () => {
    expect(istSichtbar(EXP, AUS)).toBe(false);
    expect(istSichtbar(EXP, NUR_BETA)).toBe(false);
    expect(istSichtbar(EXP, NUR_EXP)).toBe(true);
    expect(istSichtbar(EXP, BEIDE)).toBe(true);
  });

  it('beta+experte braucht BEIDE Schalter — nicht einen von beiden', () => {
    expect(istSichtbar(BEIDES, AUS)).toBe(false);
    expect(istSichtbar(BEIDES, NUR_BETA)).toBe(false);
    expect(istSichtbar(BEIDES, NUR_EXP)).toBe(false);
    expect(istSichtbar(BEIDES, BEIDE)).toBe(true);
  });
});

describe('Marken-Listen (Sidecar-Format)', () => {
  it('rundreist verlustfrei und in stabiler Reihenfolge', () => {
    expect(markenZuListe(markenAusListe(['experte', 'beta']))).toEqual(['beta', 'experte']);
    expect(markenZuListe(OHNE_MARKE)).toEqual([]);
    expect(markenAusListe([])).toEqual({});
  });

  it('vergleicht über fehlende vs. false hinweg', () => {
    expect(markenGleich({}, {})).toBe(true);
    expect(markenGleich(BETA, { beta: true })).toBe(true);
    expect(markenGleich(BETA, BEIDES)).toBe(false);
  });
});

describe('effektiveMarken — Overlay über Vorbelegung', () => {
  const katalog: KatalogEintrag[] = [
    { id: 'seite:a', art: 'seite', label: 'A', seite: 'a', marken: BETA },
    { id: 'seite:b', art: 'seite', label: 'B', seite: 'b', marken: OHNE_MARKE },
    { id: 'seite:heilig', art: 'seite', label: 'H', seite: 'heilig', marken: OHNE_MARKE, unantastbar: true },
  ];
  const index = baueIndex(katalog);

  it('nimmt die Vorbelegung, wenn nichts kuratiert ist', () => {
    expect(effektiveMarken('seite:a', index, new Map())).toEqual(BETA);
  });

  it('lässt die Kurator-Abweichung gewinnen — in beide Richtungen', () => {
    const frei = new Map([['seite:a', OHNE_MARKE]]);
    expect(effektiveMarken('seite:a', index, frei)).toEqual({});
    const strenger = new Map([['seite:b', BEIDES]]);
    expect(effektiveMarken('seite:b', index, strenger)).toEqual(BEIDES);
  });

  it('ignoriert Abweichungen an unantastbaren Elementen', () => {
    const boshaft = new Map([['seite:heilig', BEIDES]]);
    expect(effektiveMarken('seite:heilig', index, boshaft)).toEqual({});
  });

  it('behandelt unbekannte Ids als Standard — eine unbekannte Id verbirgt nichts', () => {
    const fremd = new Map([['seite:gibtesnicht', BEIDES]]);
    expect(effektiveMarken('seite:gibtesnicht', index, fremd)).toEqual({});
  });
});

describe('Reiter-Filter und der gemerkte Reiter', () => {
  const items = [{ key: 'a' }, { key: 'b' }, { key: 'c' }];
  const keyVon = (i: { key: string }): string => i.key;

  it('kürzt auf das Sichtbare', () => {
    const nurAC = filtereReiter(items, keyVon, id => id !== 'b');
    expect(nurAC.map(keyVon)).toEqual(['a', 'c']);
  });

  it('behält den aktiven Reiter, solange es ihn gibt', () => {
    expect(ersterSichtbarerReiter(items, 'c', keyVon)).toBe('c');
  });

  it('fällt auf den ersten sichtbaren, wenn der aktive verschwindet', () => {
    expect(ersterSichtbarerReiter([{ key: 'b' }, { key: 'c' }], 'a', keyVon)).toBe('b');
  });

  it('erfindet keinen Schlüssel, wenn nichts übrig ist', () => {
    expect(ersterSichtbarerReiter([], 'a', keyVon)).toBe('a');
  });
});

describe('zaehleZugewinn — der Zähler hängt vom anderen Schalter ab', () => {
  const katalog: KatalogEintrag[] = [
    { id: 'x:1', art: 'abschnitt', label: '1', seite: 'x', marken: BETA },
    { id: 'x:2', art: 'abschnitt', label: '2', seite: 'x', marken: BETA },
    { id: 'x:3', art: 'abschnitt', label: '3', seite: 'x', marken: BEIDES },
    { id: 'x:4', art: 'abschnitt', label: '4', seite: 'x', marken: OHNE_MARKE },
  ];

  it('zählt ohne Expertenmodus nur die reinen Beta-Einträge', () => {
    expect(zaehleZugewinn(katalog, new Map(), AUS, 'beta')).toBe(2);
  });

  it('zählt mit Expertenmodus zusätzlich die beidseitig markierten', () => {
    expect(zaehleZugewinn(katalog, new Map(), NUR_EXP, 'beta')).toBe(3);
  });

  it('zählt nichts, was schon sichtbar ist', () => {
    expect(zaehleZugewinn(katalog, new Map(), BEIDE, 'beta')).toBe(0);
  });
});

describe('bilanziere', () => {
  it('teilt den Katalog in die vier Felder auf', () => {
    const katalog: KatalogEintrag[] = [
      { id: 'a', art: 'seite', label: 'a', seite: 'a', marken: OHNE_MARKE },
      { id: 'b', art: 'seite', label: 'b', seite: 'b', marken: BETA },
      { id: 'c', art: 'seite', label: 'c', seite: 'c', marken: EXP },
      { id: 'd', art: 'seite', label: 'd', seite: 'd', marken: BEIDES },
    ];
    expect(bilanziere(katalog, new Map())).toEqual({
      gesamt: 4, standard: 1, nurBeta: 1, nurExperte: 1, beides: 1,
    });
  });
});
