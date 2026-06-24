import { describe, it, expect } from 'vitest';
import type { UnifiedSearchResult } from '@/core/types/search-result';
import {
  DEFAULT_BEGRUENDUNG_INSTRUCTION,
  buildResultBlock,
  assembleBegruendungPrompt,
  buildPreviewPrompt,
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

  it('assembled prompt always carries the JSON contract and the query, regardless of instruction', () => {
    const prompt = assembleBegruendungPrompt('Normen und Standards', 'Mach was du willst.', buildResultBlock([ANTRAG]));
    expect(prompt).toContain('«Normen und Standards»');
    expect(prompt).toContain('Mach was du willst.');
    // Fester JSON-Vertrag — darf durch Edits der Anweisung NICHT verschwinden.
    expect(prompt).toContain('"id"');
    expect(prompt).toContain('"begruendung"');
    expect(prompt).toContain('id: 16KN012345');
  });

  it('preview prompt equals assembly over the given results', () => {
    const preview = buildPreviewPrompt('q', DEFAULT_BEGRUENDUNG_INSTRUCTION, [ANTRAG, DOKUMENT]);
    const manual = assembleBegruendungPrompt('q', DEFAULT_BEGRUENDUNG_INSTRUCTION, buildResultBlock([ANTRAG, DOKUMENT]));
    expect(preview).toBe(manual);
  });
});
