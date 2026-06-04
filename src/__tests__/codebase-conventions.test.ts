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
 *   - no-direct-status-compare          → Pitfall #12 (Antrag-Status), Helper aus
 *     src/core/utils/status-canonical.ts nutzen.
 *   - no-direct-feedback-status-compare → Pitfall #21 (Feedback-Status),
 *     FEEDBACK_STATUS / Praedikate aus src/core/services/feedback/feedback-status.ts.
 *   - no-direct-bearbeiter-kuerzel      → Pitfall #27, useMeinKuerzel() statt
 *     direktem profile.bearbeiter_kuerzel-Lesezugriff.
 *   - no-raw-async-onclick              → Pitfall #15, useAsyncAction-Hook.
 *   - no-raw-worker                     → Pitfall #5, Worker als
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

describe('no-raw-async-onclick (CLAUDE.md Pitfall #15)', () => {
  // `onClick={() => void asyncFn()}` schluckt Promise-Rejections silent —
  // try/finally ohne catch laesst Errors verschwinden. Pflicht fuer neuen
  // Code: useAsyncAction-Hook nutzen.
  //
  // **File-Whitelist** statt Inline-Whitelist: ~30 bestehende Files nutzen
  // das Pattern noch, opportunistische Migration laeuft. Hier whitelisten,
  // bis sie migriert sind. Neue Files NICHT auf die Whitelist setzen.
  const FILE_WHITELIST_LEGACY: ReadonlySet<string> = new Set([
    // src/plugins/auslastung/ — Mai 2026 Plugin, Migration laeuft
    // (SelbsteintragungView.tsx in v1.17 entfernt — Logik wandert auf Homepage)
    'src/plugins/auslastung/views/admin/EmbeddingCorpusSection.tsx',
    'src/plugins/auslastung/views/admin/AktivVorschlagBanner.tsx',
    'src/plugins/auslastung/components/OnboardingImportDialog.tsx',
    'src/plugins/auslastung/components/PasswortDialog.tsx',
    'src/plugins/auslastung/views/admin/KategorienSection.tsx',
    'src/plugins/auslastung/views/admin/SetupWizard.tsx',
    'src/plugins/auslastung/views/KlassifizierungsReview.tsx',
    // src/plugins/csv-sources-kuration/ — Wizard, teilweise migriert
    'src/plugins/csv-sources-kuration/wizard/Step1Metadata.tsx',
    'src/plugins/csv-sources-kuration/wizard/CsvSourceWizard.tsx',
    'src/plugins/csv-sources-kuration/CsvSourceReimportDialog.tsx',
    // src/plugins/dev-infrastructure-test/ — Dev-only, Migration niedrige Prio
    'src/plugins/dev-infrastructure-test/panels/AdminPanel.tsx',
    'src/plugins/dev-infrastructure-test/panels/TriagePanel.tsx',
    'src/plugins/dev-infrastructure-test/panels/SmbPanel.tsx',
    'src/plugins/dev-infrastructure-test/panels/FixturesPanel.tsx',
    'src/plugins/dev-infrastructure-test/panels/LockPanel.tsx',
    'src/plugins/dev-infrastructure-test/panels/AtomicPanel.tsx',
    // src/plugins/dev-state-inspector/ — Dev-only
    'src/plugins/dev-state-inspector/StateInspectorPanel.tsx',
    // src/plugins/dokumentenquellen-kuration/ — v1.15, Migration laeuft
    'src/plugins/dokumentenquellen-kuration/components/SourceFormDialog.tsx',
    'src/plugins/dokumentenquellen-kuration/sections/AktivierenIndexierenSection.tsx',
    'src/plugins/dokumentenquellen-kuration/sections/VerwaltenSection.tsx',
    'src/plugins/dokumentenquellen-kuration/components/SubRootsTreePicker.tsx',
    // src/plugins/filter-kuration/, antraege/, einstellungen/ etc.
    'src/plugins/filter-kuration/dialogs/FilterEditDialog.tsx',
    'src/plugins/filter-kuration/sections/AdminCustomFilterList.tsx',
    'src/plugins/antraege/filter/FilterSidebar.tsx',
    'src/plugins/antraege/filter/SavePresetDialog.tsx',
    'src/plugins/einstellungen/MeineTechnologienTab.tsx',
    'src/plugins/einstellungen/KuratorSessionPanel.tsx',
    'src/plugins/programme-kuration/unterprogramme/UnterprogrammXlsxImportDialog.tsx',
    'src/components/feedback/FeedbackChatbot.tsx',
  ]);

  const pattern = /onClick=\{\(\)\s*=>\s*void\s+/;

  it('keine neuen `onClick={() => void asyncFn()}`-Pattern ausserhalb der Legacy-Whitelist', () => {
    const newFindings: Finding[] = [];
    for (const file of ALL_TS_FILES) {
      if (!file.endsWith('.tsx')) continue;
      const rel = relPath(file);
      if (FILE_WHITELIST_LEGACY.has(rel)) continue;
      newFindings.push(...findInFile(file, l => pattern.test(l), 'allow-raw-async-onclick'));
    }

    if (newFindings.length > 0) {
      const msg =
        `Neuer 'onClick={() => void asyncFn()}'-Pattern in nicht-whitelisteter\n` +
        `Datei (CLAUDE.md Pitfall #15). Pflicht: useAsyncAction-Hook aus\n` +
        `src/core/hooks/useAsyncAction.ts nutzen — fängt Rejections + Doppelklick.\n` +
        `Referenz: src/plugins/csv-sources-kuration/CsvSourcesPage.tsx,\n` +
        `Cheatsheet: docs/agents/async-error-pattern.md.\n` +
        `Wenn wirklich noetig: '// allow-raw-async-onclick: <grund>' inline.\n\n` +
        `Treffer:\n${fmt(newFindings)}`;
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

describe('no-direct-feedback-status-compare (CLAUDE.md Pitfall #21)', () => {
  // Feedback-Status (`kurator_status` / Legacy `admin_status`) nicht gegen String-
  // Literale vergleichen — refactor-fragil (analog Pitfall #12 fuer Antrag-Status:
  // Tippfehler, IDE-Rename-Luecke, Status-Rename uebersieht Stellen). Stattdessen
  // die Konstante `FEEDBACK_STATUS` (Einzelwert) oder die Praedikate (`istOffen`,
  // `istUmgesetzt`, `istArchiviert`) aus services/feedback/feedback-status.ts.
  const ALLOWED_PATH_FRAGMENTS = [
    `${sep}__tests__${sep}`,
    `.test.ts`,
    `${sep}feedback${sep}feedback-status.ts`, // das Helper-Modul selbst
  ];
  const isAllowed = (file: string): boolean =>
    ALLOWED_PATH_FRAGMENTS.some(frag => file.includes(frag));

  // `.kurator_status === 'x'` / `!== "x"` (auch Legacy `admin_status`).
  const pattern = /\.(kurator_status|admin_status)\s*[!=]==?\s*['"]/;

  it('keine direkten Feedback-Status-Literal-Vergleiche (FEEDBACK_STATUS / Praedikate nutzen)', () => {
    const findings: Finding[] = [];
    for (const file of ALL_TS_FILES) {
      if (isAllowed(file)) continue;
      findings.push(...findInFile(file, l => pattern.test(l), 'allow-feedback-status-literal'));
    }

    if (findings.length > 0) {
      const msg =
        `Direkter Feedback-Status-Vergleich verboten (CLAUDE.md Pitfall #21).\n` +
        `Nutze die Konstante FEEDBACK_STATUS bzw. die Praedikate istOffen /\n` +
        `istUmgesetzt / istArchiviert aus\n` +
        `src/core/services/feedback/feedback-status.ts.\n` +
        `Cheatsheet fuer neue Status: docs/agents/add-feedback-status.md.\n` +
        `Wenn wirklich ein Einzel-Literal noetig ist, Zeile mit\n` +
        `'// allow-feedback-status-literal: <grund>' markieren.\n\nTreffer:\n${fmt(findings)}`;
      expect.fail(msg);
    }
  });
});

describe('no-direct-bearbeiter-kuerzel (CLAUDE.md Pitfall #27)', () => {
  // Das effektive Bearbeiter-Kuerzel ueber useMeinKuerzel() lesen, nicht direkt
  // `profile.bearbeiter_kuerzel`: im MA-Login-Modus (prod) ist das Profilfeld
  // read-only/leer, die echte Identitaet kommt aus der entschluesselten Session.
  const ALLOWED_PATH_FRAGMENTS = [
    `${sep}__tests__${sep}`,
    `.test.ts`,
    `${sep}hooks${sep}useMeinKuerzel.ts`,    // der kanonische Getter selbst
    `${sep}einstellungen${sep}ProfilTab.tsx`, // das editierbare Profilfeld (Schreib-Quelle)
  ];
  const isAllowed = (file: string): boolean =>
    ALLOWED_PATH_FRAGMENTS.some(frag => file.includes(frag));

  // Kommentar-Zeilen (Doku-Erwaehnungen von `profile.bearbeiter_kuerzel`) sind
  // keine Lesezugriffe — ueberspringen, sonst False-Positives in JSDoc.
  const isComment = (l: string): boolean => {
    const t = l.trim();
    return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
  };
  // Fuehrender Punkt = Lesezugriff. Writes (`{ bearbeiter_kuerzel: … }`) und die
  // Type-Definition (`bearbeiter_kuerzel?:`) haben keinen Punkt → kein Treffer.
  const pattern = /\.bearbeiter_kuerzel\b/;

  it('kein direkter profile.bearbeiter_kuerzel-Lesezugriff (useMeinKuerzel nutzen)', () => {
    const findings: Finding[] = [];
    for (const file of ALL_TS_FILES) {
      if (isAllowed(file)) continue;
      findings.push(...findInFile(file, l => !isComment(l) && pattern.test(l), 'allow-direct-kuerzel'));
    }

    if (findings.length > 0) {
      const msg =
        `Direkter profile.bearbeiter_kuerzel-Lesezugriff verboten (CLAUDE.md Pitfall #27).\n` +
        `Nutze useMeinKuerzel() aus src/core/hooks/useMeinKuerzel.ts\n` +
        `(Session > Profilfeld, drop-in-kompatibel: string | undefined).\n` +
        `Pre-Login-Ausnahme (Code laeuft vor der MaLoginGate)? Zeile mit\n` +
        `'// allow-direct-kuerzel: <grund>' markieren.\n\nTreffer:\n${fmt(findings)}`;
      expect.fail(msg);
    }
  });
});
