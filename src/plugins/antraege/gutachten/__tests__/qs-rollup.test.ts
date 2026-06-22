import { describe, it, expect } from 'vitest';
import { qsRollup, qsBefundLevel } from '../qs';
import type { QsBefund } from '../types';

const b = (bewertung: QsBefund['bewertung']): QsBefund => ({ dimension: 'd', bewertung, text: '' });

describe('qsBefundLevel — QS ist beratend, nie fehler', () => {
  it('ok→ok, hinweis→hinweis, unklar→hinweis', () => {
    expect(qsBefundLevel('ok')).toBe('ok');
    expect(qsBefundLevel('hinweis')).toBe('hinweis');
    expect(qsBefundLevel('unklar')).toBe('hinweis');
  });
});

describe('qsRollup', () => {
  it('alles ok → level ok', () => {
    expect(qsRollup([b('ok'), b('ok')])).toEqual({ level: 'ok', summary: 'alles ok' });
  });
  it('Hinweise dominieren Summary', () => {
    expect(qsRollup([b('ok'), b('hinweis'), b('hinweis')])).toEqual({ level: 'hinweis', summary: '2 Hinweise' });
  });
  it('nur unklar → level hinweis, summary zählt unklar', () => {
    expect(qsRollup([b('ok'), b('unklar')])).toEqual({ level: 'hinweis', summary: '1 unklar' });
  });
  it('Hinweis schlägt unklar in der Summary', () => {
    expect(qsRollup([b('hinweis'), b('unklar')])).toEqual({ level: 'hinweis', summary: '1 Hinweis' });
  });
  it('leere Liste → ok', () => {
    expect(qsRollup([])).toEqual({ level: 'ok', summary: 'alles ok' });
  });
});
