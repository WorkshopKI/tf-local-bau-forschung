/**
 * `bl:` sucht ein Land, keinen Namensbestandteil (v4.84).
 *
 * Gemeldet wurde, dass niemand wissen kann, in welcher Schreibweise der Export
 * sein Bundesland ablegt — `bl:SN` und `bl:Sachsen` müssen dieselbe Menge
 * liefern. Beim Nachmessen am Bestand kam der schwerere Fehler heraus:
 * `bl:Sachsen` lieferte 3 278 statt 2 742 Treffer, weil die am Wortanfang
 * verankerte Nadel `" sachsen"` auch in `" sachsen anhalt st "` steckt. 536
 * Anträge aus Sachsen-Anhalt liefen als Sachsen mit, ohne dass die Trefferzeile
 * es verraten hätte.
 *
 * Deshalb wird das Bundesland seither VERGLICHEN statt durchsucht: ein
 * geschlossenes Vokabular aus 16 Werten hat abzählbare Werte, keine Textstellen.
 * Der Rückfall auf die verankerte Suche bleibt für alles, was sich nicht
 * auflösen lässt.
 */
import { describe, it, expect } from 'vitest';
import { searchAntraegeSubstring } from '../services/antraege-search-service';
import {
  bundeslandFelder, domainSuchform, standortSuchform, type AntragTextEntry,
} from '../services/search-corpus';

function eintrag(titel: string, landAfs: string, landAst = landAfs): AntragTextEntry {
  const ort = '';
  return {
    vb: titel, tv: '', abstract: '', descriptors: '', akronym: '',
    vbLower: titel.toLowerCase(), tvLower: '', absLower: '', descriptorsLower: '',
    akronymLower: '', akronymKern: '', akzLower: '',
    verbundNr: '', verbundNrLower: '', unterprogrammId: '',
    organisation: '', organisationLower: '',
    standort: ort, standortSuchform: standortSuchform(ort),
    ...bundeslandFelder(landAfs, landAst),
    domain: '', domainSuchform: domainSuchform(''),
    netzwerk: '', netzwerkLower: '', netzwerkKern: '', notiz: '', notizLower: '',
    wahlkreis: '', wahlkreisSuchform: standortSuchform(''),
  };
}

const KORPUS = new Map<string, AntragTextEntry>([
  ['SN1', eintrag('Laserfügen', 'SN')],
  ['SN2', eintrag('Sensorik', 'SN')],
  ['ST1', eintrag('Mikroalgen', 'ST')],
  ['ST2', eintrag('Magnetabscheider', 'ST')],
  // Der Grenzfall aus dem Bestand: die beiden Seiten liegen in verschiedenen
  // Ländern. Der Satz gehört BEIDEN Mengen an, nicht nur der ersten.
  ['MIX', eintrag('Verbundvorhaben', 'SN', 'ST')],
  ['NI1', eintrag('Windenergie', 'NI')],
  // Fremder Wert, den der Kürzel-Katalog nicht kennt.
  ['ROH', eintrag('Sonderfall', 'Sachsn')],
]);

const suche = (q: string): string[] => searchAntraegeSubstring(q, KORPUS).sort();

describe('bl: — Kürzel und Name sind dieselbe Frage', () => {
  it('liefert für Kürzel und Klartext dieselbe Menge', () => {
    // Das ist der Kern: der Suchende kennt die Speicherform nicht und soll sie
    // nicht kennen müssen.
    expect(suche('bl:SN')).toEqual(['MIX', 'SN1', 'SN2']);
    expect(suche('bl:Sachsen')).toEqual(suche('bl:SN'));
    expect(suche('bl:sachsen')).toEqual(suche('bl:SN'));
    expect(suche('bl:sn')).toEqual(suche('bl:SN'));
  });

  it('holt Sachsen-Anhalt nicht mehr unter Sachsen herein', () => {
    // Der gemessene Defekt: ST1/ST2 standen in der Trefferliste zu `bl:Sachsen`.
    expect(suche('bl:Sachsen')).not.toContain('ST1');
    expect(suche('bl:Sachsen')).not.toContain('ST2');
    expect(suche('bl:Sachsen-Anhalt')).toEqual(['MIX', 'ST1', 'ST2']);
    expect(suche('bl:ST')).toEqual(suche('bl:Sachsen-Anhalt'));
  });

  it('zählt einen Satz mit zwei Ländern zu beiden', () => {
    expect(suche('bl:SN')).toContain('MIX');
    expect(suche('bl:ST')).toContain('MIX');
  });

  it('lässt Niedersachsen und Sachsen getrennt', () => {
    expect(suche('bl:Niedersachsen')).toEqual(['NI1']);
    expect(suche('bl:Sachsen')).not.toContain('NI1');
  });
});

describe('bl: — der Rückfall für Unauflösbares', () => {
  it('findet beim Tippen weiter über den Wortanfang', () => {
    // `bl:sach` löst auf kein Land auf. Statt nichts zu liefern, sucht der Teil
    // verankert weiter — sonst stünde die Liste beim Tippen leer.
    const halb = suche('bl:sach');
    expect(halb).toContain('SN1');
    expect(halb).toContain('ST1');
  });

  it('findet einen fremden Wert, den der Katalog nicht kennt', () => {
    // Ein Wert, der kein bekanntes Land ist, darf nicht unauffindbar werden.
    expect(suche('bl:Sachsn')).toEqual(['ROH']);
  });
});
