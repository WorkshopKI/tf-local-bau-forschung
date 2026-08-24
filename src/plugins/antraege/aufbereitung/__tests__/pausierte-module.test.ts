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
  ABDECKUNG_PAUSIERT,
  FRAGEN_PAUSIERT,
  ZAHL_KATEGORIEN_PRUEFRELEVANT,
  istZahlKategorieGesperrt,
} from '../pausierte-module';
import * as pausierteModule from '../pausierte-module';
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

  it('hat Fragen und Abdeckung pausiert (Stand heute)', () => {
    expect(FRAGEN_PAUSIERT).toBe(true);
    expect(ABDECKUNG_PAUSIERT).toBe(true);
  });

  /**
   * Die Zeitplan-Pause ist mit v6.29 aufgehoben (die Arbeitspaket-Ernte trägt, seit der
   * Konverter den PDF-Tag-Baum liest). Der Guard hält fest, dass sie GANZ verschwunden
   * ist statt nur auf `false` zu stehen: eine stillgelegte Mechanik, die niemand mehr
   * bemerkt, ist der Weg zurück in genau diesen Zustand.
   */
  it('führt die Zeitplan-Pause nicht mehr — restlos entfernt, nicht nur ausgeschaltet', () => {
    const namen = Object.keys(pausierteModule);
    expect(namen.filter(n => n.toLowerCase().includes('zeitplan'))).toEqual([]);
  });
});
