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
import {
  domainSuchform, standortSuchform, type AntragTextEntry,
} from '../services/search-corpus';

function eintrag(
  vb: string,
  tv = '',
  abs = '',
  descr = '',
  akronym = '',
  akz = '',
  organisation = '',
  standort = '',
  domain = '',
): AntragTextEntry {
  return {
    vbLower: vb.toLowerCase(),
    tvLower: tv.toLowerCase(),
    absLower: abs.toLowerCase(),
    descriptorsLower: descr.toLowerCase(),
    akronymLower: akronym.toLowerCase(),
    akzLower: akz.toLowerCase(),
    organisationLower: organisation.toLowerCase(),
    standortSuchform: standortSuchform(standort),
    domain,
    domainSuchform: domainSuchform(domain),
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
    const treffer = searchAntraegeSubstring('laser schweißen', KORPUS, { verknuepfung: 'und' });
    expect(treffer.sort()).toEqual(['A1', 'A2']);
  });

  it('ODER genügt ein Wort', () => {
    const treffer = searchAntraegeSubstring('laser schweißen', KORPUS, { verknuepfung: 'oder' });
    expect(treffer.sort()).toEqual(['A1', 'A2', 'A3']);
  });

  it('ODER liefert nie weniger als UND', () => {
    const und = searchAntraegeSubstring('laser schweißen', KORPUS, { verknuepfung: 'und' });
    const oder = searchAntraegeSubstring('laser schweißen', KORPUS, { verknuepfung: 'oder' });
    expect(oder.length).toBeGreaterThanOrEqual(und.length);
    for (const t of und) expect(oder).toContain(t);
  });

  it('Ein-Wort-Anfrage verhält sich in beiden Modi gleich (kein Verhaltensbruch)', () => {
    const und = searchAntraegeSubstring('schweißen', KORPUS, { verknuepfung: 'und' }).sort();
    const oder = searchAntraegeSubstring('schweißen', KORPUS, { verknuepfung: 'oder' }).sort();
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

/**
 * „Stammdaten" ist der letzte Teil derselben Zusage. Am Bestand gemessen steht
 * der Organisationsname so gut wie nie in einem der bisher durchsuchten Felder
 * (0,0 % der Bgl-Sätze, 1,7 % der AnB-Sätze) — eine Einrichtung war über ihren
 * Namen praktisch unauffindbar.
 *
 * Der Fall, der ZWEI Spalten nötig macht: Rechtsperson (`ORG_AST`) und
 * ausführende Stelle (`ORG_AFS`) weichen in 2,5 % der Sätze voneinander ab.
 */
describe('searchAntraegeSubstring — Organisation', () => {
  const ORG_KORPUS = new Map<string, AntragTextEntry>([
    // Beide Namen verschieden — der gemessene Fraunhofer-/Uni-Fall.
    ['F1', eintrag('Terahertz-Sensorik', '', '', '', '', '16KN111101',
      'Fraunhofer-Institut für Nachrichtentechnik, Heinrich-Hertz-Institut Fraunhofer-Gesellschaft zur Förderung der angewandten Forschung e.V.')],
    ['U1', eintrag('Bildgebende Diagnostik', '', '', '', '', '16KN222201',
      'Universitätsklinikum Leipzig AöR Universität Leipzig')],
    // Beide Namen gleich — steht nur einmal im Feld (siehe verbindeOrganisation).
    ['G1', eintrag('Kunststoffverarbeitung', '', '', '', '', '16KN333301', 'Mogic GmbH')],
  ]);

  it('findet über die ausführende Stelle', () => {
    expect(searchAntraegeSubstring('heinrich-hertz', ORG_KORPUS)).toEqual(['F1']);
  });

  it('findet über die Rechtsperson — sie steht in KEINEM anderen Feld', () => {
    // „Universität Leipzig" ist kein Substring von „Universitätsklinikum
    // Leipzig AöR": ohne die zweite Spalte bliebe dieser Satz unauffindbar.
    expect(searchAntraegeSubstring('universität leipzig', ORG_KORPUS)).toEqual(['U1']);
  });

  it('beide Namen zusammen bleiben UND-fähig', () => {
    expect(searchAntraegeSubstring('fraunhofer terahertz', ORG_KORPUS)).toEqual(['F1']);
  });

  it('grenzt ab — eine fremde Einrichtung trifft nicht', () => {
    expect(searchAntraegeSubstring('mogic', ORG_KORPUS)).toEqual(['G1']);
  });
});

/**
 * Standort — die Frage, für die das Feld da ist: „welche Vorhaben wurden 2026
 * in Berlin gefördert?" Ort und Bundesland weichen zwischen Rechtsperson und
 * ausführender Stelle in 1 052 bzw. 621 Sätzen voneinander ab, deshalb stehen
 * beide Seiten im Feld.
 */
describe('searchAntraegeSubstring — Standort', () => {
  const ORT_KORPUS = new Map<string, AntragTextEntry>([
    ['B1', eintrag('Quantensensorik', '', '', '', '', '16KN010001', 'Qant GmbH', 'Berlin')],
    // Firmensitz und Arbeitsort verschieden — der gemessene Wedel/Hamburg-Fall.
    ['W1', eintrag('Schiffsantriebe', '', '', '', '', '16KN010002', 'Marine AG',
      'Wedel Hamburg Schleswig-Holstein')],
    ['S1', eintrag('Textilveredelung', '', '', '', '', '16KN010003', 'Webe GmbH',
      'Chemnitz Sachsen')],
  ]);

  it('findet die Vorhaben einer Stadt', () => {
    expect(searchAntraegeSubstring('berlin', ORT_KORPUS)).toEqual(['B1']);
  });

  it('findet sowohl über den Firmensitz als auch über den Arbeitsort', () => {
    expect(searchAntraegeSubstring('wedel', ORT_KORPUS)).toEqual(['W1']);
    expect(searchAntraegeSubstring('hamburg', ORT_KORPUS)).toEqual(['W1']);
  });

  it('findet über das ausgeschriebene Bundesland — im Export steht nur das Kürzel', () => {
    expect(searchAntraegeSubstring('sachsen', ORT_KORPUS)).toEqual(['S1']);
    expect(searchAntraegeSubstring('schleswig-holstein', ORT_KORPUS)).toEqual(['W1']);
  });

  it('lässt sich mit einem Sachwort verknüpfen — der eigentliche Zweck', () => {
    expect(searchAntraegeSubstring('sachsen textil', ORT_KORPUS)).toEqual(['S1']);
  });

  it('grenzt ab — eine fremde Stadt trifft nicht', () => {
    expect(searchAntraegeSubstring('chemnitz', ORT_KORPUS)).toEqual(['S1']);
  });

  /**
   * Der Befund, der die Wortanfang-Regel nötig machte: als freier Substring
   * holte „essen" am echten Bestand 439 zusätzliche Anträge herein — fast alle
   * aus H·essen, nicht aus Essen (23 Anträge).
   */
  describe('Wortanfang statt freier Substring', () => {
    const FALLEN = new Map<string, AntragTextEntry>([
      ['H1', eintrag('Lebensmittelanalytik', '', '', '', '', '16KN020001', 'Nutri GmbH',
        'Kassel Hessen')],
      ['E1', eintrag('Werkstoffprüfung', '', '', '', '', '16KN020002', 'Ruhr AG',
        'Essen Nordrhein-Westfalen')],
      ['N1', eintrag('Agrartechnik', '', '', '', '', '16KN020003', 'Hof AG',
        'Osnabrück Niedersachsen')],
      ['S1', eintrag('Textilveredelung', '', '', '', '', '16KN020004', 'Webe GmbH',
        'Chemnitz Sachsen')],
      ['A1', eintrag('Chemieanlagen', '', '', '', '', '16KN020005', 'Anha GmbH',
        'Magdeburg Sachsen-Anhalt')],
    ]);

    it('„essen" trifft Essen, aber NICHT Hessen', () => {
      expect(searchAntraegeSubstring('essen', FALLEN)).toEqual(['E1']);
    });

    it('„sachsen" trifft Sachsen und Sachsen-Anhalt, aber NICHT Niedersachsen', () => {
      expect(searchAntraegeSubstring('sachsen', FALLEN).sort()).toEqual(['A1', 'S1']);
    });

    it('der Bindestrich trennt Wörter — „anhalt" findet Sachsen-Anhalt', () => {
      expect(searchAntraegeSubstring('anhalt', FALLEN)).toEqual(['A1']);
      expect(searchAntraegeSubstring('westfalen', FALLEN)).toEqual(['E1']);
    });

    it('ausgeschrieben mit Bindestrich trifft weiterhin', () => {
      expect(searchAntraegeSubstring('sachsen-anhalt', FALLEN)).toEqual(['A1']);
      expect(searchAntraegeSubstring('nordrhein-westfalen', FALLEN)).toEqual(['E1']);
    });

    it('Präfix am Wortanfang bleibt — die Suche läuft bei jedem Tastendruck', () => {
      expect(searchAntraegeSubstring('chemn', FALLEN)).toEqual(['S1']);
      expect(searchAntraegeSubstring('osnabr', FALLEN)).toEqual(['N1']);
    });

    it('ein Satzzeichen als Anfrage trifft nicht ALLES', () => {
      // `''.includes('')` wäre `true` — die leere Nadel muss verworfen werden.
      expect(searchAntraegeSubstring('-', FALLEN)).toEqual([]);
    });
  });
});

// ---------------------------------------------------------------------------
// v4.5: dritte Verknüpfung, Wortstämme, Suchbereich
// ---------------------------------------------------------------------------

describe('searchAntraegeSubstring — genaue Wortfolge', () => {
  it('findet nur die zusammenhängende Wortfolge', () => {
    expect(searchAntraegeSubstring('laser schweißen', KORPUS, { verknuepfung: 'wortfolge' }))
      .toEqual(['A2']);
  });

  it('ist strenger als UND, UND strenger als ODER', () => {
    const folge = searchAntraegeSubstring('laser schweißen', KORPUS, { verknuepfung: 'wortfolge' });
    const und = searchAntraegeSubstring('laser schweißen', KORPUS, { verknuepfung: 'und' });
    const oder = searchAntraegeSubstring('laser schweißen', KORPUS, { verknuepfung: 'oder' });
    expect(folge.length).toBeLessThanOrEqual(und.length);
    expect(und.length).toBeLessThanOrEqual(oder.length);
  });

  it('ein einzelnes Wort verhält sich in allen drei Modi gleich', () => {
    const felder = { verknuepfung: 'wortfolge' } as const;
    expect(searchAntraegeSubstring('schweißen', KORPUS, felder).sort())
      .toEqual(searchAntraegeSubstring('schweißen', KORPUS).sort());
  });

  it('umschließende Leerzeichen ändern nichts', () => {
    expect(searchAntraegeSubstring('  laser schweißen  ', KORPUS, { verknuepfung: 'wortfolge' }))
      .toEqual(['A2']);
  });
});

const STAMM_KORPUS = new Map<string, AntragTextEntry>([
  ['N1', eintrag('Normung technischer Regelwerke')],
  ['N2', eintrag('Prüfnormen für Messverfahren')],
  ['K1', eintrag('Kalibrierstandards für die Analytik')],
  ['X1', eintrag('Bilderkennung in der Fertigung')],
]);

describe('searchAntraegeSubstring — ähnliche Begriffe (Wortstamm)', () => {
  it('ohne Stammsuche findet „Normen" die „Normung" nicht', () => {
    // „Prüfnormen" enthält das Suchwort als Teilwort und kommt auch ohne
    // Stammsuche — die Suche matcht frei im Wort. „Normung" tut es nicht.
    expect(searchAntraegeSubstring('normen', STAMM_KORPUS)).toEqual(['N2']);
  });

  it('mit Stammsuche kommt die „Normung" dazu', () => {
    expect(searchAntraegeSubstring('normen', STAMM_KORPUS, { stammSuche: true }).sort())
      .toEqual(['N1', 'N2']);
  });

  it('„Kalibrierung" findet „Kalibrierstandards"', () => {
    expect(searchAntraegeSubstring('kalibrierung', STAMM_KORPUS, { stammSuche: true }))
      .toEqual(['K1']);
  });

  it('erweitert die Treffermenge, verkleinert sie nie', () => {
    const ohne = searchAntraegeSubstring('normen', STAMM_KORPUS);
    const mit = searchAntraegeSubstring('normen', STAMM_KORPUS, { stammSuche: true });
    for (const akz of ohne) expect(mit).toContain(akz);
  });
});

const BEREICH_KORPUS = new Map<string, AntragTextEntry>([
  // Das Wort steht im Titel — ein fachlicher Treffer.
  ['T1', eintrag('Prüfung technischer Standards', '', '', '', 'NormFlow', '16KN1', 'Meier GmbH', 'Berlin')],
  // Das Wort steht NUR im Firmennamen — der Fall aus dem Handoff.
  ['O1', eintrag('Analytik von Mykotoxinen', '', '', '', 'Myko', '16KN2', 'HPC Standards GmbH', 'Hamburg')],
]);

describe('searchAntraegeSubstring — Suchen in', () => {
  it('„alles" findet beide — auch den Treffer im Firmennamen', () => {
    expect(searchAntraegeSubstring('standards', BEREICH_KORPUS).sort()).toEqual(['O1', 'T1']);
  });

  it('„nur Titel & Kurzbeschreibung" schließt den Firmennamen aus', () => {
    expect(searchAntraegeSubstring('standards', BEREICH_KORPUS, { bereich: 'inhalt' }))
      .toEqual(['T1']);
  });

  it('„nur Einrichtung" dreht es um', () => {
    expect(searchAntraegeSubstring('standards', BEREICH_KORPUS, { bereich: 'einrichtung' }))
      .toEqual(['O1']);
  });

  it('das Aktenzeichen bleibt im Inhalts-Bereich erreichbar', () => {
    expect(searchAntraegeSubstring('16kn1', BEREICH_KORPUS, { bereich: 'inhalt' })).toEqual(['T1']);
  });

  it('„nur Dokumente" liefert aus dem Antragskorpus GAR nichts', () => {
    // Sonst stünde unter „nur Dokumente" ein Antrag, der über sein Akronym kam.
    expect(searchAntraegeSubstring('normflow', BEREICH_KORPUS, { bereich: 'dokumente' }))
      .toEqual([]);
  });

  it('„nur Ort & Bundesland" sucht am Ort, nicht am Firmennamen', () => {
    // v4.15.0: „wer" und „wo" sind getrennt. „Standards" steht im Firmennamen
    // von O1 — im Ortsbereich darf das keinen Treffer geben.
    expect(searchAntraegeSubstring('berlin', BEREICH_KORPUS, { bereich: 'standort' }))
      .toEqual(['T1']);
    expect(searchAntraegeSubstring('standards', BEREICH_KORPUS, { bereich: 'standort' }))
      .toEqual([]);
  });

  it('der Einrichtungs-Bereich sucht nicht mehr am Ort mit', () => {
    expect(searchAntraegeSubstring('berlin', BEREICH_KORPUS, { bereich: 'einrichtung' }))
      .toEqual([]);
    expect(searchAntraegeSubstring('berlin', BEREICH_KORPUS, { bereich: 'inhalt' })).toEqual([]);
  });
});
