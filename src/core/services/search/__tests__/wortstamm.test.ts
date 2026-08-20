import { describe, it, expect } from 'vitest';
import {
  wortStamm, sammleVarianten, suchNadel, enthaeltAlsWortteil,
  baueNadelMuster, enthaeltMusterAlsWortteil, musterTrifft,
} from '../wortstamm';
import {
  bereichFelder,
  bereichNutztDokumente,
  bereichNutztAehnlichkeit,
  parseSuchbereich,
  NICHT_IM_STANDARD,
  SUCHBEREICH_LABEL,
  type Suchbereich,
} from '../suchbereich';
import { feldAusPraefix } from '../feldpraefix';
import { TREFFERFELD_LABEL, type Trefferfeld } from '../trefferstelle';

describe('wortStamm', () => {
  it('löst die längste passende Endung ab', () => {
    expect(wortStamm('Normungen')).toBe('norm');
    expect(wortStamm('Normung')).toBe('norm');
    expect(wortStamm('Normen')).toBe('norm');
  });

  it('führt verwandte Wörter auf denselben Stamm', () => {
    expect(wortStamm('Kalibrierung')).toBe('kalibrier');
    expect(wortStamm('Kalibrierungen')).toBe('kalibrier');
  });

  it('lässt kurze Wörter unangetastet — sonst wird die Suche zur Rauschquelle', () => {
    expect(wortStamm('Bau')).toBe('bau');       // nichts abzulösen
    expect(wortStamm('Laser')).toBe('laser');   // „-er" abzulösen hieße „las"
    expect(wortStamm('Bahn')).toBe('bahn');     // „-n" abzulösen hieße „bah"
  });

  it('kürzt bis genau an die Untergrenze, nicht darunter', () => {
    expect(wortStamm('Netze')).toBe('netz');    // vier Zeichen bleiben stehen
  });

  it('gibt ohne passende Endung das kleingeschriebene Wort zurück', () => {
    expect(wortStamm('Bilderkennung')).toBe('bilderkenn');
    expect(wortStamm('Photonik')).toBe('photonik');
  });

  it('ist idempotent genug: der Stamm eines Stamms bleibt nutzbar', () => {
    const einmal = wortStamm('Normungen');
    expect(wortStamm(einmal).length).toBeGreaterThanOrEqual(3);
  });
});

describe('suchNadel', () => {
  it('liefert ohne Stammsuche das kleingeschriebene Wort', () => {
    expect(suchNadel('Normen', false)).toBe('normen');
  });

  it('liefert mit Stammsuche den Stamm', () => {
    expect(suchNadel('Normen', true)).toBe('norm');
  });

  it('die Nadel ist nie länger als das Wort', () => {
    for (const w of ['Normungen', 'Laser', 'Kalibrierung', 'ZIM']) {
      expect(suchNadel(w, true).length).toBeLessThanOrEqual(w.length);
    }
  });
});

describe('sammleVarianten', () => {
  const TEXT = 'Für die Vergleichbarkeit werden Kalibrationsstandards nach den '
    + 'einschlägigen Normen erstellt; die Normung folgt DIN-Regelwerken.';

  it('findet die Wörter, die der Stamm mitbringt', () => {
    const v = sammleVarianten(TEXT, 'norm', 'normen', 5);
    expect(v).toContain('Normung');
  });

  it('lässt das Suchwort selbst weg — es steht schon als eigener Chip da', () => {
    const v = sammleVarianten(TEXT, 'norm', 'normen', 5).map(s => s.toLowerCase());
    expect(v).not.toContain('normen');
  });

  it('gibt die Schreibweise aus dem Text zurück, nicht die der Anfrage', () => {
    const v = sammleVarianten('Die NORMUNG ist geregelt.', 'norm', 'normen', 5);
    expect(v).toEqual(['NORMUNG']);
  });

  it('entdoppelt und hält die Obergrenze ein', () => {
    const text = 'Normung Normung Normvorgabe Normblatt Normprüfung';
    expect(sammleVarianten(text, 'norm', 'normen', 2)).toHaveLength(2);
    expect(new Set(sammleVarianten(text, 'norm', 'normen', 9)).size)
      .toBe(sammleVarianten(text, 'norm', 'normen', 9).length);
  });

  it('hält Wörter mit Bindestrich zusammen', () => {
    expect(sammleVarianten('DIN-Regelwerke gelten.', 'regel', 'regeln', 3))
      .toEqual(['DIN-Regelwerke']);
  });

  it('leere Eingaben liefern nichts', () => {
    expect(sammleVarianten('', 'norm', 'normen', 5)).toEqual([]);
    expect(sammleVarianten(TEXT, '', 'normen', 5)).toEqual([]);
    expect(sammleVarianten(TEXT, 'norm', 'normen', 0)).toEqual([]);
  });

  it('schlägt „enormes" nicht mehr als Wortform von „Normen" vor', () => {
    // Gemeldet mit Screenshot (v4.68): die Vorschlagsliste zu „Normen und
    // Standards" führte „enormes" und „Standardmaschinen" nebeneinander. Das
    // erste ist ein Buchstaben-Treffer, das zweite eine echte Wortform.
    const text = 'Ein enormes Potenzial; die Normung folgt Kalibrationsstandards.';
    const v = sammleVarianten(text, 'norm', 'normen', 9).map(s => s.toLowerCase());
    expect(v).not.toContain('enormes');
    expect(v).toContain('normung');
  });

  it('behält zusammengesetzte Wörter — dafür gibt es die Wortformen', () => {
    const v = sammleVarianten('Kalibrationsstandards und Prüfstandards.', 'standard', 'standards', 9);
    expect(v.map(s => s.toLowerCase())).toEqual(['kalibrationsstandards', 'prüfstandards']);
  });
});

