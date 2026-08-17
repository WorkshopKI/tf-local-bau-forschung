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
