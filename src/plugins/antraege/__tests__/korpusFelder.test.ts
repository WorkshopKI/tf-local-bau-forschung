/**
 * Tests für die Bausteine der Such-Korpus-Felder (v4.4.3 / v4.4.4).
 *
 * `verbindeEindeutig` zieht Angaben derselben Art zu einem Feld zusammen:
 * Antragsteller und ausführende Stelle sind am Bestand gemessen in 97,5 % der
 * Sätze identisch, Ort und Bundesland in über 90 %. Doppelt gespeichert wären
 * das ~14 000 überflüssige Kopien.
 *
 * `bundeslandName` löst das Kürzel auf, weil es als Suchwort nichts taugt: die
 * Suche fragt `feld.includes(wort)` — ein zwei Zeichen langes Feld kann nur von
 * einer ein- bis zweibuchstabigen Anfrage getroffen werden.
 */
import { describe, it, expect } from 'vitest';
import {
  verbindeEindeutig,
  verbindeMit,
  bundeslandName,
  bundeslandCode,
  bundeslandCodeNadel,
  bundeslandFelder,
  standortSuchform,
  standortNadel,
  domainLabel,
  domainSuchform,
} from '../services/search-corpus';

describe('verbindeEindeutig', () => {
  it('speichert einen identischen Wert nur einmal', () => {
    expect(verbindeEindeutig('Mogic GmbH', 'Mogic GmbH')).toBe('Mogic GmbH');
  });

  it('führt zwei verschiedene Werte zusammen', () => {
    expect(verbindeEindeutig('Universitätsklinikum Leipzig AöR', 'Universität Leipzig'))
      .toBe('Universitätsklinikum Leipzig AöR Universität Leipzig');
  });

  it('lässt Leeres weg — ohne führendes oder doppeltes Leerzeichen', () => {
    expect(verbindeEindeutig('', 'Universität Leipzig')).toBe('Universität Leipzig');
    expect(verbindeEindeutig('Wedel', '', 'Schleswig-Holstein')).toBe('Wedel Schleswig-Holstein');
    expect(verbindeEindeutig('  ', 'Berlin')).toBe('Berlin');
  });

  it('liefert für lauter leere Werte einen leeren String', () => {
    // Wichtig für den `includeEmpty`-Guard: `.length > 0` muss falsch bleiben,
    // sonst käme jeder textlose Antrag in den Korpus.
    expect(verbindeEindeutig('', '', '')).toBe('');
  });

  it('entdoppelt über die ganze Liste, nicht nur benachbarte Werte', () => {
    // Der reale Stadtstaat-Fall: Firmensitz Hamburg, Bundesland Hamburg.
    expect(verbindeEindeutig('Wedel', 'Hamburg', 'Schleswig-Holstein', 'Hamburg'))
      .toBe('Wedel Hamburg Schleswig-Holstein');
  });

  it('Berlin bleibt einmal stehen, obwohl es Stadt UND Land ist', () => {
    expect(verbindeEindeutig('Berlin', 'Berlin', 'Berlin', 'Berlin')).toBe('Berlin');
  });
});

