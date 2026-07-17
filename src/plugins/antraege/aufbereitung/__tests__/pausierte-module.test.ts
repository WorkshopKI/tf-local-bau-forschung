/**
 * Guard für die Pause-Konstanten. `pausierte-module.ts` ist bewusst import-frei — die
 * Kopplung der Kategorie-IDs an den echten Katalog wird darum HIER geprüft: ein Tippfehler
 * in `ZAHL_KATEGORIEN_PRUEFRELEVANT` würde sonst still JEDE Gruppe sperren.
 *
 * Die Tests pinnen den AKTUELLEN Pausen-Stand. Wird eine Pause zurückgenommen, sind sie
 * mitzuziehen (so gewollt: die Rücknahme soll sichtbar durch die Suite laufen).
 */
import { describe, it, expect } from 'vitest';
import {
  ZAHL_KATEGORIEN_PRUEFRELEVANT,
  ZEITPLAN_PAUSIERT,
  istZahlKategorieGesperrt,
} from '../pausierte-module';
import { ZAHL_KATEGORIE_IDS } from '../zahlen';

describe('pausierte-module', () => {
  it('kennt nur Kategorie-IDs, die es im Katalog wirklich gibt', () => {
    for (const id of ZAHL_KATEGORIEN_PRUEFRELEVANT) {
      expect(ZAHL_KATEGORIE_IDS.has(id)).toBe(true);
    }
  });

  it('lässt genau „Leistung & Technik" + „Markt & Absatz" prüfrelevant', () => {
    expect([...ZAHL_KATEGORIEN_PRUEFRELEVANT].sort()).toEqual(['leistung', 'markt']);
  });

  it('sperrt die übrigen Katalog-Kategorien', () => {
    for (const id of ['zeit', 'personal', 'kosten', 'sonstig']) {
      expect(istZahlKategorieGesperrt(id)).toBe(true);
    }
    expect(istZahlKategorieGesperrt('leistung')).toBe(false);
    expect(istZahlKategorieGesperrt('markt')).toBe(false);
  });

  it('hat den Zeitplan pausiert (Stand heute)', () => {
    expect(ZEITPLAN_PAUSIERT).toBe(true);
  });
});
