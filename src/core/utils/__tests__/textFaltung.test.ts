/**
 * Was diese Datei festnagelt:
 *
 * 1. `text.length === von.length === bis.length` — sonst greift `ursprung()`
 *    daneben, und die Treffer-Markierung sitzt am falschen Zeichen.
 * 2. Die Herkunft zeigt auf das ORIGINAL, auch wo die Faltung die Länge
 *    verschiebt („ü" wird zerlegt, „ß" verdoppelt).
 * 3. Ein Treffer, der nur die halbe Ausweitung erwischt, liefert trotzdem das
 *    ganze Ausgangszeichen — ein halbes „ß" gibt es nicht.
 */
import { describe, it, expect } from 'vitest';
import { falte, falteText, ursprung } from '../textFaltung';

describe('falteText', () => {
  it('schreibt klein und nimmt Diakritika weg', () => {
    expect(falteText('Prüfung')).toBe('prufung');
    expect(falteText('FÖRDER')).toBe('forder');
    expect(falteText('café')).toBe('cafe');
  });

  it('faellt „ß" auf „ss", damit beide Schreibweisen sich finden', () => {
    expect(falteText('Straße')).toBe('strasse');
    expect(falteText('Strasse')).toBe('strasse');
    expect(falteText('STRASSE')).toBe('strasse');
  });

  it('laesst Leerraum stehen — die Wort-Zerlegung braucht ihn', () => {
    expect(falteText('Brief  NF')).toBe('brief  nf');
  });

  it('trimmt NICHT — das Trimmen gehoert dem Aufrufer, sonst wandern Indizes', () => {
    expect(falteText('  ab ')).toBe('  ab ');
  });
});

describe('falte', () => {
  it('haelt die drei Reihen gleich lang', () => {
    for (const s of ['', 'abc', 'Prüfung', 'Straße', 'Größe ändern', 'äb']) {
      const f = falte(s);
      expect(f.von.length, s).toBe(f.text.length);
      expect(f.bis.length, s).toBe(f.text.length);
    }
  });

  it('zeigt bei einem 1:1-Zeichen auf genau dieses', () => {
    const f = falte('abc');
    expect(f.von).toEqual([0, 1, 2]);
    expect(f.bis).toEqual([1, 2, 3]);
  });

  it('laesst beide Haelften von „ss" auf dasselbe „ß" zeigen', () => {
    const f = falte('aße');
    expect(f.text).toBe('asse');
    expect(f.von).toEqual([0, 1, 1, 2]);
    expect(f.bis).toEqual([1, 2, 2, 3]);
  });

  it('behaelt die Original-Position, obwohl „ü" zerlegt wird', () => {
    const f = falte('Prüfung');
    // Das gefaltete „u" steht an Index 2 und stammt aus dem „ü" an Index 2.
    expect(f.text[2]).toBe('u');
    expect(f.von[2]).toBe(2);
    expect(f.bis[2]).toBe(3);
  });

  it('schluckt ein alleinstehendes Diakritikum, statt es mitzuzaehlen', () => {
    // „a" + kombinierendes Trema = zusammengesetztes „ä".
    const f = falte('ä');
    expect(f.text).toBe('a');
    expect(f.von).toEqual([0]);
  });
});

describe('ursprung', () => {
  it('rechnet einen Treffer auf den Original-Ausschnitt zurueck', () => {
    const roh = 'Vor Prüfung danach';
    const f = falte(roh);
    const i = f.text.indexOf('prufung');
    const { von, bis } = ursprung(f, i, i + 'prufung'.length);
    expect(roh.slice(von, bis)).toBe('Prüfung');
  });

  it('gibt das ganze „ß", wenn nur dessen erste Haelfte getroffen ist', () => {
    const roh = 'Die Straße';
    const f = falte(roh);
    const i = f.text.indexOf('stras');
    const { von, bis } = ursprung(f, i, i + 'stras'.length);
    expect(roh.slice(von, bis)).toBe('Straß');
  });

  it('liefert einen leeren Bereich fuer einen leeren Treffer', () => {
    expect(ursprung(falte('abc'), 1, 1)).toEqual({ von: 0, bis: 0 });
  });
});
