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
