import { describe, it, expect } from 'vitest';
import { parseLLMJson, extractFirstJsonObject, extractFirstJsonArray } from '../json-utils';

describe('parseLLMJson', () => {
  it('parsed reines JSON-Objekt', () => {
    const r = parseLLMJson<{ a: number }>('{"a": 1}');
    expect(r).toEqual({ a: 1 });
  });

  it('parsed reines JSON-Array', () => {
    const r = parseLLMJson<number[]>('[1, 2, 3]');
    expect(r).toEqual([1, 2, 3]);
  });

  it('strippt Markdown-Fences ```json', () => {
    const raw = 'Hier ist die Antwort:\n```json\n{"a": 1}\n```\nFertig.';
    expect(parseLLMJson(raw)).toEqual({ a: 1 });
  });

  it('strippt generische Fences ```', () => {
    const raw = '```\n{"a": 1}\n```';
    expect(parseLLMJson(raw)).toEqual({ a: 1 });
  });

  it('extrahiert Object trotz vorangestelltem Erklaerungstext', () => {
    const raw = 'Hier ist das JSON: {"foo": "bar"} und noch ein Satz.';
    expect(parseLLMJson(raw)).toEqual({ foo: 'bar' });
  });

  it('extrahiert Array trotz vorangestelltem Text', () => {
    const raw = 'Ergebnis:\n[{"fkz": "FZ-1"}, {"fkz": "FZ-2"}]';
    expect(parseLLMJson(raw)).toEqual([{ fkz: 'FZ-1' }, { fkz: 'FZ-2' }]);
  });

  it('returnt null bei kaputtem JSON', () => {
    expect(parseLLMJson('not json at all')).toBeNull();
    expect(parseLLMJson('{ broken')).toBeNull();
  });

  it('respektiert Strings mit geschachtelten Klammern', () => {
    // Klammern in Strings duerfen die Balanced-Klammer-Logik nicht abbrechen.
    const raw = '{"text": "a } b { c", "n": 1}';
    expect(parseLLMJson(raw)).toEqual({ text: 'a } b { c', n: 1 });
  });

  it('respektiert escapete Anfuehrungszeichen', () => {
    const raw = '{"text": "a \\"quoted\\" b"}';
    expect(parseLLMJson(raw)).toEqual({ text: 'a "quoted" b' });
  });

  it('waehlt Object vor Array wenn Object zuerst vorkommt', () => {
    const raw = '{"a": 1} [2, 3]';
    expect(parseLLMJson(raw)).toEqual({ a: 1 });
  });

  it('extractFirstJsonObject + extractFirstJsonArray Roundtrip', () => {
    expect(extractFirstJsonObject('foo {"a":1} bar')).toBe('{"a":1}');
    expect(extractFirstJsonArray('foo [1,2] bar')).toBe('[1,2]');
  });

  it('returnt null wenn keine passende Klammer schliesst', () => {
    expect(extractFirstJsonObject('{')).toBeNull();
    expect(extractFirstJsonArray('[1, 2')).toBeNull();
  });
});
