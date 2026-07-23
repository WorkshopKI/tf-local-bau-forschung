import { describe, it, expect } from 'vitest';
import type { ArbeitskontextEintrag } from '@/core/services/personal-storage/arbeitskontext-log';
import { beschreibeArbeitskontext } from '../arbeitskontext-anzeige';

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

// Die Faelle fuer die relative Zeitangabe leben seit dem Konsolidierungs-Pass in
// src/core/utils/__tests__/relativeZeit.test.ts -- dort stehen alle drei Register
// nebeneinander (`relativeZeitKurz` ist das hier frueher gepruefte).
