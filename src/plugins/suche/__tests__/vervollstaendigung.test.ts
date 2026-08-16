/**
 * Vervollständigung im Suchfeld (v4.71).
 *
 * Der Kern ist nicht die Liste, sondern das EINSETZEN: was der Nutzer anklickt,
 * muss danach genau das suchen, was danebenstand. Am Bestand gemessen war das
 * ohne Anführungszeichen nicht der Fall — `ort:Frankfurt am Main` fand bei
 * „irgendein Wort genügt" 6 365 statt 40 Anträge.
 */
import { describe, it, expect } from 'vitest';
import {
  berechneVorschlaege, tokenAmCursor, alsAnfrageWert, vorschlagsHinweis, MAX_WERTE,
} from '../vervollstaendigung';
import {
  leererWertIndexRoh, nimmWerte, verdichteWertIndex, vorschlaegeFuer, netzwerkName,
  anzahlPassend, type WertIndex,
} from '@/plugins/antraege/services/wert-index';
import { zerlegeFeldAnfrage } from '@/core/services/search/feldpraefix';

function indexMit(): WertIndex {
  const roh = leererWertIndexRoh();
  // Häufigkeiten wie am echten Bestand: Dresden ist der gesuchte Ort, die
  // Nachbarn tragen dieselben Buchstaben und dürfen ihn nicht verdrängen.
  for (let i = 0; i < 485; i++) nimmWerte(roh, 'standort', ['Dresden']);
  for (let i = 0; i < 5; i++) nimmWerte(roh, 'standort', ['Meiningen-Dreißigacker']);
  for (let i = 0; i < 20; i++) nimmWerte(roh, 'standort', ['Frankfurt am Main']);
  for (let i = 0; i < 266; i++) nimmWerte(roh, 'organisation', ['Technische Universität Chemnitz']);
  for (let i = 0; i < 64; i++) nimmWerte(roh, 'netzwerk', ['ProAnimalLife']);
  for (let i = 0; i < 1914; i++) nimmWerte(roh, 'deskriptoren', ['IuK-Technologien']);
  return verdichteWertIndex(roh);
}

const OHNE_VERLAUF: readonly string[] = [];

describe('tokenAmCursor', () => {
  it('findet das Stück, an dem geschrieben wird — nicht das davor', () => {
    expect(tokenAmCursor('laser ort:dre', 13)?.roh).toBe('ort:dre');
    expect(tokenAmCursor('laser ort:dre', 5)?.roh).toBe('laser');
  });

  it('gibt im Leerraum zwischen zwei Stücken nichts zurück', () => {
    expect(tokenAmCursor('laser ort:dre', 6)?.roh).toBe('ort:dre');
    expect(tokenAmCursor('laser  ort', 6)).toBeNull();
  });

  it('hält eine Wortfolge in Anführungszeichen zusammen', () => {
    expect(tokenAmCursor('ast:"Technische Universität" laser', 20)?.roh)
      .toBe('ast:"Technische Universität"');
  });
});

describe('Feldnamen vorschlagen', () => {
  it('schlägt zu einem angefangenen Wort die passenden Felder vor', () => {
    const v = berechneVorschlaege({ text: 'or', cursor: 2, index: null, verlauf: OHNE_VERLAUF });
    // `ort:` heißt selbst so, `ast:` passt nur über seinen Alias `org` — der
    // eigene Name steht vorn.
    expect(v[0]?.anzeige).toBe('ort:');
    expect(v[0]?.anfrage).toBe('ort:');
    expect(v[0]?.weiter).toBe(true);
    expect(v.map(x => x.anzeige)).toContain('ast:');
  });

  it('findet das Feld über JEDE Schreibweise, setzt aber die eine ein', () => {
    const v = berechneVorschlaege({ text: 'netz', cursor: 4, index: null, verlauf: OHNE_VERLAUF });
    expect(v.map(x => x.anzeige)).toEqual(['nw:']);
  });

  it('ersetzt nur das Stück unter dem Cursor', () => {
    const v = berechneVorschlaege({
      text: 'laser or', cursor: 8, index: null, verlauf: OHNE_VERLAUF,
    });
    expect(v.find(x => x.anzeige === 'ort:')?.anfrage).toBe('laser ort:');
  });

  it('schlägt kein Feld mehr vor, sobald der Doppelpunkt steht', () => {
    const v = berechneVorschlaege({
      text: 'ort:', cursor: 4, index: null, verlauf: OHNE_VERLAUF,
    });
    expect(v.filter(x => x.art === 'feld')).toEqual([]);
  });
});

