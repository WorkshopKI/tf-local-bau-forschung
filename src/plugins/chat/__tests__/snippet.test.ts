import { describe, expect, it } from 'vitest';
import { buildSnippet } from '../services/snippet';

const LONG = 'Die Vorhabensbeschreibung benennt den Einsatz lernender Verfahren zur '
  + 'Prozessautomatisierung als Kernziel. Adressiert werden die Reduktion manueller '
  + 'Eingriffe sowie eine durchgängige Datenerfassung entlang der Fertigungslinie über '
  + 'mehrere Stationen hinweg, damit am Ende eine robuste Qualitätssicherung entsteht.';

describe('buildSnippet', () => {
  it('zentriert das Exzerpt um den ersten Query-Term-Treffer und hebt ihn hervor', () => {
    const { snippet } = buildSnippet(LONG, 'Prozessautomatisierung');
    expect(snippet).toContain('«Prozessautomatisierung»');
  });

  it('hebt mehrere Query-Terme hervor', () => {
    const { snippet } = buildSnippet(LONG, 'manueller Datenerfassung');
    expect(snippet).toContain('«manueller»');
    expect(snippet).toContain('«Datenerfassung»');
  });

  it('kürzt lange Texte und setzt Ellipsen-Marker', () => {
    const { snippet } = buildSnippet(LONG, 'Fertigungslinie');
    expect(snippet.length).toBeLessThan(LONG.length);
    expect(snippet).toContain('…');
  });

  it('kollabiert Whitespace/Zeilenumbrüche', () => {
    const { snippet } = buildSnippet('Zeile eins\n\n  Zeile   zwei', 'zwei');
    expect(snippet).not.toContain('\n');
    expect(snippet).not.toContain('  ');
  });

  it('ohne Treffer: Anfang des Textes, keine Marker', () => {
    const { snippet } = buildSnippet(LONG, 'xyzfehlt');
    expect(snippet).not.toContain('«');
    expect(snippet.startsWith('Die Vorhabensbeschreibung')).toBe(true);
  });

  it('ignoriert sehr kurze Query-Terme (<3 Zeichen)', () => {
    const { snippet } = buildSnippet('ab cd Prozessautomatisierung ef', 'ab');
    expect(snippet).not.toContain('«ab»');
  });

  it('contextLine ist kürzer als das snippet, einzeilig und ohne «»-Marker', () => {
    const { snippet, contextLine } = buildSnippet(LONG, 'Prozessautomatisierung');
    expect(contextLine.length).toBeLessThanOrEqual(snippet.length);
    expect(contextLine).not.toContain('«');
    expect(contextLine).not.toContain('\n');
  });

  it('leerer Text → leere Ausgabe', () => {
    expect(buildSnippet('', 'foo')).toEqual({ snippet: '', contextLine: '' });
  });
});