describe('enthaeltAlsWortteil — wo ein Wort beginnen kann', () => {
  it('nimmt den Wortanfang', () => {
    expect(enthaeltAlsWortteil('normung folgt', 'norm')).toBe(true);
  });

  it('nimmt das Grundwort in einer Zusammensetzung', () => {
    expect(enthaeltAlsWortteil('kalibrierstandards', 'standard')).toBe(true);
  });

  it('nimmt kurze Vorsilben — „genormt" ist eine Wortform', () => {
    expect(enthaeltAlsWortteil('genormte bauteile', 'norm')).toBe(true);
    expect(enthaeltAlsWortteil('vornorm', 'norm')).toBe(true);
  });

  it('lehnt den Ein-Buchstaben-Rest ab — „enorm" ist keine Wortform von „Norm"', () => {
    expect(enthaeltAlsWortteil('enormes potenzial', 'norm')).toBe(false);
  });

  it('misst nur bis zur Wortgrenze, nicht bis zum Textanfang', () => {
    // Die Falle: vor dem ersten „norm" in „die enorme …" stehen fünf Zeichen,
    // aber nur eines gehört zum Wort. Wer den ganzen Text davor misst, nimmt
    // jeden Treffer an — die Regel wäre wirkungslos.
    expect(enthaeltAlsWortteil('die enorme leistung', 'norm')).toBe(false);
  });

  it('nimmt einen späteren Fund, wenn der erste nicht zählt', () => {
    expect(enthaeltAlsWortteil('die enorme normung', 'norm')).toBe(true);
  });

  it('der Bindestrich trennt hart', () => {
    expect(enthaeltAlsWortteil('e-normung', 'norm')).toBe(true);
    expect(enthaeltAlsWortteil('din-standards', 'standard')).toBe(true);
  });

  it('lässt Aktenzeichen und Kennzeichen unberührt', () => {
    expect(enthaeltAlsWortteil('16kn083001', '16kn')).toBe(true);
    expect(enthaeltAlsWortteil('16kn083001', 'kn083001')).toBe(true);
    expect(enthaeltAlsWortteil('16kn083001', '083001')).toBe(true);
  });

  it('leere Nadel trifft nichts — sonst träfe sie alles', () => {
    expect(enthaeltAlsWortteil('irgendwas', '')).toBe(false);
  });
});

