/**
 * Modul-lokale Konventionen des MAP-Plugins.
 *
 * Bewusst hier statt in `src/__tests__/codebase-conventions.test.ts`: die Regeln
 * gelten nur für dieses Plugin, und der globale Guard-Aggregator ist bereits
 * dicht an seiner LOC-Grenze.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const PLUGIN_WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function sammleDateien(verzeichnis: string, endungen: string[]): string[] {
  const treffer: string[] = [];
  for (const eintrag of readdirSync(verzeichnis)) {
    const voll = path.join(verzeichnis, eintrag);
    if (statSync(voll).isDirectory()) {
      if (eintrag === 'fixtures' || eintrag === 'fixtures-local') continue;
      treffer.push(...sammleDateien(voll, endungen));
    } else if (endungen.some(e => eintrag.endsWith(e))) {
      treffer.push(voll);
    }
  }
  return treffer;
}

const QUELLDATEIEN = sammleDateien(PLUGIN_WURZEL, ['.ts', '.tsx'])
  .filter(f => !f.includes(`${path.sep}__tests__${path.sep}`));

/**
 * Entfernt Block- und Zeilenkommentare. Die Guards unten prüfen CODE — eine
 * Fallbeschreibung im Kommentar ist erwünscht und darf nicht als Verstoss
 * gelten. Grob, aber für diesen Zweck ausreichend: es geht um Feldnamen-Literale,
 * nicht um eine Parser-genaue Analyse.
 */
function ohneKommentare(quelle: string): string {
  return quelle
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const CODE = new Map(QUELLDATEIEN.map(f => [f, ohneKommentare(readFileSync(f, 'utf-8'))]));

describe('MAP-Konventionen', () => {
  it('rechnet nie ueber normiertemonatskosten', () => {
    // Das Feld widerspricht im Echtfall der tatsaechlichen Rechnung (5.999
    // gegen effektiv 5.833 EUR/PM) und erzeugte damit Falsch-Befunde. Wahrheit
    // sind `gesamtkostenAP` und `pkma_number`.
    // `redaktion.ts` ausgenommen: dort steht der Feldname in der Verbotsliste
    // des Nachweis-Scans — er soll das Feld finden, nicht damit rechnen.
    const treffer = QUELLDATEIEN
      .filter(f => !f.endsWith(`import${path.sep}redaktion.ts`))
      .filter(f => /normiertemonatskosten/i.test(CODE.get(f)!));
    expect(treffer.map(f => path.relative(PLUGIN_WURZEL, f))).toEqual([]);
  });

  it('liest keine Pfade aus datenschutz-gesperrten Teilbaeumen', () => {
    // Die Deny-Liste ist Praefix-basiert. Ein Quellpfad-Literal aus einem
    // gesperrten Teilbaum wuerde die Sperre aushebeln und den Verworfen-
    // Nachweis im Import-Report unwahr machen.
    const gesperrt = [
      'personalbogen_editgrid',
      'data.bankverb',
      'data.plansprechpartner',
      'data.bevollmaechtigter',
    ];
    const verstoesse: string[] = [];
    for (const datei of QUELLDATEIEN) {
      if (datei.endsWith(`import${path.sep}redaktion.ts`)) continue;
      const inhalt = CODE.get(datei)!;
      for (const muster of gesperrt) {
        if (inhalt.includes(muster)) {
          verstoesse.push(`${path.relative(PLUGIN_WURZEL, datei)} → ${muster}`);
        }
      }
    }
    expect(verstoesse).toEqual([]);
  });

  it('faehrt den Substanz-Smoke nur gegen fiktive Fixtures', () => {
    // Schwester-Regel zu `eval-gui-fictional-only`: ein Messlauf schickt seinen
    // Eingang ans Modell. Zoege der Smoke einen echten Antrag heran, waere das
    // ein unbemerkter Datenabfluss in einem Werkzeug, das wie ein Testknopf
    // aussieht. Die Fixtures kommen ausschliesslich aus `kontrast.seed.ts`.
    const smokePfade = [
      `substanz${path.sep}smoke-runner.ts`,
      `components${path.sep}SubstanzSmokePanel.tsx`,
    ];
    const verboten = [
      'listAllAntraegeListView',
      'findVorhabensbeschreibung',
      'getEinreichung',
      'leseMapAnalyse',
      "'doc:",
      'useDokumenteStore',
    ];

    const verstoesse: string[] = [];
    for (const datei of QUELLDATEIEN.filter(f => smokePfade.some(p => f.endsWith(p)))) {
      const inhalt = CODE.get(datei)!;
      for (const muster of verboten) {
        if (inhalt.includes(muster)) {
          verstoesse.push(`${path.relative(PLUGIN_WURZEL, datei)} → ${muster}`);
        }
      }
    }
    expect(verstoesse).toEqual([]);

    // Und der Gegenbeweis: die Fixture-Quelle wird tatsaechlich benutzt.
    const runner = QUELLDATEIEN.find(f => f.endsWith(`substanz${path.sep}smoke-runner.ts`));
    expect(runner).toBeDefined();
    expect(CODE.get(runner!)).toContain('kontrast.seed');
  });

  it('aggregiert die KI-Zweitmeinung nirgends', () => {
    // Die Zusage des Features lautet: die Zweitmeinung erscheint AM ITEM nach der
    // eigenen Bewertung — und sonst nirgends. Kein Entwurf, kein Report, keine
    // Summe. Strukturell ist sie heute unerreichbar (sie lebt in `InfografikDaten`,
    // nicht in `MapItemBewertung`), aber genau das kann ein spaeterer Umbau
    // einreissen: ein Feld an der Bewertung, und sie liefe ueber `z.bewertung`
    // direkt in Gutachten und Ablehnung. Dieser Guard ist die Sperre dagegen.
    const gesperrteBereiche = [
      `abschluss${path.sep}`,
      `checkliste${path.sep}`,
      `import${path.sep}`,
      `ansicht${path.sep}gruppen.ts`,
      `ansicht${path.sep}bewertungs-signal.ts`,
      'useSubstanzAnsicht.ts',
    ];

    const verstoesse: string[] = [];
    for (const datei of QUELLDATEIEN) {
      if (!gesperrteBereiche.some(b => datei.includes(b))) continue;
      const inhalt = CODE.get(datei)!;
      if (/zweitmeinung/i.test(inhalt)) {
        verstoesse.push(path.relative(PLUGIN_WURZEL, datei));
      }
    }
    expect(verstoesse).toEqual([]);

    // Gegenbeweis: der Guard prueft ueberhaupt Dateien.
    expect(QUELLDATEIEN.some(f => gesperrteBereiche.some(b => f.includes(b)))).toBe(true);
  });

  it('haelt jede Nicht-Daten-Quelldatei unter 400 Zeilen', () => {
    // Kohaesion vor Zeilenzahl — aber Seed-/Daten-Files ausgenommen, die
    // duerfen laut project-structure.md groesser sein.
    const zuGross = QUELLDATEIEN
      .filter(f => !path.basename(f).endsWith('seed.ts'))
      .map(f => ({ f, zeilen: readFileSync(f, 'utf-8').split('\n').length as number }))
      .filter(x => x.zeilen > 400)
      .map(x => `${path.relative(PLUGIN_WURZEL, x.f)}: ${x.zeilen}`);
    expect(zuGross).toEqual([]);
  });
});
