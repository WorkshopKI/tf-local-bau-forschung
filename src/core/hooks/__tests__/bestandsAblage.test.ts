/**
 * Die Ablage des Bestandslaufs — geprüft wird, **wann sie NICHT gilt**.
 *
 * Ein Cache, der zu selten trifft, kostet Zeit; einer, der zu oft trifft, zeigt
 * falsche Zahlen. Der zweite Fehler ist der teurere, deshalb steht hier für jede
 * Achse des Schlüssels ein eigener Fall — und für die eine Verschärfung
 * gegenüber dem Vorbild (Cold Start vs. leerer Betrachtungsbereich) zwei.
 *
 * Verschoben aus `plugins/vorgangs-board/__tests__/boardCache.test.ts`: die
 * Ablage gehört seit v4.132 nicht mehr dem Board, sondern allen drei Lesern.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  useBestandsAblage, ablageGilt, ablagePasst, ablageVorlaeufig, bestandsBasis, bestandsSchluessel,
  BESTAND_CACHE_TTL_MS, type BestandsDaten,
} from '@/core/hooks/useBestandsAufgaben';
import {
  markiereBestandGeaendert, subscribeBestandGeneration,
} from '@/core/services/bestand-generation';
import type { MappingVersion } from '@/core/status';

const VERSION = { version: 3, zeitstempel: '2026-08-01T00:00:00.000Z' } as MappingVersion;

const daten = (n: number): BestandsDaten => ({
  version: VERSION,
  zeilen: Array.from({ length: n }, () => ({})) as BestandsDaten['zeilen'],
  ausgeblendet: 0,
  nichtGerechnet: new Set(),
  ladeMs: 1234,
  nachAktenzeichen: new Map(),
  nachVerbund: new Map(),
  abgeschlossen: new Set(),
});

describe('Bestands-Ablage', () => {
  beforeEach(() => {
    useBestandsAblage.getState().entwerten();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-18T10:00:00.000Z'));
  });
  afterEach(() => { vi.useRealTimers(); });

  it('ein frischer Schluessel gilt, ein fremder nicht', () => {
    useBestandsAblage.getState().setzen('a', daten(5), 5);
    expect(ablageGilt(useBestandsAblage.getState(), 'a', Date.now())).toBe(true);
    // Jede Achse des Schluessels — Fassung, Bereich, Generation, Stichtag —
    // landet in derselben Zeichenkette; ein Unterschied irgendwo trifft hier.
    expect(ablageGilt(useBestandsAblage.getState(), 'b', Date.now())).toBe(false);
  });

  it('nach der TTL gilt sie nicht mehr', () => {
    useBestandsAblage.getState().setzen('a', daten(5), 5);
    vi.advanceTimersByTime(BESTAND_CACHE_TTL_MS - 1000);
    expect(ablageGilt(useBestandsAblage.getState(), 'a', Date.now())).toBe(true);
    vi.advanceTimersByTime(2000);
    expect(ablageGilt(useBestandsAblage.getState(), 'a', Date.now())).toBe(false);
  });

  it('ein Cold Start (nichts gelesen) stellt NICHT scharf', () => {
    // Der Fall, an dem der Anträge-Store schon einmal gescheitert ist (v2.21.3):
    // die IDB ist noch leer, und ein scharfer leerer Eintrag hielte die Seite
    // bis zum Reload leer.
    useBestandsAblage.getState().setzen('a', daten(0), 0);
    expect(useBestandsAblage.getState().standAt).toBe(0);
    expect(ablageGilt(useBestandsAblage.getState(), 'a', Date.now())).toBe(false);
  });

  it('ein Bereich, der ALLES ausschliesst, stellt sehr wohl scharf', () => {
    // Hier liegt der Unterschied zum Vorbild: null Zeilen, aber 900 gelesene
    // Sätze ist eine echte, stabile Antwort — sie soll nicht bei jedem Besuch
    // neu erarbeitet werden. Nach `zeilen.length` wäre beides ununterscheidbar.
    useBestandsAblage.getState().setzen('a', { ...daten(0), ausgeblendet: 900 }, 900);
    expect(useBestandsAblage.getState().standAt).toBeGreaterThan(0);
    expect(ablageGilt(useBestandsAblage.getState(), 'a', Date.now())).toBe(true);
  });

  it('entwerten macht sie ungueltig (der Weg des Fehlerpfads)', () => {
    useBestandsAblage.getState().setzen('a', daten(5), 5);
    useBestandsAblage.getState().entwerten();
    expect(ablageGilt(useBestandsAblage.getState(), 'a', Date.now())).toBe(false);
    expect(useBestandsAblage.getState().daten).toBeNull();
  });

  it('berechnetAm traegt den Zeitpunkt des Laufs', () => {
    useBestandsAblage.getState().setzen('a', daten(5), 5);
    expect(useBestandsAblage.getState().berechnetAm).toBe(Date.now());
    vi.advanceTimersByTime(180_000);
    expect(Date.now() - useBestandsAblage.getState().berechnetAm).toBe(180_000);
  });
});

/**
 * Anzeige und Anstoß sind zwei Fragen.
 *
 * Bis v6.57.1 hing auch die ANZEIGE an der TTL: geprüft wurde bei jedem Render
 * gegen die Uhr, der Effekt, der neu rechnet, hing aber nur am Schlüssel. Nach
 * fünf Minuten zeigte jede To-do-Zelle der Startseite „…", und nichts rechnete
 * neu (gemessen 11.09.2026: 0 → 13 Platzhalter, kein Lauf in 12 s).
 */
