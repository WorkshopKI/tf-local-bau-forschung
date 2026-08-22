import { describe, it, expect } from 'vitest';
import { baueAntwortPrompt, saeubereAntwort, MAX_ANTWORT_ZEICHEN } from '../frageantwort-lauf';
import { ABDECKUNG_MARKE } from '../trefferstelle';

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

/**
 * Die Regel zur Abdeckungs-Marke (v4.105.1) haengt an der Marke selbst: sie
 * steht genau dann im System-Prompt, wenn eine Belegzeile sie traegt. Ein
 * zweiter Schalter dafuer koennte irgendwann anders entscheiden als die Zeile.
 */
describe('baueAntwortPrompt mit Abdeckungs-Marke', () => {
  const mit = baueAntwortPrompt(
    'Welche Vorhaben drehen sich hauptsächlich um Normung und Standards?',
    'Davon tragen ALLE gefragten Themen: 4 von 499',
    `1. Beides (16KN042124)\nRelevanz mittel · ${ABDECKUNG_MARKE} · gefunden in: Kurzbeschreibung`,
  );

  it('verlangt, die gekennzeichneten EINZELN zu nennen statt nur zu zaehlen', () => {
    expect(mit.systemPrompt).toContain(ABDECKUNG_MARKE);
    expect(mit.systemPrompt).toContain('EINZELN mit Kennzeichen');
  });

  it('verbietet ausdruecklich die gemeldete Aussage „nicht im Auszug enthalten"', () => {
    expect(mit.systemPrompt).toContain('behaupte nie, sie fehlten im Auszug');
  });

  it('schweigt, wenn keine Belegzeile die Marke traegt', () => {
    const ohne = baueAntwortPrompt('Welche Vorhaben?', 'Treffer insgesamt: 499', '1. Nur eins (16DS1)');
    expect(ohne.systemPrompt).not.toContain(ABDECKUNG_MARKE);
    expect(ohne.systemPrompt).not.toContain('EINZELN mit Kennzeichen');
  });

  it('sagt an, dass die Marke eine Notiz ist und nicht in die Antwort gehoert', () => {
    // Gemessen stand in der Karte: „Sie stehen an erster Stelle, weil sie
    // ‚trägt ALLE gefragten Themen' gekennzeichnet sind." Das erklärt dem Leser
    // die Mechanik statt die Vorhaben — und er sieht die Kennzeichnung nie.
    expect(mit.systemPrompt).toContain('eine Notiz für dich');
  });
});

describe('die Antwort spricht ueber Vorhaben, nicht ueber ihre Unterlagen', () => {
  const p = baueAntwortPrompt('Welche Vorhaben?', 'Treffer insgesamt: 82', '1. Irgendwas (16KN000101)');

  it('verbietet die Woerter, mit denen die Karte gemessen ueber sich selbst sprach', () => {
    expect(p.systemPrompt).toContain('Sprich zum Leser über die VORHABEN');
    expect(p.systemPrompt).toContain('gekennzeichnet');
    expect(p.systemPrompt).toContain('der Leser sieht diese Unterlagen nicht');
  });

  it('verbietet zusammengefasste Spannen', () => {
    // Gemessen: „Antragsjahre konzentrieren sich auf 2018 (11), 2021 (9) und
    // 2014-2020 (je 8-7)" — die Spanne stand in keinem Befund.
    expect(p.systemPrompt).toContain('keine Werte zu Spannen zusammen');
  });
});
