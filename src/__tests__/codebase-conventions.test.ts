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
 *   - no-hardcoded-datenshare-mode      → Pitfall #25, Daten-Share-Modus
 *     ('read'/'readwrite') ausschliesslich via canWriteDatenShare() entscheiden,
 *     nicht `isKurator ? 'readwrite' : 'read'` hart kodieren.
 *   - no-raw-modal                      → recurring-bug-classes Klasse 7, Modals
 *     ueber den Dialog aus @/components/ui/dialog rendern (Hoehen-Cap + Scroll
 *     eingebaut) statt per Hand `fixed inset-0`.
 *   - no-new-tf-ui-files                → P1b, src/ui/ ist nur noch Re-Export-Shim;
 *     neue UI-Komponenten gehoeren nach src/components/ui/.
 *   - import-requires-store-refresh     → recurring-bug-classes Klasse 1, jede
 *     importCsvSource(-Datei referenziert refreshAntraegeStoreAfterSync.
 *   - antraege-write-requires-listview-rebuild → recurring-bug-classes Klasse 1,
 *     jede replaceStore(-Datei referenziert rebuildAntraegeListView.
 *   - no-hardcoded-canonical-field      → recurring-bug-classes Klasse 5, kein
 *     direkter .d_xtec/.d_adv-Zugriff; Feld via resolveFieldKey aufloesen.
 *   - no-raw-active-transport           → Pitfall #30 (DSGVO-Transport-Policy),
 *     dokument-tragende Skill-Laeufe (Gutachten/Batch) ueber
 *     bridge.getTransportForSkillRun(skill) statt rohem getActiveTransport();
 *     Verfuegbarkeitschecks (.ping()) ausgenommen / bridge.pingActive().
 *   - no-hardcoded-kategorie-mapping    → Artefakt-Achse, Kategorie-Einzelquelle:
 *     der typ→kategorie-Map-Identifier TYP_ZU_KATEGORIE nur in kategorien.ts;
 *     Regel-Kategorie sonst immer ueber effektiveKategorie() ableiten.
 *   - gutachten-entwurf-kein-plain-textarea → Gutachten-Entwurf nutzt den
 *     Live-Preview-Editor (MarkdownEditor + markdownLivePreview), kein rohes
 *     <textarea> (Buffer bleibt rohes Markdown = Ground-Truth, kein Roundtrip).
 *   - eval-gui-fictional-only            → Skill-Eval-GUI (dev): SkillEvalPanel +
 *     runEvalBatch importieren KEINE Real-Antrag-Pfade (listAllAntraegeListView,
 *     findVorhabensbeschreibung, doc:-Scan) — Fixtures nur via loadEvalFixtures();
 *     Scoring nur ueber das geteilte runJudge/aggregate (kein dup. Judge-Call).
 *   - theme-token-contract              → Design-Handoff-Token-Vertrag (v2.119):
 *     jedes via var(--tf-…) OHNE Fallback in CSS/TSX/TS referenzierte Token MUSS
 *     global in src/theme.css definiert sein, sonst die "nackt"-Falle v2.67.1 (ein
 *     undefiniertes var() macht die GANZE CSS-Deklaration ungueltig). Mit-Fallback-
 *     Nutzung undefinierter Tokens nur Warnung. Ausnahme '// allow-tf-token: <grund>'.
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

// Wie walk(), aber fuer .css — der theme-token-contract-Guard muss auch CSS
// scannen (chat/gutachten/felder nutzen die Tokens dort). ALL_TS_FILES bleibt
// bewusst unberuehrt, damit die uebrigen Guards unveraendert nur .ts/.tsx scopen.
function walkCss(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist' || entry === '.vite') continue;
      walkCss(p, out);
    } else if (s.isFile() && entry.endsWith('.css')) {
      out.push(p);
    }
  }
  return out;
}

const ALL_SOURCE_FILES = [...ALL_TS_FILES, ...walkCss(ROOT)];

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

/**
 * Dateiweiter Check (fuer Regeln, die nicht zeilen-lokal entscheidbar sind):
 * Eine Datei verstoesst, wenn sie irgendwo eine `trigger`-Zeile enthaelt (z.B.
 * einen bestimmten Funktionsaufruf), aber NIRGENDWO `requiredRef` referenziert.
 * Markierte Trigger-Zeilen (`marker`) werden uebersprungen; enthaelt die Datei
 * `requiredRef` an beliebiger Stelle, gilt sie als konform. Pro Datei max. ein
 * Treffer (die erste unmarkierte Trigger-Zeile genuegt als Beleg).
 */
