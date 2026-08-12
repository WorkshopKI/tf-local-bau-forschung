/**
 * Tests für die Wortlaut-Verknüpfung der Antrags-Suche (v3.50).
 *
 * Hintergrund: bis v3.49 ging die GANZE Anfrage als eine Zeichenkette in ein
 * `.includes()`. Wer „laser schweißen" suchte, fand nur Vorhaben, in denen genau
 * diese Wortfolge stand — ein Vorhaben mit „Laserquelle" im Titel und
 * „schweißen" im Abstract war unsichtbar. Das sah nicht wie ein Defekt aus,
 * sondern wie ein leerer Bestand.
 */
import { describe, it, expect } from 'vitest';
import { searchAntraegeSubstring, zerlegeAnfrage } from '../services/antraege-search-service';
import type { AntragTextEntry } from '../services/search-corpus';

function eintrag(vb: string, tv = '', abs = '', descr = ''): AntragTextEntry {
  return {
    vbLower: vb.toLowerCase(),
    tvLower: tv.toLowerCase(),
    absLower: abs.toLowerCase(),
    descriptorsLower: descr.toLowerCase(),
  } as AntragTextEntry;
}

const KORPUS = new Map<string, AntragTextEntry>([
  // Beide Wörter, aber in VERSCHIEDENEN Feldern — der Fall, den die alte
  // Ganz-String-Suche nie fand.
  ['A1', eintrag('Laserquelle für die Fügetechnik', '', 'automatisiertes schweißen von Blechen')],
  // Beide Wörter direkt hintereinander (fand auch die alte Suche).
  ['A2', eintrag('laser schweißen im Karosseriebau')],
  // Nur eines der beiden Wörter.
  ['A3', eintrag('Schweißen mit Ultraschall')],
  // Keines.
  ['A4', eintrag('Bilderkennung in der Qualitätssicherung')],
]);

describe('zerlegeAnfrage', () => {
  it('zerlegt an Leerraum und schreibt klein', () => {
    expect(zerlegeAnfrage('Laser  Schweißen')).toEqual(['laser', 'schweißen']);
  });

  it('liefert für leere/reine Leerraum-Anfragen nichts', () => {
    expect(zerlegeAnfrage('')).toEqual([]);
    expect(zerlegeAnfrage('   ')).toEqual([]);
  });
});

describe('searchAntraegeSubstring — Verknüpfung', () => {
  it('UND findet auch Wörter, die in verschiedenen Feldern stehen (der Defekt)', () => {
    const treffer = searchAntraegeSubstring('laser schweißen', KORPUS, 'und');
    expect(treffer.sort()).toEqual(['A1', 'A2']);
  });

  it('ODER genügt ein Wort', () => {
    const treffer = searchAntraegeSubstring('laser schweißen', KORPUS, 'oder');
    expect(treffer.sort()).toEqual(['A1', 'A2', 'A3']);
  });

  it('ODER liefert nie weniger als UND', () => {
    const und = searchAntraegeSubstring('laser schweißen', KORPUS, 'und');
    const oder = searchAntraegeSubstring('laser schweißen', KORPUS, 'oder');
    expect(oder.length).toBeGreaterThanOrEqual(und.length);
    for (const t of und) expect(oder).toContain(t);
  });

  it('Ein-Wort-Anfrage verhält sich in beiden Modi gleich (kein Verhaltensbruch)', () => {
    const und = searchAntraegeSubstring('schweißen', KORPUS, 'und').sort();
    const oder = searchAntraegeSubstring('schweißen', KORPUS, 'oder').sort();
    expect(und).toEqual(['A1', 'A2', 'A3']);
    expect(oder).toEqual(und);
  });

  it('Standard ohne Angabe ist UND', () => {
    expect(searchAntraegeSubstring('laser schweißen', KORPUS).sort()).toEqual(['A1', 'A2']);
  });

  it('leere Anfrage liefert nichts — nicht den ganzen Bestand', () => {
    // Die alte Fassung hätte mit `''.includes('')` JEDEN Antrag zurückgegeben.
    expect(searchAntraegeSubstring('', KORPUS)).toEqual([]);
    expect(searchAntraegeSubstring('   ', KORPUS)).toEqual([]);
  });

  it('Teilwort-Treffer bleiben erhalten (Substring, kein Token-Match)', () => {
    expect(searchAntraegeSubstring('laserquelle', KORPUS)).toEqual(['A1']);
    expect(searchAntraegeSubstring('quelle', KORPUS)).toEqual(['A1']);
  });
});