describe('Anzeige hängt am Schlüssel, der Anstoß an der TTL', () => {
  beforeEach(() => {
    useBestandsAblage.getState().entwerten();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-18T10:00:00.000Z'));
  });
  afterEach(() => { vi.useRealTimers(); });

  it('nach der TTL passt sie weiter — nur ein neuer Lauf ist fällig', () => {
    useBestandsAblage.getState().setzen('a', daten(5), 5);
    vi.advanceTimersByTime(BESTAND_CACHE_TTL_MS + 60_000);
    expect(ablageGilt(useBestandsAblage.getState(), 'a', Date.now())).toBe(false);
    expect(ablagePasst(useBestandsAblage.getState(), 'a')).toBe(true);
    expect(ablagePasst(useBestandsAblage.getState(), 'b')).toBe(false);
  });

  it('ein Cold Start passt auch ohne Uhr nicht', () => {
    useBestandsAblage.getState().setzen('a', daten(0), 0);
    expect(ablagePasst(useBestandsAblage.getState(), 'a')).toBe(false);
  });
});

/**
 * Der Stand von vor dem Import bleibt stehen, bis neu gerechnet ist — aber nur,
 * wenn sich ALLEIN der Bestand geändert hat. Ein anderer Bereich, eine andere
 * Fassung, ein anderer Tag ist eine andere Frage; deren alte Antwort wäre
 * falsch, nicht nur alt.
 */
describe('vorläufiger Stand', () => {
  const stichtag = '2026-08-18T10:00:00.000Z';
  const basis = (): string => bestandsBasis(VERSION, null, stichtag);
  const schluessel = (): string => bestandsSchluessel(VERSION, null, stichtag);
  beforeEach(() => { useBestandsAblage.getState().entwerten(); });

  it('ein Bestandswechsel lässt den alten Stand vorläufig stehen', () => {
    useBestandsAblage.getState().setzen(schluessel(), daten(5), 5, basis());
    markiereBestandGeaendert();
    const s = useBestandsAblage.getState();
    expect(ablagePasst(s, schluessel())).toBe(false);
    expect(ablageVorlaeufig(s, schluessel(), basis())).toBe(true);
  });

  it('ein anderer Bereich ist eine andere Frage — kein vorläufiger Stand', () => {
    useBestandsAblage.getState().setzen(schluessel(), daten(5), 5, basis());
    const bereich = new Set(['16KN']);
    expect(ablageVorlaeufig(
      useBestandsAblage.getState(),
      bestandsSchluessel(VERSION, bereich, stichtag),
      bestandsBasis(VERSION, bereich, stichtag),
    )).toBe(false);
  });

  it('der passende Stand ist nicht vorläufig, ein entwerteter gar keiner', () => {
    useBestandsAblage.getState().setzen(schluessel(), daten(5), 5, basis());
    expect(ablageVorlaeufig(useBestandsAblage.getState(), schluessel(), basis())).toBe(false);
    // Der Fehlerpfad entwertet — dann steht der Rückfall, nicht der alte Stand.
    useBestandsAblage.getState().entwerten();
    markiereBestandGeaendert();
    expect(ablageVorlaeufig(useBestandsAblage.getState(), schluessel(), basis())).toBe(false);
  });

  it('ein Cold Start (nichts gelesen) wird nie zum vorläufigen Stand', () => {
    useBestandsAblage.getState().setzen(schluessel(), daten(0), 0, basis());
    markiereBestandGeaendert();
    expect(ablageVorlaeufig(useBestandsAblage.getState(), schluessel(), basis())).toBe(false);
  });
});

