/**
 * Die Matrix Schritt × Träger. Die zentrale Zusage steht im zweiten Block:
 * **ein Verbund-Feld füllt nur die Verbund-Spalte**. Der Design-Prototyp zeigt
 * eine Zeile, die beide Hälften trägt (`AAE` mit Verbund- UND TV-Datum); in den
 * echten Daten gibt es diese Zeile nicht — `AAE` ist ein TV-Feld, sein
 * Verbund-Gegenstück heißt `XTE` und ist ein eigener Katalog-Eintrag. Wer das
 * zusammenzieht, erfindet eine Beziehung, die nirgends steht.
 */
import { describe, it, expect } from 'vitest';
import {
  baueSchrittMatrix, baueSpalten, phasenGruppen, tvAchse,
} from '@/core/status/chronik-matrix';
import type { ChronikEintrag } from '@/core/status/chronik';
import type { OffenesPaarJeTv } from '@/core/status/waechter';
import type { MappingVersion, StatusFeldEintrag } from '@/core/status/typen';

const feld = (code: string, over: Partial<StatusFeldEintrag> = {}): StatusFeldEintrag => ({
  feldId: `D_${code}`,
  label: `Bezeichnung ${code}`,
  typ: 'datum',
  ebene: 'tv',
  code,
  prominenzDefault: 'normal',
  aktiv: true,
  unkuratiert: false,
  ...over,
});

const AAE = feld('AAE', { prominenzDefault: 'meilenstein', zahPhaseId: 'eingang' });
const XTE = feld('XTE', { ebene: 'verbund', zahPhaseId: 'eingang' });
const ANF = feld('ANF', { zahPhaseId: 'pruefung' });
const ANB = feld('ANB', { zahPhaseId: 'pruefung' });

const TV = ['16KN122049', '16KN122050', '16KN122051'];
const SPALTEN = baueSpalten(TV);

function fassung(felder: readonly StatusFeldEintrag[]): MappingVersion {
  return {
    version: 1, autor: null, zeitstempel: '2026-08-01T00:00:00.000Z',
    kategorien: [], felder: [...felder], werte: [],
  };
}

const e = (f: StatusFeldEintrag, tag: string, tvIds: string[] = []): ChronikEintrag =>
  ({ tag, feld: f, wert: tag, tvIds });

const paar = (fehlt: string, tvId: string, seit: string, tage: number): OffenesPaarJeTv =>
  ({ gesetzt: 'X', fehlt, fehltLabel: `Bezeichnung ${fehlt}`, seit, tage, rolle: null, tvId });

describe('chronik-matrix — Spaltenachse', () => {
  it('setzt den Verbund vor die Teilvorhaben und nummeriert sie durch', () => {
    expect(SPALTEN.map(s => s.id)).toEqual(['verbund', ...TV]);
    expect(SPALTEN.map(s => s.kurz)).toEqual(['Verbund', 'TV 1', 'TV 2', 'TV 3']);
    expect(SPALTEN[0]?.lang).toBe('3 Teilvorhaben');
    expect(SPALTEN[2]?.lang).toBe('16KN122050');
  });

  it('zählt ein einzelnes Teilvorhaben im Singular', () => {
    expect(baueSpalten(['A'])[0]?.lang).toBe('1 Teilvorhaben');
  });
});

