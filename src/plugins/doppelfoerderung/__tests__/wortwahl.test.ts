/**
 * Die Wahl, die der Bestand trifft.
 *
 * Der Betrachtungsbereich ist in allen Fällen 4.000 Anträge gross — damit liegt
 * die Ein-Prozent-Marke bei 40 und die Zwei-Prozent-Schwelle bei 80. Die Zahlen
 * der Fälle sind so gewählt, dass jeder Rang einmal vorkommt: 12 trägt, 50 ist
 * markiert, 0 ist tot, 900 flutet.
 */
import { describe, it, expect } from 'vitest';
import type { AchsenWahl, SchlagwortTreffer } from '@/plugins/doppelfoerderung/types';
import {
  beschraenkeAuf, RANG, rangVon, waehleSchlagworte, warumGewaehlt,
} from '@/plugins/doppelfoerderung/services/wortwahl';

const BEREICH = 4_000;

function treffer(paare: Record<string, number>): SchlagwortTreffer[] {
  return Object.entries(paare).map(([wort, n]) => ({ wort, treffer: n }));
}

describe('rangVon', () => {
  it('ordnet die vier Zustände eines Schlagworts', () => {
    expect(rangVon(12, BEREICH)).toBe(RANG.traegt);
    expect(rangVon(50, BEREICH)).toBe(RANG.markiert);
    expect(rangVon(0, BEREICH)).toBe(RANG.tot);
    expect(rangVon(900, BEREICH)).toBe(RANG.flutet);
  });

  /**
   * Die einzige Stelle mit Ermessen — und sie ist Absicht: für die Abdeckung
   * sind beide wertlos, aber das flutende Wort zieht hunderte Befunde in die
   * Trefferliste und macht aus „nicht beurteilbar" ein „keine Übereinstimmung".
   */
  it('stellt das tote Wort VOR das flutende', () => {
    expect(rangVon(0, BEREICH)).toBeLessThan(rangVon(900, BEREICH));
  });

  it('bewertet ohne Bezugsgrösse nur noch tot gegen lebendig', () => {
    expect(rangVon(0, null)).toBe(RANG.tot);
    expect(rangVon(900, null)).toBe(RANG.traegt);
  });
});

