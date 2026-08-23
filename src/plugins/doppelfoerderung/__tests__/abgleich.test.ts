/**
 * Der Abgleich: Abdeckung, Zusammenführung beider Stufen, Urteil.
 *
 * Der Kern ist die **Abdeckung** — wie viele der drei Schlagworte ein Vorhaben
 * trägt. Ohne sie wäre das Urteil wertlos: in der App gegen den echten Bestand
 * gemessen (Betrachtungsbereich 4.327) findet das weite Trio der ersten
 * Beispielzeile ODER-verknüpft 1.150 Vorhaben, mit zwei von drei Schlagworten
 * 103.
 *
 * Der wichtigste Test hier ist der auf das ZWEIWORT-Schlagwort: er hält den
 * Fehler fest, der bei genau dieser Messung auffiel.
 */
import { describe, it, expect } from 'vitest';
import type { AntragListItem } from '@/core/services/csv/types';
import type { AntragTextEntry } from '@/plugins/antraege/services/search-corpus';
import {
  AEHNLICHKEIT_AUS_TEXT, AEHNLICHKEIT_SCHWELLE, aehnlichkeitsStufe, aehnlichkeitsText,
  faelleUrteil, istZuWeit, vereineBefunde, wortlautAbdeckung, zaehltNicht,
  WORT_ZAEHLT_NICHT_ANTEIL, WORT_ZU_WEIT_ANTEIL,
  type AbgleichKontext,
} from '@/plugins/doppelfoerderung/services/abgleich';
import type { TrefferBefund } from '@/plugins/doppelfoerderung/types';

/** Ein Korpus-Eintrag mit den Feldern, die die Wortlaut-Stufe wirklich liest. */
function eintrag(akz: string, vb: string, abstract: string): [string, AntragTextEntry] {
  const klein = (s: string): string => s.toLowerCase();
  return [akz, {
    vb, tv: '', abstract, descriptors: '', akronym: '',
    vbLower: klein(vb), tvLower: '', absLower: klein(abstract),
    descriptorsLower: '', akronymLower: '', akronymKern: '',
    akzLower: klein(akz), verbundNr: '', verbundNrLower: '', unterprogrammId: '136',
    organisation: '', organisationLower: '', standort: '', standortSuchform: '',
    bundesland: '', bundeslandSuchform: '', bundeslandCodes: '',
    domain: '', domainSuchform: '', netzwerk: '', netzwerkLower: '', netzwerkKern: '',
    notiz: '', notizLower: '', wahlkreis: '', wahlkreisSuchform: '',
  } as AntragTextEntry];
}

const KORPUS = new Map<string, AntragTextEntry>([
  eintrag('A', 'Laserschweissen von Blechbauteilen', 'Nahtprüfung mit optischer Fehlererkennung'),
  eintrag('B', 'Optische Fehlererkennung', 'Bildverarbeitung in der Nahtprüfung'),
  eintrag('C', 'Biokatalyse im Bioreaktor', 'Enzymtechnik für Feinchemikalien'),
]);

function listItem(akz: string): AntragListItem {
  return {
    aktenzeichen: akz, programm_id: 'p', status: 'bewilligt', verbund_id: `VB-${akz}`,
    antragsdatum: '2024-01-01', antragsteller: `Antragsteller ${akz}`,
  } as AntragListItem;
}

const CTX: AbgleichKontext = {
  korpus: KORPUS,
  listeNachAkz: new Map(['A', 'B', 'C'].map(a => [a, listItem(a)])),
  embeddings: new Map(),
};

