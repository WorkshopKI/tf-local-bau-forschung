/** Phase 8 — mailto-Aufbau (adressierter Leer-Entwurf). */
import { describe, expect, it } from 'vitest';
import { buildMailtoLeer, replyBetreff } from '../mailto';

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

describe('buildMailtoLeer', () => {
  it('baut to/subject ohne Body (Betreff URL-encodet, „Re:" ergänzt)', () => {
    const url = buildMailtoLeer('a@b.de', 'Anfrage');
    expect(url).toBe('mailto:a@b.de?subject=Re%3A%20Anfrage');
    expect(url).not.toContain('body=');
  });
});