describe('waehleSchlagworte', () => {
  it('nimmt den engsten Vorschlag, der überhaupt etwas trifft', () => {
    const wahl = waehleSchlagworte(
      [['Hochtemperaturverzinken', 'Feuerverzinken', 'Verzinkung']],
      treffer({ Hochtemperaturverzinken: 0, Feuerverzinken: 12, Verzinkung: 50 }),
      BEREICH,
    );
    expect(wahl.gewaehlt).toEqual(['Feuerverzinken']);
    expect(wahl.achsen[0]?.nachgeschlagen).toBe(true);
  });

  it('lässt den ersten Vorschlag stehen, wenn er schon trägt', () => {
    const wahl = waehleSchlagworte(
      [['Feuerverzinken', 'Verzinkung']],
      treffer({ Feuerverzinken: 12, Verzinkung: 50 }),
      BEREICH,
    );
    expect(wahl.gewaehlt).toEqual(['Feuerverzinken']);
    expect(wahl.achsen[0]?.nachgeschlagen).toBe(false);
  });

  /**
   * Der Kern der Stufe: sie kann eine Zeile nicht verschlechtern. Findet sich
   * nichts Besseres, bleibt genau das Wort stehen, das ohne sie gegolten hätte.
   */
  it('behält den ersten Vorschlag, wenn ALLE Vorschläge tot sind', () => {
    const wahl = waehleSchlagworte(
      [['Getterintegration', 'Getterschicht']],
      treffer({ Getterintegration: 0, Getterschicht: 0 }),
      BEREICH,
    );
    expect(wahl.gewaehlt).toEqual(['Getterintegration']);
    expect(wahl.achsen[0]?.nachgeschlagen).toBe(false);
  });

  it('zieht ein markiertes Wort einem toten vor — es zählt wenigstens', () => {
    const wahl = waehleSchlagworte(
      [['Kryobehälter', 'Kryotechnik']],
      treffer({ Kryobehälter: 0, Kryotechnik: 50 }),
      BEREICH,
    );
    expect(wahl.gewaehlt).toEqual(['Kryotechnik']);
  });

  it('nimmt das flutende Wort NICHT, wenn ein totes danebensteht', () => {
    const wahl = waehleSchlagworte(
      [['Metallpulver', 'Metall']],
      treffer({ Metallpulver: 0, Metall: 900 }),
      BEREICH,
    );
    expect(wahl.gewaehlt).toEqual(['Metallpulver']);
  });

  it('entscheidet je Achse getrennt und behält die Achsenreihenfolge', () => {
    const wahl = waehleSchlagworte(
      [['Spritzmetallisierung', 'Metallspritzen'], ['Stiftschraube'], ['Abriebschutz', 'Verschleiss']],
      treffer({
        Spritzmetallisierung: 0, Metallspritzen: 7,
        Stiftschraube: 3,
        Abriebschutz: 0, Verschleiss: 900,
      }),
      BEREICH,
    );
    expect(wahl.gewaehlt).toEqual(['Metallspritzen', 'Stiftschraube', 'Abriebschutz']);
  });

  /**
   * Zwei gleiche Schlagworte wären EIN Beleg, würden aber als zwei gezählt —
   * genau der Fehler, den die Abdeckung nicht selbst bemerkt.
   */
  it('vergibt dasselbe Wort nicht zweimal, sondern rückt in der zweiten Achse nach', () => {
    const wahl = waehleSchlagworte(
      [['Beschichtung'], ['Beschichtung', 'Kupferband']],
      treffer({ Beschichtung: 12, Kupferband: 4 }),
      BEREICH,
    );
    expect(wahl.gewaehlt).toEqual(['Beschichtung', 'Kupferband']);
  });

  it('markiert den Nachrücker NICHT als nachgeschlagen — das war die andere Achse', () => {
    const wahl = waehleSchlagworte(
      [['Beschichtung'], ['Beschichtung', 'Kupferband']],
      treffer({ Beschichtung: 12, Kupferband: 4 }),
      BEREICH,
    );
    expect(wahl.achsen[1]?.nachgeschlagen).toBe(false);
  });

  it('lässt eine Achse fallen, deren Vorschläge alle vergeben sind', () => {
    const wahl = waehleSchlagworte(
      [['Beschichtung'], ['Beschichtung']],
      treffer({ Beschichtung: 12 }),
      BEREICH,
    );
    expect(wahl.gewaehlt).toEqual(['Beschichtung']);
    expect(wahl.achsen).toHaveLength(1);
  });

  it('führt die verworfenen Vorschläge mit ihrer Trefferzahl mit', () => {
    const wahl = waehleSchlagworte(
      [['Hochtemperaturverzinken', 'Feuerverzinken', 'Verzinkung']],
      treffer({ Hochtemperaturverzinken: 0, Feuerverzinken: 12, Verzinkung: 50 }),
      BEREICH,
    );
    expect(wahl.achsen[0]?.alternativen).toEqual([
      { wort: 'Hochtemperaturverzinken', treffer: 0 },
      { wort: 'Verzinkung', treffer: 50 },
    ]);
  });

  it('verhält sich bei einem Vorschlag je Achse wie der Stand vor v6.31', () => {
    const achsen = [['Workshop'], ['Prozessdaten'], ['Wissensmanagement']];
    const wahl = waehleSchlagworte(
      achsen, treffer({ Workshop: 1, Prozessdaten: 22, Wissensmanagement: 6 }), BEREICH,
    );
    expect(wahl.gewaehlt).toEqual(['Workshop', 'Prozessdaten', 'Wissensmanagement']);
    expect(wahl.achsen.every(a => !a.nachgeschlagen)).toBe(true);
  });
});

