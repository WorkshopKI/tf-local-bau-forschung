/**
 * `buildVerbundFromTeilantraege` synthetisiert einen echten Verbund-Header aus
 * seinen Teilanträgen, wenn der abgeleitete `verbuende`-Cache-Record fehlt.
 * Damit endet `VerbundDetail` nie auf „Verbund … nicht gefunden", solange die
 * TVs vorhanden sind.
 */
import { describe, it, expect } from 'vitest';
import { buildVerbundFromTeilantraege } from '../pseudoVerbund';
import type { Antrag } from '@/core/services/csv/types';
import { asAntragStatusRaw } from '@/core/services/csv/types';

function tv(az: string, extra: Partial<Antrag> = {}): Antrag {
  return {
    aktenzeichen: az,
    programm_id: 'P1',
    _field_sources: {},
    _updated_at: '2026-06-03T00:00:00.000Z',
    ...extra,
  } as Antrag;
}

describe('buildVerbundFromTeilantraege', () => {
  it('baut den Header aus den TVs (Key, programm_id, teilantrags_ids, Lead-Akronym/Titel)', () => {
    const vb = buildVerbundFromTeilantraege('ZKN110630', [
      tv('16KN110645', { akronym: 'LADScessible', titel: 'TV A' }),
      tv('16KN110646', { akronym: 'LADScessible', titel: 'TV B' }),
    ]);
    expect(vb.verbund_id).toBe('ZKN110630');
    expect(vb.programm_id).toBe('P1');
    expect(vb.akronym).toBe('LADScessible');
    expect(vb.titel).toBe('TV A'); // Lead-TV-Titel, da kein verbund_titel
    expect(vb.teilantrags_ids).toEqual(['16KN110645', '16KN110646']);
  });

  it('bevorzugt einen vorhandenen verbund_titel vor dem TV-Titel', () => {
    const vb = buildVerbundFromTeilantraege('V1', [
      tv('16KN1', { titel: 'TV-Titel', verbund_titel: 'Verbund-Titel' }),
    ]);
    expect(vb.titel).toBe('Verbund-Titel');
  });

  it('lässt status offen (die Detailseite leitet ihn via dominantStatus ab)', () => {
    const vb = buildVerbundFromTeilantraege('V1', [tv('16KN1', { status: asAntragStatusRaw('bewilligt') })]);
    expect(vb.status).toBeUndefined();
  });
});