describe('Platzhalter „?" — genau ein Zeichen', () => {
  it('compiliert überall — nur nicht am Wortende', () => {
    expect(baueNadelMuster('mobi?nspec')).not.toBeNull();
    expect(baueNadelMuster('?obiinspec')).not.toBeNull();
    // Das Satzzeichen einer Frage ist kein Platzhalter: ein Suchwort zerfällt
    // an den Leerzeichen, also steht es immer am Wortende. Ohne diese Regel
    // wäre jede im Frage-Modus getippte Frage eine Muster-Suche.
    expect(baueNadelMuster('normung?')).toBeNull();
    expect(baueNadelMuster('normung')).toBeNull();
    expect(baueNadelMuster('?')).toBeNull();
  });

  it('lehnt ab, was zu wenig Festes trägt — „????" träfe den ganzen Bestand', () => {
    expect(baueNadelMuster('????')).toBeNull();
    expect(baueNadelMuster('a?c')).toBeNull();     // zwei feste Zeichen
    expect(baueNadelMuster('ab?cd')).not.toBeNull(); // vier feste Zeichen
  });

  it('das Fragezeichen steht für GENAU ein Zeichen, nicht für keines und nicht für mehrere', () => {
    const m = baueNadelMuster('mobi?nspec') as RegExp;
    expect(enthaeltMusterAlsWortteil('mobiinspec messtechnik', m)).toBe(true);
    expect(enthaeltMusterAlsWortteil('mobilnspec messtechnik', m)).toBe(true);
    expect(enthaeltMusterAlsWortteil('mobinspec', m)).toBe(false);
    expect(enthaeltMusterAlsWortteil('mobiXXnspec', m)).toBe(false);
  });

  it('hält dieselbe Wortanfang-Regel wie eine feste Nadel', () => {
    // „n?rm" trifft „norm" — in „normung" am Wortanfang, in „enorme" nicht.
    const m = baueNadelMuster('n?rm') as RegExp;
    expect(enthaeltMusterAlsWortteil('die normung folgt', m)).toBe(true);
    expect(enthaeltMusterAlsWortteil('ein enormes potenzial', m)).toBe(false);
    // …und der abgelehnte Fund darf den späteren nicht verschlucken.
    expect(enthaeltMusterAlsWortteil('die enorme normung', m)).toBe(true);
  });

  it('behandelt Regex-Sonderzeichen als das, was sie sind: Text', () => {
    expect(baueNadelMuster('gmbu.d?')).toBeNull(); // „?" am Ende — kein Platzhalter
    const punkt = baueNadelMuster('gmb?.de') as RegExp;
    expect(enthaeltMusterAlsWortteil('gmbu.de', punkt)).toBe(true);
    // Der Punkt darf NICHT zum Regex-Punkt geworden sein.
    expect(enthaeltMusterAlsWortteil('gmbuxde', punkt)).toBe(false);
  });

  it('trifft Kennzeichen-Muster', () => {
    const m = baueNadelMuster('16kn0830?1') as RegExp;
    expect(enthaeltMusterAlsWortteil('16kn083001', m)).toBe(true);
    expect(enthaeltMusterAlsWortteil('16kn083021', m)).toBe(true);
    expect(enthaeltMusterAlsWortteil('16kn083002', m)).toBe(false);
  });

  it('musterTrifft ist unverankert — der Beleg darf nie strenger sein als der Treffer', () => {
    const m = baueNadelMuster('n?rm') as RegExp;
    expect(musterTrifft('ein enormes potenzial', m)).toBe(true);
    expect(enthaeltMusterAlsWortteil('ein enormes potenzial', m)).toBe(false);
  });

  it('ein geteiltes Muster merkt sich zwischen zwei Aufrufen keine Position', () => {
    const m = baueNadelMuster('mobi?nspec') as RegExp;
    expect(enthaeltMusterAlsWortteil('mobiinspec', m)).toBe(true);
    expect(enthaeltMusterAlsWortteil('mobiinspec', m)).toBe(true);
    expect(musterTrifft('mobiinspec', m)).toBe(true);
    expect(musterTrifft('mobiinspec', m)).toBe(true);
  });
});

