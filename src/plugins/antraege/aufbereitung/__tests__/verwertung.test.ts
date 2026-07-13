import { describe, it, expect } from 'vitest';
import { buildVerwertungPrompt, parseVerwertung } from '../verwertung';
import type { VbSektion } from '../gliederung';

const SEKTION_IDS = ['k-7.1', 'k-7.3', 'k-2'];

function gliederung(): VbSektion[] {
  return SEKTION_IDS.map((id, i) => ({ id, nummer: id.slice(2), titel: `T${i}`, ebene: 1 as const, start: i * 10, end: i * 10 + 10, quelle: 'heading' as const }));
}

describe('buildVerwertungPrompt', () => {
  it('nennt Sektionen (ohne s-toc), Material-Text, die fünf Kategorien und fordert kompaktes JSON', () => {
    const p = buildVerwertungPrompt(gliederung(), 'DAS ANTRAGSMATERIAL');
    expect(p).toContain('[k-7.1]');
    expect(p).toContain('DAS ANTRAGSMATERIAL');
    expect(p).toContain('```json');
    expect(p).toContain('"aussagen"');
    expect(p).toContain('zielmarkt');
    expect(p).toContain('verwertungsweg');
    expect(p).toContain('erfinde nichts');
    expect(p).toContain('kompakt');
  });
});

describe('parseVerwertung', () => {
  it('parst Aussagen, validiert Kategorie + Sektions-IDs', () => {
    const raw = ['```json', JSON.stringify({
      schemaVersion: 1,
      aussagen: [
        { kategorie: 'zielmarkt', text: 'Mittelstand DACH', sektionIds: ['k-7.1', 'xx'] },
        { kategorie: 'verwertungsweg', text: 'SaaS-Lizenz', sektionIds: ['k-7.3'] },
      ],
    }), '```'].join('\n');
    const d = parseVerwertung(raw, SEKTION_IDS)!;
    expect(d.aussagen.map(a => a.kategorie)).toEqual(['zielmarkt', 'verwertungsweg']);
    expect(d.aussagen[0]!.sektionIds).toEqual(['k-7.1']); // unbekanntes „xx" verworfen
  });

  it('verwirft Einträge mit unbekannter Kategorie ODER ohne Text (leere sektionIds ok)', () => {
    const raw = JSON.stringify({
      aussagen: [
        { kategorie: 'quatsch', text: 'ungültige Kategorie', sektionIds: ['k-2'] },
        { kategorie: 'umsatz', sektionIds: ['k-2'] }, // ohne text
        { kategorie: 'umsatz', text: '5 Mio EUR in Jahr 3', sektionIds: [] },
      ],
    });
    const d = parseVerwertung(raw, SEKTION_IDS)!;
    expect(d.aussagen).toHaveLength(1);
    expect(d.aussagen[0]!.text).toBe('5 Mio EUR in Jahr 3');
    expect(d.aussagen[0]!.sektionIds).toEqual([]);
  });

  it('kaputtes JSON / Prosa → null (Degradation)', () => {
    expect(parseVerwertung('nur Prosa ohne JSON', SEKTION_IDS)).toBeNull();
  });

  it('leeres aussagen-Array → 0 Aussagen (legitimer inhaltsbasierter Leer-Zustand, nicht null)', () => {
    expect(parseVerwertung('{"schemaVersion":1,"aussagen":[]}', SEKTION_IDS)).toEqual({ schemaVersion: 1, aussagen: [] });
    expect(parseVerwertung('{}', SEKTION_IDS)).toEqual({ schemaVersion: 1, aussagen: [] });
  });

  it('rettet vollständige Aussagen aus abgeschnittener Antwort (Truncation-Salvage)', () => {
    const raw = [
      '```json',
      '{ "schemaVersion": 1, "aussagen": [',
      '{ "kategorie": "zielmarkt", "text": "Mittelstand DACH", "sektionIds": ["k-7.1"] },',
      '{ "kategorie": "verwertungsweg", "text": "SaaS-Lizenz", "sektionIds": ["k-7.3"] },',
      '{ "kategorie": "umsatz", "text": "Gallium', // abgeschnitten
    ].join('\n');
    const d = parseVerwertung(raw, SEKTION_IDS)!;
    expect(d.aussagen.map(a => a.kategorie)).toEqual(['zielmarkt', 'verwertungsweg']);
  });
});
