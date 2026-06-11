import { describe, expect, it } from 'vitest';
import { buildChatSources } from '../services/rag-sources';
import type { OramaSearchResult } from '@/core/services/search/orama-store';

function res(overrides: Partial<OramaSearchResult> = {}): OramaSearchResult {
  return {
    id: 'r1',
    text: 'Im Vorhaben steuert KI die Interaktion zwischen Roboterzelle und Werkstück.',
    title: 'Vorhabensbeschreibung',
    source: '16KN065210_Vorhabensbeschreibung.pdf',
    tags: [],
    type: 'dokument',
    score: 0.87,
    method: 'hybrid',
    ...overrides,
  } as OramaSearchResult;
}

describe('buildChatSources', () => {
  it('nummeriert 1-basiert und mappt Felder', () => {
    const sources = buildChatSources([res(), res({ id: 'r2' })], 'KI');
    expect(sources[0]?.n).toBe(1);
    expect(sources[1]?.n).toBe(2);
    expect(sources[0]?.title).toBe('Vorhabensbeschreibung');
    expect(sources[0]?.method).toBe('hybrid');
    expect(sources[0]?.type).toBe('dokument');
    expect(sources[0]?.sourcePath).toBe('16KN065210_Vorhabensbeschreibung.pdf');
  });

  it('rechnet score→relevance (0..100, gerundet, geclampt)', () => {
    expect(buildChatSources([res({ score: 0.87 })], 'x')[0]?.relevance).toBe(87);
    expect(buildChatSources([res({ score: 1.4 })], 'x')[0]?.relevance).toBe(100);
    expect(buildChatSources([res({ score: -0.2 })], 'x')[0]?.relevance).toBe(0);
  });

  it('parst FKZ aus dem Dateinamen, wenn gültig', () => {
    const s = buildChatSources([res({ source: '16KN065210_Vorhaben.pdf' })], 'x');
    expect(s[0]?.antragFkz).toBe('16KN065210');
  });

  it('kein antragFkz, wenn der Dateiname keine gültige FKZ enthält', () => {
    const s = buildChatSources([res({ source: 'irgendein-dokument.pdf' })], 'x');
    expect(s[0]?.antragFkz).toBeUndefined();
  });

  it('title fällt auf sourcePath zurück, wenn title leer', () => {
    const s = buildChatSources([res({ title: '', source: 'datei.pdf' })], 'x');
    expect(s[0]?.title).toBe('datei.pdf');
  });

  it('baut snippet + contextLine aus dem Chunk-Text', () => {
    const s = buildChatSources([res({ text: 'KI steuert die Roboterzelle in Echtzeit.' })], 'Roboterzelle');
    expect(s[0]?.snippet).toContain('«Roboterzelle»');
    expect(s[0]?.contextLine.length).toBeGreaterThan(0);
  });

  it('leeres Input → leeres Array', () => {
    expect(buildChatSources([], 'x')).toEqual([]);
  });
});
