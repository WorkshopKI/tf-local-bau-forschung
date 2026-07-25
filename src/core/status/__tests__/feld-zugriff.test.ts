/**
 * `feldLabel` — aus der technischen feldId den kuratierten Feldnamen machen.
 * Eine Quelle für Cockpit, Timeline und „Warum?"; der Fallback muss die Zeile
 * zuordenbar halten, auch wenn jemand das Label leer räumt.
 */
import { describe, it, expect } from 'vitest';
import { feldLabel } from '../feld-zugriff';
import type { MappingVersion, StatusFeldEintrag } from '../typen';

function feld(feldId: string, label: string): StatusFeldEintrag {
  return { feldId, label, typ: 'wert', ebene: 'tv', prominenzDefault: 'normal', aktiv: true, unkuratiert: false };
}

function version(felder: StatusFeldEintrag[]): MappingVersion {
  return {
    version: 1, zeitstempel: '2026-07-25T00:00:00.000Z', autor: null,
    werte: [], felder, regeln: [],
  };
}

describe('feldLabel', () => {
  it('liefert den kuratierten Namen statt der feldId', () => {
    expect(feldLabel(version([feld('status', 'TV-Status')]), 'status')).toBe('TV-Status');
  });

  it('fällt auf die feldId zurück, wenn das Feld nicht im Katalog steht', () => {
    expect(feldLabel(version([]), 'D_QS')).toBe('D_QS');
  });

  it('fällt auf die feldId zurück, wenn das Label leer geräumt wurde', () => {
    expect(feldLabel(version([feld('status', '')]), 'status')).toBe('status');
    expect(feldLabel(version([feld('status', '   ')]), 'status')).toBe('status');
  });
});
