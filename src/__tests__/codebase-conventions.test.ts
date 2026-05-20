/**
 * Codebase-Conventions: Strukturelle Hartung dokumentierter Pitfalls.
 *
 * Statt einer separaten ESLint-Konfiguration (Projekt nutzt nur tsc + vitest)
 * laufen die Pattern-Checks als Vitest-Tests. Schlaegt ein Check fehl, listet
 * die Fehlermeldung die Treffer mit Datei:Zeile + die zu nutzende Alternative.
 *
 * Inline-Whitelist: Zeilen mit Marker-Kommentar `// allow-<rule>: <reason>`
 * werden ignoriert. Bitte den Grund knapp dokumentieren — das macht die
 * Ausnahme review-bar.
 *
 * Geprueft:
 *   - no-direct-status-compare → CLAUDE.md Pitfall #12, Helper aus
 *     src/core/utils/status-canonical.ts nutzen.
 *   - no-raw-worker            → CLAUDE.md Pitfall #5, Worker als
 *     `?worker&inline`-Import einbinden (file://-Kompat).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';

const ROOT = join(__dirname, '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist' || entry === '.vite') continue;
      walk(p, out);
    } else if (s.isFile() && (entry.endsWith('.ts') || entry.endsWith('.tsx'))) {
      out.push(p);
    }
  }
  return out;
}

const ALL_TS_FILES = walk(ROOT);

interface Finding {
  file: string;
  line: number;
  text: string;
}

function relPath(abs: string): string {
  const rel = abs.slice(ROOT.length + 1);
  return `src${sep}${rel}`.replace(/\\/g, '/');
}

function findInFile(
  file: string,
  predicate: (line: string) => boolean,
  whitelistMarker: string,
): Finding[] {
  const content = readFileSync(file, 'utf-8');
  const lines = content.split(/\r?\n/);
  const out: Finding[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.includes(whitelistMarker)) continue;
    if (predicate(line)) {
      out.push({ file: relPath(file), line: i + 1, text: line.trim() });
    }
  }
  return out;
}

function fmt(findings: Finding[]): string {
  return findings.map(f => `  ${f.file}:${f.line}\n    ${f.text}`).join('\n');
}

describe('no-direct-status-compare (CLAUDE.md Pitfall #12)', () => {
  // Antrag-Status-Werte die im gesamten Projekt EINDEUTIG zur Antrag-/Vorgang-
  // Domain gehoeren (also nicht zugleich Zuweisung-, Sync-, Comment-, Klassi-
  // fizierungs-Status sein koennen). Diese Liste ist bewusst kleiner als der
  // volle Werte-Satz aus status-canonical.ts — generische Tokens wie 'neu',
  // 'abgelehnt', 'in_bearbeitung', 'eingereicht', 'abgeschlossen', 'beantragt'
  // werden auch in anderen Domains genutzt und wuerden hier nur false-positives
  // erzeugen. Falls so ein generischer Token fuer eine Antrag-Variable wirklich
  // problematisch ist, hilft hier nur ein gezielter Refactor; den Test deshalb
  // konservativ halten.
  const ANTRAG_STATUS_VALUES = [
    // Foerderantrag-Domain (eindeutig)
    'bewilligt', 'bewilligungsreif', 'ablehnungsreif',
    'bewilligungsentwurf vdi/vde-it',
    'NF gestellt', 'keine weiteren NF',
    'Schlussvermerk', 'Widerruf',
    'abgelehnt/zurückgezogen',
    'bearbeitungsreif', 'nl eingegangen',
    'techn geprüft', 'kaufm geprüft', 'gutachten fertig',
    'VN geprüft', 'VN techn. geprüft',
    // Bauantrag-Domain (eindeutig)
    'in_pruefung', 'in_begutachtung',
    'nachforderung', 'nachbesserung', 'genehmigt',
    'archiviert',
  ];

  // Files die das Pattern legitim nutzen duerfen (Status-Canonical-Modul +
  // Tests + Type-Definitionen mit Doku-Beispielen).
  const ALLOWED_PATH_FRAGMENTS = [
    `${sep}__tests__${sep}`,
    `.test.ts`,
    `${sep}utils${sep}status-canonical.ts`,
    `${sep}utils${sep}status-mappings.ts`,
    `${sep}plugins${sep}antraege${sep}filter${sep}statusGroups.ts`,
    `${sep}core${sep}services${sep}csv${sep}types.ts`,
  ];

  const isAllowed = (file: string): boolean =>
    ALLOWED_PATH_FRAGMENTS.some(frag => file.includes(frag));

  // Regex: irgendein `.status === 'WERT'` mit WERT aus der Liste oben. Wir
  // matchen tolerant gegen `==` und `!=` (mit/ohne strict) und gegen Tab/Space.
  const valueAlternatives = ANTRAG_STATUS_VALUES
    .map(v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  const pattern = new RegExp(
    `\\.status\\s*[!=]==?\\s*['"](${valueAlternatives})['"]`,
  );

  it('keine direkten Antrag-Status-Literal-Vergleiche ausserhalb des Status-Canonical-Moduls', () => {
    const findings: Finding[] = [];
    for (const file of ALL_TS_FILES) {
      if (isAllowed(file)) continue;
      findings.push(...findInFile(file, l => pattern.test(l), 'allow-status-literal'));
    }

    if (findings.length > 0) {
      const msg =
        `Direkter Antrag-Status-Vergleich verboten (CLAUDE.md Pitfall #12).\n` +
        `Nutze stattdessen die Helper aus src/core/utils/status-canonical.ts:\n` +
        `  isOpenStatus / isBewilligtStatus / isBegleitungStatus / ...\n` +
        `Wenn diese Fundstelle wirklich nur ein einzelnes Literal will (z.B.\n` +
        `Badge-Count fuer "neu"), Zeile mit '// allow-status-literal: <grund>'\n` +
        `markieren.\n\nTreffer:\n${fmt(findings)}`;
      expect.fail(msg);
    }
  });
});

describe('no-raw-worker (CLAUDE.md Pitfall #5)', () => {
  // `new Worker(...)` ohne Vite-`?worker&inline`-Import scheitert silent unter
  // file:// (kein Server, kein klassischer Worker-Loader). Standard-Pfad:
  //   import MyWorker from './x?worker&inline';
  //   const w = new MyWorker();
  const pattern = /\bnew\s+Worker\s*\(/;

  it('kein `new Worker(...)` (Worker-Imports muessen `?worker&inline` nutzen)', () => {
    const findings: Finding[] = [];
    for (const file of ALL_TS_FILES) {
      // Tests und der Convention-Test selbst sind ausgenommen.
      if (file.includes(`${sep}__tests__${sep}`) || file.endsWith('.test.ts')) continue;
      findings.push(...findInFile(file, l => pattern.test(l), 'allow-raw-worker'));
    }

    if (findings.length > 0) {
      const msg =
        `Roher Worker-Konstruktor verboten (CLAUDE.md Pitfall #5).\n` +
        `Unter file:// scheitert er silent. Stattdessen via Vite-Suffix:\n` +
        `  import MyWorker from './worker.ts?worker&inline';\n` +
        `  const w = new MyWorker();\n` +
        `Siehe docs/agents/file-protocol-pitfalls.md.\n\nTreffer:\n${fmt(findings)}`;
      expect.fail(msg);
    }
  });
});