describe('wortlautAbdeckung — je Schlagwort ein Lauf', () => {
  it('zählt, WIE VIELE Schlagworte ein Vorhaben trägt', () => {
    const a = wortlautAbdeckung(['Laserschweissen', 'Fehlererkennung', 'Nahtprüfung'], KORPUS).proAktenzeichen;
    expect(a.get('A')?.sort()).toEqual(['Fehlererkennung', 'Laserschweissen', 'Nahtprüfung']);
    expect(a.get('B')?.sort()).toEqual(['Fehlererkennung', 'Nahtprüfung']);
    expect(a.has('C')).toBe(false);
  });

  it('merkt sich, WELCHE Schlagworte trafen — nicht nur dass eins traf', () => {
    const a = wortlautAbdeckung(['Bioreaktor', 'Laserschweissen'], KORPUS).proAktenzeichen;
    expect(a.get('C')).toEqual(['Bioreaktor']);
    expect(a.get('A')).toEqual(['Laserschweissen']);
  });

  it('überspringt leere Schlagworte, statt alles zu treffen', () => {
    expect(wortlautAbdeckung(['', '   '], KORPUS).proAktenzeichen.size).toBe(0);
  });

  it('gibt eine leere Karte zurück, wenn nichts trifft', () => {
    expect(wortlautAbdeckung(['Windkraftanlage'], KORPUS).proAktenzeichen.size).toBe(0);
  });

  it('hält ein ZWEIWORT-Schlagwort zusammen, statt es zu zerlegen', () => {
    // Der Fehler, den dieser Test festhält: die Suchstufe zerlegt eine
    // mehrwortige Anfrage in ihre Wörter. Mit `verknuepfung: 'oder'` zerfiel
    // „Mobile Fabrik" in „mobile ODER fabrik" und traf am echten Bestand 535
    // Vorhaben statt 2 — bei einem Prompt, der ausdrücklich ein- bis zweiwortige
    // Schlagworte verlangt, ist das die Regel, nicht die Ausnahme.
    // A trägt beide Wörter (Titel „Laserschweissen…", Kurzfassung „Nahtprüfung…"),
    // B nur „Nahtprüfung". Zerlegt lieferte das Schlagwort A UND B, zusammen-
    // gehalten nur A.
    const a = wortlautAbdeckung(['Laserschweissen Nahtprüfung'], KORPUS).proAktenzeichen;
    expect([...a.keys()]).toEqual(['A']);
  });

  it('lässt ein einwortiges Schlagwort davon unberührt', () => {
    const a = wortlautAbdeckung(['Fehlererkennung'], KORPUS).proAktenzeichen;
    expect([...a.keys()].sort()).toEqual(['A', 'B']);
  });
});

describe('vereineBefunde', () => {
  it('sortiert nach Abdeckung, dann Ähnlichkeit, dann Aktenzeichen', () => {
    const befunde = vereineBefunde(
      new Map([['A', ['x']], ['B', ['x', 'y']]]),
      new Map([['A', 0.9], ['C', 0.8]]),
      CTX,
    );
    expect(befunde.map(b => b.aktenzeichen)).toEqual(['B', 'A', 'C']);
    expect(befunde.map(b => b.abdeckung)).toEqual([2, 1, 0]);
  });

  it('benennt die Quelle jedes Befunds', () => {
    const befunde = vereineBefunde(
      new Map([['A', ['x']], ['B', ['x']]]),
      new Map([['A', 0.9], ['C', 0.8]]),
      CTX,
    );
    const nach = new Map(befunde.map(b => [b.aktenzeichen, b.quelle]));
    expect(nach.get('A')).toBe('beide');
    expect(nach.get('B')).toBe('wortlaut');
    expect(nach.get('C')).toBe('aehnlichkeit');
  });

  it('nimmt Titel und Kurzbeschreibung aus dem Korpus mit', () => {
    const [befund] = vereineBefunde(new Map([['C', ['Bioreaktor']]]), new Map(), CTX);
    expect(befund?.verbundTitel).toBe('Biokatalyse im Bioreaktor');
    expect(befund?.kurzbeschreibung).toBe('Enzymtechnik für Feinchemikalien');
    expect(befund?.antragsteller).toBe('Antragsteller C');
  });

  it('lässt Ähnlichkeits-Treffer ausserhalb des Bereichs fallen', () => {
    // Die Ähnlichkeitsstufe läuft über ALLE Embeddings; der Korpus ist bereits
    // auf den Betrachtungsbereich geschnitten. Was dort fehlt, gehört nicht dazu.
    const befunde = vereineBefunde(new Map(), new Map([['UNBEKANNT', 0.99]]), CTX);
    expect(befunde).toEqual([]);
  });
});

