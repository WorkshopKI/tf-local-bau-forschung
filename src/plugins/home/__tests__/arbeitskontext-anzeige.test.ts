import { describe, it, expect } from 'vitest';
import type { ArbeitskontextEintrag } from '@/core/services/personal-storage/arbeitskontext-log';
import { beschreibeArbeitskontext, relativeZeit } from '../arbeitskontext-anzeige';

function eintrag(over: Partial<ArbeitskontextEintrag> = {}): ArbeitskontextEintrag {
  return { typ: 'gutachten', verbundKey: 'FKZ01', ts: '2026-07-01T10:00:00.000Z', ...over };
}

const INFO = { akronym: 'ProjektX', titel: 'Ein Titel' };

describe('beschreibeArbeitskontext', () => {
  it('Gutachten mit Abschnitt + Live-Status „entwurf"', () => {
    const a = beschreibeArbeitskontext(eintrag({ abschnittId: 'B' }), INFO, 'entwurf');
    expect(a?.kontext).toBe('Gutachten · Abschnitt B im Entwurf');
    expect(a?.akronym).toBe('ProjektX');
    expect(a?.fkz).toBe('FKZ01');
  });

  it('Gutachten mit Abschnitt + Live-Status „freigegeben"', () => {
    const a = beschreibeArbeitskontext(eintrag({ abschnittId: 'C' }), INFO, 'freigegeben');
    expect(a?.kontext).toBe('Gutachten · Abschnitt C freigegeben');
  });

  it('Gutachten mit Abschnitt ohne Status → „offen"', () => {
    const a = beschreibeArbeitskontext(eintrag({ abschnittId: 'A' }), INFO, undefined);
    expect(a?.kontext).toBe('Gutachten · Abschnitt A offen');
  });

  it('Nachforderungen — kein Abschnitt', () => {
    const a = beschreibeArbeitskontext(eintrag({ typ: 'nachforderung' }), INFO);
    expect(a?.kontext).toBe('Nachforderungen');
  });

  it('Kurzfassung — kein Abschnitt', () => {
    const a = beschreibeArbeitskontext(eintrag({ typ: 'kurzfassung' }), INFO);
    expect(a?.kontext).toBe('Kurzfassung');
  });

  it('info === null → null (Antrag/Verbund nicht gefunden → überspringen)', () => {
    expect(beschreibeArbeitskontext(eintrag(), null)).toBeNull();
  });

  it('leeres Akronym fällt auf den verbundKey zurück', () => {
    const a = beschreibeArbeitskontext(eintrag(), { akronym: '  ', titel: null });
    expect(a?.akronym).toBe('FKZ01');
    expect(a?.titel).toBeNull();
  });
});

describe('relativeZeit', () => {
  const base = Date.parse('2026-07-01T12:00:00.000Z');
  it('gerade eben (<1 Min)', () => {
    expect(relativeZeit('2026-07-01T11:59:30.000Z', base)).toBe('gerade eben');
  });
  it('Minuten', () => {
    expect(relativeZeit('2026-07-01T11:55:00.000Z', base)).toBe('vor 5 Min');
  });
  it('Stunden', () => {
    expect(relativeZeit('2026-07-01T09:00:00.000Z', base)).toBe('vor 3 Std');
  });
  it('Tage', () => {
    expect(relativeZeit('2026-06-29T12:00:00.000Z', base)).toBe('vor 2 Tagen');
  });
  it('ungültiger Zeitstempel → leer', () => {
    expect(relativeZeit('kaputt', base)).toBe('');
  });
});
