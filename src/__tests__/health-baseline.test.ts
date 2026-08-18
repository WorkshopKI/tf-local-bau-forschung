/**
 * Codebase-Conventions — Struktur-Kennzahlen (Drift-Warnung, kein Verbot).
 *
 * Diese Schwellen fangen schleichende Verdopplung/Wildwuchs, nicht jeden
 * Feature-Zuwachs. Schlaegt eine Assertion fehl, ist die erste Frage „ist der
 * Zuwachs gewollt?" — wenn ja, die Konstante bewusst anheben.
 *
 * Geschwister-Dateien: conventions-status.test.ts, conventions-ui.test.ts, conventions-daten.test.ts.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  ROOT, ALL_TS_FILES, relPath,
} from './conventions-lib';

describe('health-baseline (Drift-Warnung, kein Verbot)', () => {
  // Schwellen mit BEWUSSTEM Puffer ueber dem Ist-Wert: sie sollen schleichende
  // Verdopplung/Wildwuchs fangen, NICHT jeden Feature-Zuwachs. Schlaegt eine
  // Assertion fehl, ist die erste Frage „ist der Zuwachs gewollt?" — wenn ja, die
  // Konstante bewusst anheben (und im CHANGELOG vermerken).
  //
  // Warum ein Wert so steht, sagt sein Kommentar; WIE er dahin kam, steht in Git
  // (CLAUDE.md Doku-Konvention 1). Beim Anheben also den Ist-Wert aktualisieren und
  // die Begruendung ERSETZEN, nicht eine weitere anhaengen — die angehaengte Kette
  // war bis v4.4 selbst der Grund, warum jeder Bump eine eigene Runde kostete.
  const MAX_FEATURE_FLAGS = 29;    // Ist 29 (v4.65: + sucheNatuerlicheSprache, dev/pl an, prod aus — die Suche ist die meistbenutzte Seite, deshalb erst Erprobung). Ein Flag lohnt sich nur, wenn er in den Varianten UNTERSCHIEDLICHE Werte hat — sonst ist er einkompilierte Wahrheit und gehoert weg (v3.0 hat auf diesem Weg elf Flags entfernt).
  const MAX_SERVICE_DIRS = 22;     // Ist 22. Ein eigener Ordner lohnt erst, wenn die Regeln darin Konsumenten in mehreren Plugins UND in core/ haben; sonst Plugin-Datei oder Submodul unter einem bestehenden Dach.
  // Getrennte Schwellen fuer Produktionscode und Tests (v4.5). Bis dahin galt EINE
  // Zahl fuer beides, und weil die Guard-Datei mit jeder Konvention wuchs, stand sie
  // bei 3250 — eine Decke, unter der jede Produktionsdatei sich haette verdreifachen
  // koennen, ohne dass der Test etwas sagt. Genau das war passiert: gemessen wurde
  // 3212 (die Guard-Datei), waehrend die groesste echte Datei unbemerkt von 846 auf
  // 1011 LOC gewachsen war.
  const MAX_FILE_LOC = 1200;       // Ist 1011 (useStatusCockpit.ts) — Produktionscode ohne Tests.
  const MAX_TEST_FILE_LOC = 1700;  // Ist 1633 (conventions-daten.test.ts). Testdateien duerfen groesser sein: ein Guard-Aggregat ist kohaerent, aber es soll nicht wieder auf das Dreifache laufen. Bewusst angehoben (v4.102.1, csv-quellordner-nicht-kopieordner) — der Guard sitzt thematisch richtig (Persistenz/Share); die Notiz stand vorher auf einem alten Ist-Wert.
  const MAX_UI_SHIM_IMPORTS = 0;   // Ist 0 — @/ui-Barrel vollständig auf @/components/ui/* migriert (v2.111); Dialog/Select nur noch als Adapter via @/ui/Dialog|Select (Subpfad, zählt nicht). Darf nur SINKEN.

  const drift = (was: string, ist: number, schwelle: number, hinweis: string): string =>
    `${was}: Ist-Wert ${ist} ueberschreitet die Baseline-Schwelle ${schwelle}.\n` +
    `${hinweis}\n` +
    `Schwelle bewusst anheben, wenn der Zuwachs gewollt ist — dieser Test ist eine ` +
    `Drift-Warnung, kein Verbot (Konstante oben im health-baseline-Block).`;

  it(`Anzahl features.*-Flags <= ${MAX_FEATURE_FLAGS}`, () => {
    const src = readFileSync(join(ROOT, 'config', 'feature-flags.ts'), 'utf-8');
    const flags = new Set<string>();
    for (const m of src.matchAll(/\bfeatures\.([A-Za-z][A-Za-z0-9_]*)/g)) flags.add(m[1]!);
    if (flags.size > MAX_FEATURE_FLAGS) {
      expect.fail(drift(
        'features.*-Flags (distinkt in src/config/feature-flags.ts)',
        flags.size, MAX_FEATURE_FLAGS,
        `Gefunden: ${[...flags].sort().join(', ')}.\n` +
        `Jedes neue Flag vergroessert die Build-Varianten-Matrix — pruefe, ob ein ` +
        `bestehendes Flag wiederverwendbar ist.`,
      ));
    }
  });

  it(`Top-Level-Verzeichnisse unter src/core/services/ <= ${MAX_SERVICE_DIRS}`, () => {
    const base = join(ROOT, 'core', 'services');
    const dirs = readdirSync(base).filter(e => statSync(join(base, e)).isDirectory());
    if (dirs.length > MAX_SERVICE_DIRS) {
      expect.fail(drift(
        'Service-Verzeichnisse unter src/core/services/',
        dirs.length, MAX_SERVICE_DIRS,
        `Gefunden: ${dirs.sort().join(', ')}.\n` +
        `Gehoeren mehrere Ordner zur selben Domaene (vgl. v2.89 skills/{run,registry,` +
        `tweaks})? Dann unter ein Dach mit Submodulen + Barrel buendeln.`,
      ));
    }
  });

  // Getrennt gemessen, damit eine wachsende Guard-Datei nie wieder die Decke fuer
  // den Produktionscode setzt (und umgekehrt ein Guard-Aggregat nicht am Mass der
  // Anwendungsdateien scheitert).
  const istTestdatei = (pfad: string): boolean =>
    pfad.includes('__tests__') || pfad.includes('.test.');

  const groesste = (nurTests: boolean): { loc: number; datei: string } => {
    let loc = 0;
    let datei = '';
    for (const file of ALL_TS_FILES) {
      const rel = relPath(file);
      if (istTestdatei(rel) !== nurTests) continue;
      const l = readFileSync(file, 'utf-8').split(/\r?\n/).length;
      if (l > loc) { loc = l; datei = rel; }
    }
    return { loc, datei };
  };

  it(`Groesste Produktionsdatei unter src/ <= ${MAX_FILE_LOC} LOC`, () => {
    const { loc, datei } = groesste(false);
    if (loc > MAX_FILE_LOC) {
      expect.fail(drift(
        'Groesste src/-Produktionsdatei (LOC)',
        loc, MAX_FILE_LOC,
        `Datei: ${datei}. Vermischt sie mehrere Verantwortlichkeiten (CLAUDE.md ` +
        `„Kohaesion vor Zeilenzahl")? Ist sie kohaerent (Daten-/State-Maschine), ` +
        `Schwelle anheben.`,
      ));
    }
  });

  it(`Groesste Testdatei unter src/ <= ${MAX_TEST_FILE_LOC} LOC`, () => {
    const { loc, datei } = groesste(true);
    if (loc > MAX_TEST_FILE_LOC) {
      expect.fail(drift(
        'Groesste src/-Testdatei (LOC)',
        loc, MAX_TEST_FILE_LOC,
        `Datei: ${datei}. Traegt sie mehrere Themen? Die Convention-Guards sind ` +
        `thematisch geschnitten (conventions-status/-ui/-daten) — ein neuer Guard ` +
        `gehoert in die passende Datei, nicht in die naechstbeste.`,
      ));
    }
  });

  it(`@/ui-Shim-Importe (P1b) <= ${MAX_UI_SHIM_IMPORTS} (darf nur sinken)`, () => {
    const re = /from\s+['"]@\/ui['"]/;
    const files = ALL_TS_FILES.filter(f => re.test(readFileSync(f, 'utf-8')));
    if (files.length > MAX_UI_SHIM_IMPORTS) {
      expect.fail(drift(
        '@/ui-Shim-Importe',
        files.length, MAX_UI_SHIM_IMPORTS,
        `Der @/ui-Re-Export-Shim (P1b) laeuft aus — neue UI-Importe ueber ` +
        `@/components/ui/*. Diese Schwelle darf nur gesenkt werden, nie erhoeht.`,
      ));
    }
  });
});