function findFilesViolating(
  trigger: (line: string) => boolean,
  requiredRef: string,
  marker: string,
  isAllowed: (file: string) => boolean,
): Finding[] {
  const out: Finding[] = [];
  for (const file of ALL_TS_FILES) {
    if (isAllowed(file)) continue;
    const content = readFileSync(file, 'utf-8');
    if (content.includes(requiredRef)) continue;
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (line.includes(marker)) continue;
      // Kommentar-Zeilen (JSDoc-Erwaehnungen wie `importCsvSource()`) sind keine
      // echten Aufrufe — ueberspringen, sonst False-Positives in der Doku.
      const t = line.trim();
      if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) continue;
      if (trigger(line)) {
        out.push({ file: relPath(file), line: i + 1, text: line.trim() });
        break;
      }
    }
  }
  return out;
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

describe('no-hardcoded-datenshare-mode (CLAUDE.md Pitfall #25)', () => {
  // Der Daten-Share-Grant-Modus ('read' vs 'readwrite') wird AUSSCHLIESSLICH
  // ueber canWriteDatenShare(isKurator) entschieden (= isKurator ||
  // features.datenShareSchreibrecht). Wer stattdessen `isKurator ? 'readwrite' :
  // 'read'` hart kodiert, verpasst den datenShareSchreibrecht-Flag (pl/kurator)
  // → silent NotAllowedError bzw. irrefuehrende Read-Only-Downgrade-Wall.
  //
  // Erlaubt ist die korrekte Form `canWriteDatenShare(...) ? 'readwrite' :
  // 'read'` — solche Zeilen werden uebersprungen.
  const ALLOWED_PATH_FRAGMENTS = [
    `${sep}__tests__${sep}`,
    `.test.ts`,
    `${sep}config${sep}feature-flags.ts`, // Definitions-Site von canWriteDatenShare
  ];
  const isAllowed = (file: string): boolean =>
    ALLOWED_PATH_FRAGMENTS.some(frag => file.includes(frag));

  // Kommentar-Zeilen (Doku-Erwaehnungen des Anti-Patterns, z.B. StartupScreen
  // JSDoc) sind keine echten Code-Pfade — ueberspringen.
  const isComment = (l: string): boolean => {
    const t = l.trim();
    return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
  };

  // Ternary, der 'read'/'readwrite' in beiden Reihenfolgen liefert.
  const pattern = /\?\s*['"](readwrite|read)['"]\s*:\s*['"](read|readwrite)['"]/;

  it('kein hartkodiertes `isKurator ? \'readwrite\' : \'read\'` (canWriteDatenShare nutzen)', () => {
    const findings: Finding[] = [];
    for (const file of ALL_TS_FILES) {
      if (isAllowed(file)) continue;
      findings.push(
        ...findInFile(
          file,
          l => !isComment(l) && !l.includes('canWriteDatenShare') && pattern.test(l),
          'allow-hardcoded-datenshare-mode',
        ),
      );
    }

    if (findings.length > 0) {
      const msg =
        `Hartkodierter Daten-Share-Modus verboten (CLAUDE.md Pitfall #25).\n` +
        `Nutze canWriteDatenShare(isKurator) aus src/config/feature-flags.ts\n` +
        `(= isKurator || features.datenShareSchreibrecht) statt\n` +
        `'isKurator ? \\'readwrite\\' : \\'read\\''.\n` +
        `Wenn die Zeile wirklich unabhaengig vom Flag ist, mit\n` +
        `'// allow-hardcoded-datenshare-mode: <grund>' markieren.\n\n` +
        `Treffer:\n${fmt(findings)}`;
      expect.fail(msg);
    }
  });
});

describe('no-raw-modal (recurring-bug-classes Klasse 7)', () => {
  // Hand-gerollte Modal-Huellen (`fixed inset-0`-Overlay + zentrierte Karte)
  // ohne Hoehen-Cap an der Karte sind bei langem Inhalt nicht scrollbar
  // (Kopf/Fuss + Buttons abgeschnitten) — die Bug-Klasse ist mehrfach neu
  // entstanden. Kanonischer Modal-Pfad ist der Dialog aus
  // @/components/ui/dialog (Hoehen-Cap + interner Scroll + fixer Kopf/Fuss
  // bereits eingebaut). String-Match `fixed inset-0` genuegt (wie no-raw-worker).
  //
  // Datei-Ausnahmen per Pfad: die beiden Dialog-Komponenten SIND der
  // Mechanismus und duerfen `fixed inset-0` nutzen.
  const ALLOWED_PATH_FRAGMENTS = [
    `${sep}__tests__${sep}`,
    `.test.ts`,
    `${sep}components${sep}ui${sep}dialog.tsx`, // kanonischer Dialog (shadcn)
    `${sep}ui${sep}Dialog.tsx`,                 // Alt-Dialog (wird in P1b zum Adapter)
  ];
  const isAllowed = (file: string): boolean =>
    ALLOWED_PATH_FRAGMENTS.some(frag => file.includes(frag));

  it('kein hand-gerolltes `fixed inset-0`-Modal (Dialog aus @/components/ui/dialog nutzen)', () => {
    const findings: Finding[] = [];
    for (const file of ALL_TS_FILES) {
      if (isAllowed(file)) continue;
      findings.push(...findInFile(file, l => l.includes('fixed inset-0'), 'allow-raw-modal'));
    }

    if (findings.length > 0) {
      const msg =
        `Hand-gerolltes Modal verboten (recurring-bug-classes Klasse 7).\n` +
        `Nutze den Dialog aus @/components/ui/dialog — Hoehen-Cap (max-h) +\n` +
        `interner Scroll + fixer Kopf/Fuss sind dort eingebaut.\n` +
        `Vollbild-Zustaende (StartupScreen, Login-Gates, Onboarding) und\n` +
        `Spezial-Overlays/Drawer (Tour, Command-Palette, Filter-Drawer) per\n` +
        `'// allow-raw-modal: <grund>' inline whitelisten.\n\nTreffer:\n${fmt(findings)}`;
      expect.fail(msg);
    }
  });
});

describe('no-new-tf-ui-files (P1b: src/ui/ ist nur noch Re-Export-Shim)', () => {
  // Es gibt genau EINE UI-Bibliothek: src/components/ui/. src/ui/ ist seit P1b
  // ein reiner Re-Export-Shim (Kompatibilitaet fuer die ~70 Barrel-Importe) und
  // darf KEINE neuen Implementierungen mehr aufnehmen. Erlaubt sind nur der
  // Barrel (index.ts), der Dialog-Adapter (Dialog.tsx) und der vorerst behaltene
  // TF-Select (Select.tsx — STOPP #2: Radix-Compound-API in ProgrammSwitcher
  // nicht durch die native TF-Select-API abbildbar).
  const ALLOWED = new Set(['index.ts', 'Dialog.tsx', 'Select.tsx']);

  it('keine neuen Dateien in src/ui/ ausser Shim/Adapter (nach src/components/ui/ verschieben)', () => {
    const dir = join(ROOT, 'ui');
    const offenders = readdirSync(dir).filter(
      entry => statSync(join(dir, entry)).isFile() && !ALLOWED.has(entry),
    );

    if (offenders.length > 0) {
      const msg =
        `Neue Datei(en) in src/ui/ gefunden (P1b: src/ui/ ist nur Re-Export-Shim).\n` +
        `UI-Komponenten gehoeren nach src/components/ui/; der Barrel src/ui/index.ts\n` +
        `re-exportiert sie (Direkt-Importe: @/components/ui/<Datei>).\n` +
        `Erlaubt in src/ui/: ${[...ALLOWED].join(', ')}.\n\n` +
        `Treffer:\n${offenders.map(o => `  src/ui/${o}`).join('\n')}`;
      expect.fail(msg);
    }
  });
});

describe('import-requires-store-refresh (recurring-bug-classes Klasse 1)', () => {
  // Jede Datei, die importCsvSource( aufruft, MUSS refreshAntraegeStoreAfterSync
  // referenzieren — sonst bleibt der In-Memory-Antraege-Store nach dem Import
  // stale, bis der User manuell neu laedt (Cold-Start-Store-Refresh, Klasse 1,
  // docs/architecture/recurring-bug-classes.md). Legitime Ausnahmen per Inline-
  // Marker `// allow-import-no-refresh: <grund>` (Seed laeuft vor dem ersten
  // Store-Load; Refresh erfolgt gebuendelt im Caller; dev-only Fixture-Import).
  const ALLOWED_PATH_FRAGMENTS = [
    `${sep}__tests__${sep}`,
    `.test.ts`,
    `${sep}importer.ts`,         // Definitions-Site von importCsvSource
    `${sep}snapshot-refresh.ts`, // Definitions-Site des Refresh-Helpers
  ];
  const isAllowed = (file: string): boolean =>
    ALLOWED_PATH_FRAGMENTS.some(frag => file.includes(frag));

  it('jede importCsvSource(-Datei referenziert refreshAntraegeStoreAfterSync', () => {
    const findings = findFilesViolating(
      l => l.includes('importCsvSource('),
      'refreshAntraegeStoreAfterSync',
      'allow-import-no-refresh',
      isAllowed,
    );
    if (findings.length > 0) {
      const msg =
        `importCsvSource(-Aufruf ohne refreshAntraegeStoreAfterSync (recurring-bug-classes\n` +
        `Klasse 1: Cold-Start-Store-Refresh). Nach dem Import den In-Memory-Store neu laden:\n` +
        `  await refreshAntraegeStoreAfterSync(idb, programmId, ['antraege','verbuende'] as const);\n` +
        `Laeuft der Import nachweislich vor dem ersten Store-Load oder refresht der Caller,\n` +
        `Zeile mit '// allow-import-no-refresh: <grund>' markieren.\n\nTreffer:\n${fmt(findings)}`;
      expect.fail(msg);
    }
  });
});

describe('antraege-write-requires-listview-rebuild (recurring-bug-classes Klasse 1)', () => {
  // Die Voll-Ersetzung des ANTRAEGE-Stores laeuft ueber die replaceStore(-Primitive
  // (clear + chunked put). Wer sie nutzt, MUSS danach rebuildAntraegeListView rufen —
  // sonst liest die Home die stale/leere Slim-Projektion ANTRAEGE_LIST_VIEW (Klasse 1,
  // Mechanismus 4). Bewusst ENG auf replaceStore( gefasst: ein breiteres
  // CSV_STORES.ANTRAEGE-Pattern wuerde legitime Einzel-Writes (idb-csv.ts) treffen
  // und den parametrisierten snapshot-sync-Aufruf verfehlen → Whitelist-Rauschen.
  const ALLOWED_PATH_FRAGMENTS = [
    `${sep}__tests__${sep}`,
    `.test.ts`,
  ];
  const isAllowed = (file: string): boolean =>
    ALLOWED_PATH_FRAGMENTS.some(frag => file.includes(frag));

  it('jede replaceStore(-Datei referenziert rebuildAntraegeListView', () => {
    const findings = findFilesViolating(
      l => l.includes('replaceStore('),
      'rebuildAntraegeListView',
      'allow-antraege-write-no-listview',
      isAllowed,
    );
    if (findings.length > 0) {
      const msg =
        `replaceStore(-Aufruf ohne rebuildAntraegeListView (recurring-bug-classes\n` +
        `Klasse 1, Mechanismus 4). Eine Voll-Ersetzung des ANTRAEGE-Stores muss die\n` +
        `Slim-Projektion ANTRAEGE_LIST_VIEW mitziehen:\n` +
        `  await rebuildAntraegeListView(idb);\n` +
        `Sonst bleibt Home/Listen leer bis zum naechsten App-Start. Echte Ausnahme:\n` +
        `'// allow-antraege-write-no-listview: <grund>'.\n\nTreffer:\n${fmt(findings)}`;
      expect.fail(msg);
    }
  });
});

describe('no-hardcoded-canonical-field (recurring-bug-classes Klasse 5)', () => {
  // Direkter Lesezugriff auf mapping-abhaengige kanonische Keys verboten: D_XTEC/
  // D_ADV koennen vom Kurator als Standard- ODER als Eigenes Feld gemappt werden
  // (recurring-bug-classes Klasse 5, v2.40-Bug). Statt `antrag.d_xtec` das ueber
  // das CSV-Schema aufgeloeste Feld nutzen (resolveFieldKey /
  // resolveVollstaendigkeitsFelder, vollstaendigkeit-felder.ts). Verbotene Muster
  // bewusst minimal (analog no-direct-status-compare) — die Liste waechst nur,
  // wenn Klasse 5 erneut zuschlaegt.
  const FORBIDDEN = ['.d_xtec', "['d_xtec']", '.d_adv', "['d_adv']"];
  const ALLOWED_PATH_FRAGMENTS = [
    `${sep}__tests__${sep}`,
    `.test.ts`,
    `${sep}vollstaendigkeit-felder.ts`,    // Resolver-Modul selbst
    `${sep}useVollstaendigkeitsFelder.ts`, // Resolver-Hook
  ];
  const isAllowed = (file: string): boolean =>
    ALLOWED_PATH_FRAGMENTS.some(frag => file.includes(frag));

  // Kommentar-Zeilen (Doku-Erwaehnungen von `.d_xtec`) sind keine Lesezugriffe.
  const isComment = (l: string): boolean => {
    const t = l.trim();
    return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
  };

  it('kein hartkodierter Lesezugriff auf .d_xtec / .d_adv (resolveFieldKey nutzen)', () => {
    const findings: Finding[] = [];
    for (const file of ALL_TS_FILES) {
      if (isAllowed(file)) continue;
      findings.push(
        ...findInFile(
          file,
          l => !isComment(l) && FORBIDDEN.some(p => l.includes(p)),
          'allow-canonical-field',
        ),
      );
    }
    if (findings.length > 0) {
      const msg =
        `Hartkodierter Zugriff auf ein mapping-abhaengiges kanonisches Feld verboten\n` +
        `(recurring-bug-classes Klasse 5). D_XTEC/D_ADV koennen als Eigenes Feld gemappt\n` +
        `sein → der kanonische Key bleibt leer, das Feature schaltet still ab. Loese das\n` +
        `Feld ueber das CSV-Schema auf (resolveFieldKey, Spalten-CODE → tatsaechlicher Key;\n` +
        `Vorbild: src/plugins/auslastung/services/klassifizierung/vollstaendigkeit-felder.ts).\n` +
        `Echte Ausnahme (Default-Mapping-Wrapper o.ae.): '// allow-canonical-field: <grund>'.\n\n` +
        `Treffer:\n${fmt(findings)}`;
      expect.fail(msg);
    }
  });
});

describe('no-raw-active-transport (CLAUDE.md Pitfall #30, DSGVO-Transport-Policy)', () => {
  // Dokument-tragende Skill-Laeufe (Generierung, QS, Batch) duerfen den Transport
  // NICHT roh ueber bridge.getActiveTransport() ziehen — sonst kann Dokumentinhalt
  // auf einem externen Provider landen. Stattdessen die gegatete Wahl
  // bridge.getTransportForSkillRun(skill) (erzwingt intern fuer inhalts-tragende
  // Skills, src/core/services/ai/transport-policy.ts). Reine Verfuegbarkeitschecks
  // tragen keinen Inhalt: Zeilen mit `.ping(` auf derselben Stelle sind ausgenommen
  // (oder bridge.pingActive() nutzen).
  //
  // Scope: die Gutachten-/Batch-Domaene, wo der inhalts-tragende Aufruf sitzt.
  // Bewusst inkl. des Batch-PLUGIN-Ordners (gutachten-batch/) — dort liegt der
  // eigentliche getActiveTransport()-Aufruf (useBatchJob), nicht nur in gutachten/.
  const SCOPE_FRAGMENTS = [
    `${sep}plugins${sep}antraege${sep}gutachten${sep}`,
    `${sep}plugins${sep}antraege${sep}gutachten-batch${sep}`,
    `${sep}core${sep}services${sep}gutachten-batch${sep}`,
    `${sep}plugins${sep}antraege${sep}nachforderungen${sep}`,
  ];
  const isInScope = (file: string): boolean =>
    SCOPE_FRAGMENTS.some(frag => file.includes(frag))
    && !file.includes(`${sep}__tests__${sep}`) && !file.endsWith('.test.ts');

  // Kommentar-Zeilen (JSDoc-Erwaehnungen von getActiveTransport()) sind keine Aufrufe.
  const isComment = (l: string): boolean => {
    const t = l.trim();
    return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
  };

  it('kein rohes bridge.getActiveTransport() fuer Inhalts-Laeufe (getTransportForSkillRun / pingActive nutzen)', () => {
    const findings: Finding[] = [];
    for (const file of ALL_TS_FILES) {
      if (!isInScope(file)) continue;
      findings.push(...findInFile(
        file,
        l => !isComment(l) && l.includes('getActiveTransport(') && !l.includes('.ping('),
        'allow-raw-active-transport',
      ));
    }

    if (findings.length > 0) {
      const msg =
        `Rohes bridge.getActiveTransport() in der Gutachten-/Batch-Domaene verboten\n` +
        `(CLAUDE.md Pitfall #30, DSGVO-Transport-Policy). Dokument-tragende Laeufe ueber\n` +
        `bridge.getTransportForSkillRun(skill) fuehren — erzwingt einen internen Transport\n` +
        `fuer inhalts-tragende Skills. Reine Verfuegbarkeitschecks: bridge.pingActive()\n` +
        `(oder eine Zeile, die auf derselben Stelle .ping() aufruft). Echte Ausnahme:\n` +
        `'// allow-raw-active-transport: <grund>'.\n\nTreffer:\n${fmt(findings)}`;
      expect.fail(msg);
    }
  });
});

describe('no-hardcoded-kategorie-mapping (Artefakt-Achse: Kategorie-Einzelquelle)', () => {
  // Die Regel-„Art" (Kategorie) wird aus EINER Quelle abgeleitet: effektiveKategorie()
  // + die private TYP_ZU_KATEGORIE-Map in src/core/services/skills/registry/kategorien.ts
  // (Reihenfolge: explizite kategorie > typ-Map > pruefart-Fallback > 'sonstige'). Ein
  // zweites typ→kategorie-Mapping (Copy-Paste der Map) anderswo divergiert lautlos,
  // sobald ein Typ dazukommt. Minimal-Guard (analog no-direct-status-compare): der
  // Map-Identifier TYP_ZU_KATEGORIE darf NUR in kategorien.ts vorkommen; Kategorie
  // sonst immer ueber effektiveKategorie() ableiten. Liste waechst nur, wenn die
  // Klasse erneut zuschlaegt.
  const ALLOWED_PATH_FRAGMENTS = [
    `${sep}__tests__${sep}`,
    `.test.ts`,
    `${sep}skills${sep}registry${sep}kategorien.ts`, // Einzelquelle der Map
  ];
  const isAllowed = (file: string): boolean =>
    ALLOWED_PATH_FRAGMENTS.some(frag => file.includes(frag));

  it('kein zweites typ→kategorie-Mapping (TYP_ZU_KATEGORIE nur in kategorien.ts; sonst effektiveKategorie())', () => {
    const findings: Finding[] = [];
    for (const file of ALL_TS_FILES) {
      if (isAllowed(file)) continue;
      findings.push(...findInFile(file, l => l.includes('TYP_ZU_KATEGORIE'), 'allow-kategorie-mapping'));
    }
    if (findings.length > 0) {
      const msg =
        `Hartkodiertes typ→kategorie-Mapping ausserhalb kategorien.ts verboten\n` +
        `(Artefakt-Achse, Kategorie-Einzelquelle). Eine Regel-Kategorie wird aus EINER\n` +
        `Quelle abgeleitet: effektiveKategorie() (explizite kategorie > typ-Map >\n` +
        `pruefart-Fallback) in src/core/services/skills/registry/kategorien.ts. Statt die\n` +
        `Map zu kopieren: effektiveKategorie(regel) aufrufen. Echte Ausnahme:\n` +
        `'// allow-kategorie-mapping: <grund>'.\n\nTreffer:\n${fmt(findings)}`;
      expect.fail(msg);
    }
  });
});

describe('health-baseline (Drift-Warnung, kein Verbot)', () => {
  // Diese Kennzahlen halten den nach P1-P6 + Skill-Dach (v2.89) erreichten
  // Struktur-Zustand fest. Schwellen mit BEWUSSTEM Puffer ueber dem Ist-Wert: sie
  // sollen schleichende Verdopplung/Wildwuchs fangen, NICHT jeden Feature-Zuwachs.
  // Schlaegt eine Assertion fehl, ist die erste Frage „ist der Zuwachs gewollt?" —
  // wenn ja, die Konstante hier bewusst anheben (und im CHANGELOG vermerken). Das
  // ist eine Drift-Warnung, kein Verbot.
  const MAX_FEATURE_FLAGS = 27;    // Ist 23 (+4 Reserve)
  const MAX_SERVICE_DIRS = 21;     // Ist 21 (+ skill-feedback File-first Substrat S1: spannt skills+personal-storage+infrastructure, Fundament für S2/S3 — bewusst eigene Domaene; davor 20 nach skill-eval)
  const MAX_FILE_LOC = 980;        // Ist 846 (smb-handle.ts); ZuweisungsCockpit.tsx von 1285 → 687 zerlegt (v2.111), ~15 % Reserve
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

  it(`Groesste Einzeldatei unter src/ <= ${MAX_FILE_LOC} LOC`, () => {
    let maxLoc = 0;
    let maxFile = '';
    for (const file of ALL_TS_FILES) {
      const loc = readFileSync(file, 'utf-8').split(/\r?\n/).length;
      if (loc > maxLoc) { maxLoc = loc; maxFile = relPath(file); }
    }
    if (maxLoc > MAX_FILE_LOC) {
      expect.fail(drift(
        'Groesste src/-Datei (LOC)',
        maxLoc, MAX_FILE_LOC,
        `Datei: ${maxFile}. Vermischt sie mehrere Verantwortlichkeiten (CLAUDE.md ` +
        `„Kohaesion vor Zeilenzahl")? Ist sie kohaerent (Daten-/State-Maschine), ` +
        `Schwelle anheben.`,
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

describe('gutachten-entwurf-kein-plain-textarea (Live-Preview statt <textarea>)', () => {
  // Der Gutachten-Entwurfs-Editor muss der Live-Preview-Editor bleiben (MarkdownEditor +
  // markdownLivePreview) und nicht auf ein nacktes <textarea> zurueckfallen. Sicher als
  // Single-File-Check: das Feedback-Notizfeld in der Datei ist ein <input> — es gibt sonst
  // kein <textarea>.
  const FILE = join(ROOT, 'plugins', 'antraege', 'gutachten', 'SectionReviewCard.tsx');

  it('SectionReviewCard nutzt markdownLivePreview und kein rohes <textarea>', () => {
    const content = readFileSync(FILE, 'utf-8');
    expect(
      content.includes('markdownLivePreview'),
      'SectionReviewCard.tsx muss markdownLivePreview importieren/verwenden.',
    ).toBe(true);
    expect(
      content.includes('<textarea'),
      'Gutachten-Entwurf darf keinen rohen <textarea>-Editor nutzen — MarkdownEditor + ' +
      'markdownLivePreview (Live-Preview-Source) verwenden. Buffer bleibt rohes Markdown.',
    ).toBe(false);
  });
});

describe('eval-gui-fictional-only (Skill-Eval-GUI dev: nur fiktive Fixtures)', () => {
  // DSGVO-Hardlock: die dev-Eval-GUI (SkillEvalPanel + runEvalBatch) darf NIE einen
  // realen Antrag in einen (externen) Judge-Call bringen. Konkret: kein Import/Aufruf
  // der Real-Antrag-Datenpfade; Fixtures ausschliesslich aus dem gebrandeten Bundle
  // (loadEvalFixtures). Abgrenzung: SkillTestlaufPanel (real, ohne Judge) ist bewusst
  // NICHT in diesem Scope. Scoring laeuft NUR ueber die geteilte Engine
  // (runJudge/aggregate aus skill-eval/) — kein nachgebauter Judge-Call.
  const EVAL_GUI_SUFFIXES = [
    'plugins/skill-verwaltung-kuration/SkillEvalPanel.tsx',
    'core/services/skill-eval/eval-batch.ts',
  ];
  const isEvalGui = (file: string): boolean => {
    const rel = relPath(file);
    return EVAL_GUI_SUFFIXES.some(s => rel.endsWith(s));
  };
  const isComment = (l: string): boolean => {
    const t = l.trim();
    return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
  };
  const FORBIDDEN = ['listAllAntraegeListView', 'findVorhabensbeschreibung', "entries('doc:", 'entries("doc:'];

  it('keine Real-Antrag-Pfade in der Eval-GUI', () => {
    const findings: Finding[] = [];
    for (const file of ALL_TS_FILES) {
      if (!isEvalGui(file)) continue;
      findings.push(...findInFile(
        file,
        l => !isComment(l) && FORBIDDEN.some(p => l.includes(p)),
        'allow-eval-gui-real-antrag',
      ));
    }
    if (findings.length > 0) {
      expect.fail(
        `Real-Antrag-Pfade in der dev-Eval-GUI verboten (DSGVO: der externe Judge darf nur\n` +
        `fiktive Fixtures sehen). Fixtures ausschliesslich ueber loadEvalFixtures() beziehen.\n` +
        `Echte Ausnahme: '// allow-eval-gui-real-antrag: <grund>'.\n\nTreffer:\n${fmt(findings)}`,
      );
    }
  });

  it('Eval-GUI nutzt die geteilte Engine (kein dupliziertes Judge/Aggregat-Scoring)', () => {
    const batch = ALL_TS_FILES.find(f => relPath(f).endsWith('core/services/skill-eval/eval-batch.ts'));
    expect(batch, 'eval-batch.ts nicht gefunden').toBeTruthy();
    const src = readFileSync(batch!, 'utf-8');
    // Delegation an die geteilten Engine-Funktionen → CLI-vergleichbare Zahlen.
    expect(src, 'runEvalBatch muss runJudge() wiederverwenden').toContain('runJudge(');
    expect(src, 'runEvalBatch muss aggregate() wiederverwenden').toContain('aggregate(');
    // Kein nachgebauter Judge-Call: response_format/json_object lebt nur in judge.ts.
    const guiFindings: Finding[] = [];
    for (const file of ALL_TS_FILES) {
      if (!isEvalGui(file)) continue;
      guiFindings.push(...findInFile(file, l => !isComment(l) && l.includes('json_object'), 'allow-eval-gui-real-antrag'));
    }
    if (guiFindings.length > 0) {
      expect.fail(
        `Die Eval-GUI baut den Judge-Call nach (json_object) statt runJudge() zu nutzen.\n` +
        `Scoring NUR ueber runJudge/aggregate aus skill-eval/.\n\nTreffer:\n${fmt(guiFindings)}`,
      );
    }
  });
});

describe('theme-token-contract (CLAUDE.md Doku-Konvention #4; v2.67.1-"nackt"-Falle)', () => {
  // Bewusst lokale (nicht-globale) Tokens — leer starten. Eintrag NUR mit Grund,
  // wenn ein Token absichtlich plugin-lokal via inline-style gesetzt + gelesen wird.
  const LOCAL_TOKEN_ALLOWLIST = new Set<string>();

  // Global in src/theme.css definierte --tf-*-Tokens (Light + Dark) einsammeln.
  function readGlobalTfTokens(): Set<string> {
    const themeCss = ALL_SOURCE_FILES.find(f => relPath(f) === 'src/theme.css');
    expect(themeCss, 'src/theme.css nicht gefunden').toBeTruthy();
    const defined = new Set<string>();
    for (const line of readFileSync(themeCss!, 'utf-8').split(/\r?\n/)) {
      const m = line.match(/^\s*(--tf-[a-z0-9-]+)\s*:/);
      if (m) defined.add(m[1]!);
    }
    return defined;
  }

  it('kein var(--tf-…) OHNE Fallback referenziert ein global undefiniertes Token', () => {
    const defined = readGlobalTfTokens();
    expect(defined.size, 'theme.css definiert verdaechtig wenige --tf-Tokens').toBeGreaterThan(30);

    const errors: Finding[] = [];    // ohne Fallback + undefiniert → die "nackt"-Falle
    const warnings: Finding[] = [];  // mit Fallback + undefiniert → tolerierter Drift
    // var(--tf-x)   → Gruppe 2 ')'  = kein Fallback
    // var(--tf-x,…) → Gruppe 2 ','  = Fallback vorhanden
    const VAR_RE = /var\(\s*(--tf-[a-z0-9-]+)\s*([,)])/g;

    for (const file of ALL_SOURCE_FILES) {
      const rel = relPath(file);
      if (rel === 'src/theme.css') continue;       // Definitions-Quelle, nicht Nutzer
      if (rel.includes('/__tests__/')) continue;    // Test-Strings sind keine echte Nutzung
      const lines = readFileSync(file, 'utf-8').split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        if (line.includes('allow-tf-token')) continue;
        VAR_RE.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = VAR_RE.exec(line)) !== null) {
          const token = m[1]!;
          const hasFallback = m[2] === ',';
          if (defined.has(token) || LOCAL_TOKEN_ALLOWLIST.has(token)) continue;
          const finding: Finding = { file: rel, line: i + 1, text: `${token}  →  ${line.trim()}` };
          (hasFallback ? warnings : errors).push(finding);
        }
      }
    }

    if (warnings.length > 0) {
      console.warn(
        `[theme-token-contract] ${warnings.length} var(--tf-…)-Nutzung(en) mit Fallback ` +
        `referenzieren ein global undefiniertes Token (toleriert — Fallback verhindert die\n` +
        `"nackt"-Falle —, aber Drift-Risiko: besser in src/theme.css aufnehmen):\n${fmt(warnings)}`,
      );
    }

    if (errors.length > 0) {
      expect.fail(
        `Undefiniertes --tf-*-Token OHNE Fallback referenziert (v2.67.1-"nackt"-Falle:\n` +
        `ein undefiniertes var() macht die GANZE CSS-Deklaration ungueltig → Komponente\n` +
        `rendert ohne border/font/radius/transition).\n` +
        `Fix: Token global in src/theme.css definieren (Light + [data-theme="dark"]) oder\n` +
        `einen Fallback angeben. Bewusste lokale Ausnahme: Zeile mit\n` +
        `'// allow-tf-token: <grund>' markieren (oder LOCAL_TOKEN_ALLOWLIST ergaenzen).\n` +
        `\nTreffer (${errors.length}):\n${fmt(errors)}`,
      );
    }
  });
});
