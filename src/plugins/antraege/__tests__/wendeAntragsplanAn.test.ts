/**
 * Die Anwendung des Antragsplans auf die vorhandenen Achsen.
 *
 * Die wichtigste Zusage steht im ersten Block: **eine Achse, die der Plan nicht
 * nennt, wird nicht angefasst**. Ohne sie hebelte eine Frage nach dem Bearbeiter
 * stillschweigend einen von Hand gesetzten Statusfilter aus.
 */
import { describe, it, expect, vi } from 'vitest';
import { getStatusValuesByCategory } from '@/core/utils/status-canonical';
import { KATEGORIE_REIHENFOLGE, KATEGORIE_TEXTE } from '@/core/utils/status-category-labels';
import { KATEGORIE_FILTER_ID } from '../filter/kategorieQuickfilter';
import { STATUS_FILTER_ID } from '../filter/phaseQuickfilter';
import type { Antragsplan } from '../frage/antragsplan';
import {
  wendeAntragsplanAn, JAHR_SPALTE, type PlanAnwendung,
} from '../frage/wendeAntragsplanAn';

/** Alle Monate 2024–2026, wie `deriveFilterCandidates` sie aus dem Bestand zieht. */
const MONATE = ['2024', '2025', '2026'].flatMap(j =>
  Array.from({ length: 12 }, (_, i) => `${j}-${String(i + 1).padStart(2, '0')}`));

function ziel(): PlanAnwendung & { rufe: Record<string, unknown[][]> } {
  const setActiveValue = vi.fn();
  const setzeKopfSpalte = vi.fn();
  const setProjektart = vi.fn();
  const setPrecheckBucket = vi.fn();
  const setStillstandTage = vi.fn();
  const setFrageKuerzel = vi.fn();
  const setPlanTeile = vi.fn();
  return {
    setActiveValue, setzeKopfSpalte, setProjektart, setPrecheckBucket,
    setStillstandTage, setFrageKuerzel, setPlanTeile,
    rufe: {
      setActiveValue: setActiveValue.mock.calls,
      setzeKopfSpalte: setzeKopfSpalte.mock.calls,
      setProjektart: setProjektart.mock.calls,
      setPrecheckBucket: setPrecheckBucket.mock.calls,
      setStillstandTage: setStillstandTage.mock.calls,
      setFrageKuerzel: setFrageKuerzel.mock.calls,
      setPlanTeile: setPlanTeile.mock.calls,
    },
  };
}

function plan(over: Partial<Antragsplan> = {}): Antragsplan {
  return {
    frage: 'f', status: [], vbPhasen: [], jahre: [],
    bearbeiter: [], leitbegriffe: [], ignoriert: [], ...over,
  };
}

const anwenden = (p: Antragsplan, z: PlanAnwendung): ReturnType<typeof wendeAntragsplanAn> =>
  wendeAntragsplanAn(p, { monatsWerte: MONATE }, z);

describe('wendeAntragsplanAn — setzen heißt ersetzen, nicht abräumen', () => {
  it('fasst KEINE Achse an, die der Plan nicht nennt', () => {
    const z = ziel();
    anwenden(plan({ bearbeiter: ['THü'] }), z);

    expect(z.rufe.setFrageKuerzel).toHaveLength(1);
    // Alles andere bleibt unberührt — ein von Hand gesetzter Statusfilter,
    // eine gewählte Projektart, ein PreCheck-Bucket.
    expect(z.rufe.setActiveValue).toHaveLength(0);
    expect(z.rufe.setzeKopfSpalte).toHaveLength(0);
    expect(z.rufe.setProjektart).toHaveLength(0);
    expect(z.rufe.setPrecheckBucket).toHaveLength(0);
    expect(z.rufe.setStillstandTage).toHaveLength(0);
  });

  it('setzt die Leitbegriffe IMMER — auch leer', () => {
    // Sie gehören zu DIESER Frage; ein stehengebliebenes Bündel der vorigen
    // suchte nach etwas, das niemand mehr gefragt hat.
    const z = ziel();
    anwenden(plan({ status: ['abgelehnt'] }), z);
    expect(z.rufe.setPlanTeile).toEqual([[[]]]);
  });

  it('ruft je Achse höchstens einen Setzer', () => {
    const z = ziel();
    anwenden(plan({ status: ['offen'], vbPhasen: [3, 5] }), z);
    // Status und Variante laufen beide über setActiveValue — aber je einmal.
    expect(z.rufe.setActiveValue).toHaveLength(2);
  });
});

