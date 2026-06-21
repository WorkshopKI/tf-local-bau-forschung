/**
 * Pure Orchestrierungs-Helfer der Eval-CLI: Resume-Schlüssel, JSONL-Lesen/
 * -Schreiben, Kombinations-Bildung (mit KN-Skip) und Pending-Filter. Bewusst
 * OHNE File-I/O — die Disk-Shell lebt in `cli.ts`. So bleibt die kniffligste
 * Logik (Resume-Dedup, KN-Skip) unter Test, obwohl die CLI selbst I/O-gebunden
 * und nur per Dry-Run verifizierbar ist.
 */
import type { StepId } from '@/plugins/antraege/gutachten/types';
import type { SectionDef } from './registry-load';
import type { EvalKontext, EvalModelConfig, Fixture } from './types';

/** Eine auszuführende Einheit: ein Fixture × ein Modell × ein Abschnitt × eine Kontext-Variante. */
export interface Combo {
  fixture: Fixture;
  modell: EvalModelConfig;
  abschnitt: StepId;
  skillId: string;
  kontext: EvalKontext;
}

/**
 * Stabiler Resume-Schlüssel `(vbFile × modell × abschnitt [× kontext])`. `'voll'`
 * hängt KEIN Suffix an → Alt-Ergebnisdateien (ohne Kontext-Achse) bleiben
 * resumebar; nur `'relevant'` wird per Suffix disambiguiert.
 */
export function comboKey(vbFile: string, modellId: string, abschnitt: StepId, kontext: EvalKontext = 'voll'): string {
  const base = `${vbFile} ${modellId} ${abschnitt}`;
  return kontext === 'voll' ? base : `${base} ${kontext}`;
}

/** Schlüssel einer Kombination (für Pending-Filter + Persistenz-Lookup). */
export function keyOfCombo(c: Combo): string {
  return comboKey(c.fixture.vbFile, c.modell.id, c.abschnitt, c.kontext);
}

/** Serialisiert ein Objekt als JSONL-Zeile (inkl. abschließendem `\n`). */
export function serializeJsonl(obj: unknown): string {
  return `${JSON.stringify(obj)}\n`;
}

/** Parst JSONL tolerant — leere/unparsebare Zeilen werden übersprungen. */
export function parseJsonl<T>(text: string): T[] {
  const out: T[] = [];
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (t === '') continue;
    try {
      out.push(JSON.parse(t) as T);
    } catch {
      // kaputte Zeile (z.B. abgebrochener Schreibvorgang) überspringen
    }
  }
  return out;
}

/** Behält je Schlüssel nur das LETZTE Vorkommen (Resume kann Zeilen duplizieren). */
export function dedupeLastByKey<T>(items: T[], keyFn: (item: T) => string): T[] {
  const byKey = new Map<string, T>();
  for (const item of items) byKey.set(keyFn(item), item);
  return [...byKey.values()];
}

/**
 * Bildet alle Kombinationen. KN-Fixtures werden ausgelassen (es gibt noch keinen
 * KN-Workflow) und separat zurückgegeben, damit die CLT sie LOGGEN kann (kein
 * stiller Drop).
 */
export function buildCombos(
  fixtures: Fixture[],
  modelle: EvalModelConfig[],
  sections: SectionDef[],
  kontexte: EvalKontext[] = ['voll'],
): { combos: Combo[]; skippedKN: Fixture[] } {
  const skippedKN = fixtures.filter(f => f.antragstyp === 'KN');
  const epFixtures = fixtures.filter(f => f.antragstyp !== 'KN');
  const combos: Combo[] = [];
  for (const fixture of epFixtures) {
    for (const modell of modelle) {
      for (const section of sections) {
        for (const kontext of kontexte) {
          combos.push({ fixture, modell, abschnitt: section.abschnitt, skillId: section.skillId, kontext });
        }
      }
    }
  }
  return { combos, skippedKN };
}

/** Kombinationen, deren Resume-Schlüssel NICHT in `doneKeys` steht. */
export function pendingCombos(combos: Combo[], doneKeys: ReadonlySet<string>): Combo[] {
  return combos.filter(c => !doneKeys.has(keyOfCombo(c)));
}