describe('faelleUrteil', () => {
  function befund(abdeckung: number, aehnlichkeit: number | null = null): TrefferBefund {
    return {
      aktenzeichen: 'X', verbundId: '', verbundTitel: '', titel: '', kurzbeschreibung: '',
      getroffeneWorte: [], abdeckung, abdeckungRoh: abdeckung, aehnlichkeit,
      traeger: null, vbPhase: 3, quelle: 'wortlaut',
      status: '', antragsdatum: '', antragsteller: '',
    };
  }

  it('urteilt an der Schwelle, nicht darunter', () => {
    expect(faelleUrteil([befund(2)], 2).uebereinstimmung).toBe(true);
    expect(faelleUrteil([befund(1)], 2).uebereinstimmung).toBe(false);
  });

  it('folgt dem Regler: bei Schwelle 1 ist reines ODER wieder erreichbar', () => {
    expect(faelleUrteil([befund(1)], 1).uebereinstimmung).toBe(true);
    expect(faelleUrteil([befund(2)], 3).uebereinstimmung).toBe(false);
  });

  it('nennt die Schlagworte als Grund, wenn sie es waren', () => {
    expect(faelleUrteil([befund(3, 0.99)], 2).grund).toBe('schlagworte');
  });

  it('lässt eine hohe Ähnlichkeit allein urteilen — und sagt es', () => {
    const u = faelleUrteil([befund(0, 0.9)], 2, 0.75);
    expect(u).toEqual({ uebereinstimmung: true, grund: 'aehnlichkeit' });
  });

  it('lässt eine mittlere Ähnlichkeit NICHT urteilen', () => {
    expect(faelleUrteil([befund(0, 0.6)], 2, 0.75).uebereinstimmung).toBe(false);
  });

  it('urteilt ohne Befunde auf „keine Übereinstimmung"', () => {
    expect(faelleUrteil([], 2)).toEqual({ uebereinstimmung: false, grund: 'keine' });
  });
});

describe('aehnlichkeitsText', () => {
  it('setzt Thema und Beschreibung zusammen', () => {
    expect(aehnlichkeitsText('Thema', 'Text')).toBe('Thema\n\nText');
  });

  it('lässt eine leere Hälfte weg, statt Leerzeilen zu erzeugen', () => {
    expect(aehnlichkeitsText('', 'Text')).toBe('Text');
    expect(aehnlichkeitsText('Thema', '  ')).toBe('Thema');
  });
});

describe('AEHNLICHKEIT_SCHWELLE', () => {
  /**
   * Der höchste Ähnlichkeitswert, den ein Lauf über alle 45 Meldungen der
   * 72er-Liste hervorgebracht hat, war 0,621 — eine Schwelle darüber schaltet
   * die ganze Stufe ab, ohne dass es jemandem auffiele. Genau das war der
   * Zustand vor dieser Messung (0,75). Der Test nagelt die Obergrenze fest,
   * nicht den exakten Wert: wer kalibriert, darf verschieben, aber nicht über
   * den beobachteten Wertebereich hinaus.
   */
  it('liegt unterhalb des höchsten je gemessenen Wertes (0,621)', () => {
    expect(AEHNLICHKEIT_SCHWELLE).toBeLessThan(0.621);
  });

  it('liegt über dem Rauschband, in dem fast jede Meldung einen Nachbarn hat', () => {
    // Ab 0,45 trugen 34 von 45 Zeilen einen Treffer — das ist kein Befund mehr.
    expect(AEHNLICHKEIT_SCHWELLE).toBeGreaterThan(0.45);
  });
});

