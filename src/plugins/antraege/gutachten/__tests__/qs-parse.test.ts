import { describe, it, expect } from 'vitest';
import { parseQsBefunde, QS_DIMENSIONEN } from '../qs';
import { SEED_QS_SKILL } from '@/core/services/skills';

describe('parseQsBefunde — toleranter QS-Freitext-Parser', () => {
  it('zerlegt vier Dimensionen mit Bewertung + Text', () => {
    const raw = [
      '### Erdung in der VB',
      'Bewertung: ok',
      'Alle Aussagen sind durch die VB gedeckt (VB 2.1).',
      '',
      '### Kohärenz',
      'Bewertung: hinweis',
      'Der dritte Absatz springt thematisch.',
      '',
      '### Vollständigkeit',
      'Bewertung: ok',
      'Der Zweck ist abgedeckt.',
      '',
      '### Ton',
      'Bewertung: ok',
      'Sachlich-gutachterlich.',
    ].join('\n');

    const out = parseQsBefunde(raw);
    expect(out).toHaveLength(4);
    expect(out[0]).toMatchObject({ dimension: 'Erdung in der VB', bewertung: 'ok' });
    expect(out[0]!.text).toContain('VB 2.1');
    expect(out[0]!.text).not.toMatch(/Bewertung:/);
    expect(out[1]).toMatchObject({ dimension: 'Kohärenz', bewertung: 'hinweis' });
  });

  it('erkennt Bewertung ohne explizite „Bewertung:"-Zeile (Schlüsselwort im Block)', () => {
    const raw = '### Ton\nDer Ton ist insgesamt in Ordnung und sachlich.';
    const out = parseQsBefunde(raw);
    expect(out[0]!.bewertung).toBe('ok');
  });

  it('unbestimmbare Bewertung → unklar (kein Throw)', () => {
    const raw = '### Kohärenz\nNur eine Beschreibung ohne klare Wertung über den Aufbau.';
    const out = parseQsBefunde(raw);
    expect(out[0]!.dimension).toBe('Kohärenz');
    expect(out[0]!.bewertung).toBe('unklar');
  });

  it('toleriert ## statt ### und Groß-/Kleinschreibung der Bewertung', () => {
    const raw = '## Erdung in der VB\nBEWERTUNG: HINWEIS\nEinzelne Aussage nicht belegt.';
    const out = parseQsBefunde(raw);
    expect(out[0]!.bewertung).toBe('hinweis');
  });

  it('Ausgabe ohne Überschriften → ein einzelner unklar-Befund', () => {
    const out = parseQsBefunde('Komplett freies Gerede ohne Struktur.');
    expect(out).toHaveLength(1);
    expect(out[0]!.bewertung).toBe('unklar');
    expect(out[0]!.text.length).toBeGreaterThan(0);
  });

  it('leere/whitespace-Eingabe → []', () => {
    expect(parseQsBefunde('')).toEqual([]);
    expect(parseQsBefunde('   \n\t ')).toEqual([]);
  });

  it('wirft nie — auch bei Müll-Eingabe', () => {
    expect(() => parseQsBefunde('###\n###\n@@@ {{{')).not.toThrow();
  });
});

/**
 * Drift-Wächter: die kanonischen Default-Dimensionen stehen als Konstante in
 * `qs.ts`, im Prompt aber als Prosa (der `qs-basis`-Seed ist prod-wirksam und
 * wird nicht angefasst). Ohne diesen Test könnten beide auseinanderlaufen, ohne
 * dass irgendetwas rot wird — der Parser akzeptiert JEDE Überschrift und
 * lieferte dann still plausible, aber falsch benannte Befunde.
 */
describe('QS_DIMENSIONEN ↔ qs-basis-Seed', () => {
  it('jede kanonische Dimension kommt als ###-Block im Seed-Prompt vor', () => {
    for (const dim of QS_DIMENSIONEN) {
      expect(SEED_QS_SKILL.promptTemplate).toContain(`### ${dim}`);
    }
  });

  it('der Seed fordert keine Dimensionen, die die Konstante nicht kennt', () => {
    const imSeed = [...SEED_QS_SKILL.promptTemplate.matchAll(/^### (.+)$/gm)].map(m => m[1]!.trim());
    expect(imSeed.sort()).toEqual([...QS_DIMENSIONEN].sort());
  });
});
