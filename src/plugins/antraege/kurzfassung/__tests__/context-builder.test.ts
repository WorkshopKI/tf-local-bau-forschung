import { describe, it, expect } from 'vitest';
import { buildKurzfassungContext } from '../context-builder';

describe('buildKurzfassungContext', () => {
  it('Akronym: Verbund-Vorrang; Titel: Lead-TV-Thema (THEMA_AD) hat Vorrang; knownIds = headerId + alle TV-Az', () => {
    const ctx = buildKurzfassungContext(
      // verbund.titel (VB_TITEL) ist hier ein generischer Platzhalter — der aussagekräftige
      // Projekt-Titel steckt im Lead-TV-Thema (THEMA_AD → tv.titel). Das Akronym behält Verbund-Vorrang.
      { akronym: 'VERBUND-AKR', titel: 'Muster VB Titel 33' },
      [
        { aktenzeichen: '16EP001A', akronym: 'tvA', titel: 'XR-INTERACTION – ExoTrain', antragsteller: 'Firma A' },
        { aktenzeichen: '16EP001B', titel: 'TV B', antragsteller: 'Firma B' },
      ],
      'ZEP00001',
    );
    expect(ctx.key).toBe('ZEP00001');
    expect(ctx.foerderkennzeichen).toBe('ZEP00001');
    expect(ctx.akronym).toBe('VERBUND-AKR');
    expect(ctx.titel).toBe('XR-INTERACTION – ExoTrain'); // Lead-TV-Thema statt generischem VB_TITEL
    expect(ctx.antragsteller).toBe('Firma A'); // Lead = antraege[0]
    expect(ctx.knownIds).toEqual(['ZEP00001', '16EP001A', '16EP001B']);
    expect(ctx.teilvorhaben).toEqual([
      { nr: 1, aktenzeichen: '16EP001A', titel: 'XR-INTERACTION – ExoTrain', antragsteller: 'Firma A' },
      { nr: 2, aktenzeichen: '16EP001B', titel: 'TV B', antragsteller: 'Firma B' },
    ]);
  });

  it('Titel: verbund_titel dient als Fallback, wenn der Lead-TV keinen Titel trägt', () => {
    const ctx = buildKurzfassungContext(
      { titel: 'Echter Verbund-Titel' },
      [{ aktenzeichen: '16EP001A', titel: '   ', antragsteller: 'Firma A' }],
      'ZEP00001',
    );
    expect(ctx.titel).toBe('Echter Verbund-Titel');
  });

  it('Akronym-Fallback-Kette: Lead-Akronym, dann akronymFallback', () => {
    expect(buildKurzfassungContext(null, [{ aktenzeichen: 'X', akronym: 'leadAkr' }], 'X').akronym).toBe('leadAkr');
    expect(buildKurzfassungContext(null, [{ aktenzeichen: 'X' }], 'X').akronym).toBe('X');
    expect(buildKurzfassungContext({}, [{ aktenzeichen: 'X' }], 'X', 'PSEUDO').akronym).toBe('PSEUDO');
  });

  it('leere Strings werden zu null', () => {
    const ctx = buildKurzfassungContext({ akronym: '  ', titel: '' }, [{ aktenzeichen: 'X', titel: '   ' }], 'X');
    expect(ctx.titel).toBeNull();
    expect(ctx.teilvorhaben[0]!.titel).toBeNull();
  });
});
