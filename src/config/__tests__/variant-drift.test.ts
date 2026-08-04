/**
 * Guard gegen Feature-Drift zwischen den Varianten `as` und `pl`.
 *
 * Die Zusage lautet: **as ist pl ohne das Auslastungs-Modul** — sonst nichts.
 * Bis v2.403.0 stimmte das nicht. pl bekam über viele Versionen neue Opt-in-
 * Features (`statusCockpit`, `vorgangssystem`, `mapFoerderfaehig`,
 * `nfNachforderungen`, `artefaktWerkbank`, `antragAufbereitung`,
 * `workflowEntwuerfe`, `feedbackDelete`), `configs/as.config.json` wurde nie
 * nachgezogen — am Ende waren es ZWÖLF abweichende Flags statt vier. AS-Nutzern
 * fehlten drei komplette Sidebar-Bereiche, über mehrere Versionen hinweg.
 *
 * Warum das durchrutschen konnte: kein Test verglich zwei Varianten MITEINANDER.
 * `local-config.test.ts` prüft jede Config nur für sich auf `valid`,
 * `registry-zugang.test.ts` vergleicht as/pl nur auf vier unverwandte Flags.
 *
 * Dieser Test wird rot, sobald ein Flag in pl gesetzt wird, das in as fehlt (und
 * umgekehrt). Das ist Absicht: Nachziehen ist der Normalfall, eine gewollte
 * Abweichung gehört begründet in `ERWARTETE_ABWEICHUNGEN`.
 *
 * Verglichen werden EFFEKTIVE Werte, nicht die rohen JSON-Felder — sonst
 * meldete `kuerzelDropdown` einen Unterschied, den es zur Laufzeit nicht gibt
 * (as setzt ihn explizit, pl leitet ihn aus `auslastung` ab).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
// @ts-expect-error — reines Node-ESM-Modul ohne Typen (Build-Layer, kein src/).
import { deepMerge } from '../../../scripts/config-schema.mjs';

type Config = Record<string, unknown>;

const REPO = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');
const lade = (datei: string): Config =>
  JSON.parse(readFileSync(join(REPO, 'configs', datei), 'utf-8')) as Config;

const shared = lade('_shared.json');
/** Dieselbe Merge-Kette wie der Build (build-with-config.mjs:82). */
const gemergt = (name: string): Config => deepMerge(shared, lade(`${name}.config.json`)) as Config;

const AS = gemergt('as');
const PL = gemergt('pl');
const asF = AS.features as Config;
const plF = PL.features as Config;

const ALLE_FLAGS: string[] = [...new Set([...Object.keys(asF), ...Object.keys(plF)])].sort();

/**
 * Die vier Flags, in denen sich as und pl unterscheiden DÜRFEN — und nur diese.
 * Alle vier gehören zum Auslastungs-Modul; in as jeweils `false`.
 *
 * Wer hier etwas ergänzt, ändert die Definition der as-Variante. Das ist eine
 * fachliche Entscheidung, keine Aufräumarbeit: Begründung dazuschreiben und
 * `docs/architecture/build-varianten.md` mitziehen.
 */
const ERWARTETE_ABWEICHUNGEN = new Set([
  'auslastung',                 // das Modul selbst (Sidebar-Eintrag + Route)
  'auslastungSelbstEintragung', // Home-Widget „Neue Anträge für dich"
  'deAnonymisierung',           // Klartext-Kürzel im Modul
  'maVerwaltungPasswort',       // Zugangspasswort-Generator im Modul
]);

/**
 * Spiegelt die Ableitungen aus `src/config/feature-flags.ts`, die NICHT der
 * Standardform `=== true` folgen. Ohne sie meldete der Vergleich Unterschiede,
 * die zur Laufzeit keine sind.
 *
 * Nicht aufgeführt und bewusst über den Default abgedeckt: `workflowEntwuerfe`
 * (`?? variant === 'development'`, feature-flags.ts:201) — beide Varianten sind
 * `production`, dort fällt die Ableitung mit `=== true` zusammen. Der Test
 * darunter hält diese Voraussetzung fest.
 */