describe('Werte vorschlagen', () => {
  const index = indexMit();

  it('stellt den Wortanfang vor die Buchstaben irgendwo im Wort', () => {
    const v = berechneVorschlaege({
      text: 'ort:dre', cursor: 7, index, verlauf: OHNE_VERLAUF,
    });
    expect(v[0]?.anzeige).toBe('Dresden');
    expect(v.map(x => x.anzeige)).toContain('Meiningen-Dreißigacker');
  });

  it('findet einen Wert auch über sein zweites Wort', () => {
    const v = berechneVorschlaege({
      text: 'ort:main', cursor: 8, index, verlauf: OHNE_VERLAUF,
    });
    expect(v[0]?.anzeige).toBe('Frankfurt am Main');
  });

  it('setzt einen mehrwortigen Wert in Anführungszeichen', () => {
    const v = berechneVorschlaege({
      text: 'ast:chemnitz', cursor: 12, index, verlauf: OHNE_VERLAUF,
    });
    expect(v[0]?.anfrage).toBe('ast:"Technische Universität Chemnitz"');
  });

  it('lässt einwortige Werte unzitiert — das liest sich besser und tut dasselbe', () => {
    const v = berechneVorschlaege({
      text: 'ort:dre', cursor: 7, index, verlauf: OHNE_VERLAUF,
    });
    expect(v[0]?.anfrage).toBe('ort:Dresden');
  });

  it('das Eingesetzte wird auch wieder als EIN Suchteil gelesen', () => {
    // Der eigentliche Vertrag zwischen Vorschlag und Suche.
    const v = berechneVorschlaege({
      text: 'ast:chemnitz', cursor: 12, index, verlauf: OHNE_VERLAUF,
    });
    const teile = zerlegeFeldAnfrage(v[0]?.anfrage ?? '');
    expect(teile).toHaveLength(1);
    expect(teile[0]?.wert).toBe('Technische Universität Chemnitz');
    expect(teile[0]?.feld).toBe('organisation');
    expect(teile[0]?.exakt).toBe(true);
  });

  it('zeigt ohne getippten Wert den Katalog — dafür sind die Deskriptoren da', () => {
    const v = berechneVorschlaege({
      text: 'deskriptor:', cursor: 11, index, verlauf: OHNE_VERLAUF,
    });
    expect(v[0]?.anzeige).toBe('IuK-Technologien');
  });

  it('schweigt zu Feldern mit Fließtext — eine Wortwolke ist keine Hilfe', () => {
    for (const feld of ['titel:las', 'inhalt:las', 'notiz:las', 'fkz:16KN']) {
      const v = berechneVorschlaege({
        text: feld, cursor: feld.length, index, verlauf: OHNE_VERLAUF,
      });
      expect(v.filter(x => x.art === 'wert')).toEqual([]);
    }
  });

  it('ersetzt auch mitten in einer längeren Anfrage nur sein Stück', () => {
    const text = 'laser ort:dre 2024';
    const v = berechneVorschlaege({ text, cursor: 13, index, verlauf: OHNE_VERLAUF });
    expect(v[0]?.anfrage).toBe('laser ort:Dresden 2024');
    expect(v[0]?.cursor).toBe('laser ort:Dresden'.length);
  });

  it('liest den schon zitierten Wert weiter — der Nutzer tippt ja noch', () => {
    const v = berechneVorschlaege({
      text: 'ast:"Technische Uni', cursor: 19, index, verlauf: OHNE_VERLAUF,
    });
    expect(v[0]?.anfrage).toBe('ast:"Technische Universität Chemnitz"');
  });
});

