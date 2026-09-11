/**
 * Die Übersicht einer Bedingung für die zugeklappte Meilenstein-Zeile: die
 * oberste Ebene in Teilen, Gruppen nur mit Namen oder Nummer. Und die Satzteile
 * sind wortgleich mit dem Satz — sonst hieße dieselbe Regel an zwei Stellen
 * verschieden.
 */
import { describe, expect, it } from 'vitest';
import { bedingungAlsText, bedingungUebersicht, satzText } from '../bedingung-text';
import type { Bedingung } from '../typen';

const NAMEN: Record<string, string> = { tib_kuerz: 'TIB', bib_kuerz: 'BIB', status: 'Status TV' };
const labelVon = (id: string): string => NAMEN[id] ?? id;
const x: Bedingung = { feldId: 'x', op: 'gefuellt' };

describe('bedingungUebersicht', () => {
  it('Einzelbedingungen stehen mit ihrem Satz da, Feld und Wert als eigene Teile', () => {
    const b: Bedingung = { einige: [
      { feldId: 'status', op: 'ist', wert: 'NL eingegangen' },
      { feldId: 'tib_kuerz', op: 'gefuellt' },
    ] };
    const u = bedingungUebersicht(b, labelVon);
    expect(satzText(u.teile)).toBe('Status TV ist „NL eingegangen" ODER TIB gefüllt');
    expect(u.teile.filter(t => t.art === 'feld').map(t => t.text)).toEqual(['Status TV', 'TIB']);
    expect(u.teile.find(t => t.art === 'wert')?.text).toBe('„NL eingegangen"');
    expect(u.teile.find(t => t.art === 'verknuepfung')?.text).toBe('ODER');
    expect(u.gruppen).toBe(0);
    expect(u.bedingungen).toBe(2);
  });

  it('Gruppen erscheinen mit Nummer oder Namen, gezählt wird bis in die Tiefe', () => {
    const b: Bedingung = { alle: [{ einige: [x, x] }, { einige: [x, { alle: [x, x] }], name: 'PreCheck FB' }] };
    const u = bedingungUebersicht(b, labelVon);
    expect(satzText(u.teile)).toBe('Gruppe 1 UND PreCheck FB');
    expect(u.teile.filter(t => t.art === 'gruppe').map(t => t.text)).toEqual(['Gruppe 1', 'PreCheck FB']);
    expect(u.gruppen).toBe(2);
    expect(u.bedingungen).toBe(5);
  });

  it('ein Blatt als Wurzel, leer', () => {
    expect(satzText(bedingungUebersicht(x, labelVon).teile)).toBe('x gefüllt');
    const leer = bedingungUebersicht({ einige: [] }, labelVon);
    expect(leer.teile).toEqual([]);
    expect(leer.bedingungen).toBe(0);
  });
});

describe('Satzteile ändern den Satz nicht', () => {
  // Jeder Operator einmal: die Teile, zusammengefügt, sind der bisherige Satz.
  const faelle: [Bedingung, string][] = [
    [{ feldId: 'x', op: 'leer' }, 'x leer'],
    [{ feldId: 'x', op: 'istNicht', wert: 'a' }, 'x ist nicht „a"'],
    [{ feldId: 'x', op: 'datumVor', tageRelativHeute: 0 }, 'x liegt in der Vergangenheit'],
    [{ feldId: 'x', op: 'datumVor', tageRelativHeute: -3 }, 'x vor heute -3 T'],
    [{ feldId: 'x', op: 'datumNach', tageRelativHeute: 5 }, 'x nach heute +5 T'],
    [{ feldId: 'x', op: 'tageSeit', tage: 14 }, 'seit x mehr als 14 Tage'],
    [{ feldId: 'x', op: 'datumNachFeld', vergleichFeldId: 'tib_kuerz' }, 'x nach TIB'],
  ];
  it.each(faelle)('%j', (b, erwartet) => {
    expect(bedingungAlsText(b, labelVon)).toBe(erwartet);
    expect(satzText(bedingungUebersicht(b, labelVon).teile)).toBe(erwartet);
  });
});
