/**
 * Werte mit Anführungszeichen — die Vorschlagsliste und der Korpus müssen
 * dieselbe Form vergleichen (v4.111).
 *
 * Der Defekt: die Stöbern-Zeile `"EIKBOOM" Gesellschaft mit beschränkter
 * Haftung` erzeugte die Anfrage `ast:"EIKBOOM Gesellschaft mit beschränkter
 * Haftung"` — die Anfrage hatte die Anführungszeichen abgelegt, der Korpus
 * behielt sie, und der Klick fand 0. Kontrolle `ast:EIKBOOM` fand 2. Am echten
 * Bestand betraf das 13 der 5 407 Einrichtungen, und weil alphabetisch sortiert
 * wird, standen sie ganz OBEN in der Liste.
 *
 * Geprüft wird deshalb die STRECKE, nicht eine der beiden Seiten: der Wert geht
 * durch `alsAnfrageWert` in die Anfrage und durch `ohneZitatzeichen` in den
 * Korpus, und beide müssen sich treffen.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { searchAntraegeSubstring } from '../services/antraege-search-service';
import {
  bundeslandFelder, domainSuchform, standortSuchform, type AntragTextEntry,
} from '../services/search-corpus';
import { ohneZitatzeichen } from '../services/wert-index';
import { namensKern } from '@/core/services/search/namensKern';
import { stoeberAnfrage } from '@/plugins/suche/start/stoebern';

/** Ein Eintrag, wie ihn `loadAntraegeTextCorpus` baut — die Suchformen aus
 *  derselben Funktion, damit der Test nie eine Form setzt, die es nicht gibt. */
function eintrag(felder: { organisation?: string; netzwerk?: string; vb?: string }): AntragTextEntry {
  const organisation = felder.organisation ?? '';
  const netzwerk = felder.netzwerk ?? '';
  const vb = felder.vb ?? '';
  const such = (s: string): string => ohneZitatzeichen(s).toLowerCase();
  return {
    vb, tv: '', abstract: '', descriptors: '', akronym: '',
    vbLower: such(vb), tvLower: '', absLower: '', descriptorsLower: '', akronymLower: '',
    akronymKern: '', akzLower: '',
    organisation,
    organisationLower: such(organisation),
    standort: '', standortSuchform: standortSuchform(''),
    ...bundeslandFelder('', ''),
    domain: '', domainSuchform: domainSuchform(''),
    netzwerk,
    netzwerkLower: such(netzwerk),
    netzwerkKern: namensKern(such(netzwerk)),
    notiz: '', notizLower: '',
    wahlkreis: '', wahlkreisSuchform: '',
    verbundNr: '', verbundNrLower: '',
    unterprogrammId: '',
  };
}

const EIKBOOM = '"EIKBOOM" Gesellschaft mit beschränkter Haftung';
const CANNABIS = 'CANNABIS-NET" 16KN089602_KR';

const KORPUS = new Map<string, AntragTextEntry>([
  ['A1', eintrag({ organisation: EIKBOOM })],
  ['A2', eintrag({ organisation: 'Fraunhofer-Gesellschaft e.V.' })],
  ['A3', eintrag({ netzwerk: CANNABIS })],
]);

describe('ohneZitatzeichen', () => {
  it('macht aus dem Anführungszeichen ein Leerzeichen, nicht nichts', () => {
    // `Foo"Bar` sind zwei Wörter — gelöscht ergäbe es `FooBar` und träfe im
    // Korpus nichts mehr.
    expect(ohneZitatzeichen('Foo"Bar')).toBe('Foo Bar');
  });

  it('zieht die entstandenen Doppelräume zusammen', () => {
    expect(ohneZitatzeichen(EIKBOOM)).toBe('EIKBOOM Gesellschaft mit beschränkter Haftung');
  });

  it('lässt einen Wert ohne Anführungszeichen unberührt (Identität)', () => {
    const w = 'Fraunhofer-Gesellschaft e.V.';
    expect(ohneZitatzeichen(w)).toBe(w);
  });
});

describe('Vorschlagswert mit Anführungszeichen findet seinen eigenen Satz', () => {
  it('die Anfrage aus der Stöbern-Zeile trifft die Einrichtung', () => {
    const anfrage = stoeberAnfrage('organisation', EIKBOOM);
    expect(anfrage).toBe('ast:"EIKBOOM Gesellschaft mit beschränkter Haftung"');
    expect(searchAntraegeSubstring(anfrage, KORPUS, { verknuepfung: 'und' })).toEqual(['A1']);
  });

  it('die Kontrolle ohne Anführungszeichen findet weiter dasselbe', () => {
    // Sie fand schon vor dem Fix — hier steht sie, damit der Fix den einfachen
    // Fall nicht kaputtmacht.
    expect(searchAntraegeSubstring('ast:EIKBOOM', KORPUS, { verknuepfung: 'und' })).toEqual(['A1']);
  });

  it('gilt auch für das halb zitierte Netzwerk', () => {
    const anfrage = stoeberAnfrage('netzwerk', CANNABIS);
    expect(searchAntraegeSubstring(anfrage, KORPUS, { verknuepfung: 'und' })).toEqual(['A3']);
  });

  it('grenzt weiterhin ab: ein fremder Wert trifft nicht', () => {
    expect(searchAntraegeSubstring('ast:EIKBOOM', KORPUS, { verknuepfung: 'und' })).not.toContain('A2');
  });
});

