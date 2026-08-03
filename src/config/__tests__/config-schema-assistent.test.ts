/**
 * Guard für die Abhängigkeit der drei Assistent-Phasen (v2.390.0).
 *
 * Phase 2 (`assistentGedaechtnis`) destilliert das Phase-0-Protokoll und speist
 * ausschliesslich den Phase-1-Panel-Kontext. Fehlt eine Vorstufe, liefe eine
 * Konsolidierung, die niemand ausloesen kann (die UI haengt in `ProfilTab`
 * hinter dem Protokoll-Gate) und deren Ergebnis niemand liest.
 *
 * Den POSITIV-Fall deckt `local-config.test.ts` mit ab (Schleife über alle
 * ausgelieferten Configs, erwartet `valid === true`). Hier steht der Negativ-Fall.
 */

import { describe, it, expect } from 'vitest';
// @ts-expect-error — reines Node-ESM-Modul ohne Typen (Build-Layer, kein src/).
import { validateConfig } from '../../../scripts/config-schema.mjs';

interface ValidationResult {
  errors: string[];
  warnings: string[];
  valid: boolean;
}
type Config = Record<string, unknown>;

/** Minimal-Config, die alle uebrigen Pflichtregeln erfuellt — nur die drei
 *  Assistent-Flags variieren je Test. */
const basis = (assistent: Record<string, boolean>): Config => ({
  configVersion: 2,
  variant: 'production',
  build: { label: 'T', outputFilename: 'test', browserTabTitle: 'T' },
  data: { allowUserToChangePath: true, allowLocalFallback: false },
  features: {
    kuratorMenus: false, feedback: true, dokumentenscan: false, volltextsuche: false,
    devInfraPanel: false, devFixtures: false, antraege: true, dokumente: false,
    auslastung: false, auslastungSelbstEintragung: false, deAnonymisierung: false,
    datenShareSchreibrecht: false, maLogin: false, maVerwaltungPasswort: false,
    suche: true, csvAutoRefresh: false,
    ...assistent,
  },
  menuLabels: { antraege: 'Förderanträge' },
  ki: { openrouter: { enabled: false }, localLlama: { enabled: true } },
});

const assistentFehler = (c: Config): string[] =>
  (validateConfig(c) as ValidationResult).errors.filter(e => e.includes('assistentGedaechtnis'));

describe('validateConfig — Assistent-Phasen bauen aufeinander auf', () => {
  it('akzeptiert alle drei Phasen gemeinsam aktiv', () => {
    const res = validateConfig(basis({
      assistentProtokoll: true, assistentPanel: true, assistentGedaechtnis: true,
    })) as ValidationResult;
    expect(res.valid, res.errors.join(' | ')).toBe(true);
  });

  it('bricht ab, wenn das Gedaechtnis ohne das Protokoll laeuft', () => {
    const fehler = assistentFehler(basis({ assistentPanel: true, assistentGedaechtnis: true }));
    expect(fehler.length).toBe(1);
    expect(fehler[0]).toContain('features.assistentProtokoll = true');
  });

  it('bricht ab, wenn das Gedaechtnis ohne das Panel laeuft', () => {
    const fehler = assistentFehler(basis({ assistentProtokoll: true, assistentGedaechtnis: true }));
    expect(fehler.length).toBe(1);
    expect(fehler[0]).toContain('features.assistentPanel = true');
  });

  it('nennt beide fehlenden Vorstufen in EINER Meldung', () => {
    const fehler = assistentFehler(basis({ assistentGedaechtnis: true }));
    expect(fehler.length).toBe(1);
    expect(fehler[0]).toContain('features.assistentPanel = true');
    expect(fehler[0]).toContain('features.assistentProtokoll = true');
  });

  it('schweigt, wenn keins der drei Flags gesetzt ist (prod-Fall, alle undefined)', () => {
    expect(assistentFehler(basis({}))).toEqual([]);
  });

  it('schweigt bei Protokoll/Panel ohne Gedaechtnis (Phase 0+1 allein ist zulaessig)', () => {
    expect(assistentFehler(basis({ assistentProtokoll: true, assistentPanel: true }))).toEqual([]);
  });
});