describe('istZuWeit', () => {
  it('markiert ein Wort ab einem Prozent des Betrachtungsbereichs', () => {
    // Gemessen: „Automatisierung" trug 852 von 4.327 Vorhaben.
    expect(istZuWeit(852, 4327)).toBe(true);
    expect(istZuWeit(44, 4327)).toBe(true);
  });

  it('lässt die unterscheidenden Wörter in Ruhe', () => {
    // „Qualifizierung" 35, „Computer Vision" 14, „Wasserstoffversprödung" 2.
    expect(istZuWeit(35, 4327)).toBe(false);
    expect(istZuWeit(14, 4327)).toBe(false);
    expect(istZuWeit(2, 4327)).toBe(false);
  });

  it('bleibt still, solange die Bezugsgrösse fehlt', () => {
    // Ohne Bereichsgrösse gäbe es nur einen Anteil ins Blaue — dann lieber
    // keine Marke als eine falsche.
    expect(istZuWeit(852, null)).toBe(false);
    expect(istZuWeit(852, 0)).toBe(false);
  });
});

describe('zaehltNicht — die Marke bekommt Folgen', () => {
  it('greift erst über der Marke, nicht mit ihr', () => {
    // Beschriften ist billig, eingreifen nicht: die Eingriffsschwelle liegt
    // bewusst höher als die Markierungsschwelle.
    expect(WORT_ZAEHLT_NICHT_ANTEIL).toBeGreaterThan(WORT_ZU_WEIT_ANTEIL);
  });

  it('nimmt den Sammelbegriffen ihre Stimme', () => {
    // Automatisierung 852, Maschinenbau 672, Medizintechnik 353,
    // Additive Fertigung 343, Logistik 105 — alle von 4.327.
    for (const n of [852, 672, 353, 343, 105]) expect(zaehltNicht(n, 4327)).toBe(true);
  });

  it('lässt die Wörter zählen, die eine Sache benennen', () => {
    // Maschinelles Lernen 86 (2,0 %), Demonstrator 82, Kreislaufwirtschaft 76,
    // Robotik 48 — häufig, aber sie benennen keine Schublade.
    for (const n of [86, 82, 76, 48, 35, 2]) expect(zaehltNicht(n, 4327)).toBe(false);
  });
});

describe('faelleUrteil — Träger und „nicht beurteilbar"', () => {
  function mitTraeger(aehnlichkeit: number | null): TrefferBefund {
    return {
      aktenzeichen: 'T', verbundId: '', verbundTitel: '', titel: '', kurzbeschreibung: '',
      getroffeneWorte: [], abdeckung: 0, abdeckungRoh: 0, aehnlichkeit,
      traeger: 'gleich', vbPhase: 3, quelle: 'traeger',
      status: '', antragsdatum: '', antragsteller: 'fzmb GmbH',
    };
  }

  it('löst aus, wenn derselbe Träger ein inhaltlich nahes Vorhaben führt', () => {
    // Der gemessene Fall: fzmb → VetDx/ZytoVet bei 0,514.
    expect(faelleUrteil([mitTraeger(0.514)], 2).grund).toBe('traeger');
  });

  it('löst NICHT aus, wenn der Träger allein dasteht', () => {
    // Sonst träfe ein Haus mit 88 Vorhaben im Bereich bei jeder Meldung zu.
    expect(faelleUrteil([mitTraeger(0.20)], 2).uebereinstimmung).toBe(false);
    expect(faelleUrteil([mitTraeger(null)], 2).uebereinstimmung).toBe(false);
  });

  it('sagt „nicht beurteilbar", wenn kein Schlagwort im Bestand vorkam', () => {
    // Fünf Meldungen der 72er-Liste hatten alle drei Schlagworte auf 0 Treffer.
    // Ein „keine Übereinstimmung" behauptete dort eine Prüfung, die nicht
    // stattfand — drei davon lagen mit der Ähnlichkeit knapp unter der Schwelle.
    const stumm = [{ wort: 'Kältenetz', treffer: 0 }, { wort: 'Tiefengeothermie', treffer: 0 }];
    expect(faelleUrteil([], 2, undefined, stumm).grund).toBe('unklar');
  });

  it('sagt weiter „keine", wenn die Schlagworte trafen und es trotzdem nichts wurde', () => {
    const traf = [{ wort: 'Cybersicherheit', treffer: 6 }, { wort: 'Handwerk', treffer: 30 }];
    expect(faelleUrteil([], 2, undefined, traf).grund).toBe('keine');
  });

  it('bleibt bei „keine", solange gar keine Trefferzahlen vorliegen', () => {
    // Ohne die Zahlen lässt sich „stumm" nicht von „nicht gelaufen"
    // unterscheiden — dann keine neue Behauptung aufmachen.
    expect(faelleUrteil([], 2).grund).toBe('keine');
  });
});

