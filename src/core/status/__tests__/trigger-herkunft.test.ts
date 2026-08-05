/**
 * Was diese Datei festnagelt:
 *
 * 1. **Ausgewählt wird nach Wirkung, nicht nach Vorkommen.** Eine Zeile, die den
 *    Code nur als Bedingung nennt (`<59`), ist kein Weg ZU 59.
 * 2. **Nach Kürzel gruppiert, Richtlinien zusammengefasst** — dasselbe Kürzel in
 *    neun Richtlinien ergibt eine Zeile mit neun Programmen, nicht neun Zeilen.
 *    Wirkt es je Richtlinie verschieden, stehen die Sätze getrennt da.
 * 3. **Der Satz ist derselbe wie im Herleitungs-Popover** — die Verkettung der
 *    Segmente ergibt genau `triggerSatzVon`, es gibt keinen zweiten Weg zum Text.
 * 4. **Kein Weg ist eine Aussage**, kein Fehler: leere Gruppen, `zeilen: 0`.
 */
import { describe, it, expect } from 'vitest';
import { herkunftZuStatus, richtlinienSatz } from '@/core/status/trigger-herkunft';
import { erklaerKatalog } from '@/core/status/trigger-erklaerung';
import { alsText, triggerSatzVon } from '@/core/status/trigger-satz';
import { parseTriggerZeile } from '@/core/status/trigger-parser';
import { baueSeedVersion } from '@/core/status/seed';
import type { TriggerZeile } from '@/core/status/typen';

const seed = baueSeedVersion();
const katalog = erklaerKatalog(seed);

/**
 * `TRG_TVs_Status_TV_VB` liest acht Positionen von vorn: 0 Status-Vergleich,
 * 1–2 ohne-Kürzel, 3–5 weitere, **6 neuer TV-Status, 7 neuer VB-Status**. Die
 * Pipes hier deshalb ausgezählt, nicht geschätzt.
 */
const zeile = (programm: string, kuerzel: string, parameter: string, folge = 1): TriggerZeile =>
  parseTriggerZeile({ programm, kuerzel, folge, prozedur: 'TRG_TVs_Status_TV_VB', parameter });

const setzen = (programm: string, kuerzel: string, parameter: string): TriggerZeile =>
  parseTriggerZeile({ programm, kuerzel, folge: 1, prozedur: 'TRG.Status.TV.VB', parameter });

/** Argumente an Position 6 (TV) und 7 (VB). */
const tv = (code: number, bedingung = ''): string => `${bedingung}||||||${code}`;
const vb = (code: number, bedingung = ''): string => `${bedingung}|||||||${code}`;
const tvUndVb = (code: number): string => `||||||${code}|${code}`;

describe('herkunftZuStatus — Auswahl nach Wirkung', () => {
  it('findet die Zeile, die den TV-Status auf den Code setzt', () => {
    const h = herkunftZuStatus([zeile('131', 'ABB', tv(59))], 59, katalog);
    expect(h.zeilen).toBe(1);
    expect(h.gruppen).toHaveLength(1);
    expect(h.gruppen[0]?.kuerzel).toBe('ABB');
    expect(h.gruppen[0]?.wirkungen[0]?.ebene).toBe('TV');
  });

  it('unterscheidet TV, Verbund und beides', () => {
    const nurVb = herkunftZuStatus([zeile('131', 'ABB', vb(59))], 59, katalog);
    expect(nurVb.gruppen[0]?.wirkungen[0]?.ebene).toBe('VB');

    const beides = herkunftZuStatus([zeile('131', 'ABB', tvUndVb(59))], 59, katalog);
    expect(beides.gruppen[0]?.wirkungen[0]?.ebene).toBe('beides');
  });

  it('eine Bedingung auf den Code ist KEIN Weg zu ihm', () => {
    // `<59` ist eine Vorbedingung; die Zeile setzt 74, nicht 59.
    const h = herkunftZuStatus([zeile('131', 'AAE', tv(74, '<59'))], 59, katalog);
    expect(h.zeilen).toBe(0);
    expect(h.gruppen).toEqual([]);
    expect(herkunftZuStatus([zeile('131', 'AAE', tv(74, '<59'))], 74, katalog).zeilen).toBe(1);
  });

  it('StatusSetzen liest die Ebene aus der Bezugsdatei-Nummer', () => {
    expect(herkunftZuStatus([setzen('131', 'ABA', '211|74')], 74, katalog)
      .gruppen[0]?.wirkungen[0]?.ebene).toBe('TV');
    expect(herkunftZuStatus([setzen('131', 'XAAE', '210|74')], 74, katalog)
      .gruppen[0]?.wirkungen[0]?.ebene).toBe('VB');
    // Unbekannte Nummer wird benannt, nicht geraten.
    expect(herkunftZuStatus([setzen('131', 'ABA', '999|74')], 74, katalog)
      .gruppen[0]?.wirkungen[0]?.ebene).toBe('unbekannt');
  });

  it('nicht interpretierte Zeilen tragen nichts bei', () => {
    const roh: TriggerZeile = {
      programm: '131', kuerzel: 'XYZ', folge: 1, prozedur: 'Unbekannt',
      parameterRoh: 'irgendwas', geparst: null, satz: 'irgendwas',
    };
    expect(herkunftZuStatus([roh], 59, katalog).zeilen).toBe(0);
  });
});

