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
import {
  searchAntraegeSubstring, searchAntraegeWortlaut,
} from '../services/antraege-search-service';
import {
  bundeslandFelder, domainSuchform, standortSuchform, type AntragTextEntry,
} from '../services/search-corpus';
import { namensKern } from '@/core/services/search/namensKern';

/**
 * Ein Korpus-Eintrag. VOLLSTÄNDIG gebaut, ohne `as`-Cast: ein neues Feld im
 * `AntragTextEntry` soll hier einen Typfehler geben und nicht erst im Lauf ein
 * `undefined.includes` (genau das passierte bei den v4.50-Feldern).
 *
 * Die selteneren Felder kommen über `extra`; ihre Suchformen leitet der Helfer
 * daraus ab, damit ein Test nie eine Suchform setzen kann, die zum Wert nicht
 * passt.
 */
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
  extra: Partial<AntragTextEntry> = {},
): AntragTextEntry {
  const basis: AntragTextEntry = {
    vb,
    tv,
    abstract: abs,
    descriptors: descr,
    akronym,
    vbLower: vb.toLowerCase(),
    tvLower: tv.toLowerCase(),
    absLower: abs.toLowerCase(),
    descriptorsLower: descr.toLowerCase(),
    akronymLower: akronym.toLowerCase(),
    akronymKern: namensKern(akronym.toLowerCase()),
    akzLower: akz.toLowerCase(),
    organisation,
    organisationLower: organisation.toLowerCase(),
    standort,
    standortSuchform: standortSuchform(standort),
    bundesland: '',
    bundeslandSuchform: '',
    bundeslandCodes: '',
    domain,
    domainSuchform: domainSuchform(domain),
    netzwerk: '',
    netzwerkLower: '',
    netzwerkKern: '',
    notiz: '',
    notizLower: '',
    wahlkreis: '',
    wahlkreisSuchform: '',
    verbundNr: '',
    verbundNrLower: '',
    unterprogrammId: '',
    ...extra,
  };
  return {
    ...basis,
    netzwerkLower: basis.netzwerk.toLowerCase(),
    netzwerkKern: namensKern(basis.netzwerk.toLowerCase()),
    notizLower: basis.notiz.toLowerCase(),
    // Anzeigewert, Suchform UND Kürzel aus EINER Quelle (siehe `bundeslandFelder`).
    ...bundeslandFelder(basis.bundesland, ''),
    wahlkreisSuchform: standortSuchform(basis.wahlkreis),
    verbundNrLower: basis.verbundNr.toLowerCase(),
  };
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
/**
 * Der Platzhalter (v4.101). Anlass ist der reale Namensdrift im Bestand: das
 * Netzwerk `mobiInspec` steht in einem Satz als `mobilnspec` (I gegen l) — wer
 * die Binnenschreibweise nicht kennt, findet mit einer festen Nadel immer nur
 * die eine Hälfte.
 */
describe('searchAntraegeSubstring — Platzhalter „?"', () => {
  const DRIFT_KORPUS = new Map<string, AntragTextEntry>([
    ['D1', eintrag('Mobile Messtechnik', '', '', '', 'mobiInspec', '16KN083001')],
    ['D2', eintrag('mobilnspec - MagPV', '', '', '', 'MagPV', '16KN083020')],
    ['D3', eintrag('Bilderkennung', '', '', '', 'QualiCam', '16EP123456')],
    ['D4', eintrag('Fragen zur Normung?', '', '', '', 'NormQ', '16KN090001')],
  ]);

  it('findet BEIDE Schreibweisen, die eine feste Nadel trennt', () => {
    expect(searchAntraegeSubstring('mobiinspec', DRIFT_KORPUS)).toEqual(['D1']);
    expect(searchAntraegeSubstring('mobilnspec', DRIFT_KORPUS)).toEqual(['D2']);
    expect(searchAntraegeSubstring('mobi?nspec', DRIFT_KORPUS).sort()).toEqual(['D1', 'D2']);
  });

  it('trifft im Aktenzeichen — dort ist das Muster am nützlichsten', () => {
    expect(searchAntraegeSubstring('16kn0830?1', DRIFT_KORPUS)).toEqual(['D1']);
  });

  it('am Wortende ist der Platzhalter unnoetig — die Suche ist ohnehin Teilstring', () => {
    // `16kn08300?` waere ein Platzhalter am Ende und ist deshalb keiner. Das
    // kostet nichts: `16kn08300` findet dieselbe Menge, weil eine Nadel immer
    // als Teilstring gesucht wird. Wer hier einen Platzhalter braeuchte, haette
    // ihn auch bei `mobi*` gebraucht — und auch dort ist er ueberfluessig.
    expect(searchAntraegeSubstring('16kn08300?', DRIFT_KORPUS)).toEqual([]);
    expect(searchAntraegeSubstring('16kn08300', DRIFT_KORPUS)).toEqual(['D1']);
  });

  it('das Fragezeichen einer FRAGE bleibt ein Fragezeichen', () => {
    // Die Nadel `normung?` endet auf dem Zeichen — kein Platzhalter, also
    // sucht sie woertlich und findet nichts (im Korpus steht „Normung?" nur
    // mit dem Satzzeichen im Titel, die Nadel traegt es mit).
    expect(searchAntraegeSubstring('normung?', DRIFT_KORPUS)).toEqual(['D4']);
    // Und sie zieht nicht versehentlich alles herein.
    expect(searchAntraegeSubstring('normung?', DRIFT_KORPUS).length).toBe(1);
  });

  it('eine Nadel mit zu wenig Festem trifft nichts — statt alles', () => {
    // „????" wuerde als Muster jeden Antrag treffen; die Grenze faengt das ab,
    // und woertlich steht die Zeichenfolge nirgends.
    expect(searchAntraegeSubstring('????', DRIFT_KORPUS)).toEqual([]);
    expect(searchAntraegeSubstring('a?c', DRIFT_KORPUS)).toEqual([]);
  });

  it('in Anfuehrungszeichen ist das Fragezeichen woertlich gemeint', () => {
    expect(searchAntraegeSubstring('"mobi?nspec"', DRIFT_KORPUS)).toEqual([]);
  });

  it('haelt die Wortanfang-Regel ein — ein Platzhalter lockert sie nicht', () => {
    const K = new Map<string, AntragTextEntry>([
      ['E1', eintrag('Ein enormes Potenzial')],
      ['E2', eintrag('Die Normung folgt')],
    ]);
    expect(searchAntraegeSubstring('n?rm', K)).toEqual(['E2']);
  });
});

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

  it('der Ortsbereich sucht am Ort, nicht am Firmennamen', () => {
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

// ---------------------------------------------------------------------------
// v4.49: Feld direkt in der Anfrage nennen (`ast:GMBU`)
// ---------------------------------------------------------------------------

describe('searchAntraegeSubstring — Feld in der Anfrage', () => {
  it('bindet das Wort an sein Feld — dasselbe Wort, zwei Ergebnisse', () => {
    expect(searchAntraegeSubstring('titel:standards', BEREICH_KORPUS)).toEqual(['T1']);
    expect(searchAntraegeSubstring('ast:standards', BEREICH_KORPUS)).toEqual(['O1']);
  });

  it('nimmt auch den Spaltencode der Fördertabelle', () => {
    expect(searchAntraegeSubstring('ORG_AST:standards', BEREICH_KORPUS)).toEqual(['O1']);
    expect(searchAntraegeSubstring('VB_TITEL:standards', BEREICH_KORPUS)).toEqual(['T1']);
  });

  it('mit Leerzeichen getippt gelesen wie ohne', () => {
    expect(searchAntraegeSubstring('ast: standards', BEREICH_KORPUS)).toEqual(['O1']);
  });

  it('das Präfix schlägt den Bereich — sonst wäre die Anfrage nie erfüllbar', () => {
    expect(searchAntraegeSubstring('ast:standards', BEREICH_KORPUS, { bereich: 'inhalt' }))
      .toEqual(['O1']);
    expect(searchAntraegeSubstring('ort:berlin', BEREICH_KORPUS, { bereich: 'einrichtung' }))
      .toEqual(['T1']);
  });

  it('mischt sich mit freien Wörtern — die folgen weiter dem Bereich', () => {
    expect(searchAntraegeSubstring('ast:standards mykotoxinen', BEREICH_KORPUS)).toEqual(['O1']);
    // Das freie Wort steht bei O1 nur im Titel — im Einrichtungs-Bereich fällt
    // der Antrag damit heraus, obwohl sein Präfix-Teil trifft.
    expect(searchAntraegeSubstring('ast:standards mykotoxinen', BEREICH_KORPUS,
      { bereich: 'einrichtung' })).toEqual([]);
  });

  it('unbekanntes Wort vor dem Doppelpunkt bleibt ein gewöhnliches Suchwort', () => {
    // „projekt:" ist kein Feld — die Anfrage darf nicht anders gedeutet werden,
    // nur weil ein Doppelpunkt darin steht.
    expect(searchAntraegeSubstring('projekt:standards', BEREICH_KORPUS)).toEqual([]);
  });

  it('gilt auch für die genaue Wortfolge', () => {
    expect(searchAntraegeSubstring('ast:hpc standards', BEREICH_KORPUS,
      { verknuepfung: 'wortfolge' })).toEqual(['O1']);
    expect(searchAntraegeSubstring('titel:hpc standards', BEREICH_KORPUS,
      { verknuepfung: 'wortfolge' })).toEqual([]);
  });

  it('ein angefangenes Präfix ohne Wert sucht nichts — nicht alles', () => {
    expect(searchAntraegeSubstring('ast:', BEREICH_KORPUS)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// v4.50: Netzwerk, Arbeitsnotiz und Wahlkreis
// ---------------------------------------------------------------------------

/**
 * Drei Teilvorhaben desselben Netzwerks und ein Antrag ohne Netz. Die Werte
 * sind der Form nach die des echten Bestandes: die Netzwerkangabe trägt Name
 * UND Kennzeichen (`"LOHCmobil" 16KN065602_AM`), der Wahlkreis nennt Orte, die
 * im Standort nicht vorkommen.
 */
const NEUE_FELDER_KORPUS = new Map<string, AntragTextEntry>([
  ['N1', eintrag('H2 Verbrenner', '', '', '', '', '16KN065603', 'Ascentec GmbH', 'Goslar · Niedersachsen', '', {
    netzwerk: '"LOHCmobil" 16KN065602_AM',
    wahlkreis: 'Goslar - Northeim - Göttingen II',
  })],
  ['N2', eintrag('Thermo-Ölkessel', '', '', '', '', '16KN065604', 'Kessel AG', 'Wedel · Schleswig-Holstein', '', {
    netzwerk: '"LOHCmobil" 16KN065602_AM',
    notiz: 'ZA nicht erinnern, da bereits Einbehalt bis VN',
  })],
  ['N3', eintrag('Speicherdichte', '', '', '', '', '16KN065605', 'Speicher GmbH', 'Kiel · Schleswig-Holstein', '', {
    netzwerk: '"PowerFrame" 16KN046501_FW',
    notiz: 'Wichtig: Vorhaben vor Bewilligung zurückgezogen',
  })],
  ['X1', eintrag('Bilderkennung', '', '', '', '', '16KN099001', 'Optik GmbH', 'Jena · Thüringen')],
]);

describe('searchAntraegeSubstring — Netzwerk, Notiz, Wahlkreis (v4.50)', () => {
  it('findet alle Teilvorhaben eines Netzwerks über sein Kennzeichen', () => {
    // Das eigentlich Neue: das Netz-Kennzeichen steht in KEINEM anderen Feld.
    // Vorher fand diese Anfrage nur den Netzwerkantrag selbst.
    expect(searchAntraegeSubstring('16KN065602', NEUE_FELDER_KORPUS).sort())
      .toEqual(['N1', 'N2']);
  });

  it('findet das Netzwerk über seinen Namen, auch angefangen', () => {
    expect(searchAntraegeSubstring('LOHC', NEUE_FELDER_KORPUS).sort()).toEqual(['N1', 'N2']);
    expect(searchAntraegeSubstring('netz:powerframe', NEUE_FELDER_KORPUS)).toEqual(['N3']);
  });

  it('erreicht die Arbeitsnotizen nur noch über ihr Feld (v4.100)', () => {
    // Bis v4.97 lief die Notiz im freien Text mit. Sie hängt aber am VORGANG,
    // nicht am Vorhaben: 1 054 der 5 345 Notizen im Bestand nennen eine
    // Vollmacht, dazu IBAN, Zahlungsstopp und Personennamen. Wer fachlich
    // sucht, bekam davon Treffer — Begründung in `NICHT_IM_STANDARD`
    // (src/core/services/search/suchbereich.ts).
    expect(searchAntraegeSubstring('einbehalt', NEUE_FELDER_KORPUS)).toEqual([]);
    // Der gezielte Weg bleibt offen — sonst wäre es eine Amputation.
    expect(searchAntraegeSubstring('notiz:einbehalt', NEUE_FELDER_KORPUS)).toEqual(['N2']);
    expect(searchAntraegeSubstring('notiz:zurückgezogen', NEUE_FELDER_KORPUS)).toEqual(['N3']);
  });

  it('findet den Wahlkreis-Ort, der im Standort NICHT steht', () => {
    // „Northeim" kommt in keinem Ortsfeld vor — genau der Zugewinn.
    expect(searchAntraegeSubstring('northeim', NEUE_FELDER_KORPUS)).toEqual(['N1']);
    expect(searchAntraegeSubstring('wahlkreis:göttingen', NEUE_FELDER_KORPUS)).toEqual(['N1']);
  });

  it('der Wahlkreis gehört zum „wo" und nicht zum „wer"', () => {
    expect(searchAntraegeSubstring('northeim', NEUE_FELDER_KORPUS, { bereich: 'standort' }))
      .toEqual(['N1']);
    expect(searchAntraegeSubstring('northeim', NEUE_FELDER_KORPUS, { bereich: 'einrichtung' }))
      .toEqual([]);
  });

  it('vergleicht den Wahlkreis am Wortanfang, nicht als freien Substring', () => {
    // Dieselbe Regel wie beim Standort: „heim" darf „Northeim" nicht holen,
    // sonst kommen über kurze Silben wieder hunderte Nachbarorte herein.
    expect(searchAntraegeSubstring('heim', NEUE_FELDER_KORPUS)).toEqual([]);
    expect(searchAntraegeSubstring('north', NEUE_FELDER_KORPUS)).toEqual(['N1']);
  });

  it('Netzwerk und Notiz bleiben in den engen Bereichen außen vor', () => {
    // „nur Titel & Kurzbeschreibung" ist eine Ansage — der Netzwerkname gehört
    // nicht dazu, auch wenn er thematisch klingt.
    expect(searchAntraegeSubstring('LOHC', NEUE_FELDER_KORPUS, { bereich: 'inhalt' })).toEqual([]);
    expect(searchAntraegeSubstring('einbehalt', NEUE_FELDER_KORPUS, { bereich: 'inhalt' }))
      .toEqual([]);
  });
});

/**
 * Die Kennzeichen (v4.53): drei Teilvorhaben eines Verbunds, eines aus einem
 * anderen. Das `akz`-Argument trägt BEIDE Schreibweisen des Antrags — genau so
 * baut der Korpus das Feld (`16KN073269` aus dem FKZ, `KNF073269` aus `AKZ`).
 */
const KENNZEICHEN_KORPUS = new Map<string, AntragTextEntry>([
  ['16KN073269', eintrag('Leichtbau-Rahmen', '', '', '', '', '16KN073269 KNF073269',
    'Rahmen GmbH', '', '', { verbundNr: 'ZKN073232' })],
  ['16KN073270', eintrag('Fügetechnik', '', '', '', '', '16KN073270 KNF073270',
    'Füge AG', '', '', { verbundNr: 'ZKN073232' })],
  ['16KN073271', eintrag('Prüfstand', '', '', '', '', '16KN073271 INF073271',
    'Institut für Prüftechnik', '', '', { verbundNr: 'ZKN073232' })],
  ['16KN046501', eintrag('Bilderkennung', '', '', '', '', '16KN046501 KNF046501',
    'Optik GmbH', '', '', { verbundNr: 'ZKN046488' })],
]);

describe('searchAntraegeSubstring — Verbundkennzeichen und Fachsystem-AKZ (v4.53)', () => {
  it('holt über das Verbundkennzeichen alle Teilvorhaben auf einmal', () => {
    // Der Kern: die Nummer steht in KEINEM anderen durchsuchten Feld. Vorher
    // führte der einzige Weg über den Verbund im Antrags-Modul.
    expect(searchAntraegeSubstring('ZKN073232', KENNZEICHEN_KORPUS).sort())
      .toEqual(['16KN073269', '16KN073270', '16KN073271']);
    expect(searchAntraegeSubstring('vb:ZKN046488', KENNZEICHEN_KORPUS)).toEqual(['16KN046501']);
  });

  it('trennt Verbund und Teilvorhaben — `fkz:` holt keine Geschwister', () => {
    expect(searchAntraegeSubstring('fkz:16KN073269', KENNZEICHEN_KORPUS)).toEqual(['16KN073269']);
    expect(searchAntraegeSubstring('fkz:ZKN073232', KENNZEICHEN_KORPUS)).toEqual([]);
    expect(searchAntraegeSubstring('vb:16KN073269', KENNZEICHEN_KORPUS)).toEqual([]);
  });

  it('findet den Antrag auch unter dem Aktenzeichen des Fachsystems', () => {
    // Am Bestand: in 12 321 von 12 358 Sätzen ist der ZIFFERNteil derselbe —
    // wer die Ziffern tippt, fand den Antrag schon vorher. Die ganze
    // Zeichenkette `KNF073269` fand vor v4.53 nichts.
    expect(searchAntraegeSubstring('KNF073269', KENNZEICHEN_KORPUS)).toEqual(['16KN073269']);
    expect(searchAntraegeSubstring('akz:INF073271', KENNZEICHEN_KORPUS)).toEqual(['16KN073271']);
    // Beide Schreibweisen sind DASSELBE Feld — auch über `fkz:` erreichbar.
    expect(searchAntraegeSubstring('fkz:KNF073270', KENNZEICHEN_KORPUS)).toEqual(['16KN073270']);
  });

  it('das Verbundkennzeichen gehört zur Identität, nicht zu „wer" oder „wo"', () => {
    expect(searchAntraegeSubstring('ZKN073232', KENNZEICHEN_KORPUS, { bereich: 'inhalt' }).sort())
      .toEqual(['16KN073269', '16KN073270', '16KN073271']);
    expect(searchAntraegeSubstring('ZKN073232', KENNZEICHEN_KORPUS, { bereich: 'einrichtung' }))
      .toEqual([]);
    expect(searchAntraegeSubstring('ZKN073232', KENNZEICHEN_KORPUS, { bereich: 'standort' }))
      .toEqual([]);
  });
});

/**
 * Ein Netzwerkname wird von jedem Teilvorhaben selbst in eine freie Spalte
 * geschrieben — und driftet dabei. Am Bestand ausgezählt (v4.123): fast nie als
 * Tippfehler, fast immer als andere Fuge.
 */
const FUGEN_KORPUS = new Map<string, AntragTextEntry>([
  ['K1', eintrag('Prüfstand', '', '', '', '', '', '', '', '', { netzwerk: '"NAFA-Tech" 16KN065602_AM' })],
  ['K2', eintrag('Sensorik', '', '', '', '', '', '', '', '', { netzwerk: '"NAFA Tech" 16KN065602_AM' })],
  ['K3', eintrag('Bildauswertung', '', '', '', 'KI-Pro')],
  ['K4', eintrag('Datenmodell', '', '', '', 'KIPRO')],
  // Der Fließtext-Gegenbeleg: hier darf die Faltung NICHT gelten.
  ['K5', eintrag('Fügetechnik', '', 'Das Verfahren braucht nur ein. Laser sind teuer.')],
  // Der Wortanfang-Gegenbeleg: `labonachip` enthält „bona".
  ['K6', eintrag('Mikrofluidik', '', '', '', '', '', '', '', '', { netzwerk: '"lab on a chip" 16KN0777' })],
]);

describe('searchAntraegeSubstring — Trennzeichen im Namen (v4.125)', () => {
  it('findet beide Schreibweisen desselben Netzwerks', () => {
    // Zusammengeschrieben fand diese Anfrage vorher NICHTS — im Bestand hängen
    // an genau diesem Fall 29 Anträge.
    expect(searchAntraegeSubstring('nafatech', FUGEN_KORPUS).sort()).toEqual(['K1', 'K2']);
    expect(searchAntraegeSubstring('nafa-tech', FUGEN_KORPUS).sort()).toEqual(['K1', 'K2']);
  });

  it('gilt auch für das Akronym', () => {
    expect(searchAntraegeSubstring('kipro', FUGEN_KORPUS).sort()).toEqual(['K3', 'K4']);
    expect(searchAntraegeSubstring('ki-pro', FUGEN_KORPUS).sort()).toEqual(['K3', 'K4']);
  });

  it('lässt den Fließtext in Ruhe', () => {
    // Fiele im Abstract auch der Satzpunkt weg, träfe `einlaser` über ihn
    // hinweg — derselbe Fehler, den `.*` beim Stern gemacht hätte.
    expect(searchAntraegeSubstring('einlaser', FUGEN_KORPUS)).toEqual([]);
  });

  it('beginnt nur an einem Wortanfang', () => {
    expect(searchAntraegeSubstring('bona', FUGEN_KORPUS)).toEqual([]);
    expect(searchAntraegeSubstring('labonachip', FUGEN_KORPUS)).toEqual(['K6']);
  });

  it('ein zitierter Teil ist wörtlich gemeint — dort zählt die Fuge', () => {
    expect(searchAntraegeSubstring('"nafatech"', FUGEN_KORPUS)).toEqual([]);
  });

  it('belegt den Treffer mit dem Feld, über das er kam', () => {
    // Sonst stünde die Zeile ohne Fundstelle da: gefunden, aber unerklärt.
    const { treffer } = searchAntraegeWortlaut('nafatech', FUGEN_KORPUS);
    expect([...(treffer.get('K1')?.felder ?? [])]).toEqual(['netzwerk']);
    const akro = searchAntraegeWortlaut('kipro', FUGEN_KORPUS);
    expect([...(akro.treffer.get('K3')?.felder ?? [])]).toEqual(['akronym']);
  });
});
