import { describe, it, expect } from 'vitest';
import { matchKeywords, findAkronymHint } from '../triage/keywords';

describe('matchKeywords', () => {
  it('matcht Verwendungsnachweisprüfung-Header', () => {
    const text = `Verwendungsnachweissprüfung Zentrales Innovationsprogramm Mittelstand (ZIM)
      Innovationsnetzwerke – FuE-Projekt aus einem Netzwerk
      Prüfung Sachbericht Formale Prüfkriterien`;
    const matches = matchKeywords(text);
    expect(matches[0]!.doc_type).toBe('verwendungsnachweispruefung');
    expect(matches[0]!.hits).toBeGreaterThanOrEqual(2);
  });

  it('matcht Gutachten-Header', () => {
    const text = `Zentrales Innovationsprogramm Mittelstand - ZIM Einzelprojekt - (EP)
      Gutachten zum Vorhaben
      Musterakronym
      Kurzfassung der Projektbeschreibung
      ZZIMFABGAEP102`;
    const matches = matchKeywords(text);
    expect(matches[0]!.doc_type).toBe('gutachten');
  });

  it('matcht Korrespondenz-Header', () => {
    const text = `per E-Mail
      Kennzeichen: 16KN096121
      Sehr geehrter Herr Mustermann`;
    const matches = matchKeywords(text);
    expect(matches[0]!.doc_type).toBe('korrespondenz');
  });

  it('liefert leeres Array bei Lorem ipsum', () => {
    expect(matchKeywords('Lorem ipsum dolor sit amet')).toEqual([]);
  });
});

describe('findAkronymHint', () => {
  it('findet Akronym nach "Akronym:" Marker', () => {
    expect(findAkronymHint('Akronym: SmartGreenRobotics')).toBe('SmartGreenRobotics');
  });
  it('findet Akronym nach "Verbundtitel:" Marker', () => {
    expect(findAkronymHint('Verbundtitel: MyProj / Entwicklung')).toBe('MyProj');
  });
  it('liefert null wenn kein Marker', () => {
    expect(findAkronymHint('Random Text ohne Marker')).toBeNull();
  });
});
