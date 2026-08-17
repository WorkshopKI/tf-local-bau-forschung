/**
 * Feldsuche in der Eingabe (v4.49).
 *
 * Zwei Sorten Test hier: das Lesen selbst — und der Guard, der die Zusage hält,
 * dass JEDE Fundstelle des Antrags-Korpus auch ansprechbar ist. Ein Feld, das
 * die Suche kennt, für das es aber kein Präfix gibt, wäre genau die Lücke, die
 * schon der Bereichsname „Titel, Beschreibung, Dokumente" gerissen hat: die App
 * kann mehr, als sie sagt, und niemand kommt darauf.
 */
import { describe, it, expect } from 'vitest';
import {
  zerlegeFeldAnfrage,
  hatFeldPraefix,
  feldAusPraefix,
  aliasseFuer,
  FELD_PRAEFIX,
} from '../feldpraefix';
import { bereichFelder } from '../suchbereich';
import type { Trefferfeld } from '../trefferstelle';

describe('zerlegeFeldAnfrage', () => {
  it('zerlegt an Leerraum und lässt die Schreibweise stehen', () => {
    expect(zerlegeFeldAnfrage('Laser  Schweißen')).toEqual([
      { roh: 'Laser', wert: 'Laser', feld: undefined },
      { roh: 'Schweißen', wert: 'Schweißen', feld: undefined },
    ]);
  });

  it('liefert für leere/reine Leerraum-Anfragen nichts', () => {
    expect(zerlegeFeldAnfrage('')).toEqual([]);
    expect(zerlegeFeldAnfrage('   ')).toEqual([]);
  });

  it('liest das Präfix und trennt Wert vom Feld', () => {
    expect(zerlegeFeldAnfrage('ast:GMBU')).toEqual([
      { roh: 'ast:GMBU', wert: 'GMBU', feld: 'organisation' },
    ]);
  });

  it('ist gegenüber der Schreibweise des Präfixes tolerant', () => {
    expect(zerlegeFeldAnfrage('AST:GMBU')[0]?.feld).toBe('organisation');
    expect(zerlegeFeldAnfrage('Org_Ast:GMBU')[0]?.feld).toBe('organisation');
  });

  it('nimmt das nächste Wort, wenn der Doppelpunkt mit Leerzeichen getippt ist', () => {
    // So hat der Nutzer es aufgeschrieben: „FKZ: 16KN083001".
    expect(zerlegeFeldAnfrage('FKZ: 16KN083001')).toEqual([
      { roh: 'FKZ: 16KN083001', wert: '16KN083001', feld: 'aktenzeichen' },
    ]);
  });

  it('lässt ein angefangenes Präfix ohne Wert fallen', () => {
    // Der Zustand beim Tippen. Als Wort „ast:" zu suchen, wäre eine Erfindung.
    expect(zerlegeFeldAnfrage('ast:')).toEqual([]);
  });

  it('deutet einen fremden Doppelpunkt NICHT als Feld', () => {
    expect(zerlegeFeldAnfrage('projekt:laser')).toEqual([
      { roh: 'projekt:laser', wert: 'projekt:laser', feld: undefined },
    ]);
    expect(zerlegeFeldAnfrage('https://gmbu.de')[0]?.feld).toBeUndefined();
    // Ein führender Doppelpunkt hat kein Präfix davor.
    expect(zerlegeFeldAnfrage(':laser')[0]?.wert).toBe(':laser');
  });

  it('mischt Teile mit und ohne Feld', () => {
    expect(zerlegeFeldAnfrage('ast:GMBU laser')).toEqual([
      { roh: 'ast:GMBU', wert: 'GMBU', feld: 'organisation' },
      { roh: 'laser', wert: 'laser', feld: undefined },
    ]);
  });

  it('bindet bei der genauen Wortfolge an die ganze Phrase', () => {
    expect(zerlegeFeldAnfrage('ast: Universität Leipzig', true)).toEqual([
      { roh: 'ast: Universität Leipzig', wert: 'Universität Leipzig', feld: 'organisation' },
    ]);
    expect(zerlegeFeldAnfrage('additive Fertigung', true)).toEqual([
      { roh: 'additive Fertigung', wert: 'additive Fertigung' },
    ]);
  });

  it('`roh` setzt die Anfrage wieder zusammen — davon hängt die Abwahl ab', () => {
    for (const eingabe of ['ast:GMBU laser', 'FKZ: 16KN08 titel:Sensor', 'laser schweißen']) {
      expect(zerlegeFeldAnfrage(eingabe).map(t => t.roh).join(' ')).toBe(eingabe);
    }
  });
});