/**
 * Der Gegenprobe-Fall: jemand kopiert den ANGEZEIGTEN Wert und fügt ihn ein.
 *
 * Dann geht das Anführungszeichen NICHT durch `alsAnfrageWert`, sondern durch
 * den Parser — und der nimmt nur die äußeren Zeichen ab. Bei einem
 * unbalancierten Wert (18 der 1 973 Netzwerknamen) bleibt es mitten in der Nadel
 * stehen. Deshalb legt auch `anfrageSuchTeile` es ab; täte es das nicht, hätte
 * die Korpus-Faltung diese Werte unauffindbar gemacht — ein Regress, der bei der
 * adversarischen Prüfung des Fixes auffiel.
 */
describe('eingefügter Rohwert findet seinen eigenen Satz', () => {
  const FAELLE: readonly (readonly [string, string])[] = [
    ['unbalanciert, Zeichen mitten drin', 'CANNABIS-NET" 16KN089602_KR'],
    ['unbalanciert, Zeichen vorn', '"3DLiveVis2 16KN045423_LT'],
    ['drei Anführungszeichen', '"eLight"" 16KN016323_OM'],
    ['sauber gepaart', '"ProAnimalLife" 16KN062302_KR'],
  ];

  for (const [name, wert] of FAELLE) {
    it(name, () => {
      const korpus = new Map([['N1', eintrag({ netzwerk: wert })]]);
      expect(searchAntraegeSubstring(wert, korpus, { verknuepfung: 'und' })).toEqual(['N1']);
    });
  }

  it('gilt auch für den Verbundtitel — dort steht das Zeichen genauso im Export', () => {
    const titel = 'NEMO Bioenergie Fabrik "Wir ersetzen Öl"';
    const korpus = new Map([['T1', eintrag({ vb: titel })]]);
    expect(searchAntraegeSubstring(titel, korpus, { verknuepfung: 'und' })).toEqual(['T1']);
  });
});

/**
 * Die Tests oben bauen den Korpus-Eintrag SELBST — sie zeigen also, dass sich
 * beide Seiten treffen, wenn beide `ohneZitatzeichen` anwenden. Dass der ECHTE
 * Korpus das tut, hält erst diese Reißleine fest.
 */
describe('zitatzeichen-beidseitig — der echte Korpus wendet dieselbe Regel an', () => {
  const SRC = join(process.cwd(), 'src');
  const lies = (...teile: string[]): string => readFileSync(join(SRC, ...teile), 'utf-8');
  const korpus = lies('plugins', 'antraege', 'services', 'search-corpus.ts');
  const dienst = lies('plugins', 'antraege', 'services', 'antraege-search-service.ts');
  const anfrage = lies('plugins', 'suche', 'vervollstaendigung.ts');

  it('KEIN Suchfeld des Korpus wird roh kleingeschrieben', () => {
    // Die schärfere Fassung: ein neu hinzugefügtes `*Lower`-Feld fällt hier auf,
    // statt still ungefaltet zu bleiben.
    const roh = [...korpus.matchAll(/(\w+Lower)\s*[:=]\s*[^,;\n]*\.toLowerCase\(\)/g)]
      .map(m => m[1]);
    expect(roh, 'Diese Suchformen entstehen mit `.toLowerCase()` statt mit `suchform()` — '
      + 'sie behalten damit das Anführungszeichen, das die Anfrage ablegt, und ihr Wert '
      + 'wird über seinen eigenen Wortlaut unauffindbar.').toEqual([]);
  });

  it('… sondern über suchform(), und das faltet', () => {
    expect(/function suchform\([\s\S]{0,120}ohneZitatzeichen\(/.test(korpus)).toBe(true);
    // Positiv-Kontrolle: findet der Scan überhaupt Suchformen?
    expect([...korpus.matchAll(/\w+Lower\s*[:=]\s*suchform\(/g)].length).toBeGreaterThanOrEqual(9);
  });

  it('die Anfrage-Seite faltet an beiden Eingängen', () => {
    // getippt/eingefügt …
    expect(/ohneZitatzeichen\(t\.wert\)/.test(dienst)).toBe(true);
    // … und aus der Vorschlagsliste übernommen.
    expect(/ohneZitatzeichen\(wert\)/.test(anfrage)).toBe(true);
  });
});
