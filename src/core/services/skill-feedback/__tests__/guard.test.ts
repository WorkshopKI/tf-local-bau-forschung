import { describe, it, expect } from 'vitest';
import { sanitizeEvent, sanitizeFeedbackEvent, sanitizeUsageEvent } from '../guard';
import { MAX_NOTIZ_LENGTH } from '../types';

describe('sanitizeFeedbackEvent — DSGVO-Whitelist', () => {
  it('übernimmt nur erlaubte Felder und verwirft Antragsbezug', () => {
    const raw = {
      skillId: 'kurzfassung',
      skillVersion: 3,
      rating: 'up',
      notiz: 'gut',
      ts: '2026-06-19T10:00:00.000Z',
      userId: 'AB',
      // verbotene Felder — müssen strukturell verschwinden:
      vbInhalt: 'geheimer Projekttext',
      fkz: '16KN012345',
      aktenzeichen: 'ZF4711',
      generatedText: 'Die Kurzfassung lautet …',
    };
    const ev = sanitizeFeedbackEvent(raw)!;
    expect(ev).not.toBeNull();
    expect(ev).toEqual({
      skillId: 'kurzfassung',
      skillVersion: 3,
      rating: 'up',
      notiz: 'gut',
      ts: '2026-06-19T10:00:00.000Z',
      userId: 'AB',
    });
    // Keine verbotenen Keys durchgerutscht.
    expect(Object.keys(ev).sort()).toEqual(['notiz', 'rating', 'skillId', 'skillVersion', 'ts', 'userId']);
  });

  it('kürzt eine zu lange Notiz auf MAX_NOTIZ_LENGTH', () => {
    const lang = 'x'.repeat(500);
    const ev = sanitizeFeedbackEvent({
      skillId: 's', skillVersion: 1, rating: 'down', notiz: lang,
      ts: '2026-06-19T10:00:00.000Z', userId: 'AB',
    })!;
    expect(ev.notiz).toHaveLength(MAX_NOTIZ_LENGTH);
  });

  it('lässt notiz weg, wenn leer/whitespace', () => {
    const ev = sanitizeFeedbackEvent({
      skillId: 's', skillVersion: 1, rating: 'up', notiz: '   ',
      ts: 't', userId: 'AB',
    })!;
    expect('notiz' in ev).toBe(false);
  });

  it('verwirft bei fehlendem Pflichtfeld oder falschem rating', () => {
    expect(sanitizeFeedbackEvent({ skillId: 's', skillVersion: 1, rating: 'up', ts: 't' })).toBeNull();
    expect(sanitizeFeedbackEvent({ skillId: 's', skillVersion: 1, rating: 'maybe', ts: 't', userId: 'AB' })).toBeNull();
    expect(sanitizeFeedbackEvent({ skillId: 's', rating: 'up', ts: 't', userId: 'AB' })).toBeNull();
    expect(sanitizeFeedbackEvent(null)).toBeNull();
    expect(sanitizeFeedbackEvent('nope')).toBeNull();
  });
});

describe('sanitizeUsageEvent — DSGVO-Whitelist', () => {
  it('übernimmt nur erlaubte Felder', () => {
    const ev = sanitizeUsageEvent({
      skillId: 'qs', skillVersion: 2, event: 'lauf', ts: 't', userId: 'CD',
      vbInhalt: 'leak', fkz: '16KN0',
    })!;
    expect(ev).toEqual({ skillId: 'qs', skillVersion: 2, event: 'lauf', ts: 't', userId: 'CD' });
    expect(Object.keys(ev).sort()).toEqual(['event', 'skillId', 'skillVersion', 'ts', 'userId']);
  });

  it('verwirft, wenn event != lauf oder Pflichtfeld fehlt', () => {
    expect(sanitizeUsageEvent({ skillId: 's', skillVersion: 1, event: 'klick', ts: 't', userId: 'A' })).toBeNull();
    expect(sanitizeUsageEvent({ skillId: 's', skillVersion: 1, ts: 't', userId: 'A' })).toBeNull();
    expect(sanitizeUsageEvent({ skillId: 's', event: 'lauf', ts: 't', userId: 'A' })).toBeNull();
  });
});

describe('sanitizeEvent — Dispatch', () => {
  it('routet auf Usage bei event=lauf, sonst Feedback', () => {
    const u = sanitizeEvent({ skillId: 's', skillVersion: 1, event: 'lauf', ts: 't', userId: 'A' });
    expect(u && 'event' in u).toBe(true);
    const f = sanitizeEvent({ skillId: 's', skillVersion: 1, rating: 'up', ts: 't', userId: 'A' });
    expect(f && 'rating' in f).toBe(true);
  });
});
