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

function eintrag(vb: string, tv = '', abs = '', descr = '', akronym = '', akz = ''): AntragTextEntry {
  return {
    vbLower: vb.toLowerCase(),
    tvLower: tv.toLowerCase(),
    absLower: abs.toLowerCase(),
    descriptorsLower: descr.toLowerCase(),
    akronymLower: akronym.toLowerCase(),
    akzLower: akz.toLowerCase(),
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

/**
 * Der reale Fall, der das Feld nötig machte: der Netzwerkantrag `16KN083001`
 * heisst `mobiInspec`, sein VB-Titel lautet aber nur „Mobile Messtechnik für
 * die Energieversorgung". Jeder andere Satz desselben Netzwerks trägt das
 * Akronym im Titel — ausgerechnet die gesuchte Phase 1 nicht.
 */
describe('searchAntraegeSubstring — Akronym', () => {
  const AKRONYM_KORPUS = new Map<string, AntragTextEntry>([
    ['NW1', eintrag('Mobile Messtechnik für die Energieversorgung', '', '', '', 'mobiInspec')],
    ['NW2', eintrag('Mobile Messtechnik für die Energieversorgung (mobiInspec)', '', '', '', 'mobiInspec')],
    ['X1', eintrag('Bilderkennung in der Qualitätssicherung', '', '', '', 'QualiCam')],
  ]);

  it('findet den Antrag über sein Akronym, auch wenn kein Titel es trägt', () => {
    expect(searchAntraegeSubstring('mobiinspec', AKRONYM_KORPUS).sort()).toEqual(['NW1', 'NW2']);
  });

  it('das Akronym zählt als eigenes Feld bei der UND-Verknüpfung', () => {
    expect(searchAntraegeSubstring('mobiinspec messtechnik', AKRONYM_KORPUS).sort())
      .toEqual(['NW1', 'NW2']);
  });

  it('grenzt weiterhin ab — ein fremdes Akronym trifft nicht', () => {
    expect(searchAntraegeSubstring('qualicam', AKRONYM_KORPUS)).toEqual(['X1']);
  });
});

/**
 * Der Leerzustand der Suche verspricht „Nach Titel, Akronym, FKZ oder
 * Stammdaten" — das Aktenzeichen war bis v4.4.2 als einziges dieser drei
 * nicht durchsucht. Es steht im Korpus vorberechnet klein, weil es sonst pro
 * Eintrag und Wort neu alloziert werden müsste.
 */
describe('searchAntraegeSubstring — Aktenzeichen', () => {
  const FKZ_KORPUS = new Map<string, AntragTextEntry>([
    ['16KN083001', eintrag('Mobile Messtechnik', '', '', '', 'mobiInspec', '16KN083001')],
    ['16KN083020', eintrag('mobiInspec - MagPV', '', '', '', 'MagPV', '16KN083020')],
    ['16EP123456', eintrag('Bilderkennung', '', '', '', 'QualiCam', '16EP123456')],
  ]);

  it('findet den Antrag über sein volles Aktenzeichen', () => {
    expect(searchAntraegeSubstring('16KN083001', FKZ_KORPUS)).toEqual(['16KN083001']);
  });

  it('Groß-/Kleinschreibung der Eingabe ist egal', () => {
    expect(searchAntraegeSubstring('16kn083001', FKZ_KORPUS)).toEqual(['16KN083001']);
  });

  it('Teil-Aktenzeichen findet das ganze Netzwerk', () => {
    expect(searchAntraegeSubstring('16KN0830', FKZ_KORPUS).sort())
      .toEqual(['16KN083001', '16KN083020']);
  });

  it('grenzt ab — ein fremdes Präfix trifft nicht', () => {
    expect(searchAntraegeSubstring('16EP', FKZ_KORPUS)).toEqual(['16EP123456']);
  });
});
