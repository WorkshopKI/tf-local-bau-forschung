/**
 * Die Spalten des Reiters „Top Ten" — was drinsteht und was ein Klick ausführt.
 *
 * Node-Umgebung, kein React. Der Werte-Index ist hier ein Handaufbau: die
 * echte Befüllung läuft im Korpus-Walk und hat ihre eigenen Tests.
 */
import { describe, expect, it } from 'vitest';
import type { WertEintrag, WertFeld, WertIndex } from '@/plugins/antraege/services/wert-index';
import type { WortIndex } from '@/plugins/antraege/services/wort-index';
import {
  baueStoeberSpalten, STOEBER_ACHSEN, STOEBER_FELDER, stoeberAnfrage, stoeberKey,
  stoeberLabel, stoeberPraefix, WERTE_JE_FELD, WERTE_NACHSCHLAG,
} from '../stoebern';

function index(inhalt: Partial<Record<WertFeld, [string, number][]>>): WertIndex {
  const m = new Map<WertFeld, WertEintrag[]>();
  for (const [feld, werte] of Object.entries(inhalt) as [WertFeld, [string, number][]][]) {
    m.set(feld, werte.map(([wert, anzahl]) => ({ wert, anzahl })));
  }
  return m;
}

function woerter(...paare: [string, number][]): WortIndex {
  // `gesamt` ist bewusst größer als die Liste: der Cache kappt, der Bestand
  // führt mehr — genau die Unterscheidung, die die Spalte tragen muss.
  return {
    liste: paare.map(([wert, anzahl]) => ({ wert, anzahl })),
    gesamt: paare.length * 10,
  };
}

describe('stoeberAnfrage', () => {
  it('schreibt das Präfix, das die App selbst schreibt', () => {
    expect(stoeberAnfrage('standort', 'Dresden')).toBe('ort:Dresden');
    expect(stoeberAnfrage('organisation', 'Fraunhofer')).toBe('ast:Fraunhofer');
    expect(stoeberAnfrage('netzwerk', 'ProAnimalLife')).toBe('nw:ProAnimalLife');
    expect(stoeberAnfrage('deskriptoren', 'Werkstoffe')).toBe('deskriptor:Werkstoffe');
  });

  it('sucht ein Thema als Deskriptor — die Trennung ist eine der Ansicht', () => {
    expect(stoeberAnfrage('thema', 'Industrie 4.0')).toBe('deskriptor:"Industrie 4.0"');
  });

  it('sucht ein Stichwort als blanken Volltext', () => {
    // Ein Stichwort ist kein Feldwert: es steht im Titel ODER in der
    // Kurzbeschreibung, und genau das meint der Klick.
    expect(stoeberAnfrage('stichwort', 'Sensorik')).toBe('Sensorik');
  });

  it('setzt mehrwortige Werte in Anführungszeichen', () => {
    // Ohne sie zerfiele der Wert an den Leerzeichen und suchte etwas anderes,
    // als in der Zeile stand.
    expect(stoeberAnfrage('standort', 'Frankfurt am Main')).toBe('ort:"Frankfurt am Main"');
    expect(stoeberAnfrage('deskriptoren', 'Dienstleistungen (Hardwareberatung)'))
      .toBe('deskriptor:"Dienstleistungen (Hardwareberatung)"');
  });

  it('gibt jedem Feld ein Präfix', () => {
    for (const feld of STOEBER_FELDER) {
      expect(stoeberPraefix(feld).length).toBeGreaterThan(0);
    }
  });

  it('gibt jeder Achse eine Überschrift', () => {
    for (const achse of STOEBER_ACHSEN) {
      expect(stoeberLabel(achse).length).toBeGreaterThan(0);
    }
  });
});

describe('stoeberKey', () => {
  it('unterscheidet gleiche Werte in verschiedenen Achsen', () => {
    expect(stoeberKey('standort', 'Jena')).not.toBe(stoeberKey('organisation', 'Jena'));
    // Ein Thema ist ein Deskriptor-Wert, steht aber in einer eigenen Spalte —
    // ohne eigenen Schlüssel überschrieben sich ihre Trefferzahlen.
    expect(stoeberKey('thema', 'Industrie 4.0')).not.toBe(stoeberKey('deskriptoren', 'Industrie 4.0'));
  });

  it('ist unabhängig von der Schreibweise', () => {
    expect(stoeberKey('standort', 'Dresden')).toBe(stoeberKey('standort', 'DRESDEN'));
  });
});

