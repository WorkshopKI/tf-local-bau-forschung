/**
 * Der pure Kern des Darstellungs-Menüs — ohne DOM, ohne React.
 *
 * Die drei Funktionen tragen die Aussagen, die man dem gerenderten Menü nicht
 * ansieht: welcher Wert den Knopf beschriftet, in welche Richtung ein Schalter
 * steht, und was „Zurücksetzen" tatsächlich schreibt.
 */
import { describe, it, expect } from 'vitest';
import {
  darstellungsZusammenfassung,
  schalterAn,
  schalterAusKey,
  zuruecksetzenAufrufe,
  type DarstellungAchse,
} from '../darstellungsAchsen';

type Id = 'ansicht' | 'gruppierung' | 'beendet';

const ansicht: DarstellungAchse<Id> = {
  id: 'ansicht',
  art: 'segment',
  label: 'Zeile zeigt',
  options: [{ key: 'antrag', label: 'Antrag' }, { key: 'mit-tv', label: 'Antrag mit TV' }],
  value: 'antrag',
  standard: 'antrag',
};

const gruppierung: DarstellungAchse<Id> = {
  id: 'gruppierung',
  art: 'segment',
  label: 'Gruppieren nach',
  options: [{ key: 'none', label: 'Keine' }, { key: 'status', label: 'Status' }],
  value: 'none',
  standard: 'none',
};

const beendet: DarstellungAchse<Id> = {
  id: 'beendet',
  art: 'schalter',
  anKey: 'ein',
  label: 'Beendete zeigen',
  options: [{ key: 'aus', label: 'ausgeblendet' }, { key: 'ein', label: 'eingeblendet' }],
  value: 'aus',
  standard: 'aus',
};

const STANDARD: DarstellungAchse<Id>[] = [ansicht, gruppierung, beendet];

describe('darstellungsZusammenfassung', () => {
  it('ist leer, solange alles auf Standard steht — der Knopf bleibt schmal', () => {
    expect(darstellungsZusammenfassung(STANDARD)).toEqual({ text: '', weitere: 0 });
  });

  it('nennt bei einer Abweichung deren Anzeige-Label, ohne Zähler', () => {
    const achsen = [{ ...ansicht, value: 'mit-tv' }, gruppierung, beendet];
    expect(darstellungsZusammenfassung(achsen)).toEqual({ text: 'Antrag mit TV', weitere: 0 });
  });

  it('schreibt nur die ERSTE Abweichung aus und zählt den Rest', () => {
    const achsen = [
      { ...ansicht, value: 'mit-tv' },
      { ...gruppierung, value: 'status' },
      { ...beendet, value: 'ein' },
    ];
    expect(darstellungsZusammenfassung(achsen)).toEqual({ text: 'Antrag mit TV', weitere: 2 });
  });

  it('folgt der Achsen-Reihenfolge, nicht der Options-Reihenfolge', () => {
    const achsen = [ansicht, { ...gruppierung, value: 'status' }, { ...beendet, value: 'ein' }];
    expect(darstellungsZusammenfassung(achsen)).toEqual({ text: 'Status', weitere: 1 });
  });

  it('nimmt beim Schalter das Achsen-Label — sein Wert allein sagt nichts', () => {
    // „Darstellung: eingeblendet" wäre bedeutungslos.
    expect(darstellungsZusammenfassung([{ ...beendet, value: 'ein' }]))
      .toEqual({ text: 'Beendete zeigen', weitere: 0 });
  });

  it('lässt eine unbekannte (z.B. veraltete) Wahl auf ihren Schlüssel zurückfallen', () => {
    expect(darstellungsZusammenfassung([{ ...gruppierung, value: 'verbund' }]))
      .toEqual({ text: 'verbund', weitere: 0 });
  });
});

describe('Schalter-Richtung', () => {
  it('steht auf an, wenn der Wert der anKey ist — nicht wenn er der erste ist', () => {
    // `aus` ist der erste Schlüssel und heißt „ausgeblendet": aus der
    // Reihenfolge geraten stünde der Schalter genau falsch herum.
    expect(schalterAn(beendet)).toBe(false);
    expect(schalterAn({ ...beendet, value: 'ein' })).toBe(true);
  });

  it('liefert als Gegen-Schlüssel den anderen Options-Wert', () => {
    expect(schalterAusKey(beendet)).toBe('aus');
    expect(schalterAusKey({ ...beendet, value: 'ein' })).toBe('aus');
  });

  it('meldet für Segment-Achsen niemals „an"', () => {
    expect(schalterAn(gruppierung)).toBe(false);
    expect(schalterAn({ ...gruppierung, value: 'status' })).toBe(false);
  });
});

describe('zuruecksetzenAufrufe', () => {
  it('ist leer, wenn nichts abweicht — „Zurücksetzen" schreibt dann nichts', () => {
    expect(zuruecksetzenAufrufe(STANDARD)).toEqual([]);
  });

  it('nennt genau die abweichenden Achsen mit ihrem Standardwert', () => {
    const achsen = [
      { ...ansicht, value: 'mit-tv' },
      gruppierung,
      { ...beendet, value: 'ein' },
    ];
    expect(zuruecksetzenAufrufe(achsen)).toEqual([
      { id: 'ansicht', key: 'antrag' },
      { id: 'beendet', key: 'aus' },
    ]);
  });
});
