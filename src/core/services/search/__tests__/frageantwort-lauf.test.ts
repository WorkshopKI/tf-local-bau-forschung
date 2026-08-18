import { describe, it, expect } from 'vitest';
import { baueAntwortPrompt, saeubereAntwort, MAX_ANTWORT_ZEICHEN } from '../frageantwort-lauf';

describe('baueAntwortPrompt', () => {
  const p = baueAntwortPrompt('Welche Vorhaben?', 'Treffer insgesamt: 663', '1. Irgendwas (16KN000101)');

  it('trägt den Befund und die Belege getrennt — der eine gilt für alle, die anderen nicht', () => {
    expect(p.userPrompt).toContain('Treffer insgesamt: 663');
    expect(p.userPrompt).toContain('16KN000101');
    expect(p.userPrompt).toContain('gilt für alle Treffer');
    expect(p.userPrompt).toContain('Auszug');
  });

  it('verbietet eigene Mengen — sonst widerspricht die Karte der Liste darunter', () => {
    expect(p.systemPrompt).toContain('GEZÄHLT');
    expect(p.systemPrompt).toContain('Erfinde keine eigenen Mengen');
  });

  it('verlangt das Förderkennzeichen bei jeder Aussage über ein Vorhaben', () => {
    expect(p.systemPrompt).toContain('Förderkennzeichen');
  });

  it('verbietet die Tabelle — die Trefferliste darunter ist bereits eine', () => {
    expect(p.systemPrompt).toContain('Keine Tabelle');
  });

  it('enthält keine Beispielantwort, die als Antwort durchgehen könnte', () => {
    expect(p.systemPrompt).not.toContain('{');
    expect(p.systemPrompt).not.toContain('```');
  });
});

describe('saeubereAntwort', () => {
  it('nimmt Codefence, Überschrift und Vorspann weg', () => {
    expect(saeubereAntwort('```\nText\n```')).toBe('Text');
    expect(saeubereAntwort('## Zusammenfassung\n\nText')).toBe('Text');
    expect(saeubereAntwort('Antwort: Text')).toBe('Text');
  });

  it('deckelt und markiert die Kürzung', () => {
    const lang = saeubereAntwort('x'.repeat(MAX_ANTWORT_ZEICHEN + 500));
    expect(lang.length).toBeLessThanOrEqual(MAX_ANTWORT_ZEICHEN + 1);
    expect(lang.endsWith('…')).toBe(true);
  });

  it('gibt Leerstring zurück, wenn nichts übrig bleibt — der Aufrufer meldet das', () => {
    expect(saeubereAntwort('   ')).toBe('');
    expect(saeubereAntwort('')).toBe('');
  });
});

/**
 * Die zweite Menge (v4.104): Vorschlaege der Aehnlichkeitssuche fahren
 * GETRENNT mit, und das Modell soll ueber sie entscheiden statt sie zu zitieren
 * wie einen Fund.
 */
describe('baueAntwortPrompt mit Aehnlichkeits-Kandidaten', () => {
  const ohne = baueAntwortPrompt('Welche Vorhaben?', 'Treffer insgesamt: 100', '1. Beleg (16KN000101)');
  const mit = baueAntwortPrompt(
    'Welche Vorhaben?', 'Treffer insgesamt: 112 (100 mit gesuchtem Wortlaut, 12 nur thematisch ähnlich)',
    '1. Beleg (16KN000101)', 'Die 12 nächstliegenden von 12\n\n1. Verwandt (16KN000999)',
  );

  it('schweigt zu Kandidaten, wenn keine da sind — kein Abschnitt, keine Regel', () => {
    expect(ohne.userPrompt).not.toContain('Thematisch verwandt');
    expect(ohne.systemPrompt).not.toContain('thematisch verwandt');
  });

  it('nennt sie als eigenen Abschnitt, nicht bei den Belegen', () => {
    const iBelege = mit.userPrompt.indexOf('Belege (Auszug');
    const iKandidaten = mit.userPrompt.indexOf('Thematisch verwandt');
    expect(iBelege).toBeGreaterThan(-1);
    expect(iKandidaten).toBeGreaterThan(iBelege);
    expect(mit.userPrompt).toContain('16KN000999');
  });

  it('verlangt Einzelpruefung UND Kennzeichnung — sonst wird ein Vorschlag zum Befund', () => {
    expect(mit.systemPrompt).toContain('KEIN gesuchtes Wort');
    expect(mit.systemPrompt).toContain('Prüfe sie einzeln');
    expect(mit.systemPrompt).toContain('(thematisch verwandt)');
    expect(mit.systemPrompt).toContain('Passt keiner');
  });

  it('laesst den Belege-Abschnitt weg, wenn die Frage NUR ueber Aehnlichkeit traf', () => {
    const nurKandidaten = baueAntwortPrompt(
      'Welche Vorhaben?', 'Treffer insgesamt: 12 (0 mit gesuchtem Wortlaut, 12 nur thematisch ähnlich)',
      '', 'Alle 12 thematisch verwandten Vorschläge.\n\n1. Verwandt (16KN000999)',
    );
    expect(nurKandidaten.userPrompt).not.toContain('Belege (Auszug');
    expect(nurKandidaten.userPrompt).toContain('Thematisch verwandt');
  });
});
