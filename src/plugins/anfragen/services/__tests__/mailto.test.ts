/** Phase 8 — mailto-Aufbau + Längen-Fallback. */
import { describe, expect, it } from 'vitest';
import { buildMailto, mailtoBodyZuLang, replyBetreff, MAILTO_MAX_BODY } from '../mailto';

describe('replyBetreff', () => {
  it('prefixt „Re:" bei normalem Betreff', () => {
    expect(replyBetreff('Anfrage zur Förderung')).toBe('Re: Anfrage zur Förderung');
  });
  it('verdoppelt vorhandene Reply-Präfixe nicht (AW:/Re:/WG:)', () => {
    expect(replyBetreff('AW: Anfrage')).toBe('AW: Anfrage');
    expect(replyBetreff('Re: X')).toBe('Re: X');
    expect(replyBetreff('WG: Y')).toBe('WG: Y');
  });
});

describe('buildMailto', () => {
  it('baut to/subject/body korrekt (Betreff + Body URL-encodet)', () => {
    const url = buildMailto('a@b.de', 'Anfrage', 'Hallo & Grüße');
    expect(url.startsWith('mailto:a@b.de?')).toBe(true);
    expect(url).toContain('subject=Re%3A%20Anfrage');
    expect(url).toContain('body=Hallo%20%26%20Gr%C3%BC%C3%9Fe');
  });
});

describe('mailtoBodyZuLang', () => {
  it('kurzer Body → false', () => {
    expect(mailtoBodyZuLang('kurze Antwort')).toBe(false);
  });
  it('langer Body (> Schwelle nach Encoding) → true', () => {
    expect(mailtoBodyZuLang('x'.repeat(MAILTO_MAX_BODY + 1))).toBe(true);
  });
});
