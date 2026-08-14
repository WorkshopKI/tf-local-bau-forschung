import { describe, it, expect } from 'vitest';
import { baueKuerzelOptionen } from '../hooks/kuerzelOptionen';
import type { AnonymMap } from '../services/identitaet';
import type { AnonymerMitarbeiter } from '../types';

/** NFC: ein Codepoint (U+00DC). */
const THUE_NFC = 'THÜ';
/** NFD: U + Combining Diaeresis — dieselbe Person, andere Schreibweise. */
const THUE_NFD = 'THÜ';

function anonymMap(paare: Record<string, string>): AnonymMap {
  const toAnon = new Map(Object.entries(paare));
  const toReal = new Map([...toAnon].map(([k, v]) => [v, k]));
  return { toAnon, toReal };
}

function ma(anonId: string, aktiv: boolean): AnonymerMitarbeiter {
  return { anonId, aktiv } as AnonymerMitarbeiter;
}

const OHNE_MAP = anonymMap({});
const KEINE_MAS: Record<string, AnonymerMitarbeiter> = {};

describe('baueKuerzelOptionen — beide Bearbeiter-Spalten (v4.47)', () => {
  it('sammelt fachliche UND administrative Kuerzel', () => {
    const opts = baueKuerzelOptionen(
      [{ tib_kuerz: 'MUE' }, { bib_kuerz: 'SCH' }],
      [], OHNE_MAP, KEINE_MAS,
    );
    expect(opts.map(o => o.kuerzel)).toEqual(['MUE', 'SCH']);
  });

  it('fuehrt eine Person, die in beiden Spalten steht, genau einmal', () => {
    const opts = baueKuerzelOptionen(
      [{ tib_kuerz: 'MUE', bib_kuerz: 'MUE' }, { tib_kuerz: 'MUE' }],
      ['MUE'], OHNE_MAP, KEINE_MAS,
    );
    expect(opts).toEqual([{ kuerzel: 'MUE', anzeige: 'MUE', aktiv: true }]);
  });

  it('nimmt die kuerzel-map dazu (Cold-Start: Antraege noch leer)', () => {
    const opts = baueKuerzelOptionen([], ['SCH', 'MUE'], OHNE_MAP, KEINE_MAS);
    expect(opts.map(o => o.kuerzel)).toEqual(['MUE', 'SCH']);
  });

  it('normalisiert Umlaut-Kuerzel nach NFC (Pitfall #22)', () => {
    // Ohne Normalisierung waeren das zwei Eintraege — und einer davon nie
    // auffindbar, weil die Antraege die andere Schreibweise tragen.
    const opts = baueKuerzelOptionen(
      [{ tib_kuerz: THUE_NFC }, { bib_kuerz: THUE_NFD }],
      [], OHNE_MAP, KEINE_MAS,
    );
    expect(opts).toEqual([{ kuerzel: THUE_NFC, anzeige: THUE_NFC, aktiv: true }]);
  });

  it('ignoriert leere und nicht-textuelle Werte', () => {
    const opts = baueKuerzelOptionen(
      [{ tib_kuerz: '  ' }, { bib_kuerz: null }, { tib_kuerz: 42 }, { bib_kuerz: 'AB1' }],
      [], OHNE_MAP, KEINE_MAS,
    );
    expect(opts.map(o => o.kuerzel)).toEqual(['AB1']);
  });
});