describe('wendeAntragsplanAn — die drei Beispielfragen', () => {
  it('1 · Einzelvorhaben FuE/DS, 2025+2026, PreCheck offen', () => {
    const z = ziel();
    const w = anwenden(plan({
      vbPhasen: [3, 5], jahre: ['2025', '2026'],
      projektart: 'einzel', precheck: 'offen',
    }), z);

    expect(z.rufe.setActiveValue).toEqual([[KATEGORIE_FILTER_ID, ['3', '5']]]);
    expect(z.rufe.setProjektart).toEqual([['einzel']]);
    expect(z.rufe.setPrecheckBucket).toEqual([['offen']]);
    // Das Jahr ist ein Spaltenkopf-Filter über konkrete Monatswerte.
    const [[spalte, werte]] = z.rufe.setzeKopfSpalte as [[string, Set<string>]];
    expect(spalte).toBe(JAHR_SPALTE);
    expect(werte.size).toBe(24);
    expect(werte.has('2025-01')).toBe(true);
    expect(werte.has('2024-12')).toBe(false);
    expect(w.ohneWirkung).toEqual([]);
  });

  it('2 · Status, Stillstand und Bearbeiter — Kürzel normalisiert', () => {
    const z = ziel();
    anwenden(plan({ status: ['in_pruefung'], stillstandTage: 60, bearbeiter: ['THü'] }), z);

    expect(z.rufe.setStillstandTage).toEqual([[60]]);
    // Vergleichsform: großgeschrieben und NFC (Pitfall #22).
    expect(z.rufe.setFrageKuerzel).toEqual([[['THÜ']]]);
    const [[filterId, werte]] = z.rufe.setActiveValue as [[string, string[]]];
    expect(filterId).toBe(STATUS_FILTER_ID);
    expect(werte.length).toBeGreaterThan(0);
  });

  it('3 · Netzwerke Phase 2, abgelehnt', () => {
    // `abgeschlossen` und nicht `abgelehnt`: im eingebauten Katalog liegen die
    // Ablehnungen als Rohwert „abgelehnt/zurückgezogen" in DIESER Kategorie, und
    // `abgelehnt` hat gar keinen Rohwert. Der Prompt bietet deshalb nur belegte
    // Kategorien an (siehe `antragsplan.test.ts`) — das Modell kann hier also
    // gar nichts anderes wählen.
    const z = ziel();
    const w = anwenden(plan({ vbPhasen: [2], status: ['abgeschlossen'] }), z);

    const rufe = z.rufe.setActiveValue as [string, string[]][];
    expect(rufe.find(([id]) => id === KATEGORIE_FILTER_ID)?.[1]).toEqual(['2']);
    const statusWerte = rufe.find(([id]) => id === STATUS_FILTER_ID)?.[1] ?? [];
    expect(statusWerte.length).toBeGreaterThan(0);
    expect(statusWerte.some(v => v.includes('abgelehnt'))).toBe(true);
    expect(w.gesetzt.join(' | ')).toContain('NW 2');
    expect(w.ohneWirkung).toEqual([]);
  });
});

describe('wendeAntragsplanAn — was der Bestand nicht hergibt, wird gemeldet', () => {
  it('ein Jahr ohne einen einzigen Antrag verpufft nicht still', () => {
    const z = ziel();
    const w = anwenden(plan({ jahre: ['2027'] }), z);

    expect(z.rufe.setzeKopfSpalte).toHaveLength(0);
    expect(w.gesetzt).toEqual([]);
    expect(w.ohneWirkung.join(' ')).toContain('2027');
  });

  it('bei zwei Jahren, von denen eines fehlt, wirkt das vorhandene und das andere wird genannt', () => {
    const z = ziel();
    const w = anwenden(plan({ jahre: ['2026', '2027'] }), z);

    const [[, werte]] = z.rufe.setzeKopfSpalte as [[string, Set<string>]];
    expect(werte.size).toBe(12);
    expect(w.gesetzt.join(' ')).toContain('2026');
    expect(w.ohneWirkung.join(' ')).toContain('2027');
  });

  it('eine Kategorie ohne Rohwerte setzt keinen Filter und wird gemeldet', () => {
    // Ein Filter, der nichts vergleicht, wäre eine Liste ohne die verlangte
    // Einschränkung — und niemand sähe, dass sie fehlt. Am eingebauten Katalog
    // trifft das `abgelehnt`; ist die Kategorie im Team-Katalog belegt, greift
    // stattdessen der normale Pfad (dann ist dieser Test gegenstandslos, nicht falsch).
    const leer = KATEGORIE_REIHENFOLGE
      .filter(k => getStatusValuesByCategory(k).length === 0);
    if (leer.length === 0) return;

    const z = ziel();
    const w = anwenden(plan({ status: [leer[0]!] }), z);
    expect(z.rufe.setActiveValue).toHaveLength(0);
    expect(w.gesetzt).toEqual([]);
    expect(w.ohneWirkung.join(' ')).toContain('kein Wert');
  });

  it('benennt jede gesetzte Achse im Klartext', () => {
    const w = anwenden(plan({
      status: ['abgeschlossen'], vbPhasen: [2], projektart: 'kooperation',
      precheck: 'positiv', bearbeiter: ['ABC'], stillstandTage: 90,
      leitbegriffe: [{ begriff: 'Leichtbau', nadeln: ['leichtbau'], pflicht: false }],
    }), ziel());

    const text = w.gesetzt.join(' | ');
    const erledigt = KATEGORIE_TEXTE.abgeschlossen.lang;
    for (const teil of [erledigt, 'NW 2', 'Kooperations', 'PreCheck positiv', 'ABC', '90 Tagen', 'Leichtbau']) {
      expect(text).toContain(teil);
    }
  });
});
