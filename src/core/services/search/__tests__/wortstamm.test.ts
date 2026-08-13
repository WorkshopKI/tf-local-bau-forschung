import { describe, it, expect } from 'vitest';
import { wortStamm, sammleVarianten, suchNadel } from '../wortstamm';
import {
  bereichFelder,
  bereichNutztDokumente,
  parseSuchbereich,
  SUCHBEREICH_LABEL,
  type Suchbereich,
} from '../suchbereich';

describe('wortStamm', () => {
  it('löst die längste passende Endung ab', () => {
    expect(wortStamm('Normungen')).toBe('norm');
    expect(wortStamm('Normung')).toBe('norm');
    expect(wortStamm('Normen')).toBe('norm');
  });

  it('führt verwandte Wörter auf denselben Stamm', () => {
    expect(wortStamm('Kalibrierung')).toBe('kalibrier');
    expect(wortStamm('Kalibrierungen')).toBe('kalibrier');
  });

  it('lässt kurze Wörter unangetastet — sonst wird die Suche zur Rauschquelle', () => {
    expect(wortStamm('Bau')).toBe('bau');       // nichts abzulösen
    expect(wortStamm('Laser')).toBe('laser');   // „-er" abzulösen hieße „las"
    expect(wortStamm('Bahn')).toBe('bahn');     // „-n" abzulösen hieße „bah"
  });

  it('kürzt bis genau an die Untergrenze, nicht darunter', () => {
    expect(wortStamm('Netze')).toBe('netz');    // vier Zeichen bleiben stehen
  });

  it('gibt ohne passende Endung das kleingeschriebene Wort zurück', () => {
    expect(wortStamm('Bilderkennung')).toBe('bilderkenn');
    expect(wortStamm('Photonik')).toBe('photonik');
  });

  it('ist idempotent genug: der Stamm eines Stamms bleibt nutzbar', () => {
    const einmal = wortStamm('Normungen');
    expect(wortStamm(einmal).length).toBeGreaterThanOrEqual(3);
  });
});

describe('suchNadel', () => {
  it('liefert ohne Stammsuche das kleingeschriebene Wort', () => {
    expect(suchNadel('Normen', false)).toBe('normen');
  });

  it('liefert mit Stammsuche den Stamm', () => {
    expect(suchNadel('Normen', true)).toBe('norm');
  });

  it('die Nadel ist nie länger als das Wort', () => {
    for (const w of ['Normungen', 'Laser', 'Kalibrierung', 'ZIM']) {
      expect(suchNadel(w, true).length).toBeLessThanOrEqual(w.length);
    }
  });
});

describe('sammleVarianten', () => {
  const TEXT = 'Für die Vergleichbarkeit werden Kalibrationsstandards nach den '
    + 'einschlägigen Normen erstellt; die Normung folgt DIN-Regelwerken.';

  it('findet die Wörter, die der Stamm mitbringt', () => {
    const v = sammleVarianten(TEXT, 'norm', 'normen', 5);
    expect(v).toContain('Normung');
  });

  it('lässt das Suchwort selbst weg — es steht schon als eigener Chip da', () => {
    const v = sammleVarianten(TEXT, 'norm', 'normen', 5).map(s => s.toLowerCase());
    expect(v).not.toContain('normen');
  });

  it('gibt die Schreibweise aus dem Text zurück, nicht die der Anfrage', () => {
    const v = sammleVarianten('Die NORMUNG ist geregelt.', 'norm', 'normen', 5);
    expect(v).toEqual(['NORMUNG']);
  });

  it('entdoppelt und hält die Obergrenze ein', () => {
    const text = 'Normung Normung Normvorgabe Normblatt Normprüfung';
    expect(sammleVarianten(text, 'norm', 'normen', 2)).toHaveLength(2);
    expect(new Set(sammleVarianten(text, 'norm', 'normen', 9)).size)
      .toBe(sammleVarianten(text, 'norm', 'normen', 9).length);
  });

  it('hält Wörter mit Bindestrich zusammen', () => {
    expect(sammleVarianten('DIN-Regelwerke gelten.', 'regel', 'regeln', 3))
      .toEqual(['DIN-Regelwerke']);
  });

  it('leere Eingaben liefern nichts', () => {
    expect(sammleVarianten('', 'norm', 'normen', 5)).toEqual([]);
    expect(sammleVarianten(TEXT, '', 'normen', 5)).toEqual([]);
    expect(sammleVarianten(TEXT, 'norm', 'normen', 0)).toEqual([]);
  });
});

describe('Suchbereich', () => {
  const ALLE: Suchbereich[] = ['alles', 'inhalt', 'dokumente', 'einrichtung', 'standort'];

  it('jeder Bereich hat eine Beschriftung', () => {
    for (const b of ALLE) expect(SUCHBEREICH_LABEL[b].length).toBeGreaterThan(0);
  });

  it('„alles" ist der weiteste Bereich', () => {
    const alles = bereichFelder('alles');
    for (const b of ALLE) {
      for (const f of bereichFelder(b)) expect(alles.has(f)).toBe(true);
    }
  });

  it('Inhalt und Einrichtung überschneiden sich nicht', () => {
    const inhalt = bereichFelder('inhalt');
    for (const f of bereichFelder('einrichtung')) expect(inhalt.has(f)).toBe(false);
  });

  it('„wer" und „wo" sind zwei Bereiche, nicht einer', () => {
    // v4.15.0: zusammengelegt beantwortete der Bereich beide Fragen auf einmal
    // — wer nach einem Ort suchte, bekam die Firmennamen dazu.
    expect(Array.from(bereichFelder('einrichtung'))).toEqual(['organisation']);
    expect(Array.from(bereichFelder('standort'))).toEqual(['standort']);
  });

  it('„nur Dokumente" prüft KEIN Antragsfeld', () => {
    expect(bereichFelder('dokumente').size).toBe(0);
  });

  it('das Aktenzeichen bleibt im Inhalts-Bereich erreichbar', () => {
    expect(bereichFelder('inhalt').has('aktenzeichen')).toBe(true);
  });

  it('nur die inhaltlichen Bereiche befragen den Dokumentenindex', () => {
    expect(bereichNutztDokumente('alles')).toBe(true);
    expect(bereichNutztDokumente('dokumente')).toBe(true);
    expect(bereichNutztDokumente('inhalt')).toBe(false);
    expect(bereichNutztDokumente('einrichtung')).toBe(false);
    expect(bereichNutztDokumente('standort')).toBe(false);
  });

  it('toleranter Leser: Unbekanntes fällt auf „alles" zurück', () => {
    expect(parseSuchbereich(null)).toBe('alles');
    expect(parseSuchbereich('quatsch')).toBe('alles');
    expect(parseSuchbereich('einrichtung')).toBe('einrichtung');
    expect(parseSuchbereich('standort')).toBe('standort');
  });
});
