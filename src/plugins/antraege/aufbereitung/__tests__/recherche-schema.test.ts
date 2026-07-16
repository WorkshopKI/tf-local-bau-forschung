import { describe, it, expect } from 'vitest';
import { parseExterneRecherche } from '../recherche-schema';

describe('parseExterneRecherche', () => {
  it('liest einen sauberen JSON-Block (Aussagen + Quellen)', () => {
    const raw = 'Report …\n```json\n{ "schemaVersion": 1, "identifikation": "Fa. X", "quellen": [{ "url": "https://a.example", "datum": "2026-01-02" }], "aussagen": [{ "kategorie": "zielmarkt", "text": "Markt wächst", "quellenUrls": ["https://a.example"] }, { "kategorie": "sdt", "text": "Stand der Technik …" }] }\n```';
    const r = parseExterneRecherche(raw);
    expect(r).not.toBeNull();
    expect(r?.identifikation).toBe('Fa. X');
    expect(r?.quellen).toEqual([{ url: 'https://a.example', datum: '2026-01-02' }]);
    expect(r?.aussagen).toHaveLength(2);
    expect(r?.aussagen[0]).toMatchObject({ kategorie: 'zielmarkt', text: 'Markt wächst' });
  });

  it('verkraftet das Bridge-Trailing-Artefakt nach dem Codeblock', () => {
    const raw = '```json\n{ "schemaVersion": 1, "quellen": [], "aussagen": [{ "kategorie": "umsatz", "text": "10 Mio" }] }\n```\n :help[]';
    expect(parseExterneRecherche(raw)?.aussagen[0]?.kategorie).toBe('umsatz');
  });

  it('verwirft Aussagen mit unbekannter Kategorie und Quellen ohne URL', () => {
    const raw = '```json\n{ "quellen": [{ "datum": "2026-01-01" }, { "url": "https://ok.example" }], "aussagen": [{ "kategorie": "quatsch", "text": "x" }, { "kategorie": "wettbewerb", "text": "Wettbewerber Y" }] }\n```';
    const r = parseExterneRecherche(raw);
    expect(r?.quellen).toEqual([{ url: 'https://ok.example' }]);
    expect(r?.aussagen).toEqual([{ kategorie: 'wettbewerb', text: 'Wettbewerber Y' }]);
  });

  it('erkennt ein leeres, aber schema-konformes Objekt (0 Aussagen ist legitim)', () => {
    const r = parseExterneRecherche('```json\n{ "schemaVersion": 1, "quellen": [], "aussagen": [] }\n```');
    expect(r).not.toBeNull();
    expect(r?.aussagen).toEqual([]);
  });

  it('gibt null bei reinem Fließtext ohne Schema zurück (→ Fallback auf internen Lauf)', () => {
    expect(parseExterneRecherche('Nur ein Report ohne JSON.')).toBeNull();
  });

  it('gibt null bei fremdem JSON ohne aussagen/quellen zurück', () => {
    expect(parseExterneRecherche('```json\n{ "foo": 1, "bar": 2 }\n```')).toBeNull();
  });
});
