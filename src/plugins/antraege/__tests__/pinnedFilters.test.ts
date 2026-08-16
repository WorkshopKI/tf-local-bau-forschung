import { describe, it, expect } from 'vitest';
import type { ActiveFilter, FilterDefinition, FilterTyp } from '@/core/services/csv';
import {
  pinKey,
  wertAktiv,
  wertUmschalten,
  kombiAktiv,
  kombiEinschalten,
  kombiAusschalten,
  aktivIstAngepinnt,
  facetteAlsUmschalterMoeglich,
  MAX_UMSCHALTER_WERTE,
  type PinnedFilter,
} from '../filter/pinnedFilters';

function def(id: string, typ: FilterTyp = 'multi_select'): FilterDefinition {
  return {
    id,
    programm_id: 'p',
    scope: 'system',
    name: id,
    feld: id,
    typ,
    config: {},
    anzeige_reihenfolge: 1,
    versteckt: false,
    erstellt_am: '2026-01-01',
    aktualisiert_am: '2026-01-01',
  };
}

describe('Schnellzugriff — Identität eines Pins', () => {
  it('unterscheidet die drei Arten, auch bei gleicher filterId', () => {
    const wert: PinnedFilter = { art: 'wert', filterId: 'f1', wert: 'a' };
    const facette: PinnedFilter = { art: 'facette', filterId: 'f1' };
    const kombi: PinnedFilter = { art: 'kombination', signatur: 'f1', gesetzt: [] };
    expect(new Set([pinKey(wert), pinKey(facette), pinKey(kombi)]).size).toBe(3);
  });

  it('ist stabil — zwei gleich gebaute Pins tragen denselben Schlüssel', () => {
    expect(pinKey({ art: 'wert', filterId: 'f1', wert: 'a' }))
      .toBe(pinKey({ art: 'wert', filterId: 'f1', wert: 'a' }));
  });

  it('einer Kombination genügt ihre Signatur — der gesetzte Satz zählt nicht mit', () => {
    // Trägt die Nadel an einer Status-PHASE: welche Stati die Phase gerade
    // führt, hängt von den übrigen Filtern ab. Zählte der Satz zur Identität,
    // läse sich derselbe Pin nach dem nächsten Filter als „nicht angepinnt" —
    // und die Nadel legte ihn ein zweites Mal an.
    const vorher: PinnedFilter = {
      art: 'kombination',
      signatur: 'phase:status:eingang',
      gesetzt: [{ filterId: 'status', value: ['beantragt', 'skizze'] }],
    };
    const nachher: PinnedFilter = {
      art: 'kombination',
      signatur: 'phase:status:eingang',
      gesetzt: [{ filterId: 'status', value: ['beantragt'] }],
    };
    expect(pinKey(nachher)).toBe(pinKey(vorher));
  });
});

describe('Einzelwert-Chip: Schalter, nicht Sprung', () => {
  const multi = def('projektart');
  const single = def('richtlinie', 'single_select');

  it('erkennt den Wert als aktiv, egal ob Einfach- oder Mehrfachauswahl', () => {
    expect(wertAktiv([{ filterId: 'projektart', value: ['a', 'b'] }], 'projektart', 'b')).toBe(true);
    expect(wertAktiv([{ filterId: 'richtlinie', value: 'a' }], 'richtlinie', 'a')).toBe(true);
    expect(wertAktiv([], 'projektart', 'a')).toBe(false);
  });

  it('ergänzt bei Mehrfachauswahl, statt die anderen Werte zu verwerfen', () => {
    const active: ActiveFilter[] = [{ filterId: 'projektart', value: ['a'] }];
    expect(wertUmschalten(active, multi, 'b')).toEqual(['a', 'b']);
  });

  it('nimmt bei Mehrfachauswahl nur den eigenen Wert heraus', () => {
    const active: ActiveFilter[] = [{ filterId: 'projektart', value: ['a', 'b'] }];
    expect(wertUmschalten(active, multi, 'a')).toEqual(['b']);
  });

  it('leert den Filter, wenn der letzte Wert abgewählt wird', () => {
    const active: ActiveFilter[] = [{ filterId: 'projektart', value: ['a'] }];
    expect(wertUmschalten(active, multi, 'a')).toBeNull();
  });

  it('setzt bzw. löscht bei Einfachauswahl', () => {
    expect(wertUmschalten([], single, 'a')).toBe('a');
    expect(wertUmschalten([{ filterId: 'richtlinie', value: 'a' }], single, 'a')).toBeNull();
    // Ein ANDERER Wert ersetzt — Einfachauswahl kennt kein Dazulegen.
    expect(wertUmschalten([{ filterId: 'richtlinie', value: 'a' }], single, 'b')).toBe('b');
  });
});