describe('bundeslandFelder (v4.81)', () => {
  it('zeigt den Klartext, sucht aber auch über das rohe Kürzel', () => {
    // Der gemeldete Defekt hatte zwei Hälften: die Bundesländer standen in der
    // Ortsliste, und daneben standen die rohen Kürzel als eigene Werte. Beides
    // gehört nicht in die Vorschlagsliste — das Kürzel bleibt trotzdem
    // suchbar, weil das Team es aus dem Export kennt.
    const { bundesland, bundeslandSuchform } = bundeslandFelder('SN', 'SN');
    expect(bundesland).toBe('Sachsen');
    expect(bundeslandSuchform).toContain(' sachsen ');
    expect(bundeslandSuchform).toContain(' sn ');
  });

  it('zieht zwei gleiche Angaben zusammen und führt zwei verschiedene beide', () => {
    expect(bundeslandFelder('HH', 'SH').bundesland).toBe('Hamburg · Schleswig-Holstein');
    expect(bundeslandFelder('BE', '').bundesland).toBe('Berlin');
  });

  it('liefert für fehlende Angaben leere Felder', () => {
    // Wichtig für den `includeEmpty`-Guard: `.length > 0` muss falsch bleiben.
    expect(bundeslandFelder('', ''))
      .toEqual({ bundesland: '', bundeslandSuchform: '', bundeslandCodes: '' });
  });

  it('führt jedes Land einzeln gerahmt in der Vergleichsform', () => {
    expect(bundeslandFelder('SN', 'SN').bundeslandCodes).toBe(' sn ');
    expect(bundeslandFelder('SN', 'ST').bundeslandCodes).toBe(' sn st ');
    // Fremder Wert: kein Kürzel — der Satz bleibt über die Suchform auffindbar,
    // fällt aber aus dem genauen Vergleich heraus.
    expect(bundeslandFelder('Sachsn', '').bundeslandCodes).toBe('');
  });

  it('trifft am Wortanfang — „essen" holt Hessen nicht herein', () => {
    const { bundeslandSuchform } = bundeslandFelder('HE', 'HE');
    expect(bundeslandSuchform.includes(standortNadel('essen'))).toBe(false);
    expect(bundeslandSuchform.includes(standortNadel('hess'))).toBe(true);
  });
});

describe('bundeslandName', () => {
  /** Im Bestand belegte Kürzel (Stand 2026-08, 14 224 Sätze mit Angabe).
   *  Alle 16 kommen vor — eine Lücke hier wäre ein stiller Suchausfall. */
  const IM_BESTAND = ['BW', 'BY', 'BE', 'BB', 'HB', 'HH', 'HE', 'MV',
    'NI', 'NW', 'RP', 'SL', 'SN', 'ST', 'SH', 'TH'];

  it('löst jedes im Bestand belegte Kürzel auf', () => {
    for (const k of IM_BESTAND) {
      const name = bundeslandName(k);
      expect(name, `Kürzel ${k}`).not.toBe(k);
      expect(name.length).toBeGreaterThan(2);
    }
  });

  it('trifft die Schreibweisen, nach denen jemand tatsächlich sucht', () => {
    expect(bundeslandName('SN')).toBe('Sachsen');
    expect(bundeslandName('NW')).toBe('Nordrhein-Westfalen');
    expect(bundeslandName('BW')).toBe('Baden-Württemberg');
    expect(bundeslandName('TH')).toBe('Thüringen');
  });

  it('nimmt Kleinschreibung und Leerraum an', () => {
    expect(bundeslandName(' sn ')).toBe('Sachsen');
  });

  it('gibt Unbekanntes unverändert zurück, statt es zu verwerfen', () => {
    // Ein neues Kürzel darf nie stillschweigend verschwinden. Als Suchwort ist
    // es wirkungslos (zu kurz), aber die Angabe bleibt im Feld.
    expect(bundeslandName('XX')).toBe('XX');
  });

  it('bleibt bei fehlender Angabe leer', () => {
    expect(bundeslandName('')).toBe('');
    expect(bundeslandName('   ')).toBe('');
  });
});

/**
 * Der genaue Vergleich (v4.84). Ohne ihn hing das Ergebnis daran, in welcher
 * Schreibweise der Export sein Land ablegt — und `bl:Sachsen` zog Sachsen-Anhalt
 * mit herein, weil die Verankerung am Wortanfang die beiden nicht trennt.
 */
