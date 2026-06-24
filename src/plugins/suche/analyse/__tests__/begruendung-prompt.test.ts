import { describe, it, expect } from 'vitest';
import type { UnifiedSearchResult } from '@/core/types/search-result';
import {
  DEFAULT_BEGRUENDUNG_INSTRUCTION,
  buildResultBlock,
  assembleBegruendungPrompt,
  buildPreviewPrompt,
  parseBegruendungResponse,
} from '../stages/begruendung';

const ANTRAG: UnifiedSearchResult = {
  id: '16KN012345',
  type: 'antrag',
  score: 0.7,
  method: 'hybrid',
  title: 'SmartPig — Prozessstandards',
  snippet: 'Interpretationsregeln und Prozessstandards für die Tierhaltung.',
  fkz: '16KN012345',
  programm: 'ZIM',
  antragsteller: 'Humboldt-Universität',
  status: 'bewilligt',
};

const DOKUMENT: UnifiedSearchResult = {
  id: 'chunk-42',
  type: 'dokument',
  score: 0.5,
  method: 'fulltext',
  title: 'Gutachten Abschnitt B',
  snippet: 'Bewertung der wissenschaftlich-technischen Qualität.',
  dateiname: 'gutachten.pdf',
  dokumentTyp: 'Gutachten',
};

describe('begruendung prompt assembly', () => {
  it('default instruction is non-empty', () => {
    expect(DEFAULT_BEGRUENDUNG_INSTRUCTION.length).toBeGreaterThan(20);
  });

  it('buildResultBlock keeps the exact id and labels both result types', () => {
    const block = buildResultBlock([ANTRAG, DOKUMENT]);
    expect(block).toContain('id: 16KN012345');
    expect(block).toContain('id: chunk-42');
    expect(block).toContain('Typ: Förderantrag');
    expect(block).toContain('Typ: Dokument');
    expect(block).toContain('SmartPig'); // Titel
    expect(block).toContain('Dokumenttyp: Gutachten');
  });

  it('assembled prompt always carries the marker format contract and the query', () => {
    const prompt = assembleBegruendungPrompt('Normen und Standards', 'Mach was du willst.', buildResultBlock([ANTRAG]));
    expect(prompt).toContain('«Normen und Standards»');
    expect(prompt).toContain('Mach was du willst.');
    // Festes (quote-sicheres) Format — darf durch Edits der Anweisung NICHT verschwinden.
    expect(prompt).toContain('@@@ <id>');
    expect(prompt).toContain('id: 16KN012345');
    expect(prompt).not.toContain('JSON-Array');
  });

  it('preview prompt equals assembly over the given results', () => {
    const preview = buildPreviewPrompt('q', DEFAULT_BEGRUENDUNG_INSTRUCTION, [ANTRAG, DOKUMENT]);
    const manual = assembleBegruendungPrompt('q', DEFAULT_BEGRUENDUNG_INSTRUCTION, buildResultBlock([ANTRAG, DOKUMENT]));
    expect(preview).toBe(manual);
  });
});

describe('parseBegruendungResponse', () => {
  it('parses the marker format even when the begruendung contains double-quotes', () => {
    // Genau die Falle aus dem echten Lauf: Anführungszeichen würden JSON sprengen.
    const raw = [
      '@@@ 16DS260491',
      'Der Antrag ist für die Suche nach "Normung und Standardisierung" nicht relevant.',
      '@@@ 16KN101128',
      'Im Titel steht ein "Prozessstandard", damit hochrelevant.',
      'Zweiter Satz zur Begründung.',
    ].join('\n');
    const out = parseBegruendungResponse(raw);
    expect(out).not.toBeNull();
    expect(out!['16DS260491']).toContain('"Normung und Standardisierung"');
    expect(out!['16KN101128']).toContain('Zweiter Satz'); // mehrzeilig zusammengeführt
  });

  it('ignores preamble and code fences before the first marker', () => {
    const raw = '```\nHier die Begründungen:\n@@@ A1\nText eins.\n```';
    const out = parseBegruendungResponse(raw);
    expect(out).toEqual({ A1: 'Text eins.' });
  });

  it('falls back to a valid JSON array when no markers are present', () => {
    const raw = '[{ "id": "X9", "begruendung": "Passt." }]';
    expect(parseBegruendungResponse(raw)).toEqual({ X9: 'Passt.' });
  });

  it('returns null when nothing usable is present', () => {
    expect(parseBegruendungResponse('Ich kann das nicht beantworten.')).toBeNull();
  });
});