describe('warumGewaehlt', () => {
  it('schweigt, wenn der erste Vorschlag gewonnen hat', () => {
    const wahl = waehleSchlagworte(
      [['Feuerverzinken', 'Verzinkung']], treffer({ Feuerverzinken: 12, Verzinkung: 50 }), BEREICH,
    );
    expect(warumGewaehlt(wahl.achsen[0] as AchsenWahl)).toBeNull();
  });

  it('nennt den toten Erstvorschlag beim Namen', () => {
    const wahl = waehleSchlagworte(
      [['Getterintegration', 'Getterschicht']],
      treffer({ Getterintegration: 0, Getterschicht: 12 }), BEREICH,
    );
    expect(warumGewaehlt(wahl.achsen[0] as AchsenWahl))
      .toBe('Der erste Vorschlag „Getterintegration" kommt im Betrachtungsbereich nicht vor — gewählt wurde deshalb „Getterschicht".');
  });

  /**
   * Der Fall, an dem der Satz einmal falsch war: „Effizienzsteigerung" trug 46
   * Vorhaben und verlor trotzdem — die Meldung sagte „trug im Bestand nichts
   * aus". Sie muss die Zahl nennen, die sie meint.
   */
  it('sagt bei einem zu weiten Erstvorschlag NICHT, er habe nichts getroffen', () => {
    const wahl = waehleSchlagworte(
      [['Effizienzsteigerung', 'Sicherheitsmanagement']],
      treffer({ Effizienzsteigerung: 46, Sicherheitsmanagement: 2 }), BEREICH,
    );
    const satz = warumGewaehlt(wahl.achsen[0] as AchsenWahl) ?? '';
    expect(satz).toContain('trifft 46 Vorhaben');
    expect(satz).toContain('zu weit');
    expect(satz).not.toContain('nicht vor');
  });

  /**
   * Warum der Satz überhaupt behaupten darf, ein verlierender Erstvorschlag mit
   * Treffern sei „zu weit": bei Gleichstand gewinnt der frühere, also kann der
   * Verlierer nur schlechter im Rang gestanden haben — und schlechter als
   * `traegt` heisst bei Treffern über null zwangsläufig markiert oder flutend.
   */
  it('kann nur zwei Fälle haben — tot oder zu weit', () => {
    for (const n of [1, 39, 40, 79, 80, 500]) {
      const wahl = waehleSchlagworte(
        [['Erster', 'Zweiter']], treffer({ Erster: n, Zweiter: 12 }), BEREICH,
      );
      const achse = wahl.achsen[0] as AchsenWahl;
      if (!achse.nachgeschlagen) continue;
      expect(rangVon(n, BEREICH)).toBeGreaterThan(RANG.traegt);
      expect(warumGewaehlt(achse)).toContain('zu weit');
    }
  });
});

describe('beschraenkeAuf', () => {
  const wortlaut = {
    proAktenzeichen: new Map([
      ['A1', ['Metallspritzen', 'Metall']],
      ['A2', ['Metall']],
      ['A3', ['Metallspritzen']],
    ]),
    treffer: treffer({ Metallspritzen: 2, Metall: 900 }),
  };

  it('wirft die verworfenen Vorschläge aus den Belegen', () => {
    const eng = beschraenkeAuf(wortlaut, ['Metallspritzen']);
    expect(eng.proAktenzeichen.get('A1')).toEqual(['Metallspritzen']);
    expect(eng.proAktenzeichen.has('A3')).toBe(true);
  });

  /**
   * Ohne diesen Schnitt bliebe ein Antrag in der Trefferliste, den NUR ein
   * verworfenes Wort gefunden hat — ein Beleg für ein Schlagwort, das gar nicht
   * mehr in der Zeile steht.
   */
  it('lässt einen Antrag fallen, den nur ein verworfenes Wort trug', () => {
    const eng = beschraenkeAuf(wortlaut, ['Metallspritzen']);
    expect(eng.proAktenzeichen.has('A2')).toBe(false);
  });

  it('gibt die Trefferzahlen in der Reihenfolge der Wahl zurück', () => {
    const eng = beschraenkeAuf(wortlaut, ['Metall', 'Metallspritzen']);
    expect(eng.treffer).toEqual([
      { wort: 'Metall', treffer: 900 },
      { wort: 'Metallspritzen', treffer: 2 },
    ]);
  });

  it('trägt ein Wort ohne Suchergebnis mit null Treffern nach', () => {
    const eng = beschraenkeAuf(wortlaut, ['Handeingabe']);
    expect(eng.treffer).toEqual([{ wort: 'Handeingabe', treffer: 0 }]);
  });
});
