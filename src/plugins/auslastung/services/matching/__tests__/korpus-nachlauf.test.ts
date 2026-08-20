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
import { pruefeNachlauf, SPERRE_VORUEBERGEHEND, type NachlaufLage } from '../korpus-nachlauf';

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

  /**
   * Der Aufrufer prueft einmal je Sitzung. Nach einer Sperre, die sich in
   * Sekunden von selbst aufloest, waere dieser eine Versuch verschenkt — genau
   * so verlor der Nachlauf beim Start gegen die Datenaktualisierung (v4.128).
   * Jede Sperre muss eingeordnet sein; eine neue zwingt zur Entscheidung.
   */
  describe('SPERRE_VORUEBERGEHEND', () => {
    it('ordnet JEDE Sperre ein — keine bleibt unbeantwortet', () => {
      for (const [, kippe] of faelle) {
        const sperre = pruefeNachlauf({ ...gut, ...kippe }).sperre!;
        expect(typeof SPERRE_VORUEBERGEHEND.has(sperre)).toBe('boolean');
      }
      expect(faelle).toHaveLength(8); // Reisleine: neue Sperre → Zeile hier ergaenzen
    });

    it('zaehlt genau die Start-Kollisionen dazu', () => {
      expect(SPERRE_VORUEBERGEHEND.has('daten-laufen')).toBe(true);
      expect(SPERRE_VORUEBERGEHEND.has('lock-belegt')).toBe(true);
    });

    it('laesst dauerhafte Zustaende dauerhaft — sonst laedt der Start ein Modell fuer nichts', () => {
      for (const s of ['aus', 'offline', 'kein-schreibrecht', 'korpus-leer', 'fremder-raum', 'nichts-zu-tun'] as const) {
        expect(SPERRE_VORUEBERGEHEND.has(s)).toBe(false);
      }
    });
  });
});
