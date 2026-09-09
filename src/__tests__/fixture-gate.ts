/**
 * Torwächter für Tests, die an lokal vorhandene Fixtures gebunden sind.
 *
 * DAS PROBLEM, das er löst. Mehrere Testblöcke laufen nur, wenn eine Datei da
 * ist, die per `.gitignore` bewusst NICHT im Repo liegt (`docs/fixtures/*.csv`,
 * `fixtures-local/`). Bis v6.44 schaltete jeder von ihnen sich selbst ab —
 * `const beschreibe = vorhanden ? describe : describe.skip` — und sagte dabei
 * nichts. Auf der Dev-Maschine liefen sie, auf einem frischen Klon verschwanden
 * sie wortlos, und der Lauf blieb grün. Zwei Entwickler führten aus demselben
 * Commit unterschiedliche Testmengen aus, ohne dass die Ausgabe das verriet.
 *
 * Ein Test, der still nicht läuft, ist schlimmer als einer, der fehlt: der
 * fehlende ist sichtbar.
 *
 * DIE REGEL. Das Auslassen bleibt erlaubt — die Fixtures sind aus gutem Grund
 * lokal (echte Exportdaten). Es muss sich nur MELDEN. Wer einen fixture-
 * gebundenen Block schreibt, nimmt diesen Wächter; er sagt beim Überspringen,
 * WAS ausfällt und WARUM, mit Pfad.
 *
 * Der Guard `fixture-gate-meldet-sich` in conventions-clean-code.test.ts hält
 * fest, dass niemand wieder von Hand auf `describe.skip` ausweicht.
 */
import { describe } from 'vitest';
import { existsSync } from 'node:fs';

/** Ein Block, der auf dieser Maschine nicht lief — für die Schluss-Bilanz. */
export interface AusgelasseneGruppe {
  name: string;
  grund: string;
  pfad: string;
}

const ausgelassen: AusgelasseneGruppe[] = [];

/** Was auf dieser Maschine nicht lief. Leer heisst: alles lief. */
export function ausgelasseneGruppen(): readonly AusgelasseneGruppe[] {
  return ausgelassen;
}

/**
 * `describe`, wenn die Fixture da ist — sonst `describe.skip` MIT Ansage.
 *
 * @param name    Name des Blocks, wie ihn `describe` bekäme.
 * @param pfad    Die Datei oder das Verzeichnis, an dem der Block hängt. Wird
 *                mitgemeldet, damit man weiss, was zu besorgen wäre.
 * @param grund   Ein Satz: warum liegt das nicht im Repo?
 */
export function beschreibeMitFixture(
  name: string,
  pfad: string,
  grund: string,
  fn: () => void,
): void {
  if (existsSync(pfad)) {
    describe(name, fn);
    return;
  }
  melde(name, pfad, grund);
  describe.skip(name, fn);
}

/**
 * Vermerkt die Auslassung. Die LAUTE Meldung macht der Waechter
 * `fixture-tore-melden-sich` in conventions-clean-code.test.ts.
 *
 * Warum nicht hier per `console.warn`: das war der erste Anlauf, und er war
 * wirkungslos. Vitest 4 zeigt Konsolen-Ausgaben bestandener Tests im
 * Standard-Reporter NICHT an — weder aus der Sammelphase noch aus einem
 * laufenden Test (nachgemessen mit einer Sonde: `console.warn` in einem gruenen
 * Test erscheint nirgends). Der Lauf meldete weiterhin nur „2 skipped".
 *
 * Der einzige Kanal, den dieser Reporter zuverlaessig zeigt, ist ein ROTER Test.
 * Deshalb faellt die Meldung dort — mit einer ausdruecklichen Quittung, damit
 * ein Rechner ohne Fixtures nicht dauerhaft rot bleibt.
 */
function melde(name: string, pfad: string, grund: string): void {
  ausgelassen.push({ name, grund, pfad });
}

/**
 * Wie `beschreibeMitFixture`, aber die Bedingung wird selbst mitgebracht —
 * für Blöcke, die an einer MENGE hängen (z.B. „mindestens eine .msg im Ordner")
 * statt an einer einzelnen Datei.
 */
export function beschreibeWenn(
  name: string,
  bedingung: boolean,
  pfad: string,
  grund: string,
  fn: () => void,
): void {
  if (bedingung) {
    describe(name, fn);
    return;
  }
  melde(name, pfad, grund);
  describe.skip(name, fn);
}
