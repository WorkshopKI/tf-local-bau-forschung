/**
 * Der Stichwort-Index — welche Wörter er zählt und welche er wegwirft.
 *
 * Die Filterlisten sind am echten Bestand kuratiert (siehe Modulkopf von
 * `wort-index.ts`); hier steht, WARUM jede der drei Stufen existiert. Fällt
 * eine von ihnen weg, ist das Ergebnis wieder die Wortwolke aus Füllwörtern,
 * gegen die der Werte-Index seit jeher argumentiert.
 */
import { describe, expect, it } from 'vitest';
import {
  kanonischeForm, leererWortIndexRoh, nimmWoerter, verdichteWortIndex,
} from '../wort-index';

function zaehle(...antraege: string[][]): readonly { wert: string; anzahl: number }[] {
  const roh = leererWortIndexRoh();
  for (const texte of antraege) nimmWoerter(roh, texte);
  return verdichteWortIndex(roh, 50).liste;
}

describe('nimmWoerter', () => {
  it('zählt Anträge, nicht Vorkommen', () => {
    // Sonst wäre die Zahl neben dem Wort eine andere Größe als die
    // Trefferzahl, die nach dem Klick dasteht.
    const liste = zaehle(['Sensorik Sensorik Sensorik']);
    expect(liste).toEqual([{ wert: 'Sensorik', anzahl: 1 }]);
  });

  it('zählt über alle drei Textfelder EINES Antrags nur einmal', () => {
    // Verbundtitel, Teilvorhabentitel und Kurzbeschreibung sind EIN Antrag.
    const liste = zaehle(['Sensorik', 'Sensorik', 'Sensorik']);
    expect(liste).toEqual([{ wert: 'Sensorik', anzahl: 1 }]);
  });

  it('lässt klein geschriebene Wörter aus', () => {
    // Stufe 1: im Deutschen markiert die Großschreibung das Nomen. Ohne sie
    // stünden „genutzt", „geplanten", „realisiert" ganz oben.
    expect(zaehle(['Verwendet werden geplante Bauteile'])).toEqual([
      { wert: 'Bauteile', anzahl: 1 },
    ]);
  });

  it('lässt Funktionswörter am Satzanfang aus', () => {
    // Stufe 2: „Diese", „Durch", „Dabei" stehen groß, sind aber kein Stichwort.
    expect(zaehle(['Diese Sensorik. Durch Messung.'])).toEqual([
      { wert: 'Messung', anzahl: 1 }, { wert: 'Sensorik', anzahl: 1 },
    ]);
  });

  it('lässt die Füllwörter der Förderdomäne aus, in jeder Beugung', () => {
    // Stufe 3: „Entwicklung" steht in 8 124 von 14 225 Anträgen — es trennt
    // nichts. Ein Eintrag in der Liste deckt alle Beugungen ab.
    const liste = zaehle(['Entwicklung eines Verfahrens zur Fertigung von Bauteilen']);
    expect(liste.map(e => e.wert)).toEqual(['Bauteilen', 'Fertigung']);
  });

  it('wirft Bindestrich-Zusammensetzungen weg, deren Grundwort Beiwerk ist', () => {
    // Im Deutschen steht das Grundwort hinten: `FuE-Projekt` ist so wenig ein
    // Stichwort wie `Projekt`, und `KI-gestützt` fällt über `gestützt`.
    const liste = zaehle(['FuE-Projekt mit KI-gestützten Reglern und Laser-Sensorik']);
    expect(liste.map(e => e.wert)).toEqual(['Laser-Sensorik', 'Reglern']);
  });

  it('lässt Wörter aus, die mit einer Ziffer beginnen', () => {
    // Der bewusste Preis der Großschreibungs-Regel: `3D-Druck` fällt mit
    // heraus, dafür stehen keine Förderkennzeichen in der Liste.
    expect(zaehle(['3D-Druck an Bauteilen'], ['16KN0830 an Bauteilen']))
      .toEqual([{ wert: 'Bauteilen', anzahl: 2 }]);
  });

  it('lässt zu kurze Wörter aus', () => {
    expect(zaehle(['Ein KI Werk'])).toEqual([{ wert: 'Werk', anzahl: 1 }]);
  });

  it('faltet Beugungen und zeigt die häufigste Schreibweise', () => {
    // Zwei Zeilen für denselben Gegenstand („Bauteile" / „Bauteilen") sind eine
    // Unterscheidung ohne Unterschied — dieselbe Regel wie bei den
    // Schreibweisen im Werte-Index.
    const liste = zaehle(
      ['Bauteile'], ['Bauteile'], ['Bauteilen'],
    );
    expect(liste).toEqual([{ wert: 'Bauteile', anzahl: 3 }]);
  });

  it('zählt ein Wort auch dann einmal, wenn zwei seiner Formen im Antrag stehen', () => {
    expect(zaehle(['Bauteile und Bauteilen'])).toEqual([{ wert: 'Bauteile', anzahl: 1 }]);
  });
});

describe('verdichteWortIndex', () => {
  it('sortiert nach Häufigkeit, bei Gleichstand alphabetisch', () => {
    const liste = zaehle(
      ['Sensorik Analyse Werkstoff'], ['Sensorik Analyse'], ['Sensorik'],
    );
    expect(liste.map(e => `${e.wert}:${e.anzahl}`))
      .toEqual(['Sensorik:3', 'Analyse:2', 'Werkstoff:1']);
  });

  it('kappt die Liste, nennt aber den ganzen Bestand', () => {
    // Sonst stünde im Reiter „Stichwörter 10 Werte" — die Cache-Obergrenze,
    // die aussieht wie eine gemessene Zahl.
    const roh = leererWortIndexRoh();
    for (let i = 0; i < 30; i++) nimmWoerter(roh, [`Sensorik${i} `.repeat(30 - i)]);
    const index = verdichteWortIndex(roh, 10);
    expect(index.liste).toHaveLength(10);
    expect(index.gesamt).toBe(30);
  });
});

describe('kanonischeForm', () => {
  it('bringt Einzahl und Mehrzahl auf denselben Schlüssel', () => {
    // `wortStamm` allein löst nur EINE Endung ab: „System" würde zu „syst",
    // „Systems" zu „system" — die beiden träfen sich nie.
    expect(kanonischeForm('System')).toBe(kanonischeForm('Systems'));
    expect(kanonischeForm('Bauteile')).toBe(kanonischeForm('Bauteilen'));
    expect(kanonischeForm('Anlage')).toBe(kanonischeForm('Anlagen'));
  });

  it('wirft verschiedene Wörter NICHT zusammen', () => {
    expect(kanonischeForm('Sensorik')).not.toBe(kanonischeForm('Sensoren'));
    expect(kanonischeForm('Fertigung')).not.toBe(kanonischeForm('Fahrzeug'));
  });

  it('endet, statt sich im Kreis zu drehen', () => {
    expect(kanonischeForm('Ion')).toBe('ion');
  });
});