describe('Kombinations-Chip: legt dazu und nimmt nur sein eigenes Zutun zurück', () => {
  const satz: ActiveFilter[] = [
    { filterId: 'status', value: ['x', 'y'] },
    { filterId: 'richtlinie', value: 'r1' },
  ];

  it('gilt erst als an, wenn ALLE seine Filter gesetzt sind', () => {
    expect(kombiAktiv([{ filterId: 'status', value: ['x', 'y'] }], satz)).toBe(false);
    expect(kombiAktiv([
      { filterId: 'status', value: ['x', 'y', 'z'] },
      { filterId: 'richtlinie', value: 'r1' },
    ], satz)).toBe(true);
  });

  it('vereinigt beim Einschalten und merkt sich nur das Neue', () => {
    const active: ActiveFilter[] = [{ filterId: 'status', value: ['x'] }];
    const { aenderungen, delta } = kombiEinschalten(active, satz);
    expect(aenderungen).toEqual([
      { filterId: 'status', value: ['x', 'y'] },
      { filterId: 'richtlinie', value: 'r1' },
    ]);
    expect(delta).toEqual([
      { filterId: 'status', hinzugefuegt: ['y'] },
      { filterId: 'richtlinie', vorher: null },
    ]);
  });

  it('gibt beim Ausschalten den Vorzustand zurück — fremde Werte bleiben stehen', () => {
    // Vorher stand `x` (von Hand gesetzt) und `r0`; der Chip ergänzte `y` und
    // überschrieb die Richtlinie.
    const vorher: ActiveFilter[] = [
      { filterId: 'status', value: ['x'] },
      { filterId: 'richtlinie', value: 'r0' },
    ];
    const { aenderungen, delta } = kombiEinschalten(vorher, satz);
    const nachEin: ActiveFilter[] = aenderungen.map(a => ({ filterId: a.filterId, value: a.value! }));
    const zurueck = kombiAusschalten(nachEin, satz, delta);
    expect(zurueck).toEqual([
      { filterId: 'status', value: ['x'] },
      { filterId: 'richtlinie', value: 'r0' },
    ]);
  });

  it('zieht ohne Gedächtnis ersatzweise den ganzen Satz ab — großzügiger, nie falsch', () => {
    // Der Rückfall nimmt AUCH `x` weg, obwohl es vorher von Hand gesetzt worden
    // sein könnte. Das ist die schlechtere Antwort (der Delta-Fall oben hält `x`),
    // aber sie bleibt beim „Filter aus" statt bei einem Zustand dazwischen.
    const active: ActiveFilter[] = [
      { filterId: 'status', value: ['x', 'y'] },
      { filterId: 'richtlinie', value: 'r1' },
    ];
    expect(kombiAusschalten(active, satz)).toEqual([
      { filterId: 'status', value: null },
      { filterId: 'richtlinie', value: null },
    ]);
    // Was übrig ist, bleibt: ein Wert, den der Satz nicht kennt, überlebt.
    expect(kombiAusschalten(
      [{ filterId: 'status', value: ['x', 'y', 'z'] }, { filterId: 'richtlinie', value: 'r1' }],
      satz,
    )[0]).toEqual({ filterId: 'status', value: ['z'] });
  });
});

describe('Entdopplung: welcher aktive Filter braucht daneben keinen Chip mehr', () => {
  it('eine angepinnte Facette deckt ihren Slot ganz ab', () => {
    const pins: PinnedFilter[] = [{ art: 'facette', filterId: 'projektart' }];
    expect(aktivIstAngepinnt({ filterId: 'projektart', value: ['a', 'b'] }, pins)).toBe(true);
  });

  it('ein angepinnter Wert deckt nur ab, solange nichts Ungepinntes danebensteht', () => {
    const pins: PinnedFilter[] = [{ art: 'wert', filterId: 'projektart', wert: 'a' }];
    expect(aktivIstAngepinnt({ filterId: 'projektart', value: ['a'] }, pins)).toBe(true);
    // `b` käme sonst spurlos weg — der Chip bleibt.
    expect(aktivIstAngepinnt({ filterId: 'projektart', value: ['a', 'b'] }, pins)).toBe(false);
  });

  it('eine angepinnte Kombination deckt nichts ab', () => {
    // Sie ist ein Schalter über mehrere Slots; was tatsächlich filtert, soll
    // einzeln sicht- und abwählbar bleiben.
    const pins: PinnedFilter[] = [{
      art: 'kombination',
      signatur: 's',
      gesetzt: [{ filterId: 'projektart', value: ['a'] }],
    }];
    expect(aktivIstAngepinnt({ filterId: 'projektart', value: ['a'] }, pins)).toBe(false);
  });
});

describe('Welche Facette taugt als Umschalter', () => {
  it('nur abzählbare Facetten mit wenigen Werten', () => {
    expect(facetteAlsUmschalterMoeglich(def('projektart'), 3)).toBe(true);
    expect(facetteAlsUmschalterMoeglich(def('richtlinie', 'single_select'), 1)).toBe(true);
    // Ja/Nein ist der Umschalter-Fall schlechthin — er stand zunächst
    // versehentlich draußen (am echten Bestand aufgefallen).
    expect(facetteAlsUmschalterMoeglich(def('nw_bezug', 'boolean_ja_nein'), 2)).toBe(true);
    expect(facetteAlsUmschalterMoeglich(def('datum', 'date_range'), 2)).toBe(false);
    expect(facetteAlsUmschalterMoeglich(def('leer'), 0)).toBe(false);
  });

  it('trägt die Facetten, die es im echten Bestand gibt', () => {
    // Am 16.08.2026 gemessen: VB-Phase hat 6 Werte. Mit der Handoff-Grenze (5)
    // qualifizierte sich KEINE der sieben Facetten — die Grenze schaltete das
    // Merkmal faktisch ab.
    expect(facetteAlsUmschalterMoeglich(def('vb_phase'), 6)).toBe(true);
    expect(facetteAlsUmschalterMoeglich(def('richtlinie'), 16)).toBe(false);
  });

  it('lässt genau so viele Werte zu, wie die Zeile trägt', () => {
    expect(facetteAlsUmschalterMoeglich(def('x'), MAX_UMSCHALTER_WERTE)).toBe(true);
    expect(facetteAlsUmschalterMoeglich(def('x'), MAX_UMSCHALTER_WERTE + 1)).toBe(false);
  });
});