describe('bundeslandCode', () => {
  const IM_BESTAND = ['BW', 'BY', 'BE', 'BB', 'HB', 'HH', 'HE', 'MV',
    'NI', 'NW', 'RP', 'SL', 'SN', 'ST', 'SH', 'TH'];

  it('führt Kürzel und Namen auf dieselbe Antwort', () => {
    // Das ist der ganze Zweck: niemand muss wissen, was in der Quelle steht.
    for (const k of IM_BESTAND) {
      expect(bundeslandCode(k), `Kürzel ${k}`).toBe(k);
      expect(bundeslandCode(bundeslandName(k)), `Name zu ${k}`).toBe(k);
      expect(bundeslandCode(bundeslandName(k).toLowerCase()), `klein zu ${k}`).toBe(k);
    }
  });

  it('nimmt Kleinschreibung, Leerraum und zerlegte Umlaute an', () => {
    expect(bundeslandCode(' sn ')).toBe('SN');
    expect(bundeslandCode('sachsen')).toBe('SN');
    // Zerlegte Form (NFD) — kommt aus Quellen mit anderer Zeichen-Zerlegung.
    expect(bundeslandCode('Baden-Württemberg'.normalize('NFD'))).toBe('BW');
    expect(bundeslandCode('Thüringen'.normalize('NFD'))).toBe('TH');
  });

  it('trennt Sachsen von Sachsen-Anhalt — der gemeldete Defekt', () => {
    expect(bundeslandCode('Sachsen')).toBe('SN');
    expect(bundeslandCode('Sachsen-Anhalt')).toBe('ST');
    const sachsen = bundeslandFelder('SN', 'SN');
    const anhalt = bundeslandFelder('ST', 'ST');
    const nadel = bundeslandCodeNadel(bundeslandCode('Sachsen'));
    expect(sachsen.bundeslandCodes.includes(nadel)).toBe(true);
    expect(anhalt.bundeslandCodes.includes(nadel)).toBe(false);
    // Zum Vergleich der alte Weg: die verankerte Nadel trennt die beiden NICHT.
    // Genau daran hingen am Bestand 536 falsche Treffer.
    expect(anhalt.bundeslandSuchform.includes(standortNadel('Sachsen'))).toBe(true);
  });

  it('bleibt leer, wo nichts aufzulösen ist — Rückfall auf die Suchform', () => {
    // Halb getippt: `bl:sach` soll beim Tippen weiter etwas zeigen.
    expect(bundeslandCode('sach')).toBe('');
    expect(bundeslandCode('XX')).toBe('');
    expect(bundeslandCode('')).toBe('');
    expect(bundeslandCodeNadel('')).toBe('');
  });

  it('rahmt beidseitig, damit ein Kürzel kein anderes anschneidet', () => {
    expect(bundeslandCodeNadel('SN')).toBe(' sn ');
    expect(bundeslandFelder('SN', 'ST').bundeslandCodes).toContain(' st ');
  });
});

/**
 * Die Ortsangabe ist das einzige Korpus-Feld, das am WORTANFANG verglichen wird.
 * Der Rahmen aus Leerzeichen macht das aus einem `includes` — Speicherform
 * beidseitig gerahmt, Nadel nur vorn, damit Präfix-Tippen weiter funktioniert.
 */
describe('standortSuchform / standortNadel', () => {
  it('rahmt die Speicherform beidseitig ein', () => {
    expect(standortSuchform('Berlin')).toBe(' berlin ');
  });

  it('rahmt die Nadel nur vorn ein — sonst stirbt das Präfix-Tippen', () => {
    expect(standortNadel('Dresd')).toBe(' dresd');
    expect(standortSuchform('Dresden').includes(standortNadel('Dresd'))).toBe(true);
  });

  it('zerlegt an Bindestrich und Klammer in eigene Wörter', () => {
    expect(standortSuchform('Sachsen-Anhalt')).toBe(' sachsen anhalt ');
    expect(standortSuchform('Ellwangen (Jagst)')).toBe(' ellwangen jagst ');
    expect(standortNadel('Sachsen-Anhalt')).toBe(' sachsen anhalt');
  });

  it('trennt „essen" von „Hessen" — der Fall, der die Regel nötig machte', () => {
    expect(standortSuchform('Hessen').includes(standortNadel('essen'))).toBe(false);
    expect(standortSuchform('Essen').includes(standortNadel('essen'))).toBe(true);
  });

  it('trennt „sachsen" von „Niedersachsen", nicht aber von „Sachsen-Anhalt"', () => {
    const nadel = standortNadel('sachsen');
    expect(standortSuchform('Niedersachsen').includes(nadel)).toBe(false);
    expect(standortSuchform('Sachsen-Anhalt').includes(nadel)).toBe(true);
    expect(standortSuchform('Sachsen').includes(nadel)).toBe(true);
  });

  it('liefert für Leeres einen leeren String — nicht ein einzelnes Leerzeichen', () => {
    // `' '.includes(' ')` wäre `true`: eine leere Angabe träfe jede Nadel.
    expect(standortSuchform('')).toBe('');
    expect(standortSuchform('  -  ')).toBe('');
    expect(standortNadel('')).toBe('');
    expect(standortNadel('-')).toBe('');
  });
});