describe('Platzhalter „*" — beliebig viele Zeichen', () => {
  it('steht für keines, eines und mehrere — genau das, was „?" nicht kann', () => {
    const m = baueNadelMuster('mob*spec') as RegExp;
    expect(enthaeltMusterAlsWortteil('mobiinspec messtechnik', m)).toBe(true);
    expect(enthaeltMusterAlsWortteil('mobilnspec messtechnik', m)).toBe(true);
    // Der Fall, an dem „mobi?nspec" scheitert: eine Schreibweise ohne das
    // doppelte Zeichen. Wer die Drift sucht, kennt ihre Länge nicht.
    expect(enthaeltMusterAlsWortteil('mobinspec', m)).toBe(true);
    expect(enthaeltMusterAlsWortteil('mobspec', m)).toBe(true);
  });

  it('bleibt im Wort — sonst spannte ein Stern über den halben Abstract', () => {
    const m = baueNadelMuster('mob*spec') as RegExp;
    expect(enthaeltMusterAlsWortteil('mobile messtechnik für die spectroskopie', m)).toBe(false);
    // Der Bindestrich trennt hart, hier wie überall in wortstamm.ts.
    expect(enthaeltMusterAlsWortteil('mobi-inspec', m)).toBe(false);
  });

  it('gilt auch am Wortende — dort ändert er nur nichts', () => {
    const m = baueNadelMuster('mobi*') as RegExp;
    expect(m).not.toBeNull();
    expect(enthaeltMusterAlsWortteil('mobiinspec', m)).toBe(true);
    expect(enthaeltMusterAlsWortteil('mobil', m)).toBe(true);
    expect(enthaeltMusterAlsWortteil('nobil', m)).toBe(false);
  });

  it('zählt wie „?" nur die FESTEN Zeichen gegen die Untergrenze', () => {
    expect(baueNadelMuster('a*c')).toBeNull();      // zwei feste Zeichen
    expect(baueNadelMuster('***')).toBeNull();      // keins
    expect(baueNadelMuster('ab*cd')).not.toBeNull();
  });

  it('zieht mehrere Sterne hintereinander zu einem zusammen', () => {
    const eins = baueNadelMuster('mob*spec') as RegExp;
    const drei = baueNadelMuster('mob***spec') as RegExp;
    expect(drei.source).toBe(eins.source);
  });

  it('trägt dieselbe Wortanfang-Regel wie jede andere Nadel', () => {
    const m = baueNadelMuster('n*rm') as RegExp;
    expect(enthaeltMusterAlsWortteil('die normung folgt', m)).toBe(true);
    expect(enthaeltMusterAlsWortteil('ein enormes potenzial', m)).toBe(false);
  });

  it('lässt sich mit „?" in einer Nadel mischen', () => {
    const m = baueNadelMuster('mob*nsp?c') as RegExp;
    expect(enthaeltMusterAlsWortteil('mobiinspec', m)).toBe(true);
    expect(enthaeltMusterAlsWortteil('mobilnspac', m)).toBe(true);
    // Das „?" bleibt GENAU ein Zeichen, auch neben einem Stern.
    expect(enthaeltMusterAlsWortteil('mobiinspc', m)).toBe(false);
  });

  it('am Wortende bleibt „?" ein Fragezeichen — auch in einer Nadel mit Stern', () => {
    const m = baueNadelMuster('mob*nspec?') as RegExp;
    expect(enthaeltMusterAlsWortteil('mobiinspec', m)).toBe(false);
    expect(enthaeltMusterAlsWortteil('mobiinspec?', m)).toBe(true);
  });
});

