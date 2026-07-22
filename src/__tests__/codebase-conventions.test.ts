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
 *   - no-raw-clipboard                  → v2.301.3, Zwischenablage nur ueber
 *     kopiereText() aus src/core/utils/kopieren.ts (execCommand-Rueckfall +
 *     wirft statt still zu scheitern); "kopieren und oeffnen" erst kopieren.
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
 *   - keine-elidierte-wortlaut-vorgabe   → Prompt-Hygiene: eine Anweisung, die einen
 *     Wortlaut EXAKT/woertlich verlangt, darf ihn nicht zitiert-und-abgeschnitten
 *     ("… “") zeigen — das Modell kann die String-Grenze nicht bestimmen und
 *     dreht in eine Reasoning-Schleife (v2.284.1; Vorlaeufer: Beleg-Kontrakt-Rueckbau).
 *   - gutachten-entwurf-kein-plain-textarea → Gutachten-Entwurf nutzt den
 *     Live-Preview-Editor (MarkdownEditor + markdownLivePreview), kein rohes
 *     <textarea> (Buffer bleibt rohes Markdown = Ground-Truth, kein Roundtrip).
 *   - eval-gui-fictional-only            → Skill-Eval-GUI (dev): SkillEvalPanel +
 *     runEvalBatch importieren KEINE Real-Antrag-Pfade (listAllAntraegeListView,
 *     findVorhabensbeschreibung, doc:-Scan) — Fixtures nur via loadEvalFixtures();
 *     Scoring nur ueber das geteilte runJudge/aggregate (kein dup. Judge-Call).
 *   - aufbereitung-eval-fictional-only   → Aufbereitung-Eval (dev): eval-panel/
 *     importiert KEINE Real-Antrag-Pfade (gleicher Verbots-Katalog) — seit dem
 *     OpenRouter-Generierungs-Modus duerfen NUR gebrandete fiktive Fixtures
 *     (loadEvalFixtures + isFromEvalBundle) in einen externen Call gelangen.
 *   - home-widgets-local-only           → Home-Widget-Config + Notizen sind
 *     persoenliche Darstellungs-Daten: IDB primaer, Mirror NUR ueber
 *     savePersonalSettings; keine Share-/Snapshot-Writer unter
 *     src/plugins/home/widgets/, kein Widget-Key in SNAPSHOT_FILES.
 *   - no-raw-cta-fill                   → CTA-Buttons tragen die Profil-Primaerfarbe
 *     ueber die kanonische <Button>-Komponente (@/components/ui/button, variant=
 *     'primary' = --tf-primary); kein hand-gebauter Fill — weder als Klasse
 *     (`bg-[var(--tf-text)]`/`bg-[var(--tf-primary)]` + hover:opacity) noch inline
 *     (`background:'var(--tf-text)',color:'var(--tf-bg)'`). Inline '// allow-cta-fill'.
 *   - theme-token-contract              → Design-Handoff-Token-Vertrag (v2.119):
 *     jedes via var(--tf-…) OHNE Fallback in CSS/TSX/TS referenzierte Token MUSS
 *     global in src/theme.css definiert sein, sonst die "nackt"-Falle v2.67.1 (ein
 *     undefiniertes var() macht die GANZE CSS-Deklaration ungueltig). Mit-Fallback-
 *     Nutzung undefinierter Tokens nur Warnung. Ausnahme '// allow-tf-token: <grund>'.
 *   - screen-context-coverage           → Feedback-KI-Kontext (docs/feedback-kontext/):
 *     jede nicht-dev Plugin-ID (Text-Scan von src/plugins/index.ts(x) je Ordner, da ein
 *     Import von plugins.config.ts unter Vitest an pdfjs-dist-Workern bricht) hat
 *     ein eigenes Kontext-Doc oder ist Mitglied von KURATION_PLUGIN_IDS (teilt
 *     kuration.md); jedes Doc <= 2500 Zeichen (_app.md <= 4000) — Prompt-Budget-
 *     Schutz fuer die Bridge.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';
import { PRESET_COLORS } from '../components/ui/theme';
import { KURATION_PLUGIN_IDS } from '../core/services/feedback/screenContext';
// Datei-Walk + Such-Primitive liegen in der Lib; die REGELN bleiben hier
// (CLAUDE.md Doku-Konvention 4: alle Konventionen in EINER Datei).
import {
  ROOT, ALL_TS_FILES, ALL_SOURCE_FILES,
  relPath, findInFile, fmt, findFilesViolating,
  type Finding,
} from './conventions-lib';


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

