import { describe, it, expect } from 'vitest';
import { zeilenSchluessel, haekchenStand, gewaehlteAus } from '../auswahl';

describe('Was eine Zeile auswählt', () => {
  it('ein Einzel-Antrag sich selbst', () => {
    expect(zeilenSchluessel({ aktenzeichen: '16EP260001' })).toEqual(['16EP260001']);
  });

  it('eine Verbund-Zeile ALLE ihre Teilvorhaben', () => {
    // Sonst hinge an der Auswahl eine Bedeutung, die beim Umschalten der Ansicht
    // kippt — und ein Export enthielte je nach Zeilen-Körnung andere Zeilen.
    expect(zeilenSchluessel({
      aktenzeichen: '16EP260001',
      _verbund: { tvs: [{ aktenzeichen: '16EP260001' }, { aktenzeichen: '16EP260002' }] },
    })).toEqual(['16EP260001', '16EP260002']);
  });
});

describe('Stand eines Häkchens', () => {
  it('ist an, wenn alle Schlüssel gewählt sind', () => {
    expect(haekchenStand(['a', 'b'], new Set(['a', 'b']))).toEqual({ an: true, teilweise: false });
  });

  it('ist teilweise, wenn nur ein Teil gewählt ist — der Verbund-Fall', () => {
    expect(haekchenStand(['a', 'b'], new Set(['a']))).toEqual({ an: false, teilweise: true });
  });

  it('ist aus bei leerer Auswahl und bei leerer Zeilenmenge', () => {
    expect(haekchenStand(['a'], new Set())).toEqual({ an: false, teilweise: false });
    expect(haekchenStand([], new Set(['a']))).toEqual({ an: false, teilweise: false });
  });
});

describe('Was eine Massen-Aktion wirklich anfasst', () => {
  const liste = [
    { aktenzeichen: 'a' }, { aktenzeichen: 'b' }, { aktenzeichen: 'c' },
  ];

  it('schneidet gegen die aktuelle Liste — nichts Unsichtbares', () => {
    // Wer auswählt und danach den Filter dreht, darf nicht exportieren, was
    // gerade gar nicht dasteht.
    expect(gewaehlteAus(liste, new Set(['b', 'weg'])).map(a => a.aktenzeichen)).toEqual(['b']);
  });

  it('behält die Reihenfolge der LISTE, nicht die der Klicks', () => {
    expect(gewaehlteAus(liste, new Set(['c', 'a'])).map(a => a.aktenzeichen)).toEqual(['a', 'c']);
  });

  it('liefert leer, solange nichts gewählt ist', () => {
    expect(gewaehlteAus(liste, new Set())).toEqual([]);
  });
});