describe('baueStoeberSpalten', () => {
  it('liefert nichts, solange der Bestand fehlt', () => {
    expect(baueStoeberSpalten(null)).toEqual([]);
  });

  it('nennt die Gesamtzahl der Werte, hält aber nur Sichtbares plus Nachschlag vor', () => {
    const viele: [string, number][] = Array.from(
      { length: 40 }, (_, i) => [`Ort ${i}`, 100 - i],
    );
    const spalten = baueStoeberSpalten(index({ standort: viele }));
    const ort = spalten.find(s => s.achse === 'standort');
    expect(ort?.gesamt).toBe(40);
    expect(ort?.werte).toHaveLength(WERTE_JE_FELD + WERTE_NACHSCHLAG);
    expect(ort?.werte[0]?.wert).toBe('Ort 0');
  });

  it('nimmt die HÄUFIGSTEN, nicht den alphabetischen Anschnitt', () => {
    // Der Defekt bis v4.110: der Index ist alphabetisch sortiert, und die
    // Vorschau nahm einfach die ersten fünf. Am echten Bestand stand damit
    // Bremen (306 Anträge) unter „die häufigsten", Sachsen (2 742) nicht.
    const selten: [string, number][] = Array.from(
      { length: 25 }, (_, i) => [`Aaa-Land ${i}`, 5],
    );
    const spalten = baueStoeberSpalten(index({
      bundesland: [
        ...selten,
        ['Baden-Württemberg', 1931], ['Bayern', 1976], ['Sachsen', 2742],
      ],
    }));
    const werte = spalten[0]?.werte.map(w => w.wert) ?? [];
    expect(werte.slice(0, 3)).toEqual(['Sachsen', 'Bayern', 'Baden-Württemberg']);
    expect(werte).not.toContain('Aaa-Land 24');
  });

  it('entscheidet Gleichstand alphabetisch, nicht nach Cursor-Reihenfolge', () => {
    const spalten = baueStoeberSpalten(index({
      deskriptoren: [['Zeta', 7], ['Alpha', 7], ['Mitte', 7]],
    }));
    expect(spalten[0]?.werte.map(w => w.wert)).toEqual(['Alpha', 'Mitte', 'Zeta']);
  });

  it('lässt Achsen ohne einen einzigen Wert weg', () => {
    // Eine Überschrift über einer leeren Spalte behauptet einen Vorrat, den es
    // nicht gibt — auch die Stichwörter, solange der Korpus lädt.
    const spalten = baueStoeberSpalten(index({
      deskriptoren: [['Werkstoffe', 5]],
      netzwerk: [],
    }));
    expect(spalten.map(s => s.achse)).toEqual(['deskriptoren']);
  });

  it('hält die Reihenfolge der Achsen ein — Stichwörter und Themen zuerst', () => {
    const spalten = baueStoeberSpalten(index({
      standort: [['Dresden', 9]],
      deskriptoren: [['Werkstoffe', 5], ['Industrie 4.0', 8]],
      organisation: [['GMBU', 3]],
      netzwerk: [['ProAnimalLife', 2]],
    }), woerter(['Sensorik', 40]));
    expect(spalten.map(s => s.achse)).toEqual([
      'stichwort', 'thema', 'deskriptoren', 'netzwerk', 'organisation', 'standort',
    ]);
  });

  it('trennt Zukunftsthemen aus dem Deskriptoren-Topf heraus', () => {
    // Am echten Bestand sind fünf der zehn häufigsten Deskriptoren ZT-Themen.
    // Stünden sie in beiden Spalten, wäre dieselbe Zeile zweimal da.
    const spalten = baueStoeberSpalten(index({
      deskriptoren: [
        ['Industrie 4.0', 822], ['Künstliche Intelligenz (KI)', 1591],
        ['IuK-Technologien', 1929], ['Baugewerbe', 915],
      ],
    }));
    const thema = spalten.find(s => s.achse === 'thema');
    const rest = spalten.find(s => s.achse === 'deskriptoren');
    expect(thema?.werte.map(w => w.wert))
      .toEqual(['Künstliche Intelligenz (KI)', 'Industrie 4.0']);
    expect(rest?.werte.map(w => w.wert)).toEqual(['IuK-Technologien', 'Baugewerbe']);
    expect(thema?.gesamt).toBe(2);
    expect(rest?.gesamt).toBe(2);
  });

  it('nimmt die Zahl der Stichwörter aus dem Index, nicht aus einem Probelauf', () => {
    // Sonst liefe die nach Häufigkeit sortierte Liste sichtbar durcheinander:
    // gemessen standen 530 Treffer über 2 711, weil die Suche dieselbe
    // Zeichenfolge in jedem Feld findet, der Index aber nur im Titel zählt.
    const spalten = baueStoeberSpalten(
      index({ standort: [['Dresden', 9]] }), woerter(['Sensorik', 40]),
    );
    expect(spalten.find(s => s.achse === 'stichwort')?.zahlArt).toBe('vorhaben');
    for (const s of spalten.filter(s => s.achse !== 'stichwort')) {
      expect(s.zahlArt, s.achse).toBe('treffer');
    }
  });

  it('gibt den Stichwörtern kein Präfix — sie sind kein Feld', () => {
    // Die Fußnote „2.055 Werte — deskriptor: tippen" wäre hier eine Zusage auf
    // eine Liste, die das Suchfeld nicht führt.
    const spalten = baueStoeberSpalten(
      index({ standort: [['Dresden', 9]] }),
      woerter(['Sensorik', 40], ['Analyse', 30]),
    );
    expect(spalten.find(s => s.achse === 'stichwort')?.praefix).toBeNull();
    expect(spalten.find(s => s.achse === 'standort')?.praefix).toBe('ort');
  });

  it('übernimmt die Reihenfolge der Stichwörter, wie sie kommt', () => {
    // `verdichteWortIndex` sortiert bereits nach Häufigkeit und kappt — ein
    // zweites Sortieren hier könnte nur davon abweichen.
    const spalten = baueStoeberSpalten(
      index({ standort: [['Dresden', 9]] }),
      woerter(['Prozesse', 903], ['Analyse', 876], ['Fertigung', 787]),
    );
    expect(spalten[0]?.werte.map(w => w.wert)).toEqual(['Prozesse', 'Analyse', 'Fertigung']);
    // `gesamt` ist der Bestand, nicht die Länge der gekappten Liste — sonst
    // stünde im Kurzformat „Stichwörter 100 Werte", also die Cache-Obergrenze
    // als gemessene Zahl.
    expect(spalten[0]?.gesamt).toBe(30);
  });
});