describe('Kein stiller Deckel (v4.71.1)', () => {
  /** Mehr Netzwerke, als die Liste zeigt — die Zahl hängt am Deckel selbst. */
  const MEHR_ALS_PASSEN = MAX_WERTE + 15;
  function vieleNetzwerke(): WertIndex {
    const roh = leererWertIndexRoh();
    for (let i = 0; i < MEHR_ALS_PASSEN; i++) {
      for (let n = 0; n <= i; n++) nimmWerte(roh, 'netzwerk', [`Netz${String(i).padStart(3, '0')}`]);
    }
    return verdichteWertIndex(roh);
  }

  it('zeigt den ganzen Deskriptoren-Katalog — 42 Werte am echten Bestand', () => {
    // Die eine Zahl muss BEIDE Fälle bedienen: den kleinen Katalog vollständig
    // und den großen Vorrat angeschnitten (mit Hinweis).
    expect(MAX_WERTE).toBeGreaterThanOrEqual(42);
  });

  it('zeigt bei großem Vorrat genau den Deckel', () => {
    const v = berechneVorschlaege({
      text: 'nw:', cursor: 3, index: vieleNetzwerke(), verlauf: OHNE_VERLAUF,
    });
    expect(v.filter(x => x.art === 'wert')).toHaveLength(MAX_WERTE);
  });

  it('sagt, wie viele es insgesamt gibt — ein Deckel liest sich sonst als alles', () => {
    expect(vorschlagsHinweis({
      text: 'nw:', cursor: 3, index: vieleNetzwerke(), verlauf: OHNE_VERLAUF,
    })).toBe(`${MAX_WERTE} von ${MEHR_ALS_PASSEN} — tippe weiter, um einzugrenzen`);
  });

  it('schweigt, wenn wirklich alles dasteht', () => {
    expect(vorschlagsHinweis({
      text: 'ort:dre', cursor: 7, index: indexMit(), verlauf: OHNE_VERLAUF,
    })).toBeNull();
    expect(vorschlagsHinweis({
      text: 'laser', cursor: 5, index: indexMit(), verlauf: OHNE_VERLAUF,
    })).toBeNull();
  });

  it('zählt den gefilterten Vorrat, nicht den ganzen', () => {
    const index = vieleNetzwerke();
    // „Netz00" trifft die ersten zehn — weniger als der Deckel, also kein Hinweis.
    expect(anzahlPassend(index, 'netzwerk', 'Netz00')).toBe(10);
    expect(vorschlagsHinweis({
      text: 'nw:Netz00', cursor: 9, index, verlauf: OHNE_VERLAUF,
    })).toBeNull();
  });
});

describe('Verlauf', () => {
  it('steht hinter den gezielten Vorschlägen, nicht davor', () => {
    const v = berechneVorschlaege({
      text: 'ort:dre', cursor: 7, index: indexMit(), verlauf: ['ort:dresden laser'],
    });
    expect(v[0]?.art).toBe('wert');
    expect(v[v.length - 1]?.art).toBe('verlauf');
  });

  it('bleibt allein übrig, wenn es nichts zu vervollständigen gibt', () => {
    const v = berechneVorschlaege({
      text: 'xyz', cursor: 3, index: indexMit(), verlauf: ['xyz laser'],
    });
    expect(v.map(x => x.art)).toEqual(['verlauf']);
  });
});

describe('wert-index', () => {
  it('zählt einen Wert je Antrag einmal, auch wenn zwei Spalten ihn führen', () => {
    const roh = leererWertIndexRoh();
    nimmWerte(roh, 'organisation', ['Fraunhofer', 'Fraunhofer']);
    expect(verdichteWertIndex(roh).get('organisation')).toEqual([
      { wert: 'Fraunhofer', anzahl: 1 },
    ]);
  });

  it('nimmt den Namen des Netzwerks aus der Export-Schreibweise', () => {
    expect(netzwerkName('"ProAnimalLife" 16KN062302_KR')).toBe('ProAnimalLife');
    expect(netzwerkName('ohne Anführung')).toBe('ohne Anführung');
  });

  it('ordnet nach Häufigkeit, bei Gleichstand nach Name', () => {
    const roh = leererWertIndexRoh();
    nimmWerte(roh, 'standort', ['Zwickau']);
    nimmWerte(roh, 'standort', ['Aachen']);
    nimmWerte(roh, 'standort', ['Berlin']);
    nimmWerte(roh, 'standort', ['Berlin']);
    expect(vorschlaegeFuer(verdichteWertIndex(roh), 'standort', '', 3).map(e => e.wert))
      .toEqual(['Berlin', 'Aachen', 'Zwickau']);
  });
});

describe('alsAnfrageWert', () => {
  it('zitiert nur, was Leerraum trägt', () => {
    expect(alsAnfrageWert('Dresden')).toBe('Dresden');
    expect(alsAnfrageWert('Frankfurt am Main')).toBe('"Frankfurt am Main"');
  });

  it('wirft ein Anführungszeichen IM Wert weg — es beendete das Zitat', () => {
    expect(alsAnfrageWert('"LOHCmobil" Netz')).toBe('"LOHCmobil Netz"');
  });
});
