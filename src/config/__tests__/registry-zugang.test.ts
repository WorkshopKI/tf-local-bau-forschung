/**
 * Wer darf die Skill-Registry schreiben, und wer sieht die Inline-Werkstatt?
 *
 * Der Test fährt die ECHTEN `configs/*.json` durch dieselbe Merge-Kette wie der
 * Build (`deepMerge(_shared, variante)`, siehe build-with-config.mjs:82) — eine
 * Handtabelle würde genau dann falsch, wenn jemand einen Flag in einer Variante
 * umstellt, also im einzigen Fall, der zählt.
 *
 * Warum das nicht direkt gegen `canEditSkillRegistry` läuft: Vitest verdrahtet
 * `__TEAMFLOW_CONFIG__` fest auf `variant: 'development'` (vitest.config.mts) —
 * jede Funktion mit `runtimeConfig`-Zugriff liefert im Test IMMER den dev-Fall.
 * Deshalb die reine Schicht mit `RegistryUmgebung` als Argument.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
// @ts-expect-error — reines Node-ESM-Modul ohne Typen (Build-Layer, kein src/).
import { deepMerge } from '../../../scripts/config-schema.mjs';
import { registryEditierbar, werkstattZugang, type RegistryUmgebung } from '../registry-zugang';

type Config = Record<string, unknown>;

const REPO = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');
const lade = (datei: string): Config =>
  JSON.parse(readFileSync(join(REPO, 'configs', datei), 'utf-8')) as Config;

const shared = lade('_shared.json');

/** Bildet exakt ab, was `registryUmgebung()` zur Laufzeit aus der Config liest. */
function umgebung(variante: string, sessionAktiv: boolean): RegistryUmgebung {
  const c = deepMerge(shared, lade(`${variante}.config.json`)) as Config;
  const f = (c.features ?? {}) as Config;
  return {
    devKontext: c.variant === 'development' || c.variant === 'custom',
    skillVerwaltung: f.skillVerwaltung === true,
    datenShareSchreibrecht: f.datenShareSchreibrecht === true,
    kuratorMenus: f.kuratorMenus === true,
    sessionAktiv,
  };
}

/** Erwartung je Variante: [editierbar, sichtbar] ohne Session / mit Session. */
const MATRIX: Record<string, { ohne: [boolean, boolean]; mit: [boolean, boolean] }> = {
  // Entwickler-Kontexte — `local` MUSS dabei sein, dort läuft die Selbstabnahme.
  dev: { ohne: [true, true], mit: [true, true] },
  local: { ohne: [true, true], mit: [true, true] },
  // Schreibrecht auf dem Share ohne Kurator-Menüs → pl und as editieren direkt.
  pl: { ohne: [true, true], mit: [true, true] },
  as: { ohne: [true, true], mit: [true, true] },
  // Kurator hat das Schreibrecht, aber erst nach dem Login.
  kurator: { ohne: [false, false], mit: [true, true] },
  // prod: kein Schreibrecht, keine Skill-Verwaltung, keine Session erreichbar.
  prod: { ohne: [false, false], mit: [true, false] },
};

describe('Registry-Zugang über die echten Varianten-Configs', () => {
  for (const [variante, erwartet] of Object.entries(MATRIX)) {
    it(`${variante}: editierbar/sichtbar wie festgelegt`, () => {
      for (const [sessionAktiv, [edit, sicht]] of [
        [false, erwartet.ohne] as const,
        [true, erwartet.mit] as const,
      ]) {
        const u = umgebung(variante, sessionAktiv);
        expect(registryEditierbar(u), `${variante} editierbar (Session ${sessionAktiv})`).toBe(edit);
        expect(werkstattZugang(u).sichtbar, `${variante} sichtbar (Session ${sessionAktiv})`).toBe(sicht);
      }
    });
  }

  it('pl und as sind auf den vier entscheidenden Flags deckungsgleich', () => {
    // Es gibt keinen sauberen Diskriminator zwischen beiden — würde jemand as
    // aussperren wollen, wäre die ehrliche Stelle `skillVerwaltung` in der Config,
    // nicht ein Sonderfall in dieser Logik.
    const { sessionAktiv: _a, ...pl } = umgebung('pl', false);
    const { sessionAktiv: _b, ...as } = umgebung('as', false);
    expect(as).toEqual(pl);
  });

  it('prod bekommt die Werkstatt auch mit (unerreichbarer) Session nicht', () => {
    expect(werkstattZugang(umgebung('prod', true)).sichtbar).toBe(false);
  });
});

describe('registryEditierbar ist verhaltensgleich zur abgelösten Fassung', () => {
  // Wörtliche Kopie der drei Zeilen, die vor der Extraktion in
  // `canEditSkillRegistry` standen — fängt eine vertauschte oder negierte
  // Bedingung bei der Umstellung.
  const alt = (u: RegistryUmgebung): boolean => {
    if (u.devKontext) return true;
    if (u.datenShareSchreibrecht && !u.kuratorMenus) return true;
    return u.sessionAktiv;
  };

  it('stimmt über alle 32 Flag-Kombinationen überein', () => {
    let geprueft = 0;
    for (const devKontext of [false, true]) {
      for (const skillVerwaltung of [false, true]) {
        for (const datenShareSchreibrecht of [false, true]) {
          for (const kuratorMenus of [false, true]) {
            for (const sessionAktiv of [false, true]) {
              const u = { devKontext, skillVerwaltung, datenShareSchreibrecht, kuratorMenus, sessionAktiv };
              expect(registryEditierbar(u), JSON.stringify(u)).toBe(alt(u));
              geprueft++;
            }
          }
        }
      }
    }
    expect(geprueft).toBe(32);
  });

  it('koppelt die Sichtbarkeit zusätzlich an die Skill-Verwaltung', () => {
    const basis = { devKontext: true, datenShareSchreibrecht: true, kuratorMenus: false, sessionAktiv: true };
    expect(registryEditierbar({ ...basis, skillVerwaltung: false })).toBe(true);
    expect(werkstattZugang({ ...basis, skillVerwaltung: false }).sichtbar).toBe(false);
  });
});
