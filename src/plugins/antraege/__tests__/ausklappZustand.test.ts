/**
 * Die Zustandslogik des aufgeklappten Bereichs.
 *
 * Der interessante Fall ist der zweite Klick: dieselbe Zelle schließt, die
 * NACHBARZELLE derselben Zeile schaltet den Reiter um. Ohne diese Trennung
 * stapelten sich zwei Bereiche unter einer Zeile — oder die Frist ließe sich
 * bei offenem Verlauf gar nicht ansehen.
 */
import { describe, it, expect } from 'vitest';
import {
  naechsterZustand, istOffen, bereichsId,
  type AusklappZustand,
} from '../ausklapp/ausklappZustand';

const A = '16KN001';
const B = '16KN002';

describe('ausklappZustand — Akkordeon mit zwei Reitern', () => {
  it('öffnet aus dem Nichts mit dem geklickten Reiter', () => {
    expect(naechsterZustand(null, A, 'verlauf')).toEqual({ key: A, reiter: 'verlauf' });
    expect(naechsterZustand(null, A, 'fristen')).toEqual({ key: A, reiter: 'fristen' });
  });

  it('schließt beim zweiten Klick auf DIESELBE Zelle', () => {
    const offen: AusklappZustand = { key: A, reiter: 'verlauf' };
    expect(naechsterZustand(offen, A, 'verlauf')).toBeNull();
  });

  it('schaltet den Reiter um, statt zu stapeln', () => {
    const offen: AusklappZustand = { key: A, reiter: 'verlauf' };
    expect(naechsterZustand(offen, A, 'fristen')).toEqual({ key: A, reiter: 'fristen' });
    // und wieder zurück — nicht zu.
    expect(naechsterZustand({ key: A, reiter: 'fristen' }, A, 'verlauf'))
      .toEqual({ key: A, reiter: 'verlauf' });
  });

  it('lässt höchstens eine Zeile offen', () => {
    const offen: AusklappZustand = { key: A, reiter: 'fristen' };
    expect(naechsterZustand(offen, B, 'verlauf')).toEqual({ key: B, reiter: 'verlauf' });
  });

  it('`istOffen` fragt nach der Zeile, nicht nach dem Reiter', () => {
    const offen: AusklappZustand = { key: A, reiter: 'fristen' };
    expect(istOffen(offen, A)).toBe(true);
    expect(istOffen(offen, B)).toBe(false);
    expect(istOffen(null, A)).toBe(false);
  });

  it('baut eine `aria-controls`-taugliche Id auch aus krummen Aktenzeichen', () => {
    expect(bereichsId('16KN001')).toBe('zeilen-bereich-16KN001');
    // Aktenzeichen mit Schrägstrich/Leerzeichen sind im Bestand selten, aber
    // eine Id mit Leerzeichen zerreißt `aria-controls` lautlos.
    expect(bereichsId('16 KN/001')).toBe('zeilen-bereich-16_KN_001');
  });
});
