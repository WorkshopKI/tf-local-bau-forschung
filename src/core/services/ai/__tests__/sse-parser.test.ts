import { describe, expect, it } from 'vitest';
import { createSSEParser } from '../sse-parser';

describe('createSSEParser', () => {
  it('liefert ein einzelnes data-Payload bei komplettem Event', () => {
    const p = createSSEParser();
    expect(p.push('data: {"a":1}\n\n')).toEqual(['{"a":1}']);
  });

  it('liefert mehrere Events aus einem Chunk', () => {
    const p = createSSEParser();
    expect(p.push('data: eins\n\ndata: zwei\n\n')).toEqual(['eins', 'zwei']);
  });

  it('puffert partielle Zeilen über Chunk-Grenzen', () => {
    const p = createSSEParser();
    expect(p.push('data: {"a"')).toEqual([]);
    expect(p.push(':1}\n\n')).toEqual(['{"a":1}']);
  });

  it('joined Multi-Line-data mit \\n (SSE-Spec)', () => {
    const p = createSSEParser();
    expect(p.push('data: zeile1\ndata: zeile2\n\n')).toEqual(['zeile1\nzeile2']);
  });

  it('verkraftet CRLF-Zeilenenden', () => {
    const p = createSSEParser();
    expect(p.push('data: x\r\n\r\n')).toEqual(['x']);
  });

  it('ignoriert Kommentar-Zeilen (OpenRouter Keep-alive)', () => {
    const p = createSSEParser();
    expect(p.push(': OPENROUTER PROCESSING\n\ndata: y\n\n')).toEqual(['y']);
  });

  it('ignoriert event:- und id:-Felder', () => {
    const p = createSSEParser();
    expect(p.push('event: message\nid: 3\ndata: z\n\n')).toEqual(['z']);
  });

  it('reicht [DONE] als Payload durch', () => {
    const p = createSSEParser();
    expect(p.push('data: [DONE]\n\n')).toEqual(['[DONE]']);
  });

  it('akzeptiert data: ohne Leerzeichen nach dem Doppelpunkt', () => {
    const p = createSSEParser();
    expect(p.push('data:x\n\n')).toEqual(['x']);
  });

  it('end() flusht ein gepuffertes Event ohne abschließende Leerzeile', () => {
    const p = createSSEParser();
    expect(p.push('data: tail')).toEqual([]);
    expect(p.end()).toEqual(['tail']);
  });

  it('end() ohne Rest liefert leeres Array', () => {
    const p = createSSEParser();
    p.push('data: fertig\n\n');
    expect(p.end()).toEqual([]);
  });

  it('Payload über drei Chunks verteilt', () => {
    const p = createSSEParser();
    const out = [
      ...p.push('da'),
      ...p.push('ta: {"delta":"ab'),
      ...p.push('c"}\n\nda'),
      ...p.push('ta: [DONE]\n\n'),
    ];
    expect(out).toEqual(['{"delta":"abc"}', '[DONE]']);
  });
});
