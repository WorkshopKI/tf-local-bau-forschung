/**
 * Die Vorbedingungen des Nachlaufs (v4.127).
 *
 * Sie sind ein Test wert, weil jede einzelne einen Schaden abwendet, den man
 * dem Ergebnis nicht ansieht: ein Lauf ohne Schreibrecht verbrennt 40 Minuten
 * fuer einen Korpus, den niemand bekommt; einer waehrend der Datenaktualisierung
 * bettet einen ueberholten Stand ein; und einer auf fremdem Vektorraum ist kein
 * „Nachziehen", sondern ein Vollbau.
 */
import { describe, it, expect } from 'vitest';
import { pruefeNachlauf, type NachlaufLage } from '../korpus-nachlauf';

/** Die Lage, in der er laufen SOLL — jeder Test kippt genau eine Bedingung. */
const gut: NachlaufLage = {
  an: true,
  online: true,
  darfSchreiben: true,
  datenUpdateLaeuft: false,
  lokalCount: 12359,
  raumAktuell: true,
  zuEmbedden: 214,
  lockFrei: true,
};

describe('pruefeNachlauf', () => {
  it('laeuft, wenn alles stimmt — und nennt die Zahl', () => {
    const u = pruefeNachlauf(gut);
    expect(u.laeuft).toBe(true);
    expect(u.sperre).toBeUndefined();
    expect(u.grund).toContain('214');
  });

  const faelle: [string, Partial<NachlaufLage>, string][] = [
    ['Schalter aus', { an: false }, 'aus'],
    ['Datenspeicher weg', { online: false }, 'offline'],
    ['kein Schreibrecht', { darfSchreiben: false }, 'kein-schreibrecht'],
    ['Datenaktualisierung laeuft', { datenUpdateLaeuft: true }, 'daten-laufen'],
    ['lokal kein Korpus', { lokalCount: 0 }, 'korpus-leer'],
    ['fremder Vektorraum', { raumAktuell: false }, 'fremder-raum'],
    ['nichts zu tun', { zuEmbedden: 0 }, 'nichts-zu-tun'],
    ['Lock belegt', { lockFrei: false }, 'lock-belegt'],
  ];

  it.each(faelle)('%s → gesperrt', (_name, kippe, sperre) => {
    const u = pruefeNachlauf({ ...gut, ...kippe });
    expect(u.laeuft).toBe(false);
    expect(u.sperre).toBe(sperre);
  });

  it('jede Sperre traegt einen Grund — „passiert nichts" ist keine Auskunft', () => {
    for (const [, kippe] of faelle) {
      expect(pruefeNachlauf({ ...gut, ...kippe }).grund.length).toBeGreaterThan(20);
    }
  });

  /**
   * Die Reihenfolge ist Teil der Aussage: wer den Schalter aus hat, soll nicht
   * lesen, dass sein Datenspeicher weg ist.
   */
  it('meldet die erste zutreffende Sperre, nicht irgendeine', () => {
    expect(pruefeNachlauf({ ...gut, an: false, online: false, zuEmbedden: 0 }).sperre).toBe('aus');
    expect(pruefeNachlauf({ ...gut, online: false, lockFrei: false }).sperre).toBe('offline');
  });

  /** Der teure Irrtum: „fehlt nichts" ist nicht „ist aktuell". */
  it('trennt fremden Raum von leerer Arbeitsliste', () => {
    expect(pruefeNachlauf({ ...gut, raumAktuell: false, zuEmbedden: 0 }).sperre).toBe('fremder-raum');
  });
});
