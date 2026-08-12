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
});