function effektiv(f: Config, flag: string): boolean {
  switch (flag) {
    // :78 — fällt auf `auslastung` zurück (as setzt explizit, pl leitet ab).
    case 'kuerzelDropdown':
      return f.kuerzelDropdown === true || f.auslastung === true;
    // :108 — expliziter Boolean gewinnt, sonst `auslastung`.
    case 'auslastungSelbstEintragung':
      return typeof f.auslastungSelbstEintragung === 'boolean'
        ? f.auslastungSelbstEintragung
        : f.auslastung === true;
    // :88 — fehlender Flag heißt „erlaubt", nicht „aus".
    case 'embeddingCorpusBuild':
      return f.embeddingCorpusBuild !== false;
    // :358 — ohne Katalog keine Codes.
    case 'vorgangssystem':
      return f.vorgangssystem === true && f.statusCockpit === true;
    default:
      return f[flag] === true;
  }
}

const zeige = (flag: string): string =>
  `${flag} (as=${effektiv(asF, flag)}, pl=${effektiv(plF, flag)})`;

describe('as bleibt pl ohne Auslastungs-Modul', () => {
  it('beide Varianten sind `production` (Voraussetzung der Flag-Normalisierung)', () => {
    // `workflowEntwuerfe` leitet sich sonst unterschiedlich ab und `effektiv()`
    // läge daneben, ohne dass es jemand merkt.
    expect(AS.variant).toBe('production');
    expect(PL.variant).toBe('production');
  });

  it('kein Flag driftet über die vier Auslastungs-Flags hinaus', () => {
    const abweichend = ALLE_FLAGS
      .filter(flag => !ERWARTETE_ABWEICHUNGEN.has(flag))
      .filter(flag => effektiv(asF, flag) !== effektiv(plF, flag))
      .map(zeige);

    expect(
      abweichend,
      `as und pl driften auseinander:\n  ${abweichend.join('\n  ')}\n\n` +
        'Regel: as = pl ohne Auslastungs-Modul. Fehlt ein pl-Flag in ' +
        'configs/as.config.json, dort nachziehen. Ist die Abweichung gewollt, ' +
        'in ERWARTETE_ABWEICHUNGEN (dieser Datei) mit Begründung eintragen und ' +
        'docs/architecture/build-varianten.md mitziehen.',
    ).toEqual([]);
  });

  it('die vier Auslastungs-Flags sind in as aus und in pl an', () => {
    for (const flag of ERWARTETE_ABWEICHUNGEN) {
      expect(effektiv(asF, flag), `${flag} muss in as aus sein`).toBe(false);
      expect(effektiv(plF, flag), `${flag} muss in pl an sein`).toBe(true);
    }
  });

  it('`kuerzelDropdown` ist roh verschieden, effektiv aber gleich', () => {
    // Dokumentiert die einzige Stelle, an der ein Blick in die JSON-Dateien in
    // die Irre führt — und beweist sie, statt sie wegzuerklären.
    expect(asF.kuerzelDropdown).toBe(true);
    expect(plF.kuerzelDropdown).toBeUndefined();
    expect(effektiv(asF, 'kuerzelDropdown')).toBe(effektiv(plF, 'kuerzelDropdown'));
  });

  it('erkennt ein neues, nur in pl gesetztes Flag', () => {
    // Selbsttest des Guards: ohne ihn wäre „grün" nicht unterscheidbar von
    // „vergleicht versehentlich nichts". Bewusst `toContain` statt `toEqual` —
    // ob SONST etwas driftet, ist Sache des Tests darüber; hier doppelt gemeldet
    // würde es die Fehlerausgabe nur verrauschen.
    const plMitNeuem = { ...plF, einNeuesFeature: true };
    const abweichend = [...new Set([...Object.keys(asF), ...Object.keys(plMitNeuem)])]
      .filter(flag => !ERWARTETE_ABWEICHUNGEN.has(flag))
      .filter(flag => effektiv(asF, flag) !== effektiv(plMitNeuem, flag));

    expect(abweichend).toContain('einNeuesFeature');
  });
});