/**
 * Der Grund für die Anführungszeichen steht im Modul-Kommentar und ist gemessen:
 * `ort:Frankfurt am Main` liefert 48 Treffer bei „alle Wörter" und 6 365 bei
 * „irgendein Wort genügt" — `ort:"Frankfurt am Main"` in beiden Fällen die 40,
 * die es sind.
 */
describe('Anführungszeichen halten einen Wert zusammen (v4.71)', () => {
  it('macht aus einem mehrwortigen Feldwert EINEN Suchteil', () => {
    expect(zerlegeFeldAnfrage('ast:"Technische Universität Chemnitz"')).toEqual([
      {
        roh: 'ast:"Technische Universität Chemnitz"',
        wert: 'Technische Universität Chemnitz',
        feld: 'organisation',
        exakt: true,
      },
    ]);
  });

  it('liest auch die noch offene Form — das ist der Zustand beim Tippen', () => {
    expect(zerlegeFeldAnfrage('ort:"Sankt Aug')).toEqual([
      { roh: 'ort:"Sankt Aug', wert: 'Sankt Aug', feld: 'standort', exakt: true },
    ]);
  });

  it('nimmt die Wortfolge auch hinter einem Leerzeichen nach dem Doppelpunkt', () => {
    expect(zerlegeFeldAnfrage('ast: "Universität Leipzig"')).toEqual([
      {
        roh: 'ast: "Universität Leipzig"',
        wert: 'Universität Leipzig',
        feld: 'organisation',
        exakt: true,
      },
    ]);
  });

  it('bindet eine Wortfolge ohne Feld an den Bereich, statt sie zu zerlegen', () => {
    expect(zerlegeFeldAnfrage('"additive Fertigung"')).toEqual([
      { roh: '"additive Fertigung"', wert: 'additive Fertigung', feld: undefined, exakt: true },
    ]);
  });

  it('lässt die übrigen Teile daneben unberührt', () => {
    expect(zerlegeFeldAnfrage('laser ast:"TU Chemnitz" 2024')).toEqual([
      { roh: 'laser', wert: 'laser', feld: undefined },
      { roh: 'ast:"TU Chemnitz"', wert: 'TU Chemnitz', feld: 'organisation', exakt: true },
      { roh: '2024', wert: '2024', feld: undefined },
    ]);
  });

  it('setzt `exakt` NUR bei Anführungszeichen — sonst bleibt alles wie zuvor', () => {
    for (const t of zerlegeFeldAnfrage('laser ast:GMBU FKZ: 16KN08')) {
      expect(t.exakt).toBeUndefined();
    }
  });

  it('lässt ein leeres Zitat fallen, statt alles zu treffen', () => {
    expect(zerlegeFeldAnfrage('ast:""')).toEqual([]);
    expect(zerlegeFeldAnfrage('""')).toEqual([]);
  });

  it('deutet einen Doppelpunkt INNERHALB des Zitats nicht als Präfix', () => {
    expect(zerlegeFeldAnfrage('"Projekt: Laser"')).toEqual([
      { roh: '"Projekt: Laser"', wert: 'Projekt: Laser', feld: undefined, exakt: true },
    ]);
  });

  it('`roh` setzt auch die zitierte Anfrage wieder zusammen', () => {
    const eingabe = 'ast:"TU Chemnitz" laser';
    expect(zerlegeFeldAnfrage(eingabe).map(t => t.roh).join(' ')).toBe(eingabe);
  });
});

