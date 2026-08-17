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
  berechneVorschlaege, tokenAmCursor, alsAnfrageWert,
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
  // Getrenntes Feld seit v4.81 — am Bestand trägt JEDER Antrag ein Land, die
  // Orte verteilen sich auf 2 055 Werte. Zusammen in einem Topf führten die 16
  // Ländernamen deshalb jede Ortsliste an.
  for (let i = 0; i < 3282; i++) nimmWerte(roh, 'bundesland', ['Sachsen']);
  for (let i = 0; i < 1976; i++) nimmWerte(roh, 'bundesland', ['Bayern']);
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

  it('trennt Ort und Bundesland — jede Liste zeigt nur ihre Art und ihr Etikett', () => {
    // Der gemeldete Defekt (v4.81): unter `ort:` standen die Bundesländer,
    // unter `bl:` dieselbe Liste — beides beschriftet mit „Ort", weil beide
    // Präfixe auf dasselbe Feld zeigten.
    const orte = berechneVorschlaege({
      text: 'ort:', cursor: 4, index, verlauf: OHNE_VERLAUF,
    }).filter(x => x.art === 'wert');
    expect(orte.map(x => x.anzeige)).toContain('Dresden');
    expect(orte.map(x => x.anzeige)).not.toContain('Sachsen');
    expect(new Set(orte.map(x => x.erklaerung))).toEqual(new Set(['Ort']));

    const laender = berechneVorschlaege({
      text: 'bl:', cursor: 3, index, verlauf: OHNE_VERLAUF,
    }).filter(x => x.art === 'wert');
    // Alphabetisch seit v4.88 — Sachsen ist hier das häufigere Land und steht
    // trotzdem hinten.
    expect(laender.map(x => x.anzeige)).toEqual(['Bayern', 'Sachsen']);
    expect(new Set(laender.map(x => x.erklaerung))).toEqual(new Set(['Bundesland']));
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

describe('Gar kein Deckel (v4.88)', () => {
  const VIELE = 300;
  function vieleNetzwerke(): WertIndex {
    const roh = leererWertIndexRoh();
    for (let i = 0; i < VIELE; i++) {
      for (let n = 0; n <= i; n++) nimmWerte(roh, 'netzwerk', [`Netz${String(i).padStart(3, '0')}`]);
    }
    return verdichteWertIndex(roh);
  }

  it('zeigt ALLE Werte — gefragt war „können wir nicht alle nw anzeigen?"', () => {
    const v = berechneVorschlaege({
      text: 'nw:', cursor: 3, index: vieleNetzwerke(), verlauf: OHNE_VERLAUF,
    });
    expect(v.filter(x => x.art === 'wert')).toHaveLength(VIELE);
  });

  it('zeigt auch beim Tippen alles Passende, nicht die ersten paar', () => {
    const v = berechneVorschlaege({
      text: 'nw:Netz0', cursor: 8, index: vieleNetzwerke(), verlauf: OHNE_VERLAUF,
    });
    // Netz000…Netz099 = 100 Stück; kein Deckel schneidet sie ab.
    expect(v.filter(x => x.art === 'wert')).toHaveLength(100);
  });

  it('zählt den gefilterten Vorrat — die Zahl trägt jetzt der Reiter „Stöbern"', () => {
    expect(anzahlPassend(vieleNetzwerke(), 'netzwerk', 'Netz00')).toBe(10);
  });

  it('sammelt die hinteren Ränge auch dann, wenn der erste voll ist', () => {
    // Die Reißleine gegen den alten Abbruch: „main" darf „Frankfurt am Main"
    // nicht verlieren, nur weil genug Werte mit „Main" ANFANGEN.
    const roh = leererWertIndexRoh();
    for (let i = 0; i < 80; i++) nimmWerte(roh, 'standort', [`Main${String(i).padStart(3, '0')}`]);
    nimmWerte(roh, 'standort', ['Frankfurt am Main']);
    const werte = vorschlaegeFuer(verdichteWertIndex(roh), 'standort', 'main').map(e => e.wert);
    expect(werte).toHaveLength(81);
    expect(werte).toContain('Frankfurt am Main');
    // …und der Wortanfang-Rang steht hinter dem Wertanfang-Rang.
    expect(werte[werte.length - 1]).toBe('Frankfurt am Main');
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

  it('kommt mit einem fehlenden Anführungszeichen aus — 25 von 1 243 am Bestand', () => {
    // Alphabetisch sortiert stünden diese Bruchstücke sonst ganz vorn im
    // Katalog: ein führendes `"` kommt vor jedem Buchstaben. Es fehlt mal das
    // schließende, mal das öffnende — deshalb kein Paar-Muster.
    expect(netzwerkName('"3DLiveVis2 16KN045423_LT')).toBe('3DLiveVis2');
    expect(netzwerkName('"Eco++ 16KN131101_ED')).toBe('Eco++');
    expect(netzwerkName('CANNABIS-NET" 16KN089602_KR')).toBe('CANNABIS-NET');
    expect(netzwerkName('netSENSORS" 16KN111503_ED')).toBe('netSENSORS');
  });

  it('faltet Schreibweisen — 80 Netzwerke stehen im Export doppelt', () => {
    // Alphabetisch stehen die beiden Fassungen direkt untereinander und sehen
    // aus wie ein Anzeigefehler; die Suche unterscheidet sie ohnehin nicht.
    const roh = leererWertIndexRoh();
    for (let i = 0; i < 3; i++) nimmWerte(roh, 'netzwerk', ['3D-Fab']);
    nimmWerte(roh, 'netzwerk', ['3D-FAB']);
    const werte = verdichteWertIndex(roh).get('netzwerk') ?? [];
    // Eine Zeile, die Summe beider — und die HÄUFIGERE Schreibweise.
    expect(werte).toEqual([{ wert: '3D-Fab', anzahl: 4 }]);
  });

  it('lässt fallen, was nur aus Satzzeichen besteht', () => {
    expect(netzwerkName('"')).toBe('');
    expect(netzwerkName('"" _')).toBe('');
  });

  it('findet den Namen auch, wenn das Kennzeichen VORN steht', () => {
    // Der Fall, den ein reines „Anführungszeichen weg, Kennzeichen hinten ab"
    // verlöre — dann stünde die ganze Zeile als Netzwerkname im Katalog.
    expect(netzwerkName('16KN054101 "IWiT" _PSc')).toBe('IWiT');
    expect(netzwerkName('16KN054102 "RehaReform" _AM')).toBe('RehaReform');
  });

  it('lässt einen reinen Kennzeichen-Wert stehen — er ist der Wert', () => {
    // 68 Netzwerke führen im Export gar keinen Namen. Sie zu schlucken hieße,
    // sie unauffindbar zu machen; sie stehen alphabetisch bei den Ziffern.
    expect(netzwerkName('16KN087150')).toBe('16KN087150');
    expect(netzwerkName('16KN099324_AM/FFAK')).toBe('16KN099324_AM/FFAK');
  });

  it('ordnet alphabetisch, nicht nach Häufigkeit (v4.88)', () => {
    // Berlin ist der häufigste Wert und steht trotzdem in der Mitte: die
    // Häufigkeit ordnet nichts mehr, seit die Liste vollständig ist.
    const roh = leererWertIndexRoh();
    nimmWerte(roh, 'standort', ['Zwickau']);
    nimmWerte(roh, 'standort', ['Aachen']);
    nimmWerte(roh, 'standort', ['Berlin']);
    nimmWerte(roh, 'standort', ['Berlin']);
    expect(vorschlaegeFuer(verdichteWertIndex(roh), 'standort', '').map(e => e.wert))
      .toEqual(['Aachen', 'Berlin', 'Zwickau']);
  });

  it('sortiert nach deutschen Regeln — Umlaute stehen bei ihrem Grundbuchstaben', () => {
    const roh = leererWertIndexRoh();
    for (const o of ['Zwickau', 'Ölsnitz', 'Aachen', 'Überlingen', 'Osnabrück']) {
      nimmWerte(roh, 'standort', [o]);
    }
    expect(vorschlaegeFuer(verdichteWertIndex(roh), 'standort', '').map(e => e.wert))
      .toEqual(['Aachen', 'Ölsnitz', 'Osnabrück', 'Überlingen', 'Zwickau']);
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
