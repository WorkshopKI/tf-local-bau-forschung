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
  aehnlichkeitsText, faelleUrteil, vereineBefunde, wortlautAbdeckung,
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
    const a = wortlautAbdeckung(['Laserschweissen', 'Fehlererkennung', 'Nahtprüfung'], KORPUS);
    expect(a.get('A')?.sort()).toEqual(['Fehlererkennung', 'Laserschweissen', 'Nahtprüfung']);
    expect(a.get('B')?.sort()).toEqual(['Fehlererkennung', 'Nahtprüfung']);
    expect(a.has('C')).toBe(false);
  });

  it('merkt sich, WELCHE Schlagworte trafen — nicht nur dass eins traf', () => {
    const a = wortlautAbdeckung(['Bioreaktor', 'Laserschweissen'], KORPUS);
    expect(a.get('C')).toEqual(['Bioreaktor']);
    expect(a.get('A')).toEqual(['Laserschweissen']);
  });

  it('überspringt leere Schlagworte, statt alles zu treffen', () => {
    expect(wortlautAbdeckung(['', '   '], KORPUS).size).toBe(0);
  });

  it('gibt eine leere Karte zurück, wenn nichts trifft', () => {
    expect(wortlautAbdeckung(['Windkraftanlage'], KORPUS).size).toBe(0);
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
    const a = wortlautAbdeckung(['Laserschweissen Nahtprüfung'], KORPUS);
    expect([...a.keys()]).toEqual(['A']);
  });

  it('lässt ein einwortiges Schlagwort davon unberührt', () => {
    const a = wortlautAbdeckung(['Fehlererkennung'], KORPUS);
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
      getroffeneWorte: [], abdeckung, aehnlichkeit, quelle: 'wortlaut',
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