describe('chronik-matrix — Ebenen werden nicht zusammengezogen', () => {
  it('füllt mit einem Verbund-Eintrag NUR die Verbund-Spalte', () => {
    const [zeile] = baueSchrittMatrix([e(XTE, '2026-03-10')], [], SPALTEN, fassung([XTE]));
    expect(zeile?.zellen.get('verbund')).toEqual({ art: 'datum', tag: '2026-03-10' });
    for (const tv of TV) expect(zeile?.zellen.has(tv)).toBe(false);
  });

  it('füllt mit einem TV-Eintrag NUR die TV-Spalten', () => {
    const [zeile] = baueSchrittMatrix(
      [e(AAE, '2026-02-24', [TV[0]!, TV[1]!])], [], SPALTEN, fassung([AAE]),
    );
    expect(zeile?.zellen.has('verbund')).toBe(false);
    expect(zeile?.zellen.get(TV[0]!)).toEqual({ art: 'datum', tag: '2026-02-24' });
    expect(zeile?.zellen.get(TV[2]!)).toBeUndefined();
  });

  it('hält AAE und XTE als ZWEI Zeilen auseinander', () => {
    const zeilen = baueSchrittMatrix(
      [e(AAE, '2026-02-24', [TV[0]!]), e(XTE, '2026-03-10')], [], SPALTEN, fassung([AAE, XTE]),
    );
    expect(zeilen.map(z => z.feld.code)).toEqual(['AAE', 'XTE']);
  });

  it('verteilt denselben Schritt an verschiedenen Tagen auf die richtigen Spalten', () => {
    const [zeile] = baueSchrittMatrix(
      [e(AAE, '2026-02-24', [TV[0]!]), e(AAE, '2026-03-06', [TV[1]!, TV[2]!])],
      [], SPALTEN, fassung([AAE]),
    );
    expect(zeile?.zellen.get(TV[0]!)).toEqual({ art: 'datum', tag: '2026-02-24' });
    expect(zeile?.zellen.get(TV[2]!)).toEqual({ art: 'datum', tag: '2026-03-06' });
  });

  it('ignoriert Träger, die gar keine Spalte haben', () => {
    const [zeile] = baueSchrittMatrix(
      [e(AAE, '2026-02-24', ['FREMD'])], [], SPALTEN, fassung([AAE]),
    );
    expect([...(zeile?.zellen.keys() ?? [])]).toEqual([]);
  });
});

describe('chronik-matrix — fehlende Kürzel sind Zellen', () => {
  it('setzt die Lücke in die Spalte ihres Teilvorhabens', () => {
    const zeilen = baueSchrittMatrix(
      [e(ANF, '2026-04-17', [TV[0]!])],
      [paar('ANF', TV[2]!, '2026-04-17', 101)],
      SPALTEN, fassung([ANF]),
    );
    expect(zeilen).toHaveLength(1);
    expect(zeilen[0]?.zellen.get(TV[2]!)).toEqual({ art: 'fehlt', seit: '2026-04-17', tage: 101 });
    expect(zeilen[0]?.fehlt).toBe(1);
  });

  it('legt eine Zeile auch für ein Kürzel an, das NIRGENDS gesetzt ist', () => {
    const zeilen = baueSchrittMatrix(
      [], [paar('ANB', TV[1]!, '2026-05-05', 35)], SPALTEN, fassung([ANB]),
    );
    expect(zeilen.map(z => z.feld.code)).toEqual(['ANB']);
    expect(zeilen[0]?.ankerTag).toBe('2026-05-05');
  });

  it('lässt einen gesetzten Termin die Lücke schlagen', () => {
    const [zeile] = baueSchrittMatrix(
      [e(ANF, '2026-04-17', [TV[0]!])],
      [paar('ANF', TV[0]!, '2026-04-01', 9)],
      SPALTEN, fassung([ANF]),
    );
    expect(zeile?.zellen.get(TV[0]!)).toEqual({ art: 'datum', tag: '2026-04-17' });
    expect(zeile?.fehlt).toBe(0);
  });

  it('verwirft eine Lücke, deren Kürzel der Katalog nicht kennt', () => {
    expect(baueSchrittMatrix([], [paar('UNBEKANNT', TV[0]!, '2026-05-05', 9)],
      SPALTEN, fassung([ANF]))).toEqual([]);
  });
});

