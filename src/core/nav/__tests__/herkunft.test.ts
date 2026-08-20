/**
 * Der Rückweg aus der Antrags-Detailseite (siehe `core/nav/herkunft.ts`).
 *
 * Vorgänger war ein Vermerk im `location.state`, den jeder Aufrufer selbst
 * setzen musste — gesetzt hat ihn genau einer. Gemessen am Vorgangs-Board:
 * Detail geöffnet, kein Rückweg, Schließen landete in der Förderanträge-Liste.
 * Die Fälle hier sind die Regeln, die das jetzt verhindern.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ANTRAEGE_ROUTE,
  SKILL_VERWALTUNG_ROUTE,
  detailSchliessenZiel,
  herkunftJetzt,
  istDetailRoute,
  merkeSeite,
  rueckwegAus,
} from '../herkunft';

const SCHLUESSEL = 'teamflow_letzte_seite';

// Vitest läuft node-only (siehe vitest.config.mts) — Speicher wie im Rest der
// Suite per stubGlobal, nicht per jsdom-Environment.
beforeEach(() => {
  const ablage = new Map<string, string>();
  vi.stubGlobal('sessionStorage', {
    getItem: (k: string) => ablage.get(k) ?? null,
    setItem: (k: string, v: string) => { ablage.set(k, v); },
    removeItem: (k: string) => { ablage.delete(k); },
    clear: () => { ablage.clear(); },
  });
});

describe('istDetailRoute', () => {
  it('erkennt die Detail-Routen, aber nicht die Liste', () => {
    expect(istDetailRoute('/antraege/16DS260261')).toBe(true);
    expect(istDetailRoute('/antraege/verbund/ZDS26026')).toBe(true);
    expect(istDetailRoute('/antraege/16DS260261/aufbereitung')).toBe(true);
    // Die Liste ist eine echte Station — sie darf Herkunft sein.
    expect(istDetailRoute('/antraege')).toBe(false);
    expect(istDetailRoute('/vorgangs-board')).toBe(false);
    expect(istDetailRoute('/suche')).toBe(false);
  });

  // v4.133: zweiter Wirt. Ohne diese Regel merkte sich die App den Deep-Link des
  // Widgets „Zuletzt geändert" als Station — der Rückweg böte dann „Zurück zur
  // Skill-Verwaltung", während man auf ihr steht.
  it('zählt auch den Deep-Link der Skill-Verwaltung zum Detail', () => {
    expect(istDetailRoute(`${SKILL_VERWALTUNG_ROUTE}/2f1c-…-9ab`)).toBe(true);
    // Die flache Route ist die LISTE und bleibt eine echte Station.
    expect(istDetailRoute(SKILL_VERWALTUNG_ROUTE)).toBe(false);
    // Der Kurations-Hub darüber ist keine Detail-Route der Skill-Verwaltung.
    expect(istDetailRoute('/kuration')).toBe(false);
  });
});

describe('merkeSeite', () => {
  it('merkt eine besuchte Seite mit Pfad und Namen', () => {
    merkeSeite('/vorgangs-board', 'Vorgangs-Board');
    expect(herkunftJetzt()).toEqual({ route: '/vorgangs-board', label: 'Vorgangs-Board' });
  });

  it('behält die Query, damit ein Panel-Ziel wieder trifft', () => {
    merkeSeite('/kuration?panel=csv-quellen', 'Kuration');
    expect(herkunftJetzt()?.route).toBe('/kuration?panel=csv-quellen');
  });

  it('übergeht Detail-Routen — die Herkunft bleibt stehen', () => {
    merkeSeite('/vorgangs-board', 'Vorgangs-Board');
    merkeSeite('/antraege/16DS260261', 'Förderanträge');
    merkeSeite('/antraege/verbund/ZDS26026?ziel=meilensteine', 'Förderanträge');
    // Genau der Weitersprung-Fall: im Detail von TV zu TV, Herkunft unverändert.
    expect(herkunftJetzt()).toEqual({ route: '/vorgangs-board', label: 'Vorgangs-Board' });
  });

  it('übergeht den Skill-Deep-Link — die Startseite bleibt der Rückweg', () => {
    merkeSeite('/', 'Home');
    merkeSeite(`${SKILL_VERWALTUNG_ROUTE}/2f1c-…-9ab`, 'Skill-Verwaltung');
    expect(herkunftJetzt()).toEqual({ route: '/', label: 'Home' });
  });

  it('merkt nichts ohne Namen', () => {
    merkeSeite('/irgendwo', '');
    expect(herkunftJetzt()).toBeNull();
  });
});

describe('herkunftJetzt — toleranter Leser', () => {
  it('liest Fremdinhalt als „keine Herkunft"', () => {
    for (const roh of ['', 'kein json', 'null', '42', '"text"', '{}', '{"route":"/x"}',
      '{"label":"X"}', '{"route":"","label":"X"}', '{"route":"/x","label":""}',
      '{"route":7,"label":"X"}']) {
      sessionStorage.setItem(SCHLUESSEL, roh);
      expect(herkunftJetzt(), roh).toBeNull();
    }
  });
});

describe('rueckwegAus', () => {
  it('gibt Route und Seitennamen weiter — der Pfeil macht daraus den Satz', () => {
    expect(rueckwegAus({ route: '/suche', label: 'Suche' }, ANTRAEGE_ROUTE))
      .toEqual({ route: '/suche', label: 'Suche' });
  });

  it('bietet keinen Knopf ohne Herkunft', () => {
    expect(rueckwegAus(null, ANTRAEGE_ROUTE)).toBeNull();
  });

  it('bietet keinen Knopf für die Förderanträge-Liste selbst', () => {
    // Die Liste steht neben dem Detail, und das X führt ohnehin dorthin.
    expect(rueckwegAus({ route: '/antraege', label: 'Förderanträge' }, ANTRAEGE_ROUTE)).toBeNull();
    expect(rueckwegAus({ route: '/antraege?x=1', label: 'Förderanträge' }, ANTRAEGE_ROUTE)).toBeNull();
  });

  // Die Sonderregel von oben ist seit v4.133 die allgemeine: jeder Wirt nennt
  // seine eigene Route. Ein Knopf „Zurück zur Skill-Verwaltung" auf der
  // Skill-Verwaltung täte nichts.
  it('schweigt für die eigene Route, antwortet für eine fremde', () => {
    const eigen = { route: SKILL_VERWALTUNG_ROUTE, label: 'Skill-Verwaltung' };
    expect(rueckwegAus(eigen, SKILL_VERWALTUNG_ROUTE)).toBeNull();
    // Dieselbe Herkunft ist für einen ANDEREN Wirt ein gültiger Rückweg.
    expect(rueckwegAus(eigen, ANTRAEGE_ROUTE)).toEqual(eigen);
    expect(rueckwegAus({ route: '/', label: 'Home' }, SKILL_VERWALTUNG_ROUTE))
      .toEqual({ route: '/', label: 'Home' });
  });
});

describe('detailSchliessenZiel', () => {
  it('führt zur Herkunft zurück', () => {
    expect(detailSchliessenZiel({ route: '/vorgangs-board', label: 'Vorgangs-Board' }))
      .toBe('/vorgangs-board');
  });

  it('bleibt sonst bei der Förderanträge-Liste', () => {
    expect(detailSchliessenZiel(null)).toBe(ANTRAEGE_ROUTE);
    expect(detailSchliessenZiel({ route: '/antraege', label: 'Förderanträge' })).toBe(ANTRAEGE_ROUTE);
  });
});