describe('bestandsSchluessel', () => {
  it('trennt nach Fassung, Bereich und Stichtag-TAG', () => {
    const a = bestandsSchluessel(VERSION, null, '2026-08-18T10:00:00.000Z');
    // Dieselbe Fassung, derselbe Tag, anderer Bereich → anderer Schlüssel.
    expect(bestandsSchluessel(VERSION, new Set(['16']), '2026-08-18T10:00:00.000Z')).not.toBe(a);
    // Derselbe Tag zu anderer Uhrzeit → derselbe Schlüssel (nur der TAG zählt).
    expect(bestandsSchluessel(VERSION, null, '2026-08-18T23:59:00.000Z')).toBe(a);
    // Der Tag danach → anderer Schlüssel: alle Liegezeiten sind relativ zu ihm.
    expect(bestandsSchluessel(VERSION, null, '2026-08-19T00:01:00.000Z')).not.toBe(a);
  });

  it('unterscheidet zwei Fassungen mit gleicher Nummer am Zeitstempel', () => {
    const alt = { version: 3, zeitstempel: '2026-08-01T00:00:00.000Z' } as MappingVersion;
    const neu = { version: 3, zeitstempel: '2026-08-17T00:00:00.000Z' } as MappingVersion;
    expect(bestandsSchluessel(alt, null, '2026-08-18T10:00:00.000Z'))
      .not.toBe(bestandsSchluessel(neu, null, '2026-08-18T10:00:00.000Z'));
  });

  it('die Bereichs-Menge geht sortiert ein — die Reihenfolge darf nichts ändern', () => {
    const stichtag = '2026-08-18T10:00:00.000Z';
    expect(bestandsSchluessel(VERSION, new Set(['16KN', '16EP']), stichtag))
      .toBe(bestandsSchluessel(VERSION, new Set(['16EP', '16KN']), stichtag));
  });

  it('ein Bestandswechsel ändert den Schlüssel', () => {
    const stichtag = '2026-08-18T10:00:00.000Z';
    const vorher = bestandsSchluessel(VERSION, null, stichtag);
    markiereBestandGeaendert();
    expect(bestandsSchluessel(VERSION, null, stichtag)).not.toBe(vorher);
  });
});

/**
 * Der Schlüssel trägt die Generation — also muss der LESER ihr folgen können.
 *
 * Ohne dieses Abo läse ein gemounteter Leser den Stand genau einmal ab und
 * bliebe nach einem Import auf der alten Generation stehen, während der Lauf
 * sein Ergebnis unter der neuen ablegt. Die beiden fänden sich nie wieder: die
 * Startseite zeigte bis zum Sitzungsende die To-dos von VOR dem Import, und
 * `laeuftNoch` bliebe dauerhaft wahr. Das ist kein Tempo-, sondern ein
 * Wahrheitsproblem — deshalb steht der Test hier und nicht in einer Messung.
 */
describe('subscribeBestandGeneration', () => {
  it('meldet jeden Bestandswechsel und hört nach dem Abmelden auf', () => {
    let gerufen = 0;
    const abmelden = subscribeBestandGeneration(() => { gerufen += 1; });

    markiereBestandGeaendert();
    expect(gerufen).toBe(1);
    markiereBestandGeaendert();
    expect(gerufen).toBe(2);

    abmelden();
    markiereBestandGeaendert();
    expect(gerufen).toBe(2);
  });

  it('bedient mehrere Leser — sie teilen sich eine Ablage', () => {
    const gesehen: string[] = [];
    const ab1 = subscribeBestandGeneration(() => gesehen.push('startseite'));
    const ab2 = subscribeBestandGeneration(() => gesehen.push('liste'));
    markiereBestandGeaendert();
    expect(gesehen).toEqual(['startseite', 'liste']);
    ab1(); ab2();
  });
});