describe('chronik-matrix — Streuung zwischen den Teilvorhaben', () => {
  it('rechnet die Spanne über die TV-Spalten, nicht über den Verbund', () => {
    const [zeile] = baueSchrittMatrix(
      [e(AAE, '2026-02-24', [TV[0]!]), e(AAE, '2026-03-06', [TV[1]!])],
      [], SPALTEN, fassung([AAE]),
    );
    expect(zeile?.fruehestesTv).toBe('2026-02-24');
    expect(zeile?.spaetestesTv).toBe('2026-03-06');
    expect(zeile?.streuungTage).toBe(10);
  });

  it('meldet 0 Tage, wenn alle Teilvorhaben am selben Tag liefern', () => {
    const [zeile] = baueSchrittMatrix(
      [e(AAE, '2026-03-24', [TV[0]!, TV[1]!, TV[2]!])], [], SPALTEN, fassung([AAE]),
    );
    expect(zeile?.streuungTage).toBe(0);
  });

  it('lässt die Streuung offen, wo es nichts zu vergleichen gibt', () => {
    const [nurEins] = baueSchrittMatrix(
      [e(AAE, '2026-03-24', [TV[0]!])], [], SPALTEN, fassung([AAE]),
    );
    expect(nurEins?.streuungTage).toBeNull();
    const [nurVerbund] = baueSchrittMatrix([e(XTE, '2026-03-10')], [], SPALTEN, fassung([XTE]));
    expect(nurVerbund?.streuungTage).toBeNull();
    expect(nurVerbund?.fruehestesTv).toBeNull();
  });

  it('zählt eine Lücke NICHT in die Streuung — sie hat kein Datum', () => {
    const [zeile] = baueSchrittMatrix(
      [e(ANF, '2026-04-17', [TV[0]!, TV[1]!])],
      [paar('ANF', TV[2]!, '2026-04-17', 101)],
      SPALTEN, fassung([ANF]),
    );
    expect(zeile?.streuungTage).toBe(0);
  });
});

describe('chronik-matrix — Reihenfolge', () => {
  it('sortiert nach dem frühesten Beleg der Zeile', () => {
    const zeilen = baueSchrittMatrix(
      [e(ANF, '2026-04-17', [TV[0]!]), e(AAE, '2026-02-24', [TV[0]!]), e(XTE, '2026-03-10')],
      [], SPALTEN, fassung([AAE, XTE, ANF]),
    );
    expect(zeilen.map(z => z.feld.code)).toEqual(['AAE', 'XTE', 'ANF']);
  });

  it('stellt bei gleichem Anker den Meilenstein nach vorn', () => {
    const zeilen = baueSchrittMatrix(
      [e(ANF, '2026-02-24', [TV[0]!]), e(AAE, '2026-02-24', [TV[0]!])],
      [], SPALTEN, fassung([AAE, ANF]),
    );
    expect(zeilen.map(z => z.feld.code)).toEqual(['AAE', 'ANF']);
  });
});

