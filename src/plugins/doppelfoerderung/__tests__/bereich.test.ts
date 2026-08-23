/**
 * Der Betrachtungsbereich — die drei Achsen einzeln und zusammen.
 *
 * Die Zahlen in den Namen stammen aus der Messung am echten Bestand
 * (14.225 Anträge, 23.08.2026): alle drei Achsen zusammen lassen 4.327 stehen —
 * in der laufenden App gegen den echten Bestand nachgemessen.
 * Hier steht nicht die Zahl auf dem Prüfstand, sondern die Regel, die zu ihr
 * führt — vor allem die beiden Stellen, an denen eine LÜCKE nicht als Ausschluss
 * zählt.
 */
import { describe, it, expect } from 'vitest';
import { asAntragStatusRaw, type AntragListItem } from '@/core/services/csv/types';
import { getStatusCategory } from '@/core/utils/status-canonical';
import {
  BEREICH_VORGABE, bereichsAktenzeichen, imBereich, imZeitfenster,
  istFueNetzwerkStudie, istNichtAbgelehnt, jahrAus,
} from '@/plugins/doppelfoerderung/services/bereich';

const HEUTE = 2026;

function item(p: Partial<AntragListItem> = {}): AntragListItem {
  return {
    aktenzeichen: '16KN000001',
    programm_id: 'default-programm',
    antragsdatum: '2024-03-17',
    vb_phase: 3,
    status: asAntragStatusRaw('bewilligt'),
    ...p,
  } as AntragListItem;
}

describe('jahrAus', () => {
  it('liest ISO und deutsche Schreibweise', () => {
    expect(jahrAus('2024-03-17')).toBe(2024);
    expect(jahrAus('17.03.2024')).toBe(2024);
  });

  it('gibt null zurück, wo kein Jahr steht', () => {
    expect(jahrAus('')).toBeNull();
    expect(jahrAus(undefined)).toBeNull();
    expect(jahrAus('offen')).toBeNull();
  });
});

describe('imZeitfenster — fünf Jahre ab heute', () => {
  it('nimmt das Grenzjahr mit', () => {
    expect(imZeitfenster(item({ antragsdatum: '2021-01-02' }), 5, HEUTE)).toBe(true);
  });

  it('lässt ältere Anträge draussen', () => {
    expect(imZeitfenster(item({ antragsdatum: '2020-12-30' }), 5, HEUTE)).toBe(false);
  });

  it('behält einen Antrag OHNE Datum — eine Lücke ist kein Beleg für „alt"', () => {
    expect(imZeitfenster(item({ antragsdatum: '' }), 5, HEUTE)).toBe(true);
  });

  it('kennt die abgeschaltete Achse', () => {
    expect(imZeitfenster(item({ antragsdatum: '2012-01-01' }), null, HEUTE)).toBe(true);
  });
});

describe('istFueNetzwerkStudie — VB_PHASE 1/2/3/5', () => {
  it('nimmt Netzwerke (1, 2), FuE (3) und Studien (5)', () => {
    for (const phase of [1, 2, 3, 5]) {
      expect(istFueNetzwerkStudie(item({ vb_phase: phase }))).toBe(true);
    }
  });

  it('lässt Dienstleistung (4) und Irrläufer (9) draussen', () => {
    expect(istFueNetzwerkStudie(item({ vb_phase: 4 }))).toBe(false);
    expect(istFueNetzwerkStudie(item({ vb_phase: 9 }))).toBe(false);
  });

  it('behält einen Antrag ohne Phase', () => {
    expect(istFueNetzwerkStudie(item({ vb_phase: undefined }))).toBe(true);
  });
});

describe('istNichtAbgelehnt — über den Helper, nicht über die Kategorie', () => {
  it('wirft den amtlichen Endzustand `abgelehnt/zurückgezogen` heraus', () => {
    expect(istNichtAbgelehnt(item({ status: asAntragStatusRaw('abgelehnt/zurückgezogen') }))).toBe(false);
  });

  it('fällt NICHT auf die unbesetzte Kategorie `abgelehnt` herein', () => {
    // Der Grund, warum dieser Test existiert: `abgelehnt/zurückgezogen` liegt in
    // der Kategorie `abgeschlossen`, nicht in `abgelehnt` — die ist vom
    // Förder-Katalog seit v4.87 unbesetzt. Eine Prüfung
    // `getStatusCategory(...) === 'abgelehnt'` liefe still ins Leere und liesse
    // am echten Bestand alle 4.094 abgelehnten Vorhaben im Bereich stehen.
    expect(getStatusCategory('abgelehnt/zurückgezogen')).toBe('abgeschlossen');
    expect(istNichtAbgelehnt(item({ status: asAntragStatusRaw('abgelehnt/zurückgezogen') }))).toBe(false);
  });

  it('behält, was noch nicht entschieden ist — auch „Ablehnung" und „ablehnungsreif"', () => {
    // Beides sind Zwischenstände der Entscheidungsvorbereitung (Kategorie
    // `entscheidung` bzw. `in_pruefung`), keine Endzustände: 110 + 53 Vorhaben
    // am echten Bestand, die als beantragt in den Bereich gehören.
    expect(istNichtAbgelehnt(item({ status: asAntragStatusRaw('Ablehnung') }))).toBe(true);
    expect(istNichtAbgelehnt(item({ status: asAntragStatusRaw('ablehnungsreif') }))).toBe(true);
  });

  it('behält beantragte, bewilligte und abgeschlossene Vorhaben', () => {
    for (const status of ['beantragt', 'bewilligt', 'Schlussvermerk', 'beendet', 'bearbeitungsreif']) {
      expect(istNichtAbgelehnt(item({ status: asAntragStatusRaw(status) }))).toBe(true);
    }
  });
});

describe('imBereich + bereichsAktenzeichen', () => {
  it('braucht alle drei Achsen gleichzeitig', () => {
    expect(imBereich(item(), BEREICH_VORGABE, HEUTE)).toBe(true);
    expect(imBereich(item({ antragsdatum: '2015-01-01' }), BEREICH_VORGABE, HEUTE)).toBe(false);
    expect(imBereich(item({ vb_phase: 4 }), BEREICH_VORGABE, HEUTE)).toBe(false);
    expect(imBereich(item({ status: asAntragStatusRaw('abgelehnt/zurückgezogen') }), BEREICH_VORGABE, HEUTE)).toBe(false);
  });

  it('sammelt genau die Aktenzeichen im Bereich', () => {
    const menge = bereichsAktenzeichen([
      item({ aktenzeichen: 'A' }),
      item({ aktenzeichen: 'B', vb_phase: 4 }),
      item({ aktenzeichen: 'C', status: asAntragStatusRaw('abgelehnt/zurückgezogen') }),
      item({ aktenzeichen: 'D', antragsdatum: '2013-05-05' }),
      item({ aktenzeichen: 'E', vb_phase: 1, status: asAntragStatusRaw('Schlussvermerk') }),
    ], BEREICH_VORGABE, HEUTE);
    expect([...menge].sort()).toEqual(['A', 'E']);
  });

  it('lässt bei abgeschalteten Achsen alles durch', () => {
    const alles = { jahre: null, nurFueNetzwerkStudie: false, ohneAbgelehnte: false };
    const menge = bereichsAktenzeichen([
      item({ aktenzeichen: 'A', vb_phase: 9, status: asAntragStatusRaw('abgelehnt/zurückgezogen'), antragsdatum: '2012-01-01' }),
    ], alles, HEUTE);
    expect([...menge]).toEqual(['A']);
  });
});