describe('Kennzeichen-Präfixe (v4.53)', () => {
  it('`vb:` meint das Verbundkennzeichen, `fkz:` das Teilvorhaben', () => {
    expect(zerlegeFeldAnfrage('vb:ZKN073232')).toEqual([
      { roh: 'vb:ZKN073232', wert: 'ZKN073232', feld: 'verbundkennzeichen' },
    ]);
    expect(zerlegeFeldAnfrage('fkz:16KN073269')[0]?.feld).toBe('aktenzeichen');
  });

  it('beide Schreibweisen des Antrags führen auf DASSELBE Feld', () => {
    // `16KN065624` (Förderkennzeichen) und `KNF065624` (Fachsystem) sind
    // derselbe Antrag — wer eine Nummer tippt, fragt nicht nach der Spalte.
    for (const alias of ['fkz', 'akz', 'aktenzeichen', 'kennzeichen']) {
      expect(feldAusPraefix(alias)).toBe('aktenzeichen');
    }
  });

  it('das Netzwerk schreibt sich `nw:`, liest sich aber weiter als `netz:`', () => {
    // Umbenennung v4.53: die App schlägt nur noch `nw:` vor. Eine gemerkte
    // Suche mit `netz:` darf davon nicht ins Leere laufen.
    expect(FELD_PRAEFIX.netzwerk).toBe('nw');
    expect(feldAusPraefix('nw')).toBe('netzwerk');
    expect(feldAusPraefix('netz')).toBe('netzwerk');
    expect(zerlegeFeldAnfrage('netz:ProAnimalLife')[0]?.feld).toBe('netzwerk');
  });
});

describe('Ort und Bundesland sind zwei Felder (v4.81)', () => {
  it('`bl:` meint das Bundesland, `ort:` den Ort', () => {
    // Vorher waren beide Schreibweisen Aliasse DESSELBEN Feldes: `bl:` zeigte
    // Städte, `ort:` zeigte Bundesländer, und die Vorschlagsliste beschriftete
    // beides mit „Ort".
    expect(FELD_PRAEFIX.bundesland).toBe('bl');
    expect(FELD_PRAEFIX.standort).toBe('ort');
    for (const alias of ['bl', 'buland', 'bundesland', 'buland_ast', 'buland_afs']) {
      expect(feldAusPraefix(alias), alias).toBe('bundesland');
    }
    for (const alias of ['ort', 'standort', 'ort_ast', 'ort_afs']) {
      expect(feldAusPraefix(alias), alias).toBe('standort');
    }
  });

  it('trennt eine Anfrage, die beide nennt, in zwei Teile', () => {
    expect(zerlegeFeldAnfrage('ort:Dresden bl:Sachsen')).toEqual([
      { roh: 'ort:Dresden', wert: 'Dresden', feld: 'standort' },
      { roh: 'bl:Sachsen', wert: 'Sachsen', feld: 'bundesland' },
    ]);
  });
});

describe('hatFeldPraefix', () => {
  it('erkennt, ob die Anfrage ein Feld nennt', () => {
    expect(hatFeldPraefix('laser schweißen')).toBe(false);
    expect(hatFeldPraefix('laser ast:GMBU')).toBe(true);
    expect(hatFeldPraefix('projekt:laser')).toBe(false);
  });
});

describe('Guard: jede Fundstelle ist ansprechbar', () => {
  it('jedes Feld aus „alle Felder" hat ein Präfix', () => {
    const ohne = Array.from(bereichFelder('alles')).filter(f => FELD_PRAEFIX[f] === undefined);
    expect(ohne).toEqual([]);
  });

  it('das genannte Präfix löst auf sein eigenes Feld auf', () => {
    for (const [feld, praefix] of Object.entries(FELD_PRAEFIX)) {
      expect(feldAusPraefix(praefix as string)).toBe(feld as Trefferfeld);
    }
  });

  it('jeder Alias löst auf genau ein Feld auf', () => {
    for (const feld of Object.keys(FELD_PRAEFIX) as Trefferfeld[]) {
      const aliasse = aliasseFuer(feld);
      expect(aliasse.length).toBeGreaterThan(0);
      for (const a of aliasse) expect(feldAusPraefix(a)).toBe(feld);
    }
  });

  it('führt kein Präfix für Dokument oder Ähnlichkeit', () => {
    // Beide kommen nicht aus dem Antrags-Korpus; ihre Wahl sind der Bereich
    // „nur Dokumente" und der Ähnlichkeits-Schalter (siehe Modul-Kommentar).
    expect(FELD_PRAEFIX.dokument).toBeUndefined();
    expect(FELD_PRAEFIX.aehnlichkeit).toBeUndefined();
    expect(feldAusPraefix('dokument')).toBeUndefined();
  });
});
