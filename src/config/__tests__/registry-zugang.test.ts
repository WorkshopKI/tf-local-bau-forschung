/**
 * Registry-Zugang über die ECHTEN Varianten-Configs + eine explizite
 * Wahrheitstabelle.
 *
 * v3.0: Der Term `&& !u.kuratorMenus` ist entfallen — er hiess woertlich
 * „pl/as, aber nicht kurator" und war der einzige verkappte Varianten-Test im
 * `src/`-Baum. Nach der Zusammenlegung muss `kuratorMenus` auch in pl auf `true`
 * stehen, der Term haette PL-Nutzern also still das Schreibrecht auf die
 * Skill-Registry genommen. Die frühere „verhaltensgleich zur abgeloesten
 * Fassung"-Probe ist damit gegenstandslos: das Verhalten SOLL sich hier
 * unterscheiden. An ihre Stelle tritt die Tabelle unten.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { registryEditierbar, werkstattZugang, type RegistryUmgebung } from '../registry-zugang';
// @ts-expect-error — reines Node-ESM-Modul ohne Typen (Build-Layer, kein src/).
import { deepMerge, buildBasis } from '../../../scripts/config-schema.mjs';

type Config = Record<string, unknown>;

const lade = (datei: string): Config =>
  JSON.parse(readFileSync(resolve('configs', datei), 'utf-8'));

const shared = lade('_shared.json');

/**
 * Alle real gebauten Varianten — GEGLOBBT, nicht gepflegt. Eine harte Liste hat
 * `zah-demo` und `as` noch lange nach ihrem Verschwinden mitgeschleppt.
 */
const VARIANTEN = readdirSync(resolve('configs'))
  .filter(f => f.endsWith('.config.json'))
  .map(f => f.replace('.config.json', ''))
  .sort();

/** Bildet exakt ab, was `registryUmgebung()` zur Laufzeit aus der Config liest. */
function umgebung(variante: string, sessionAktiv: boolean): RegistryUmgebung {
  const c = deepMerge(deepMerge(buildBasis(), shared), lade(`${variante}.config.json`)) as Config;
  const f = (c.features ?? {}) as Config;
  return {
    devKontext: c.variant === 'development' || c.variant === 'custom',
    skillVerwaltung: f.skillVerwaltung === true,
    datenShareSchreibrecht: f.datenShareSchreibrecht === true,
    sessionAktiv,
  };
}

/** Erwartung je Variante: [editierbar, sichtbar] ohne Session / mit Session. */
const MATRIX: Record<string, { ohne: [boolean, boolean]; mit: [boolean, boolean] }> = {
  // Entwickler-Kontexte — `local` MUSS dabei sein, dort läuft die Selbstabnahme.
  // `local-fiktiv` ist ihre Schwester auf einer rein fiktiven Datenwurzel (Messungen
  // gegen die interne KI ohne echte Antragsdaten) und teilt deshalb ihre Zeile.
  dev: { ohne: [true, true], mit: [true, true] },
  local: { ohne: [true, true], mit: [true, true] },
  'local-fiktiv': { ohne: [true, true], mit: [true, true] },
  // Schreibrecht auf dem Share → pl editiert direkt, OHNE Kurator-Freischaltung.
  // Genau das hätte der alte `!kuratorMenus`-Term nach der Zusammenlegung gekippt.
  pl: { ohne: [true, true], mit: [true, true] },
  // prod: kein Schreibrecht, keine Skill-Verwaltung, keine Session erreichbar.
  prod: { ohne: [false, false], mit: [true, false] },
};

describe('Registry-Zugang über die echten Varianten-Configs', () => {
  it('die Matrix deckt jede gebaute Variante ab (keine still dazugekommene)', () => {
    expect(Object.keys(MATRIX).sort()).toEqual(VARIANTEN);
  });

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

  it('prod bekommt die Werkstatt auch mit (unerreichbarer) Session nicht', () => {
    expect(werkstattZugang(umgebung('prod', true)).sichtbar).toBe(false);
  });
});

describe('registryEditierbar — vollständige Wahrheitstabelle', () => {
  it('acht Kombinationen, drei Fakten', () => {
    const faelle: Array<[RegistryUmgebung, boolean, string]> = [];
    for (const devKontext of [false, true]) {
      for (const datenShareSchreibrecht of [false, true]) {
        for (const sessionAktiv of [false, true]) {
          const u: RegistryUmgebung = { devKontext, skillVerwaltung: true, datenShareSchreibrecht, sessionAktiv };
          // Erwartung als ODER der drei Fakten — bewusst neu formuliert statt aus
          // der Implementierung kopiert, sonst prüfte der Test sich selbst.
          const erwartet = devKontext || datenShareSchreibrecht || sessionAktiv;
          faelle.push([u, erwartet, JSON.stringify(u)]);
        }
      }
    }
    expect(faelle).toHaveLength(8);
    for (const [u, erwartet, label] of faelle) {
      expect(registryEditierbar(u), label).toBe(erwartet);
    }
  });

  it('ohne alle drei Fakten bleibt die Registry zu (der prod-Fall)', () => {
    expect(registryEditierbar({
      devKontext: false, skillVerwaltung: true, datenShareSchreibrecht: false, sessionAktiv: false,
    })).toBe(false);
  });

  it('koppelt die Sichtbarkeit zusätzlich an die Skill-Verwaltung', () => {
    const basis = { devKontext: true, datenShareSchreibrecht: true, sessionAktiv: true };
    expect(registryEditierbar({ ...basis, skillVerwaltung: false })).toBe(true);
    expect(werkstattZugang({ ...basis, skillVerwaltung: false }).sichtbar).toBe(false);
  });
});
