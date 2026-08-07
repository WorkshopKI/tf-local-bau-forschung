/**
 * Das Haltedatum **aus der Verlaufsableitung** — und die Zusage, auf der die
 * zweistufige Auflösung steht.
 *
 * Der Kern: `baueUebergaenge` nimmt den Bezugszeitpunkt gar nicht entgegen.
 * Deshalb darf ein erster Lauf mit dem nackten Stichtag die Kanten liefern, aus
 * denen das Haltedatum kommt, und ein zweiter mit diesem Haltedatum die
 * Segmente. Wäre die Kantenliste vom Bezugszeitpunkt abhängig, wäre das ein
 * Zirkelschluss — hier steht der Test, der es festhält.
 */
import { describe, expect, it } from 'vitest';
import {
  haltedatumAusSpuren, haltedatumAusUebergaengen,
} from '../verlauf/haltedatum-aus-verlauf';
import type { StatusRef, VerlaufsSpur, VerlaufsUebergang } from '../verlauf/typen';

function ref(code: number): StatusRef {
  return { roh: `Status ${code}`, code, kurz: String(code), lang: `Status ${code}`, labelHerkunft: 'ohne' };
}

function u(
  kuerzel: string, datum: string,
  setzt?: number, konfidenz: VerlaufsUebergang['konfidenz'] = 'trigger_bestaetigt',
): VerlaufsUebergang {
  return {
    kuerzel, datum, rollen: [], rollenLage: 'neutral',
    konfidenz: setzt === undefined ? 'kein_kuerzel' : konfidenz,
    bezeichnung: null, bezeichnungEindeutig: true,
    ...(setzt !== undefined ? { setztStatus: ref(setzt) } : {}),
  };
}

describe('Die letzte datierte Kante', () => {
  it('datiert den Eintritt in den heutigen Status', () => {
    const h = haltedatumAusUebergaengen(
      [u('AAE', '2018-01-05', 31), u('ABB', '2019-06-02', 73)], 73,
    );
    expect(h).toEqual({ tag: '2019-06-02', konfidenz: 'trigger_bestaetigt', kuerzel: 'ABB', code: 73 });
  });

  it('nimmt den ERSTEN Tag einer Folge desselben Zielstatus', () => {
    // Dreimal in denselben Status gesetzt heißt: seit dem ersten Mal darin.
    const h = haltedatumAusUebergaengen([
      u('AAE', '2018-01-05', 31),
      u('ABB', '2019-06-02', 73),
      u('ABLZ', '2019-08-01', 73),
      u('AAR', '2020-02-11', 73),
    ], 73);
    expect(h?.tag).toBe('2019-06-02');
    expect(h?.kuerzel).toBe('ABB');
  });

  it('reicht die Konfidenz der datierenden Kante durch', () => {
    const h = haltedatumAusUebergaengen(
      [u('ABB', '2019-06-02', 73, 'trigger_bedingt')], 73,
    );
    expect(h?.konfidenz).toBe('trigger_bedingt');
  });
});

describe('Was NICHT datiert wird', () => {
  it('schweigt, wenn die letzte Kante einen anderen Status setzt', () => {
    // Die Ableitung erklärt den importierten Status nicht — ein Datum von ihr
    // wäre eine Aussage über einen anderen Status (Pitfall #44).
    expect(haltedatumAusUebergaengen(
      [u('AAE', '2018-01-05', 31), u('ABB', '2019-06-02', 59)], 73,
    )).toBeNull();
  });

  it('schweigt ohne auflösbaren Statuscode', () => {
    expect(haltedatumAusUebergaengen([u('ABB', '2019-06-02', 73)], null)).toBeNull();
  });

  it('schweigt, wenn keine Kante einen Status setzt', () => {
    expect(haltedatumAusUebergaengen([u('YW', '2019-06-02')], 73)).toBeNull();
  });

  it('schweigt bei leerer Kantenliste', () => {
    expect(haltedatumAusUebergaengen([], 73)).toBeNull();
  });
});

describe('Die richtige Spur', () => {
  const spur = (art: 'tv' | 'verbund', id: string, code: number, tag: string): VerlaufsSpur => ({
    art, id, herkunft: 'abgeleitet', journalAb: null,
    projektform: { art: 'unbekannt' },
    zustand: 'verlauf', segmente: [], uebergaenge: [u('ABB', tag, code)],
  });

  it('nimmt die Spur der genannten Ebene, nicht die des Nachbarn', () => {
    const spuren = [
      spur('tv', 'AZ-1', 73, '2019-01-01'),
      spur('tv', 'AZ-2', 73, '2020-05-05'),
      spur('verbund', 'VB1', 73, '2021-09-09'),
    ];
    expect(haltedatumAusSpuren(spuren, 'tv', 'AZ-2', 73)?.tag).toBe('2020-05-05');
    expect(haltedatumAusSpuren(spuren, 'verbund', 'VB1', 73)?.tag).toBe('2021-09-09');
  });

  it('schweigt, wo es die Spur nicht gibt', () => {
    expect(haltedatumAusSpuren([spur('tv', 'AZ-1', 73, '2019-01-01')], 'verbund', 'VB1', 73))
      .toBeNull();
  });
});