/**
 * Der Standort wird seit v4.23 nicht nur gesucht, sondern auch ANGEZEIGT
 * (Trefferliste, Spalte „Ort & Bundesland") — deshalb der sichtbare Trenner.
 *
 * Diese Tests sind der Grund, warum das gefahrlos ist: Anzeigeform und Suchform
 * sind zwei verschiedene Dinge, und nur die erste ändert sich.
 */
describe('verbindeMit — Anzeigeform des Standorts', () => {
  it('fügt mit dem gewählten Trenner und entdoppelt wie zuvor', () => {
    expect(verbindeMit(' · ', 'Dresden', 'Dresden', 'Sachsen')).toBe('Dresden · Sachsen');
  });

  it('setzt keinen Trenner vor oder nach Leerem', () => {
    expect(verbindeMit(' · ', '', 'Berlin', '  ')).toBe('Berlin');
    expect(verbindeMit(' · ', '', '', '')).toBe('');
  });

  it('bleibt für den Standard-Trenner identisch zu verbindeEindeutig', () => {
    expect(verbindeMit(' ', 'Wedel', 'Hamburg')).toBe(verbindeEindeutig('Wedel', 'Hamburg'));
  });

  it('ändert die SUCHFORM nicht — der Trenner fällt in der Normalisierung weg', () => {
    // Ohne diese Zusicherung wäre die Anzeige-Kosmetik ein Eingriff in die
    // Suche: `standortSuchform` ersetzt jede Nicht-Buchstaben-Folge durch
    // Leerraum, „Dresden · Sachsen" und „Dresden Sachsen" sind danach dasselbe.
    const mitPunkt = verbindeMit(' · ', 'Dresden', 'Sachsen');
    const ohnePunkt = verbindeEindeutig('Dresden', 'Sachsen');
    expect(standortSuchform(mitPunkt)).toBe(standortSuchform(ohnePunkt));
    expect(standortSuchform(mitPunkt)).toBe(' dresden sachsen ');
    expect(standortSuchform(mitPunkt).includes(standortNadel('Sachsen'))).toBe(true);
  });

  it('lässt auch mehrteilige Ortsnamen unverändert suchbar', () => {
    const feld = verbindeMit(' · ', 'Frankfurt am Main', 'Hessen');
    expect(feld).toBe('Frankfurt am Main · Hessen');
    expect(standortSuchform(feld).includes(standortNadel('Frankfurt'))).toBe(true);
    expect(standortSuchform(feld).includes(standortNadel('Main'))).toBe(true);
  });
});

/**
 * Die Web-Adresse (v4.42.0) macht Einrichtungen auffindbar, die ihr Kürzel NICHT
 * im Namen führen.
 *
 * Am Bestand gemessen: 244 Organisationen schreiben es aus („… e.V. (IUTA)") und
 * sind darüber längst zu finden. Die „Gesellschaft zur Förderung von Medizin-,
 * Bio- und Umwelt- Technologien e.V." nicht — „GMBU" steht in keinem einzigen
 * Organisationsfeld des Bestandes, wohl aber in `gmbu.de`.
 */
