import { describe, expect, it } from 'vitest';
import {
  buildApiMessages,
  DEFAULT_SYSTEM_PROMPT,
  HISTORY_CHAR_BUDGET,
  HISTORY_MAX_MESSAGES,
} from '../conversation-context';
import type { ChatMessage } from '../types';

let counter = 0;
function msg(role: 'user' | 'assistant', content: string, extra: Partial<ChatMessage> = {}): ChatMessage {
  counter += 1;
  return { id: `m-${counter}`, role, content, createdAt: '2026-06-10T12:00:00Z', ...extra };
}

describe('buildApiMessages', () => {
  it('System-Prompt zuerst, danach Verlauf chronologisch', () => {
    const api = buildApiMessages(
      [msg('user', 'Frage 1'), msg('assistant', 'Antwort 1'), msg('user', 'Frage 2')],
      DEFAULT_SYSTEM_PROMPT,
    );
    expect(api.map(m => m.role)).toEqual(['system', 'user', 'assistant', 'user']);
    expect(api[0]?.content).toBe(DEFAULT_SYSTEM_PROMPT);
    expect(api[3]?.content).toBe('Frage 2');
  });

  it('leerer System-Prompt → keine system-Message', () => {
    const api = buildApiMessages([msg('user', 'Hi')], '  ');
    expect(api.map(m => m.role)).toEqual(['user']);
  });

  it('extraContext (RAG/Verzeichnisse) hängt NUR an der letzten User-Message', () => {
    const api = buildApiMessages(
      [msg('user', 'Frage 1'), msg('assistant', 'Antwort 1'), msg('user', 'Frage 2')],
      'sys',
      '\n\nKontext: XYZ',
    );
    expect(api[1]?.content).toBe('Frage 1');
    expect(api[3]?.content).toBe('Frage 2\n\nKontext: XYZ');
  });

  it('Attachment-Kontext wird in den API-Content der User-Message injiziert', () => {
    const api = buildApiMessages(
      [msg('user', 'Was steht im Dokument?', {
        attachments: [{
          id: 'a1', filename: 'bericht.pdf', format: 'pdf', markdown: 'INHALT',
          charCount: 6, originalCharCount: 6, truncated: false,
        }],
      })],
      'sys',
    );
    expect(api[1]?.content).toContain('Was steht im Dokument?');
    expect(api[1]?.content).toContain('bericht.pdf');
    expect(api[1]?.content).toContain('INHALT');
  });

  it('leere Assistant-Messages (Abort ohne Inhalt) werden übersprungen', () => {
    const api = buildApiMessages(
      [msg('user', 'F1'), msg('assistant', '', { aborted: true }), msg('user', 'F2')],
      'sys',
    );
    expect(api.map(m => m.role)).toEqual(['system', 'user', 'user']);
  });

  it('thinking wird nie mitgesendet', () => {
    const api = buildApiMessages(
      [msg('user', 'F'), msg('assistant', 'A', { thinking: 'GEHEIM' }), msg('user', 'F2')],
      'sys',
    );
    expect(JSON.stringify(api)).not.toContain('GEHEIM');
  });

  it(`kappt auf die letzten ${HISTORY_MAX_MESSAGES} Messages`, () => {
    const history: ChatMessage[] = [];
    for (let i = 0; i < 30; i++) {
      history.push(msg(i % 2 === 0 ? 'user' : 'assistant', `Nachricht ${i}`));
    }
    const api = buildApiMessages(history, 'sys');
    expect(api.length).toBe(1 + HISTORY_MAX_MESSAGES);
    expect(api[1]?.content).toBe(`Nachricht ${30 - HISTORY_MAX_MESSAGES}`);
  });

  it('kappt am Zeichen-Budget, älteste fliegen zuerst raus', () => {
    const big = 'x'.repeat(HISTORY_CHAR_BUDGET - 10);
    const api = buildApiMessages(
      [msg('user', big), msg('assistant', 'kurz'), msg('user', 'aktuelle Frage mit etwas Text')],
      'sys',
    );
    // big (Budget-10) + 'kurz' + aktuelle Frage > Budget → big fällt raus
    expect(api.map(m => m.role)).toEqual(['system', 'assistant', 'user']);
  });

  it('die aktuelle User-Message bleibt IMMER drin, auch wenn sie allein das Budget sprengt', () => {
    const api = buildApiMessages(
      [msg('user', 'x'.repeat(HISTORY_CHAR_BUDGET + 5000))],
      'sys',
    );
    expect(api.map(m => m.role)).toEqual(['system', 'user']);
  });
});
