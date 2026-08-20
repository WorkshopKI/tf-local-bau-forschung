import { describe, it, expect } from 'vitest';
import { markiereText, type MarkSegment } from '../markierung';

/** Der Text muss verlustfrei rekonstruierbar sein — sonst zeigt die Liste etwas
 *  anderes an als der Antrag enthält. Diese Invariante gilt IMMER. */
function zusammen(segmente: MarkSegment[]): string {
  return segmente.map(s => s.text).join('');
}

describe('markiereText', () => {
  it('ohne Nadeln bleibt der Text ein einziges unmarkiertes Segment', () => {
    expect(markiereText('Normen und Standards', [])).toEqual([
      { text: 'Normen und Standards', art: null },
    ]);
  });

  it('markiert das wörtliche Suchwort', () => {
    const s = markiereText('Prüfung von Normen', ['normen']);
    expect(zusammen(s)).toBe('Prüfung von Normen');
    expect(s.filter(x => x.art === 'wortlaut').map(x => x.text)).toEqual(['Normen']);
  });

  it('markiert die Stamm-Variante in eigener Klasse', () => {
    const s = markiereText('Normung und Normen', ['normen'], ['normung']);
    expect(s.filter(x => x.art === 'aehnlich').map(x => x.text)).toEqual(['Normung']);
    expect(s.filter(x => x.art === 'wortlaut').map(x => x.text)).toEqual(['Normen']);
  });

  it('trifft über Umlaute hinweg an der richtigen Stelle', () => {
    // `normalize('NFD')` zerlegt „ö" — ohne Herkunftsrechnung säße die
    // Markierung um ein Zeichen daneben.
    const s = markiereText('Die Förderung läuft', ['förderung']);
    expect(s.filter(x => x.art === 'wortlaut').map(x => x.text)).toEqual(['Förderung']);
    expect(zusammen(s)).toBe('Die Förderung läuft');
  });

  it('findet ein Umlaut-Wort auch ohne Umlaut in der Anfrage', () => {
    const s = markiereText('Die Förderung läuft', ['forderung']);
    expect(s.filter(x => x.art === 'wortlaut').map(x => x.text)).toEqual(['Förderung']);
  });

  it('„ss" findet „ß" und markiert das ganze Zeichen', () => {
    const s = markiereText('Strasse und Straße', ['straße']);
    expect(s.filter(x => x.art === 'wortlaut').map(x => x.text)).toEqual(['Strasse', 'Straße']);
    expect(zusammen(s)).toBe('Strasse und Straße');
  });

  it('markiert jedes Vorkommen', () => {
    const s = markiereText('Laser, Laser, Laser', ['laser']);
    expect(s.filter(x => x.art === 'wortlaut')).toHaveLength(3);
  });

  it('markiert auch mitten im Wort — dieselbe Regel wie die Suche', () => {
    const s = markiereText('Laserquelle', ['laser']);
    expect(s.map(x => x.text)).toEqual(['Laser', 'quelle']);
  });

  it('bei Überschneidung gewinnt das getippte Wort', () => {
    const s = markiereText('Normen', ['normen'], ['norm']);
    expect(s.filter(x => x.art === 'aehnlich')).toHaveLength(0);
    expect(zusammen(s)).toBe('Normen');
  });

  it('der Überhang einer längeren Variante geht nicht verloren', () => {
    const s = markiereText('Normung', ['norm'], ['normung']);
    expect(zusammen(s)).toBe('Normung');
    expect(s.some(x => x.art === 'wortlaut')).toBe(true);
  });

  it('rekonstruiert den Text in jedem Fall verlustfrei', () => {
    const faelle: Array<[string, string[], string[]]> = [
      ['Normen und Standards', ['normen', 'standards'], []],
      ['Kalibrierstandards nach Normen', ['normen'], ['kalibrierstandards']],
      ['ÄÖÜ ßß aa', ['ss'], ['a']],
      ['', ['x'], ['y']],
      ['ohne Treffer', ['quantenkryptografie'], []],
    ];
    for (const [text, wortlaut, aehnlich] of faelle) {
      expect(zusammen(markiereText(text, wortlaut, aehnlich))).toBe(text);
    }
  });

  it('eine leere Nadel markiert NICHT alles', () => {
    expect(markiereText('Text', [''], [''])).toEqual([{ text: 'Text', art: null }]);
  });

  it('markiert, was ein Platzhalter getroffen hat — nicht die getippte Nadel', () => {
    // Ohne Muster-Pfad stünde hier gar nichts an: „mob*spec" kommt in keinem
    // Antragstext vor, „mobiInspec" schon.
    const stern = markiereText('Netzwerk mobiInspec (Messtechnik)', ['mob*spec']);
    expect(zusammen(stern)).toBe('Netzwerk mobiInspec (Messtechnik)');
    expect(stern.filter(s => s.art === 'wortlaut').map(s => s.text)).toEqual(['mobiInspec']);

    const frage = markiereText('Netzwerk mobilnspec', ['mobi?nspec']);
    expect(frage.filter(s => s.art === 'wortlaut').map(s => s.text)).toEqual(['mobilnspec']);
  });

  it('markiert jede Fundstelle eines Musters, auch mehrfach im Text', () => {
    const s = markiereText('mobiInspec und mobilnspec', ['mob*spec']);
    expect(s.filter(x => x.art === 'wortlaut').map(x => x.text)).toEqual(['mobiInspec', 'mobilnspec']);
  });

  it('bleibt bei einem Muster, das leer treffen kann, nicht stehen', () => {
    // `mobi*` kann an der Wortgrenze null Zeichen greifen — die Schleife muss
    // trotzdem terminieren und den Text verlustfrei zurückgeben.
    const s = markiereText('mobi mobil mobiInspec', ['mobi*']);
    expect(zusammen(s)).toBe('mobi mobil mobiInspec');
    expect(s.filter(x => x.art === 'wortlaut').map(x => x.text)).toEqual(['mobi', 'mobil', 'mobiInspec']);
  });

  it('unter der Drei-Zeichen-Grenze bleibt der Stern ein Sternchen', () => {
    // Dieselbe Untergrenze wie in der Trefferstufe: was zu wenig Festes trägt,
    // ist kein Muster, sondern Text — und wird als Text markiert.
    const s = markiereText('die Formel a*b steht dort', ['a*b']);
    expect(s.filter(x => x.art === 'wortlaut').map(x => x.text)).toEqual(['a*b']);
  });

  it('markiert in einem NAMEN auch über die Fuge hinweg', () => {
    // Der Treffer kam über den trennzeichen-blinden Vergleich; ohne diese
    // Markierung stünde er unerklärt in der Zeile.
    const s = markiereText('"NAFA-Tech" 16KN065602_AM', ['nafatech'], [], true);
    expect(zusammen(s)).toBe('"NAFA-Tech" 16KN065602_AM');
    expect(s.filter(x => x.art === 'wortlaut').map(x => x.text)).toEqual(['NAFA-Tech']);
  });

  it('lässt Fließtext in Ruhe — dort gilt die Faltung nicht', () => {
    // Derselbe Aufruf zeichnet auch Titel und Abstract aus. Fiele dort der Punkt
    // weg, träfe `einlaser` über den Satzpunkt hinweg.
    const satz = 'Das Verfahren braucht nur ein. Laser sind teuer.';
    expect(markiereText(satz, ['einlaser'])).toEqual([{ text: satz, art: null }]);
  });
});