describe('chronik-matrix — Phasen-Rinne', () => {
  it('beschriftet nur den Beginn eines Laufs — und nennt seine Länge', () => {
    const zeilen = baueSchrittMatrix(
      [e(AAE, '2026-02-24', [TV[0]!]), e(XTE, '2026-03-10'), e(ANF, '2026-04-17', [TV[0]!])],
      [], SPALTEN, fassung([AAE, XTE, ANF]),
    );
    // Die Länge ist der Grund, aus dem `phasenRinne` abgelöst wurde: die
    // Beschriftung steht per `rowSpan` über der ganzen Gruppe, sonst bestimmt
    // ein langes Label die Höhe einer einzelnen Zeile.
    expect(phasenGruppen(zeilen)).toEqual([
      { phase: 'eingang', laenge: 2 }, null, { phase: 'pruefung', laenge: 1 },
    ]);
  });

  it('schreibt eine zurückkehrende Phase erneut hin, statt sie zu unterschlagen', () => {
    const zeilen = baueSchrittMatrix(
      [e(AAE, '2026-02-24', [TV[0]!]), e(ANF, '2026-03-01', [TV[0]!]), e(XTE, '2026-04-01')],
      [], SPALTEN, fassung([AAE, ANF, XTE]),
    );
    expect(phasenGruppen(zeilen)).toEqual([
      { phase: 'eingang', laenge: 1 },
      { phase: 'pruefung', laenge: 1 },
      { phase: 'eingang', laenge: 1 },
    ]);
  });

  it('lässt Zeilen ohne gepflegte Phase leer', () => {
    const ohne = feld('OHNE');
    const zeilen = baueSchrittMatrix(
      [e(ohne, '2026-02-24', [TV[0]!])], [], SPALTEN, fassung([ohne]),
    );
    expect(phasenGruppen(zeilen)).toEqual([{ phase: null, laenge: 1 }]);
  });

  it('hängt Zeilen ohne Phase nicht an die vorige Gruppe an', () => {
    // Sie gehören ihr nicht — unter einem `rowSpan` der Vorgängerin läsen sie
    // sich als deren Phase, obwohl das Fachsystem für sie keine führt.
    const ohne = feld('OHNE');
    const zeilen = baueSchrittMatrix(
      [e(AAE, '2026-02-24', [TV[0]!]), e(ohne, '2026-03-01', [TV[0]!])],
      [], SPALTEN, fassung([AAE, ohne]),
    );
    expect(phasenGruppen(zeilen)).toEqual([
      { phase: 'eingang', laenge: 1 }, { phase: null, laenge: 1 },
    ]);
  });

  it('deckt jede Zeile genau einmal ab — die Summe der Läufe ist die Zeilenzahl', () => {
    const ohne = feld('OHNE');
    const zeilen = baueSchrittMatrix(
      [e(AAE, '2026-02-24', [TV[0]!]), e(XTE, '2026-03-10'),
        e(ohne, '2026-03-20', [TV[0]!]), e(ANF, '2026-04-17', [TV[0]!])],
      [], SPALTEN, fassung([AAE, XTE, ohne, ANF]),
    );
    const gruppen = phasenGruppen(zeilen);
    const summe = gruppen.reduce((n, g) => n + (g?.laenge ?? 0), 0);
    expect(summe).toBe(zeilen.length);
  });
});

describe('tvAchse — dieselbe Nummer in jedem Wirt', () => {
  it('nummeriert nach sortiertem Aktenzeichen, nicht nach Eingangsreihenfolge', () => {
    const a = tvAchse([
      { aktenzeichen: '16KN084433' },
      { aktenzeichen: '16KN084430' },
      { aktenzeichen: '16KN084432' },
    ]);
    expect(a.tvIds).toEqual(['16KN084430', '16KN084432', '16KN084433']);
    expect(a.nummern.get('16KN084430')).toBe(1);
    expect(a.nummern.get('16KN084433')).toBe(3);
  });

  it('liefert für dieselbe Menge in anderer Reihenfolge dieselbe Karte', () => {
    const tvs = [{ aktenzeichen: 'B' }, { aktenzeichen: 'A' }, { aktenzeichen: 'C' }];
    const eine = tvAchse(tvs);
    const andere = tvAchse([...tvs].reverse());
    expect([...andere.nummern]).toEqual([...eine.nummern]);
  });

  it('bleibt bei leerer Eingabe leer — dann fällt die Marke auf das Aktenzeichen zurück', () => {
    const a = tvAchse([]);
    expect(a.tvIds).toEqual([]);
    expect(a.nummern.size).toBe(0);
  });

  it('stimmt mit der Spaltenachse überein, die aus denselben Ids gebaut wird', () => {
    const a = tvAchse([{ aktenzeichen: 'Y' }, { aktenzeichen: 'X' }]);
    const spalten = baueSpalten(a.tvIds);
    expect(spalten.map(s => s.kurz)).toEqual(['Verbund', 'TV 1', 'TV 2']);
    expect(a.nummern.get('X')).toBe(1);
  });
});