describe('domainLabel', () => {
  it('nimmt den Host und lässt den Personenteil weg', () => {
    // Der lokale Teil ist eine Personenangabe und gehört in kein Suchfeld.
    expect(domainLabel('bergmann@gmbu.de')).toBe('gmbu.de');
    expect(domainLabel('bergmann@gmbu.de')).not.toContain('bergmann');
  });

  it('liest die erste Adresse, wenn das Feld mehrere führt', () => {
    expect(domainLabel('a@gmbu.de; b@example.org')).toBe('gmbu.de');
  });

  it('sperrt die Domains des Projektträgers', () => {
    // Am Bestand: `vdivde-it.de` steht 26 933 mal in der Quelldatei, bei rund
    // 8 000 Sätzen. Als Suchwort wäre das ein Treffer auf alles.
    expect(domainLabel('mueller@vdivde-it.de')).toBe('');
    expect(domainLabel('mueller@filina-it.de')).toBe('');
    expect(domainLabel('mueller@eura-ag.de')).toBe('');
  });

  it('sperrt Freemailer — sie benennen keine Einrichtung', () => {
    expect(domainLabel('chef@t-online.de')).toBe('');
    expect(domainLabel('chef@gmx.de')).toBe('');
    expect(domainLabel('chef@gmail.com')).toBe('');
  });

  it('bleibt bei fehlender oder unbrauchbarer Angabe leer', () => {
    expect(domainLabel('')).toBe('');
    expect(domainLabel('kein Kontakt hinterlegt')).toBe('');
    expect(domainLabel('@')).toBe('');
  });

  it('behandelt Groß-/Kleinschreibung wie eine Adresse, nicht wie Text', () => {
    expect(domainLabel('Bergmann@GMBU.de')).toBe('gmbu.de');
  });
});

describe('domainSuchform', () => {
  it('findet das Kürzel — der Fall, der das Feld nötig machte', () => {
    expect(domainSuchform('gmbu.de').includes(standortNadel('gmbu'))).toBe(true);
  });

  it('lässt die Top-Level-Domain weg', () => {
    // Sonst träfe die zweibuchstabige Anfrage „de" jeden Antrag mit Mailadresse
    // — dieselbe Falle, die beim Bundesland-Kürzel schon zugeschlagen hat.
    expect(domainSuchform('gmbu.de')).toBe(' gmbu ');
    expect(domainSuchform('gmbu.de').includes(standortNadel('de'))).toBe(false);
  });

  it('hält alle übrigen Segmente suchbar', () => {
    expect(domainSuchform('mb.tu-chemnitz.de')).toBe(' mb tu chemnitz ');
    expect(domainSuchform('mb.tu-chemnitz.de').includes(standortNadel('chemnitz'))).toBe(true);
  });

  it('trifft am Wortanfang, nicht mittendrin', () => {
    // Kürzel sind kurz und stecken ineinander; freies Substring-Matching
    // holte hier Fremdes herein (dieselbe Regel wie beim Ort).
    expect(domainSuchform('weingutmbu.de').includes(standortNadel('mbu'))).toBe(false);
    expect(domainSuchform('mbu-technik.de').includes(standortNadel('mbu'))).toBe(true);
  });

  it('macht aus Bindestrich und Punkt eine Wortgrenze — wie beim Ort', () => {
    // Beabsichtigt: `tu-chemnitz.de` soll auf „tu" UND auf „chemnitz" ansprechen.
    // Wer hier eine engere Regel will, nimmt der Suche genau diese Fälle weg.
    expect(domainSuchform('weingut-mbu.de')).toBe(' weingut mbu ');
    expect(domainSuchform('weingut-mbu.de').includes(standortNadel('mbu'))).toBe(true);
  });

  it('bleibt leer, wenn es keine Adresse gibt', () => {
    expect(domainSuchform('')).toBe('');
  });
});