describe('baueKuerzelOptionen — Schreibweise der Quelle (v4.48)', () => {
  /** Wie das Team es schreibt: gemischt, NFC (U+00FC). */
  const THUE_ORIGINAL = 'THü';

  it('zeigt die Schreibweise der Quelle und vergleicht ueber die Normalform', () => {
    const opts = baueKuerzelOptionen([{ tib_kuerz: THUE_ORIGINAL }], [], OHNE_MAP, KEINE_MAS);
    expect(opts).toEqual([{ kuerzel: THUE_NFC, anzeige: THUE_ORIGINAL, aktiv: true }]);
  });

  it('laesst die gemischte Schreibweise gegen den Grossbuchstaben-Eintrag gewinnen', () => {
    // Die kuerzel-map fuehrt normalisiert, die Antraege im Original — welche
    // Quelle zuerst gelesen wird, darf die Anzeige nicht bestimmen.
    const ausAntraegen = baueKuerzelOptionen(
      [{ tib_kuerz: THUE_ORIGINAL }], [THUE_NFC], OHNE_MAP, KEINE_MAS,
    );
    const nurMap = baueKuerzelOptionen([], [THUE_NFC], OHNE_MAP, KEINE_MAS);
    expect(ausAntraegen.map(o => o.anzeige)).toEqual([THUE_ORIGINAL]);
    // Ohne eine gemischte Quelle bleibt es bei der Normalform — nichts erfinden.
    expect(nurMap.map(o => o.anzeige)).toEqual([THUE_NFC]);
  });

  it('haelt die Anzeige an die erste gemischte Schreibweise (Determinismus)', () => {
    const opts = baueKuerzelOptionen(
      [{ tib_kuerz: 'MaL' }, { tib_kuerz: 'MAL' }, { tib_kuerz: 'Mal' }],
      [], OHNE_MAP, KEINE_MAS,
    );
    expect(opts).toEqual([{ kuerzel: 'MAL', anzeige: 'MaL', aktiv: true }]);
  });

  it('sortiert weiter ueber die Normalform, nicht ueber die Schreibweise', () => {
    // Sonst landeten Kleinbuchstaben in einer eigenen Gruppe hinter allen
    // Grossbuchstaben — „aBC" stuende nach „ZED".
    const opts = baueKuerzelOptionen(
      [{ tib_kuerz: 'zEd' }, { tib_kuerz: 'aBc' }], [], OHNE_MAP, KEINE_MAS,
    );
    expect(opts.map(o => o.anzeige)).toEqual(['aBc', 'zEd']);
  });
});

describe('baueKuerzelOptionen — aktiv-Flag und Reihenfolge', () => {
  it('liest `aktiv` ueber die AnonymMap aus der MA-Liste', () => {
    const opts = baueKuerzelOptionen(
      [{ tib_kuerz: 'MUE' }],
      [], anonymMap({ MUE: 'MA01' }), { MA01: ma('MA01', false) },
    );
    expect(opts).toEqual([{ kuerzel: 'MUE', anzeige: 'MUE', aktiv: false }]);
  });

  it('gilt ohne Map-Eintrag als aktiv — „inaktiv" kann nur die MA-Liste sagen', () => {
    // AB-Kuerzel stehen nie in der (tib-only) AnonymMap, Pitfall #17.
    const opts = baueKuerzelOptionen(
      [{ bib_kuerz: 'NEU' }],
      [], anonymMap({ MUE: 'MA01' }), { MA01: ma('MA01', true) },
    );
    expect(opts).toEqual([{ kuerzel: 'NEU', anzeige: 'NEU', aktiv: true }]);
  });

  it('sortiert aktive zuerst, dann alphabetisch — inaktive verschwinden aber nicht', () => {
    const opts = baueKuerzelOptionen(
      [{ tib_kuerz: 'ZED' }, { tib_kuerz: 'ALT' }, { tib_kuerz: 'BOB' }],
      [],
      anonymMap({ ALT: 'MA01', BOB: 'MA02', ZED: 'MA03' }),
      { MA01: ma('MA01', false), MA02: ma('MA02', true), MA03: ma('MA03', true) },
    );
    expect(opts).toEqual([
      { kuerzel: 'BOB', anzeige: 'BOB', aktiv: true },
      { kuerzel: 'ZED', anzeige: 'ZED', aktiv: true },
      { kuerzel: 'ALT', anzeige: 'ALT', aktiv: false },
    ]);
  });
});
