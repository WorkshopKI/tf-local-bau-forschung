/**
 * Der Antworttext ist ein MODELLtext — die Zerlegung muss deshalb an dem
 * scheitern dürfen, was sie nicht versteht, ohne dabei etwas zu erfinden.
 * Jeder Fall hier ist aus einer echten Antwort abgeschrieben (Screenshot zur
 * Frage „Welche Vorhaben drehen sich hauptsächlich um Normung und Standards?").
 */
import { describe, it, expect } from 'vitest';
import {
  kennzeichenIn, zerlegeAntwort, fkzMuster, KURZFORM_ZEICHEN,
} from '../genannteTreffer';

const ECHTE_ANTWORT = [
  'Von den 566 gefundenen Vorhaben wurden 13 explizit als "hauptsächlich um Normung',
  'und Standards" gekennzeichnet (Befund). Die Relevanz-Verteilung aller Treffer',
  'lautet: hoch 4, mittel 26, gering 536.',
  '',
  'Die vorliegenden 20 Treffer zeigen, welche Vorhaben konkret Normung adressieren:',
  '',
  '- Entwicklung von Normierungsalgorithmen zum Spektrentransfer zwischen SERS und Raman (16KN042124).',
  '- Standardisiertes Verfahren zur Probennahme und -vorbereitung (16KN062342).',
  '- KI-gestützte Standard-Templates für SAP BDC/SAC im Healthcare-Umfeld (16EP250167).',
].join('\n');

describe('kennzeichenIn', () => {
  it('findet die Kennzeichen in Reihenfolge und ohne Dubletten', () => {
    expect(kennzeichenIn(ECHTE_ANTWORT))
      .toEqual(['16KN042124', '16KN062342', '16EP250167']);
  });

  it('nennt ein zweimal genanntes Vorhaben nur einmal', () => {
    expect(kennzeichenIn('16KN042124 und nochmal 16KN042124')).toEqual(['16KN042124']);
  });

  it('haelt die Zahlen des Befunds fuer keine Kennzeichen', () => {
    expect(kennzeichenIn('hoch 4, mittel 26, gering 536 von 14.225')).toEqual([]);
  });

  it('das geteilte Muster merkt sich keine Position zwischen zwei Aufrufen', () => {
    // Ein `g`-RegExp als Modulkonstante ist die klassische Falle: der zweite
    // Aufruf begaenne dort, wo der erste aufhoerte, und faende nichts.
    const t = 'Beleg 16KN042124.';
    expect(kennzeichenIn(t)).toEqual(['16KN042124']);
    expect(kennzeichenIn(t)).toEqual(['16KN042124']);
  });

  it('fkzMuster liefert JEDESMAL ein frisches Objekt', () => {
    const a = fkzMuster();
    a.exec('16KN042124');
    expect(fkzMuster().lastIndex).toBe(0);
  });
});

describe('zerlegeAntwort', () => {
  it('haengt jeden Satz an sein Vorhaben, ohne Strich und ohne Kennzeichen', () => {
    const belege = zerlegeAntwort(ECHTE_ANTWORT);
    expect(belege.get('16KN042124')?.satz)
      .toBe('Entwicklung von Normierungsalgorithmen zum Spektrentransfer zwischen SERS und Raman');
    expect(belege.get('16EP250167')?.satz)
      .toBe('KI-gestützte Standard-Templates für SAP BDC/SAC im Healthcare-Umfeld');
  });

  it('laesst den Zahlen-Absatz weg — er gehoert an keine einzelne Zeile', () => {
    const belege = zerlegeAntwort(ECHTE_ANTWORT);
    expect(belege.size).toBe(3);
    for (const b of belege.values()) expect(b.satz).not.toMatch(/Relevanz-Verteilung/);
  });

  it('gibt allen Kennzeichen EINER Zeile denselben Satz', () => {
    const belege = zerlegeAntwort('- Beide bauen auf derselben Norm auf (16KN042124, 16KN062342).');
    expect(belege.get('16KN042124')?.satz).toBe('Beide bauen auf derselben Norm auf');
    expect(belege.get('16KN062342')?.satz).toBe(belege.get('16KN042124')?.satz);
  });

  it('der erste Satz gewinnt — die spaetere Zusammenfassung verdraengt ihn nicht', () => {
    const belege = zerlegeAntwort([
      '- Die eigentliche Aussage (16KN042124).',
      '',
      'Zusammengefasst betrifft das vor allem 16KN042124.',
    ].join('\n'));
    expect(belege.get('16KN042124')?.satz).toBe('Die eigentliche Aussage');
  });

  it('erfindet nichts, wo nur ein Kennzeichen steht', () => {
    expect(zerlegeAntwort('- 16KN042124').size).toBe(0);
    expect(zerlegeAntwort('- (16KN042124)').size).toBe(0);
  });

  it('kommt mit leerer und fehlender Antwort klar', () => {
    expect(zerlegeAntwort(null).size).toBe(0);
    expect(zerlegeAntwort('').size).toBe(0);
    expect(zerlegeAntwort('Kein einziges Vorhaben passt.').size).toBe(0);
  });

  it('kuerzt an der Wortgrenze und behaelt den vollen Satz daneben', () => {
    const lang = `Ein sehr ausfuehrlicher Satz ${'mit vielen Woertern '.repeat(12)}Ende`;
    const belege = zerlegeAntwort(`- ${lang} (16KN042124).`);
    const b = belege.get('16KN042124');
    expect(b?.satz.length).toBeGreaterThan(KURZFORM_ZEICHEN);
    expect(b?.kurz.length).toBeLessThanOrEqual(KURZFORM_ZEICHEN + 1);
    expect(b?.kurz.endsWith('…')).toBe(true);
    expect(b?.kurz.slice(0, -1).endsWith(' ')).toBe(false);
  });

  it('kuerzt nicht, was ohnehin passt', () => {
    const belege = zerlegeAntwort('- Kurz und knapp (16KN042124).');
    expect(belege.get('16KN042124')?.kurz).toBe('Kurz und knapp');
  });

  it('nimmt auch Aufzaehlungen mit Ziffer und Stern', () => {
    expect(zerlegeAntwort('1. Erste Aussage (16KN042124).').get('16KN042124')?.satz)
      .toBe('Erste Aussage');
    expect(zerlegeAntwort('* Zweite Aussage (16KN062342).').get('16KN062342')?.satz)
      .toBe('Zweite Aussage');
  });
});