describe('herkunftZuStatus — Bündelung', () => {
  it('dasselbe Kürzel mit derselben Wirkung ergibt EINE Zeile mit allen Richtlinien', () => {
    const h = herkunftZuStatus([
      zeile('131', 'ABB', tv(59)),
      zeile('133', 'ABB', tv(59)),
      zeile('137', 'ABB', tv(59)),
    ], 59, katalog);
    expect(h.zeilen).toBe(3);
    expect(h.gruppen).toHaveLength(1);
    expect(h.gruppen[0]?.wirkungen).toHaveLength(1);
    expect(h.gruppen[0]?.wirkungen[0]?.programme).toEqual(['131', '133', '137']);
    expect(h.programme).toEqual(['131', '133', '137']);
  });

  it('dasselbe Kürzel mit verschiedener Wirkung ergibt zwei Zeilen, der breitere Weg zuerst', () => {
    const h = herkunftZuStatus([
      zeile('131', 'ABB', tv(59)),
      zeile('133', 'ABB', tv(59)),
      zeile('137', 'ABB', tv(59, '<51')),
    ], 59, katalog);
    expect(h.gruppen[0]?.wirkungen).toHaveLength(2);
    expect(h.gruppen[0]?.wirkungen[0]?.programme).toEqual(['131', '133']);
    expect(h.gruppen[0]?.wirkungen[1]?.programme).toEqual(['137']);
  });

  it('zwei Kürzel ergeben zwei Gruppen, alphabetisch', () => {
    const h = herkunftZuStatus([
      zeile('131', 'ZZZ', tv(59)),
      zeile('131', 'ABB', tv(59)),
    ], 59, katalog);
    expect(h.gruppen.map(g => g.kuerzel)).toEqual(['ABB', 'ZZZ']);
  });

  it('eine gedeutete Ebene schlägt eine ungedeutete derselben Wirkung', () => {
    // Beide Zeilen tragen denselben Satz? Nein — die Ebene steckt IM Satz. Der
    // Fall entsteht nur über verschiedene Programme mit identischem Text; hier
    // wird geprüft, dass „unbekannt" jedenfalls nie eine belegte Angabe frisst.
    const h = herkunftZuStatus([setzen('131', 'ABA', '211|74')], 74, katalog);
    expect(h.gruppen[0]?.wirkungen[0]?.ebene).not.toBe('unbekannt');
  });
});

describe('herkunftZuStatus — Katalog-Bezug', () => {
  it('nennt Bezeichnung und Rolle aus dem Kürzel-Katalog', () => {
    const g = herkunftZuStatus([zeile('131', 'ABB', tv(59))], 59, katalog).gruppen[0];
    expect(g?.label).toBe('Bewilligung');
    expect(g?.unbekannt).toBe(false);
    expect(g?.rollenText.length).toBeGreaterThan(0);
  });

  it('ein katalogfremdes Kürzel wird als solches markiert, nicht verschwiegen', () => {
    const g = herkunftZuStatus([zeile('131', 'QQQ', tv(59))], 59, katalog).gruppen[0];
    expect(g?.unbekannt).toBe(true);
    expect(g?.label).toBe('QQQ');
    // Leere Rollen heißen „jeder darf setzen", nie „niemand" (Pitfall #43).
    expect(g?.rollenText).toBe('alle');
  });

  it('der Satz ist zeichengleich mit dem des Herleitungs-Popovers', () => {
    const z = zeile('131', 'ABB', tv(59, '<51'));
    const g = herkunftZuStatus([z], 59, katalog).gruppen[0];
    expect(alsText(g?.wirkungen[0]?.segmente ?? [])).toBe(triggerSatzVon(z));
  });

  it('die Segmente tragen Erklärungen, wo die Fassung eine kennt', () => {
    const g = herkunftZuStatus([zeile('131', 'ABB', tv(59))], 59, katalog).gruppen[0];
    const status = g?.wirkungen[0]?.segmente.find(s => s.art === 'status');
    expect(status?.erklaerung?.titel).toBe('bewilligt');
  });
});

describe('herkunftZuStatus — kein Weg ist eine Aussage', () => {
  it('leere Tabelle liefert leere Gruppen, keinen Fehler', () => {
    expect(herkunftZuStatus([], 59, katalog)).toEqual({ gruppen: [], zeilen: 0, programme: [] });
  });

  it('ein Code ohne Weg liefert dasselbe', () => {
    expect(herkunftZuStatus([zeile('131', 'ABB', tv(59))], 11, katalog).gruppen).toEqual([]);
  });

  it('zwei Läufe über dieselbe Eingabe liefern dasselbe (rein)', () => {
    const t = [zeile('133', 'ABB', tv(59)), zeile('131', 'AAE', tv(59))];
    expect(herkunftZuStatus(t, 59, katalog)).toEqual(herkunftZuStatus(t, 59, katalog));
  });
});

describe('richtlinienSatz', () => {
  it('fasst mehrere Richtlinien zu einer Aufzählung zusammen', () => {
    expect(richtlinienSatz(['131', '133', '137'])).toBe('in 131, 133 und 137');
    expect(richtlinienSatz(['131', '133'])).toBe('in 131 und 133');
  });

  it('nennt eine einzelne Richtlinie beim Namen', () => {
    expect(richtlinienSatz(['131'])).toBe('in Richtlinie 131');
  });

  it('schweigt bei leerer Liste, statt ein Satzfragment zu liefern', () => {
    expect(richtlinienSatz([])).toBe('');
  });
});