describe('no-raw-clipboard (v2.301.3 — „Document is not focused")', () => {
  // Chrome lehnt `navigator.clipboard.writeText` ab, wenn das Dokument im selben
  // Tick den Fokus verliert (Kopier-Knopf neben einem Link, Dialog-Schluss,
  // window.open). Ohne Rueckfall + geworfenen Fehler behaelt die Zwischenablage
  // still ihren ALTEN Inhalt, und der Nutzer fuegt etwas Fremdes ein.
  // Einziger Schreibweg: kopiereText() aus src/core/utils/kopieren.ts.
  const pattern = /\bnavigator\s*\.\s*clipboard\b/;
  const HEIMAT = `${sep}core${sep}utils${sep}kopieren.ts`;

  it('kein direkter `navigator.clipboard`-Zugriff ausserhalb von core/utils/kopieren.ts', () => {
    const findings: Finding[] = [];
    for (const file of ALL_TS_FILES) {
      if (file.endsWith(HEIMAT)) continue;
      if (file.includes(`${sep}__tests__${sep}`) || file.endsWith('.test.ts')) continue;
      findings.push(...findInFile(file, l => pattern.test(l), 'allow-raw-clipboard'));
    }

    if (findings.length > 0) {
      const msg =
        `Direkter Zwischenablage-Zugriff verboten (v2.301.3).\n` +
        `Stattdessen:\n` +
        `  import { kopiereText } from '@/core/utils/kopieren';\n` +
        `  await kopiereText(text);   // faehrt den execCommand-Rueckfall und WIRFT,\n` +
        `                             // wenn beide Wege scheitern\n` +
        `Bei "kopieren und oeffnen": erst await kopiereText(...), DANN window.open().\n` +
        `Braucht die Stelle wirklich die rohe API (z.B. ClipboardItem fuer text/html),\n` +
        `Zeile mit '// allow-raw-clipboard: <grund>' markieren.\n\nTreffer:\n${fmt(findings)}`;
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

describe('no-blanket-idb-wipe (recurring-bug-classes Klasse 12)', () => {
  // Identitaet (`profile` + `onboarding-complete`) und die FSAPI-Handles
  // (`smb-handles`) leben ausschliesslich in der Varianten-IndexedDB. Wer sie
  // in einem Reset mitloescht, wirft den Nutzer zurueck in Onboarding +
  // Ordner-Auswahl. Konkreter Vorfall (v2.277): der Dev-Szenario-Reset nahm
  // `profile` + `onboarding-complete` mit — der Tester tippte nach JEDEM
  // Szenario-Klick Name und Kuerzel neu, waehrend die Ordner verbunden blieben.
  //
  // Erkennung dateiweit statt zeilenweise: gefaehrlich ist die KOMBINATION aus
  // "unpraefixiert alle Keys holen" und "loeschen". Ein blosses `keys()` zum
  // Anzeigen/Exportieren (StateInspectorPanel, exportCurrentState) ist harmlos,
  // ein praefix-gebundenes `keys('doc:')` + delete ebenfalls (trifft die
  // Setup-Keys gar nicht).
  const SETUP_KEYS_MODUL = 'storage/setup-keys';
  // Bewusst an den Receiver `idb` gebunden: `cache.keys()` auf einer Map o.ae.
  // hat mit dem kv-Store nichts zu tun (war ein Fehlalarm beim Bau des Guards).
  const holtAlleKeys = (line: string): boolean => /\bidb\.keys\(\s*\)/.test(line);
  const loescht = (line: string): boolean => /\bidb\.delete\(/.test(line);

  const ALLOWED_PATH_FRAGMENTS = [
    `${sep}__tests__${sep}`,
    `.test.ts`,
    // Der IDBStore implementiert keys()/delete() selbst — er IST der Mechanismus.
    `${sep}services${sep}storage${sep}idb-store.ts`,
  ];
  const isAllowed = (file: string): boolean =>
    ALLOWED_PATH_FRAGMENTS.some(frag => file.includes(frag));

  it('pauschales Leeren des kv-Stores muss die Setup-Schlüssel aussparen', () => {
    const findings: Finding[] = [];
    for (const file of ALL_TS_FILES) {
      if (isAllowed(file)) continue;
      const content = readFileSync(file, 'utf-8');
      if (content.includes(SETUP_KEYS_MODUL)) continue; // referenziert die kanonische Liste
      if (!content.split(/\r?\n/).some(loescht)) continue; // loescht gar nicht

      const lines = content.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        if (line.includes('allow-blanket-idb-wipe')) continue;
        const t = line.trim();
        if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) continue;
        if (holtAlleKeys(line)) {
          findings.push({ file: relPath(file), line: i + 1, text: t });
          break;
        }
      }
    }

    if (findings.length > 0) {
      const msg =
        `Pauschales kv-Leeren ohne Setup-Schutz (recurring-bug-classes Klasse 12).\n` +
        `Diese Datei holt ALLE kv-Keys (unpraefixiertes keys()) und loescht,\n` +
        `referenziert aber nicht '@/core/services/storage/setup-keys'.\n` +
        `Damit wuerde sie 'profile', 'onboarding-complete' und 'smb-handles'\n` +
        `mitnehmen — der Nutzer landet wieder im Onboarding und muss alle\n` +
        `Ordner neu verbinden.\n\n` +
        `Fix: 'istSetupKey(key)' aus setup-keys.ts als Filter nutzen.\n` +
        `Nur-lesende keys()-Nutzung oder ein bewusster Voll-Reset? Zeile mit\n` +
        `'// allow-blanket-idb-wipe: <grund>' markieren.\n\nTreffer:\n${fmt(findings)}`;
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
  // Plus der Assistenten-Pfad (chat/assistent/): dokument-tragend → nur intern,
  // die gegatete Wahl ist bridge.getTransportForAssistent(). Plus die Gedächtnis-
  // Konsolidierung (assistent/gedaechtnis/): bridge.getTransportForKonsolidierung().
  const SCOPE_FRAGMENTS = [
    `${sep}plugins${sep}antraege${sep}gutachten${sep}`,
    `${sep}plugins${sep}antraege${sep}gutachten-batch${sep}`,
    `${sep}core${sep}services${sep}gutachten-batch${sep}`,
    `${sep}plugins${sep}antraege${sep}nachforderungen${sep}`,
    `${sep}plugins${sep}chat${sep}assistent${sep}`,
    // Assistent Phase 2: Gedächtnis-Konsolidierung ist dokument-tragend (Protokoll-
    // daten) → nur intern, gegatete Wahl bridge.getTransportForKonsolidierung().
    `${sep}core${sep}services${sep}assistent${sep}gedaechtnis${sep}`,
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

/**
 * Alle Dateien, die Prompt-Text an ein LLM bauen. Der Guard hing frueher am Pfad
 * `skills/` und war damit blind fuer die Mehrheit der Prompts im Repo — Aufbereitung,
 * Assistent, MAP, Suche und die Gutachten-Teilgenerierung liegen alle woanders
 * (Prompt-Audit 2026-07). Tests sind ausgenommen: sie zitieren Alt-Staende absichtlich.
 */
const PROMPT_VERZEICHNISSE = [
  `${sep}skills${sep}`,
  `${sep}assistent${sep}`,
  `${sep}aufbereitung${sep}`,
  `${sep}gutachten${sep}`,
  `${sep}map-foerderfaehig${sep}`,
  `${sep}analyse${sep}`,
  `${sep}feedback${sep}`,
  `${sep}triage${sep}`,
  `${sep}klassifizierung${sep}`,
];
const PROMPT_DATEIEN = ALL_TS_FILES.filter(f =>
  PROMPT_VERZEICHNISSE.some(v => f.includes(v))
  && !f.includes(`${sep}__tests__${sep}`)
  && !f.endsWith('.test.ts'));

describe('keine-elidierte-wortlaut-vorgabe (Prompt-Hygiene)', () => {
  // Bug-Klasse, zweimal zugeschlagen: eine Prompt-Anweisung verlangt einen Wortlaut
  // EXAKT/woertlich und zeigt ihn zugleich zitiert-und-abgeschnitten („… “). Das ist
  // nicht erfuellbar — das Modell kann nicht entscheiden, ob das Auslassungszeichen zum
  // Wortlaut gehoert und wo er endet. Qwen suchte darauf im Reasoning wiederholt die
  // String-Grenze, degenerierte in Wiederholung und verbrauchte das Ausgabebudget: Lauf
  // ohne Antwort (Abschnitt G, v2.284.1). Richtig ist ein eigener, zeilenbegrenzter Block
  // ohne Anfuehrungszeichen (siehe abschnittTemplate.pflichtAnfang).
  //
  // Nur die KOMBINATION ist verboten. Ein „…“ zur reinen Veranschaulichung (grundsatz.ts:
  // „Das Vorhaben…“ statt „Der Antragsteller plant…“) fordert nichts Woertliches und
  // bleibt erlaubt.
  const LITERAL_WORT = /(exakt|wörtlich|wortgetreu|wortwörtlich|unverändert|buchstabengetreu|\b1:1\b)/i;
  const ELIDIERTES_ZITAT = /(…|\.\.\.)\s*[“”„»«"']/;

  it('keine Wortlaut-Vorgabe zeigt den Wortlaut zitiert-und-abgeschnitten', () => {
    const findings: Finding[] = [];
    for (const file of PROMPT_DATEIEN) {
      findings.push(...findInFile(
        file,
        l => LITERAL_WORT.test(l) && ELIDIERTES_ZITAT.test(l),
        'allow-elidierte-wortlaut-vorgabe',
      ));
    }
    if (findings.length > 0) {
      const msg =
        `Prompt verlangt einen Wortlaut EXAKT und zeigt ihn zugleich abgeschnitten.\n` +
        `Das Modell kann die String-Grenze nicht bestimmen und dreht in eine\n` +
        `Reasoning-Schleife, bis das Ausgabebudget aufgebraucht ist (Lauf ohne Antwort).\n` +
        `Statt zitiert-und-elidiert: eigener Block, unzitiert, auf eigener Zeile —\n` +
        `siehe abschnittTemplate.pflichtAnfang. Endet der Wortlaut absichtlich mitten im\n` +
        `Satz, muss der Prompt das ausdruecklich sagen. Echte Ausnahme (eingefrorener\n` +
        `Alt-Stand fuer die Migrations-Erkennung):\n` +
        `'// allow-elidierte-wortlaut-vorgabe: <grund>'.\n\nTreffer:\n${fmt(findings)}`;
      expect.fail(msg);
    }
  });

  // Zweite Form derselben Klasse: die Anweisung verbietet Pretty-Print und zeigt als
  // „genau diese Form" ein eingerücktes JSON-Beispiel. Beide Lesarten sind mit dem
  // Prompt vertraeglich — das Modell muss entscheiden, ob die Anweisung oder ihr
  // eigener Beleg gilt. Traf `steckbrief.ts` und `recherche-import.ts` (Audit 2026-07).
  const KOMPAKT_ANWEISUNG = /(kein\s+Pretty-Print|keine\s+Einrückung|kompakt\b)/i;
  const EINGERUECKTE_JSON_ZEILE = /^\s*(\+\s*)?['"`]?\s{2,}"[a-zA-Z_]+"\s*:/;

  it('keine Kompakt-Anweisung neben einem eingerueckten JSON-Beispiel', () => {
    const findings: Finding[] = [];
    for (const file of PROMPT_DATEIEN) {
      const zeilen = readFileSync(file, 'utf8').split(/\r?\n/);
      const hatKompakt = zeilen.some(l => KOMPAKT_ANWEISUNG.test(l));
      if (!hatKompakt) continue;
      zeilen.forEach((l, i) => {
        if (!EINGERUECKTE_JSON_ZEILE.test(l)) return;
        if (l.includes('allow-kompakt-vs-pretty-print')) return;
        findings.push({ file, line: i + 1, text: l.trim() });
      });
    }
    if (findings.length > 0) {
      const msg =
        `Der Prompt verbietet Pretty-Print und zeigt zugleich ein eingeruecktes\n` +
        `JSON-Beispiel als verbindliche Form. Das Modell kann nicht entscheiden, ob die\n` +
        `Anweisung oder ihr eigener Beleg gilt — beide Lesarten sind konsistent.\n` +
        `Beispiel und Anweisung muessen uebereinstimmen: Beispiel unindentiert schreiben\n` +
        `(Vorbild: verwertung.ts). Ausnahme: '// allow-kompakt-vs-pretty-print: <grund>'.\n` +
        `\nTreffer:\n${fmt(findings)}`;
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
  const MAX_FEATURE_FLAGS = 34;    // Ist 34; +1 'mapFoerderfaehig' (MAP Prüf-Workflow: Einreichungs-Import + editierbare Checkliste, dev); davor 33 (+1 'assistentGedaechtnis'); davor 32 (+1 'assistentPanel'); davor 31 (+1 'assistentProtokoll'); davor 30 (+1 'antragAufbereitung')
  const MAX_SERVICE_DIRS = 21;     // Ist 21; Konsolidierungs-Pass: 'review' + 'versioning' geloescht (MVP-Reste vom Maerz 2026, null Konsumenten). Davor 23 (+1 'assistent'), davor 22 (+ msg)
  const MAX_FILE_LOC = 1600;       // Ist ~1566 (DIESE Datei; Konsolidierungs-Pass: Scan-Infrastruktur nach conventions-lib.ts ausgelagert (-105), davor 1700 wegen +no-raw-clipboard; +keine-kompakt-anweisung-neben-json-beispiel + Prompt-Datei-Scope Audit 2026-07, +keine-elidierte-wortlaut-vorgabe v2.284.1, +no-blanket-idb-wipe v2.277.1 — kohaerenter Guard-Aggregator, waechst mit jeder Convention; +preset-contrast-contract v2.144 +no-parallel-scope-tabs v2.148 +no-raw-cta-fill v2.150 +cta-fill-Hex-Route v2.164 +screen-context-coverage v2.165 +arbeitskontext-log-idb-only v2.170 +aufbereitung-eval-fictional-only v2.223 +home-widgets-local-only v2.226 +notizen-strikt v2.229 +djb2-single-source v2.231); groesste Nicht-Test-Datei: 846 (smb-handle.ts)
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

describe('screen-context-coverage (Feedback-KI-Kontext: docs/feedback-kontext/)', () => {
  // Jede nicht-dev Plugin-ID braucht ein Kontext-Doc (direkt oder ueber das
  // gemeinsame kuration.md fuer Kuration-Plugins) — sonst arbeitet die
  // Feedback-Verbesserung (feedbackImprove.ts) mit unvollstaendigem App-Wissen.
  // Budget-Grenzen schuetzen das Bridge-Prompt (die Bridge traegt den Prompt
  // per DOM, Groesse ist teuer).
  const DOCS_DIR = join(ROOT, '..', 'docs', 'feedback-kontext');
  const MAX_DOC_CHARS = 2500;
  const MAX_APP_OVERVIEW_CHARS = 4000;

  // Text-Scan statt Import: plugins.config.ts importiert alle Plugin-Komponenten
  // (u.a. pdfjs-dist-Worker), was unter Vitest bricht. Jede Plugin-ID steht
  // textuell als `id: '...'` im jeweiligen src/plugins/<name>/index.ts(x).
  function collectAllPluginIds(): string[] {
    const pluginsDir = join(ROOT, 'plugins');
    const ids: string[] = [];
    for (const entry of readdirSync(pluginsDir)) {
      const dir = join(pluginsDir, entry);
      if (!statSync(dir).isDirectory()) continue;
      for (const candidate of ['index.ts', 'index.tsx']) {
        const file = join(dir, candidate);
        try {
          const src = readFileSync(file, 'utf-8');
          for (const m of src.matchAll(/\bid:\s*'([a-zA-Z0-9_-]+)'/g)) ids.push(m[1]!);
        } catch { /* Datei existiert nicht mit dieser Endung */ }
      }
    }
    return ids;
  }

  it('jede nicht-dev Plugin-ID hat ein Kontext-Doc (direkt oder via kuration.md)', () => {
    const files = new Set(readdirSync(DOCS_DIR));
    const missing = collectAllPluginIds()
      .filter(id => !id.startsWith('dev-'))
      .filter(id => !KURATION_PLUGIN_IDS.includes(id))
      .filter(id => !files.has(`${id}.md`));
    if (missing.length > 0) {
      expect.fail(
        `Fehlende Bildschirmseiten-Kontext-Docs fuer Plugin-IDs: ${missing.join(', ')}.\n` +
        `Neues Doc unter docs/feedback-kontext/<id>.md anlegen (Schablone: ` +
        `docs/feedback-kontext/README.md) oder die ID in KURATION_PLUGIN_IDS ` +
        `(src/core/services/feedback/screenContext.ts) aufnehmen, falls sie ein ` +
        `Kuration-Sammel-Doc teilt.`,
      );
    }
  });

  it(`jedes Kontext-Doc <= ${MAX_DOC_CHARS} Zeichen (_app.md <= ${MAX_APP_OVERVIEW_CHARS})`, () => {
    const findings: string[] = [];
    for (const entry of readdirSync(DOCS_DIR)) {
      if (!entry.endsWith('.md') || entry.toLowerCase() === 'readme.md') continue;
      const chars = readFileSync(join(DOCS_DIR, entry), 'utf-8').length;
      const limit = entry === '_app.md' ? MAX_APP_OVERVIEW_CHARS : MAX_DOC_CHARS;
      if (chars > limit) findings.push(`  ${entry}: ${chars} Zeichen (Limit ${limit})`);
    }
    if (findings.length > 0) {
      expect.fail(
        `Kontext-Doc(s) ueberschreiten das Prompt-Budget:\n${findings.join('\n')}\n` +
        `Kuerzen — die Bridge traegt den Prompt per DOM, Groesse ist teuer.`,
      );
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

describe('aufbereitung-eval-fictional-only (Aufbereitung-Eval dev: nur fiktive Fixtures)', () => {
  // DSGVO-Hardlock (Schwester von eval-gui-fictional-only): seit die Aufbereitung-Eval
  // einen OpenRouter-Generierungs-Modus hat (externer DirectLLMTransport), darf in
  // eval-panel/ NIE ein Real-Antrag-Datenpfad auftauchen — Fixtures ausschliesslich
  // aus dem gebrandeten Bundle (loadEvalFixtures + isFromEvalBundle-Assert im Panel).
  // Die runJudge/aggregate-Pflicht der Skill-Eval-GUI gilt hier NICHT (kein Judge —
  // Metriken sind deterministisch).
  const SCOPE = 'plugins/antraege/aufbereitung/eval-panel/';
  const isAufbereitungEval = (file: string): boolean => {
    const rel = relPath(file);
    return rel.includes(SCOPE) && !rel.includes('__tests__') && !rel.endsWith('.test.ts');
  };
  const isComment = (l: string): boolean => {
    const t = l.trim();
    return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
  };
  const FORBIDDEN = ['listAllAntraegeListView', 'findVorhabensbeschreibung', "entries('doc:", 'entries("doc:'];

  it('keine Real-Antrag-Pfade im Aufbereitung-Eval-Panel', () => {
    const findings: Finding[] = [];
    for (const file of ALL_TS_FILES) {
      if (!isAufbereitungEval(file)) continue;
      findings.push(...findInFile(
        file,
        l => !isComment(l) && FORBIDDEN.some(p => l.includes(p)),
        'allow-eval-gui-real-antrag',
      ));
    }
    if (findings.length > 0) {
      expect.fail(
        `Real-Antrag-Pfade im Aufbereitung-Eval-Panel verboten (DSGVO: der OpenRouter-Modus\n` +
        `darf nur fiktive Fixtures sehen). Fixtures ausschliesslich ueber loadEvalFixtures() beziehen.\n` +
        `Echte Ausnahme: '// allow-eval-gui-real-antrag: <grund>'.\n\nTreffer:\n${fmt(findings)}`,
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

describe('anfrage-no-mapping-in-transport (DSGVO: Mapping/Original nie an Transporte/Serialisierung)', () => {
  // Im Modul „Anfragen" sind `Anfrage.mapping` (Platzhalter→Original), `Anfrage.originalMd`
  // (echte Inhalte) und `Anfrage.verallgemeinerungen` (enthaelt `original`-Freitext) die
  // sensibelsten Strukturen. Sie duerfen nie in einer Sende-/Serialisierungs-Payload landen.
  // Der LEGITIME interne Anonymisierungs-Lauf nutzt getTransportForSkillRun()/runSkill()
  // (intern erzwungen) — diese Tokens stehen BEWUSST nicht in der Verbotsliste.
  const isAnfragen = (file: string): boolean =>
    relPath(file).includes('plugins/anfragen/') && !relPath(file).includes('__tests__');
  const SENDER = [
    'JSON.stringify', 'getActiveTransport', '.submitMessage(', '.submitConversation(',
    'clipboard.writeText', 'mailto:', 'fetch(',
  ];
  const PII = ['mapping', 'originalMd', 'verallgemeinerungen'];

  it('mapping/originalMd tauchen nie zusammen mit einem Transport-/Serialisierungs-Aufruf auf', () => {
    const findings: Finding[] = [];
    for (const file of ALL_TS_FILES) {
      if (!isAnfragen(file)) continue;
      findings.push(...findInFile(file, l => {
        const t = l.trim();
        if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return false;
        return PII.some(p => l.includes(p)) && SENDER.some(s => l.includes(s));
      }, 'allow-anfrage-transport'));
    }
    if (findings.length > 0) {
      expect.fail(
        `DSGVO: Anfrage.mapping/originalMd/verallgemeinerungen duerfen nie in eine Transport-/Serialisierungs-Payload\n` +
        `(JSON.stringify, getActiveTransport, submit*, clipboard, mailto, fetch). Der interne\n` +
        `Anonymisierungs-Lauf laeuft ueber getTransportForSkillRun()/runSkill(). Echte Ausnahme:\n` +
        `'// allow-anfrage-transport: <grund>'.\n\nTreffer:\n${fmt(findings)}`,
      );
    }
  });
});

describe('anfrage-export-only-via-guard (anonymisierter Export nur ueber pruefeExportSicher)', () => {
  // Der EXTERNE (anonymisierte) Export ins ZIM-Dashboard ist die einzige Grenze zwischen
  // PII und Zwischenablage → jede clipboard/mailto-Stelle im Anfragen-Modul muss
  // pruefeExportSicher referenzieren. AUSNAHME (per Inline-Marker): die finale, bewusst
  // DE-anonymisierte Antwort an den Original-Absender (Phase 8) — kein externer Leak.
  const isNotAnfragen = (file: string): boolean =>
    !relPath(file).includes('plugins/anfragen/') || relPath(file).includes('__tests__');
  const trigger = (l: string): boolean =>
    l.includes('clipboard.writeText') || l.includes('mailto:');

  it('clipboard/mailto im Anfragen-Modul referenzieren pruefeExportSicher (oder sind markiert)', () => {
    const findings = findFilesViolating(trigger, 'pruefeExportSicher', 'allow-anfrage-export', isNotAnfragen);
    if (findings.length > 0) {
      expect.fail(
        `Anonymisierter Export muss ueber pruefeExportSicher gehen (Button-Enable an dessen\n` +
        `Ergebnis). Datei mit clipboard/mailto ohne pruefeExportSicher-Bezug gefunden. Fuer die\n` +
        `finale de-anonymisierte Antwort (Phase 8): Zeile mit '// allow-anfrage-export: <grund>'.\n\n` +
        `Treffer:\n${fmt(findings)}`,
      );
    }
  });
});

describe('preset-contrast-contract (CTA-Primaerfarbe lesbar gegen weissen Vordergrund)', () => {
  // Die Default-CTA (bg-primary text-primary-foreground) traegt seit dem Token-Fix
  // die gewaehlte Primaerfarbe als Flaeche mit WEISSEM Vordergrund (--tf-on-primary).
  // Jedes PRESET_COLORS-Preset muss daher >= 4,5:1 (WCAG AA Normaltext) gegen #fff
  // liegen — sonst wird der CTA-Text unleserlich. Verhindert, dass ein kuenftig
  // hinzugefuegtes (zu helles) Preset die Lesbarkeit bricht. (HSL->sRGB->relative
  // Luminanz->Kontrast; Schwelle 4,5. Dark veraendert nur Bg/Text, nicht --tf-primary.)
  const THRESHOLD = 4.5;

  function hslToRgb(h: number, s: number, l: number): [number, number, number] {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const hp = ((h % 360) + 360) % 360 / 60;
    const x = c * (1 - Math.abs((hp % 2) - 1));
    let r = 0, g = 0, b = 0;
    if (hp < 1) [r, g, b] = [c, x, 0];
    else if (hp < 2) [r, g, b] = [x, c, 0];
    else if (hp < 3) [r, g, b] = [0, c, x];
    else if (hp < 4) [r, g, b] = [0, x, c];
    else if (hp < 5) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    const m = l - c / 2;
    return [r + m, g + m, b + m];
  }

  function relLuminance([r, g, b]: [number, number, number]): number {
    const lin = (v: number): number => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  }

  // Kontrast gegen Weiss (relative Luminanz 1,0).
  function contrastVsWhite(h: number, s: number, l: number): number {
    const lum = relLuminance(hslToRgb(h, s, l));
    return (1.0 + 0.05) / (lum + 0.05);
  }

  it(`jedes PRESET_COLORS-Preset hat >= ${THRESHOLD}:1 gegen #fff`, () => {
    const failing = PRESET_COLORS
      .map(p => {
        const s = parseFloat(p.s) / 100;
        const l = parseFloat(p.l) / 100;
        return { name: p.name, ratio: contrastVsWhite(p.h, s, l) };
      })
      .filter(r => r.ratio < THRESHOLD);

    if (failing.length > 0) {
      expect.fail(
        `Preset(s) mit zu geringem Kontrast fuer weissen CTA-Text (Schwelle ${THRESHOLD}:1):\n` +
        failing.map(r => `  - ${r.name}: ${r.ratio.toFixed(2)}:1`).join('\n') +
        `\nFix: Lightness (l) des Presets in src/components/ui/theme.ts (PRESET_COLORS) senken, ` +
        `bis der Kontrast >= ${THRESHOLD}:1 ist (vgl. Bernstein 42% -> 40%).`,
      );
    }
  });
});

describe('no-parallel-scope-tabs (Listen-Sicht-Tabs gehören in ScopeTabs)', () => {
  // Die unterstrichene Aktiv-Tab-Signatur 'border-b-2 border-[var(--tf-primary)]' ist
  // die kanonische Darstellung der Listen-Sicht-Tabs (ScopeTabs variant='tabs';
  // Förderanträge + Chat sind konsolidiert). Seit v2.151.2 trägt der aktive Tab den
  // Profil-Akzent (--tf-primary) statt Schwarz (--tf-text). Sie darf außerhalb des
  // Primitivs nicht neu hand-gebaut werden, sonst driften die Tabs wieder auseinander.
  // Generische Section-/Settings-Navigation nutzt @/components/ui/tabs (Inline-Style-
  // Border, trifft diese Tailwind-Signatur NICHT).
  const SIGNATURE = 'border-b-2 border-[var(--tf-primary)]';
  // Kanonische Heimat + bewusst grandfatherte Bestands-Tabs (außerhalb des
  // schlanken Umfangs dieser Schicht-Einführung; Migration als spätere Phase offen,
  // siehe docs/layout-audit.md → „Adoptions-Status"):
  const ALLOWED_SUFFIXES = [
    'components/ui/ScopeTabs.tsx',                                // Primitiv-Definition
    'plugins/skill-verwaltung-kuration/SkillVerwaltungPage.tsx', // gezählte Tabs, ScopeTabs-Kandidat (später)
    'plugins/skill-verwaltung-kuration/SkillEditor.tsx',         // 2-Tab-Nav mit Border-Container (anderes Muster)
  ];
  const isAllowed = (file: string): boolean => {
    const rel = relPath(file);
    return rel.includes('/__tests__/') || ALLOWED_SUFFIXES.some(s => rel.endsWith(s));
  };

  it('keine hand-gebaute ScopeTabs-Unterstrich-Signatur außerhalb des Primitivs', () => {
    const findings: Finding[] = [];
    for (const file of ALL_TS_FILES) {
      if (isAllowed(file)) continue;
      findings.push(...findInFile(file, l => l.includes(SIGNATURE), 'allow-scope-tabs'));
    }
    if (findings.length > 0) {
      expect.fail(
        `Unterstrichene Listen-Sicht-Tabs gehören in das ScopeTabs-Primitiv\n` +
        `(@/components/ui/ScopeTabs, variant='tabs') — nicht hand-bauen. Vordefinierte\n` +
        `Listen-Sichten mit Zähler → ScopeTabs; generische Navigation → @/components/ui/tabs.\n` +
        `Echte Ausnahme: '// allow-scope-tabs: <grund>' auf der Zeile (oder Pfad in\n` +
        `ALLOWED_SUFFIXES mit Begründung).\n\nTreffer:\n${fmt(findings)}`,
      );
    }
  });
});

describe('arbeitskontext-log-idb-only (Journey Phase 2 — rein lokales Log)', () => {
  // Das Arbeitskontext-Log (Home-„Weitermachen") ist strikt gerätelokal (IDB) und
  // darf NIE auf den Daten-Share / in den persönlichen Ordner gespiegelt oder
  // exportiert werden (Datenschutz-Leitplanke; Präzedenz embedding-caches-machine-
  // local). Struktureller Schutz: der Service referenziert keine Share-/Mirror-
  // Schreibpfade.
  it('arbeitskontext-log.ts nutzt ausschließlich IDB (kein Share-/Mirror-Write)', () => {
    const file = join(ROOT, 'core', 'services', 'personal-storage', 'arbeitskontext-log.ts');
    const content = readFileSync(file, 'utf-8');
    const verboten = [
      'mirrorJsonToPersonal',
      'atomicWrite',
      'appendToFile',
      'getPersoenlichHandle',
      'writeProfileToShare',
      'writeEinstellungenToShare',
    ];
    // Nur echte Code-Referenzen zählen — Doku/Kommentar-Erwähnungen (die den Guard
    // begründen) werden anhand des Zeilen-Prefixes ausgenommen.
    const lines = content.split(/\r?\n/);
    const treffer = verboten.filter(v =>
      lines.some(l => {
        const t = l.trim();
        if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return false;
        return l.includes(v);
      }),
    );
    expect(
      treffer,
      `arbeitskontext-log.ts muss IDB-only bleiben (kein Share-/Mirror-Write).\n`
      + `Verbotene Referenz(en) gefunden: ${treffer.join(', ')}`,
    ).toEqual([]);
  });
});

describe('home-widgets-local-only (Home-Widget-Config: nie Daten-Share/Snapshot)', () => {
  // Die Home-Widget-Config (+ Notizen) ist persoenliche DARSTELLUNGS-Config:
  // IDB primaer (kv-Keys `home-widgets-config` / `home-notizen`), optional
  // gespiegelt AUSSCHLIESSLICH ueber den sanktionierten PersonalEinstellungen-
  // Pfad (savePersonalSettings, persoenliches Laufwerk). Sie darf NIE auf den
  // geteilten Daten-Share, in registry.json oder in den SMB-Snapshot gelangen
  // (Vorbild: Assistent-Stores, Pitfall #37). Zwei strukturelle Checks:
  it('widgets/-Module referenzieren keine Share-/Snapshot-Writer', () => {
    const widgetFiles = ALL_TS_FILES.filter(f => {
      const p = relPath(f);
      return p.startsWith('src/plugins/home/widgets/') && !p.includes('__tests__');
    });
    // atomicWrite/appendToFile = rohe Share-Writes; writeProgrammSnapshot* =
    // SMB-Snapshot; getSmbHandle = Daten-Share-Handle; mirrorJsonToPersonal
    // bewusst mit verboten — der Personal-Mirror laeuft ueber genau EINEN
    // Mechanismus (savePersonalSettings), nicht ueber zwei.
    const verboten = [
      'atomicWrite',
      'appendToFile',
      'writeProgrammSnapshot',
      'getSmbHandle',
      'mirrorJsonToPersonal',
    ];
    const treffer: string[] = [];
    for (const file of widgetFiles) {
      const lines = readFileSync(file, 'utf-8').split(/\r?\n/);
      for (const v of verboten) {
        const hit = lines.some(l => {
          const t = l.trim();
          if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return false;
          return l.includes(v);
        });
        if (hit) treffer.push(`${relPath(file)} → ${v}`);
      }
    }
    expect(
      treffer,
      `Home-Widget-Module muessen lokal bleiben (IDB + savePersonalSettings-Mirror).\n`
      + `Verbotene Referenz(en): ${treffer.join(', ')}`,
    ).toEqual([]);
  });

  it('Snapshot-Allowlist (snapshot.ts) kennt keine Widget-/Notizen-Keys', () => {
    const snapshot = readFileSync(join(ROOT, 'core', 'services', 'csv', 'snapshot.ts'), 'utf-8');
    for (const key of ['home-widgets', 'home-notizen']) {
      expect(
        snapshot.includes(key),
        `snapshot.ts darf '${key}' nicht kennen — die Widget-Config ist geraetelokal `
        + `(kv-Store, strukturell ausserhalb von SNAPSHOT_FILES).`,
      ).toBe(false);
    }
  });

  it('notizenStore.ts bleibt strikt IDB-only (auch KEIN Personal-Mirror)', () => {
    // Der Notiz-TEXT ist strenger als die Widget-Config: wie arbeitskontext-log
    // NIE in den persoenlichen Ordner — daher zusaetzlich savePersonalSettings +
    // getPersoenlichHandle verboten.
    const file = join(ROOT, 'plugins', 'home', 'widgets', 'notizenStore.ts');
    const content = readFileSync(file, 'utf-8');
    const verboten = [
      'savePersonalSettings',
      'getPersoenlichHandle',
      'mirrorJsonToPersonal',
      'atomicWrite',
      'appendToFile',
      'writeEinstellungenToShare',
    ];
    const lines = content.split(/\r?\n/);
    const treffer = verboten.filter(v =>
      lines.some(l => {
        const t = l.trim();
        if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return false;
        return l.includes(v);
      }),
    );
    expect(
      treffer,
      `notizenStore.ts muss strikt geraetelokal bleiben (nur idb.get/set/delete).\n`
      + `Verbotene Referenz(en): ${treffer.join(', ')}`,
    ).toEqual([]);
  });
});

describe('djb2-single-source (Feedback-Signatur nicht duplizieren)', () => {
  // Die Feedback-Antwort-Signatur (djb2 → base36) lebt genau EINMAL in
  // useUnreadReplies.signatureOf; das Feedback-Neuigkeiten-Widget
  // (feedbackNews.ts) importiert sie wieder, statt djb2 zu kopieren. Scope
  // bewusst auf Feedback + Home-Widgets begrenzt — die gutachten-Domaene hat
  // ihren eigenen, unabhaengigen freigabeHash-djb2 (runner.hashText).
  it('die djb2-Konstante 5381 kommt im Feedback-/Widget-Scope nur in useUnreadReplies vor', () => {
    const treffer = ALL_TS_FILES.filter(f => {
      const p = relPath(f);
      const imScope = p.startsWith('src/components/feedback/')
        || p.startsWith('src/plugins/home/widgets/')
        || p.startsWith('src/plugins/feedback');
      if (!imScope) return false;
      return readFileSync(f, 'utf-8').split(/\r?\n/).some(l => {
        const t = l.trim();
        if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return false;
        return /\b5381\b/.test(l);
      });
    }).map(relPath);
    expect(
      treffer,
      `djb2 (h = 5381) darf im Feedback-/Widget-Scope nur EINMAL existieren `
      + `(useUnreadReplies.signatureOf); Konsumenten importieren die Funktion. `
      + `Gefunden in: ${treffer.join(', ')}`,
    ).toEqual(['src/components/feedback/useUnreadReplies.ts']);
  });
});

describe('no-raw-cta-fill (CTA-Buttons tragen die Profil-Primaerfarbe via <Button>)', () => {
  // Gefuellte primaere CTAs gehoeren an die kanonische Komponente <Button> aus
  // @/components/ui/button (variant='primary'/'default' = bg-primary = --tf-primary,
  // der vom User waehlbare Profil-Akzent; seit v2.144). Ein hand-gebauter <button>/<a>
  // mit eigenem `bg-[var(--tf-text)]`- oder `bg-[var(--tf-primary)]`-Fill haengt sich
  // davon ab und wirkt schwarz statt im Akzent (DESIGN_GUIDE „Button").
  //
  // Zwei Mechaniken, beide praezise:
  //  (a) Tailwind-Klassen-Fill + `hover:opacity` — trifft NUR gefuellte Klick-CTAs.
  //      Toggle-Pills (Aktiv-Fill im Ternary), Badge-Style-Maps, Switch-Thumbs, Chat-
  //      Bubbles, Vorschau-Chip, Progress-Bars haben KEIN `hover:opacity` → kein
  //      False-Positive.
  //  (b) Inline-Style-Fill `background: 'var(--tf-text)', color: 'var(--tf-bg)'` — die
  //      Auslastungs-Mechanik (v2.151). Das exakte bg+color-PAAR trifft nur gefuellte
  //      CTAs; Progress-Bars/Marker (nur `background`, keine paired `color: var(--tf-bg)`)
  //      und Pills (Akzent-Light) bleiben aussen vor.
  //  (c) Literal OPAKES Schwarz als Inline-Background (Hex-Analog zu (b), v2.164): #000/
  //      #000000/black/rgb(0,0,0). rgba(0,0,0,α)-Modal-Backdrops (Alpha) + Pastell-Boxen
  //      (#fee2e2 …) bleiben aussen vor. Forward-looking: aktuell 0 Treffer.
  // Inline-Ausnahme: '// allow-cta-fill: <grund>'.
  const CLASS_FILLS = [
    'bg-[var(--tf-text)] text-[var(--tf-bg)]',
    'bg-[var(--tf-primary)] text-white',
    'bg-[var(--tf-primary)] text-[var(--tf-primary-foreground)]',
  ];
  const INLINE_FILLS = [
    "background: 'var(--tf-text)', color: 'var(--tf-bg)'",
    'background: "var(--tf-text)", color: "var(--tf-bg)"',
  ];
  const INLINE_BLACK_FILL = /(?:background|backgroundColor)\s*:\s*['"](?:#000(?:000)?|black|rgb\(\s*0\s*,\s*0\s*,\s*0\s*\))['"]/i;
  const isCtaFill = (l: string): boolean =>
    (l.includes('hover:opacity') && CLASS_FILLS.some(f => l.includes(f)))
    || INLINE_FILLS.some(f => l.includes(f))
    || INLINE_BLACK_FILL.test(l);

  // Sanity: schwarze/CTA-Fills treffen, neutrale Flaechen (rgba-Overlays, Pastell-Boxen) nicht.
  it('isCtaFill: Treffer nur bei gefuellten CTAs', () => {
    const hits = [
      "background: '#000', color: 'white'", 'backgroundColor: "#000000"', "background: 'black'",
      "background: 'rgb(0, 0, 0)'", 'bg-[var(--tf-primary)] text-white hover:opacity-90',
      "background: 'var(--tf-text)', color: 'var(--tf-bg)'",
    ];
    const misses = [ // Backdrop, Pastell-Box, Teal-Badge, Fill ohne hover:opacity
      "background: 'rgba(0,0,0,0.4)'", "background: '#fee2e2', color: '#991b1b'",
      "background: '#075985', color: 'white'", 'bg-[var(--tf-primary)] text-white',
    ];
    for (const l of hits) expect(isCtaFill(l), l).toBe(true);
    for (const l of misses) expect(isCtaFill(l), l).toBe(false);
  });

  it('kein hand-gebauter gefuellter CTA-Fill (Button-Komponente nutzen)', () => {
    const findings: Finding[] = [];
    for (const file of ALL_TS_FILES) {
      if (!file.endsWith('.tsx')) continue;
      if (file.includes(`${sep}__tests__${sep}`)) continue;
      findings.push(...findInFile(file, isCtaFill, 'allow-cta-fill'));
    }
    if (findings.length > 0) {
      expect.fail(
        `Hand-gebauter gefuellter CTA-Button verboten (DESIGN_GUIDE „Button").\n` +
        `Nutze die kanonische Komponente <Button> aus @/components/ui/button:\n` +
        `  <Button variant="primary" icon={Icon} loading={x.busy} onClick={…}>Speichern</Button>\n` +
        `variant='primary' traegt die vom User waehlbare Profil-Primaerfarbe (--tf-primary);\n` +
        `Zweitaktion = variant='secondary' (Outline), Anker = <Button asChild><a>…</a></Button>.\n` +
        `Bewusste Nicht-Button-Flaeche (Toggle-Pill/Badge/Chip): Fill OHNE hover:opacity halten\n` +
        `oder Zeile mit '// allow-cta-fill: <grund>' markieren.\n\nTreffer:\n${fmt(findings)}`,
      );
    }
  });
});