describe('Suchbereich', () => {
  const ALLE: Suchbereich[] = ['alles', 'inhalt', 'dokumente', 'einrichtung', 'standort'];

  it('jeder Bereich hat eine Beschriftung', () => {
    for (const b of ALLE) expect(SUCHBEREICH_LABEL[b].length).toBeGreaterThan(0);
  });

  it('„alles" ist der weiteste Bereich', () => {
    const alles = bereichFelder('alles');
    for (const b of ALLE) {
      for (const f of bereichFelder(b)) expect(alles.has(f)).toBe(true);
    }
  });

  it('der Standardbereich führt JEDES Antragsfeld — bis auf drei benannte', () => {
    // Ein neu eingeführtes `Trefferfeld`, das hier nicht landet, macht die
    // Beschriftung zur Falschaussage — und zwar stumm: die Suche liefert dann
    // einfach weniger. Ausnahmen gibt es genau die aus `NICHT_IM_STANDARD`,
    // und diese Zeile ist der Grund, warum eine vierte nicht unbemerkt
    // dazukommen kann.
    const alles = bereichFelder('alles');
    const fehlend = (Object.keys(TREFFERFELD_LABEL) as Trefferfeld[])
      .filter(f => !NICHT_IM_STANDARD.includes(f) && !alles.has(f));
    expect(fehlend).toEqual([]);
    expect(bereichNutztDokumente('alles')).toBe(true);
  });

  it('die drei Ausnahmen sind genau diese drei — jede neue braucht eine Begründung', () => {
    expect([...NICHT_IM_STANDARD].sort())
      .toEqual(['aehnlichkeit', 'dokument', 'notiz']);
  });

  it('kein Bereich sucht in den Arbeitsnotizen — nur das Feld-Präfix tut es', () => {
    // Die Notiz hängt am Vorgang, nicht am Vorhaben: 1 054 der 5 345 Notizen
    // nennen eine Vollmacht, dazu IBAN, Zahlungsstopp und Personennamen. Sie
    // aus dem Standard zu nehmen ist nur dann keine Amputation, wenn der
    // gezielte Weg dorthin offen BLEIBT — deshalb steht beides in EINEM Test.
    for (const b of ALLE) expect(bereichFelder(b).has('notiz')).toBe(false);
    for (const wort of ['notiz', 'notizen', 'bemerkung', 'wichtig', 't_yw', 't_hint']) {
      expect(feldAusPraefix(wort)).toBe('notiz');
    }
  });

  it('nur „alles" verspricht alle, alle anderen sagen „nur"', () => {
    // Der Gegensatz IST die Bedienhilfe: „alle …" ⇄ „nur …" zeigt auf einen
    // Blick, welche Wahl etwas wegnimmt. Eine Aufzählung an der Stelle von
    // „alle …" las sich zweimal als Einschränkung, die sie nicht war.
    //
    // Der Name nennt seit v4.100 die VORHABENSfelder: „alle Felder" schloss die
    // Arbeitsnotizen mit ein, die seither nicht mehr mitlaufen — ein Name, der
    // mehr zusagt, als er hält, war hier schon zweimal die Fehlerquelle.
    expect(SUCHBEREICH_LABEL.alles).toBe('alle Vorhabensfelder');
    expect(SUCHBEREICH_LABEL.alles.startsWith('alle ')).toBe(true);
    for (const b of ALLE) {
      if (b === 'alles') continue;
      expect(SUCHBEREICH_LABEL[b].startsWith('nur ')).toBe(true);
    }
  });

  it('Inhalt und Einrichtung überschneiden sich nicht', () => {
    const inhalt = bereichFelder('inhalt');
    for (const f of bereichFelder('einrichtung')) expect(inhalt.has(f)).toBe(false);
  });

  it('„wer" und „wo" sind zwei Bereiche, nicht einer', () => {
    // v4.15.0: zusammengelegt beantwortete der Bereich beide Fragen auf einmal
    // — wer nach einem Ort suchte, bekam die Firmennamen dazu.
    //
    // Die Web-Adresse steht seit v4.42.0 beim „wer", nicht beim „wo": sie
    // benennt die Einrichtung (`gmbu.de`), nicht ihren Sitz. Sie ist der
    // einzige Weg zu Einrichtungen, die ihr Kürzel nicht im Namen führen.
    //
    // Der Wahlkreis steht seit v4.50.0 beim „wo": er nennt in 5 274 von 14 218
    // Anträgen einen Ort, den das Standort-Feld nicht führt. Ohne ihn fände der
    // engere Bereich weniger als „alle Felder", und der Nutzer hätte keinen
    // Weg, den Unterschied zu sehen.
    //
    // Das Bundesland ist seit v4.81.0 ein eigenes Feld und muss hier mit stehen:
    // wer „nur Ort, Bundesland & Wahlkreis" wählt, hat die Beschriftung gelesen.
    expect(Array.from(bereichFelder('einrichtung'))).toEqual(['organisation', 'domain']);
    expect(Array.from(bereichFelder('standort')))
      .toEqual(['standort', 'bundesland', 'wahlkreis']);
  });

  it('„nur Dokumente" prüft KEIN Antragsfeld', () => {
    expect(bereichFelder('dokumente').size).toBe(0);
  });

  it('das Aktenzeichen bleibt im Inhalts-Bereich erreichbar', () => {
    expect(bereichFelder('inhalt').has('aktenzeichen')).toBe(true);
  });

  it('nur die inhaltlichen Bereiche befragen den Dokumentenindex', () => {
    expect(bereichNutztDokumente('alles')).toBe(true);
    expect(bereichNutztDokumente('dokumente')).toBe(true);
    expect(bereichNutztDokumente('inhalt')).toBe(false);
    expect(bereichNutztDokumente('einrichtung')).toBe(false);
    expect(bereichNutztDokumente('standort')).toBe(false);
  });

  // v4.113: bis dahin lief die Ähnlichkeitsstufe in JEDEM Bereich mit. Am echten
  // Bestand gemessen lieferte „nur Einrichtung" damit 50 Treffer, alle 50 aus der
  // Vektorstufe — genau das Thema, das der Nutzer ausgeschlossen hatte; „nur
  // Dokumente" 50 Anträge ohne einen einzigen Dokumenttreffer.
  it('nur die themen-tragenden Bereiche lassen die Ähnlichkeitsstufe mitlaufen', () => {
    expect(bereichNutztAehnlichkeit('alles')).toBe(true);
    expect(bereichNutztAehnlichkeit('inhalt')).toBe(true);
    expect(bereichNutztAehnlichkeit('einrichtung')).toBe(false);
    expect(bereichNutztAehnlichkeit('standort')).toBe(false);
    // Der Vektor beschreibt ein VORHABEN, kein Dokument.
    expect(bereichNutztAehnlichkeit('dokumente')).toBe(false);
  });

  it('toleranter Leser: Unbekanntes fällt auf „alles" zurück', () => {
    expect(parseSuchbereich(null)).toBe('alles');
    expect(parseSuchbereich('quatsch')).toBe('alles');
    expect(parseSuchbereich('einrichtung')).toBe('einrichtung');
    expect(parseSuchbereich('standort')).toBe('standort');
  });
});