describe('aehnlichkeitsStufe — ein leeres Ergebnis sagt, warum es leer ist', () => {
  const signal = new AbortController().signal;
  const wirft = (): Promise<number[]> => Promise.reject(new Error('Model not initialized'));
  const mitVektoren: AbgleichKontext = { ...CTX, embeddings: new Map([['A', [1, 0, 0]]]) };

  it('reicht den Grund des Laufs durch, wenn gar keine Einbettungen da sind', async () => {
    // Der Lauf weiss, WARUM er keine hat; hier ist nur bekannt, DASS keine da sind.
    const ctx: AbgleichKontext = {
      ...CTX, aehnlichkeitAusfall: { aus: 'modell-fehlt', meldung: null },
    };
    const lauf = await aehnlichkeitsStufe('Text', ctx, wirft, new Set(), signal);
    expect(lauf.ausfall?.aus).toBe('modell-fehlt');
    expect(lauf.treffer.size).toBe(0);
  });

  it('fällt auf „vektoren-fehlen" zurück, wenn der Lauf keinen Grund mitgab', async () => {
    const lauf = await aehnlichkeitsStufe('Text', CTX, wirft, new Set(), signal);
    expect(lauf.ausfall?.aus).toBe('vektoren-fehlen');
  });

  it('behält die Meldung, wenn das Einbetten wirft — statt sie zu verschlucken', async () => {
    // Genau dieser Fall kostete beim Abnehmen von v6.25.1 drei Fehlversuche: das
    // Modell war bei Laufbeginn bereit, beim Klick 16 s später nicht mehr. Die
    // alte Hülle gab `null` zurück, und die Zeile meldete „keine Ähnlichkeit" —
    // dasselbe Bild wie bei einem ehrlichen Nulltreffer.
    const lauf = await aehnlichkeitsStufe('Text', mitVektoren, wirft, new Set(), signal);
    expect(lauf.ausfall?.aus).toBe('einbetten-schlug-fehl');
    expect(lauf.ausfall?.meldung).toBe('Model not initialized');
  });

  it('meldet keinen Ausfall, wenn die Stufe lief', async () => {
    const lauf = await aehnlichkeitsStufe(
      'Text', mitVektoren, async () => [1, 0, 0], new Set(), signal,
    );
    expect(lauf.ausfall).toBeNull();
  });

  it('hat zu jedem Grund einen Satz, der mehr sagt als „lief nicht"', () => {
    // Ein Grund ohne eigenen Satz wäre wieder die Auskunft, die nichts erklärt.
    // 40 Zeichen ist die Grenze, unter der kein Satz mehr Zustand UND Weg
    // heraus nennen kann („Ohne Ähnlichkeitsstufe gelaufen." hat 32).
    for (const [aus, text] of Object.entries(AEHNLICHKEIT_AUS_TEXT)) {
      expect(text.length, aus).toBeGreaterThan(40);
    }
  });
});
