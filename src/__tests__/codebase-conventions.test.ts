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
 *   - no-direct-feedback-user-id-compare → v3.7, Feedback-Zugehoerigkeit ueber
 *     istMeinTicket/istMeineId (Kuerzel UND Profilname), nie `user_id === meId`.
 *   - no-raw-async-onclick              → Pitfall #15, useAsyncAction-Hook.
 *   - no-raw-worker                     → Pitfall #5, Worker als
 *     `?worker&inline`-Import einbinden (file://-Kompat).
 *   - no-raw-clipboard                  → v2.301.3, Zwischenablage nur ueber
 *     kopiereText() aus src/core/utils/kopieren.ts (execCommand-Rueckfall +
 *     wirft statt still zu scheitern); "kopieren und oeffnen" erst kopieren.
 *   - no-inline-frist-arithmetik        → v3.6, keine literale 90/84 in Frist-Naehe
 *     ausserhalb von csv/frist.ts + csv/frist-ergebnis.ts. Die Konstante
 *     ANTRAG_SLA_DAYS zu benutzen ist ausdruecklich erwuenscht; sie zu
 *     ABSCHREIBEN war der Fehler (drei Achsen mit eigenen Literalen).
 *   - no-headless-tree-outside-wrapper  → Tree-Basis (v2.393): @headless-tree/*
 *     nur in src/components/tree/; Verbraucher nutzen TfTree statt einen zweiten
 *     Baum mit eigenem Aufklapp-/Auswahl-/DnD-Verhalten zu bauen.
 *   - no-plugins-config-in-components   → Konsolidierungs-Pass, src/components/
 *     (geteilte Blatt-Schicht) importiert nicht @/plugins.config; Plugin-Wissen
 *     kommt als Prop oder via useNavigation().activeName herein.
 *   - no-hardcoded-datenshare-mode      → Pitfall #25, Daten-Share-Modus
 *     ('read'/'readwrite') ausschliesslich via canWriteDatenShare() entscheiden,
 *     nicht `isKurator ? 'readwrite' : 'read'` hart kodieren.
 *   - no-raw-modal                      → recurring-bug-classes Klasse 7, Modals
 *     ueber den Dialog aus @/components/ui/dialog rendern (Hoehen-Cap + Scroll
 *     eingebaut) statt per Hand `fixed inset-0`.
 *   - no-new-tf-ui-files                → P1b, src/ui/ ist nur noch Re-Export-Shim;
 *     neue UI-Komponenten gehoeren nach src/components/ui/.
 *   - local-fs-gate-eingegrenzt         → Variante „local" (feste Entwickler-Ordner
 *     statt FSAPI-Picker): das Define __TEAMFLOW_LOCAL_FS__ nur im local-fs-Adapter
 *     und den benannten Einhaengepunkten; window.__tf importiert nichts aus local-fs/.
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
 *   - status-kurzlabel-single-source   → die Kurzform eines Rohstatus hat EINE
 *     Quelle (StatusCodeEintrag.kurz + kuratiertes StatusWertEintrag.kurzLabel),
 *     gelesen ueber statusKurzLabel()/statusLabel() in core/utils/
 *     status-wert-labels.ts. Bis v3.15 waren es drei Kopien — eine mit
 *     Tippfehler, eine auf eine Schreibweise geschluesselt, die im Bestand nicht
 *     vorkommt. Geprueft wird die Herkunft (kein STATUS_LABEL_OVERRIDES/
 *     shortStatus, kein Import der entfernten Symbole, status-mappings.ts
 *     beschriftet nicht mehr) plus eine kuratierte Literal-Sperre.
 *   - zah-phasen-snapshot-single-writer → ZAH-Phasen sind seit v2.409 kuratierbare
 *     Daten; welcher Schnitt GILT, steht in zwei Modul-Registern in
 *     core/status/zah-phasen.ts. Gesetzt werden sie NUR von
 *     setStatusKatalogSnapshot() in core/status/snapshot.ts (Tests:
 *     resetZahPhasenSnapshotFuerTests). Zweiter Teil: zahPhasenVon() liefert nie
 *     eine leere Liste — ein '?? []' daneben ist ein Missverstaendnis.
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
 *   - kuerzel-genau-ein-speicherort     → Pitfall #44 / v2.376: die vier kanonisch
 *     belegten Kuerzel (AAE/ABB/AZ1/VBE) duerfen im Vorgangssystem-Scope kein
 *     zweites `D_<code>`-Feld bekommen — das kanonische Feld gewinnt den Wert,
 *     das Code-Feld bleibt leer, und alles was am Code haengt antwortet „nie
 *     gesetzt". Spaltenname immer ueber todoFeld()/feld().
 *   - screen-context-coverage           → Feedback-KI-Kontext (docs/feedback-kontext/):
 *     jede nicht-dev Plugin-ID (Text-Scan von src/plugins/index.ts(x) je Ordner, da ein
 *     Import von plugins.config.ts unter Vitest an pdfjs-dist-Workern bricht) hat
 *     ein eigenes Kontext-Doc oder ist Mitglied von KURATION_PLUGIN_IDS (teilt
 *     kuration.md). KEIN Zeichen-Budget mehr, nur eine Reissleine (10000) gegen
 *     ausufernde Docs — die Disziplin ist inhaltlich (WAS statt WIE), nicht numerisch.
 *   - verlauf-leitet-keinen-status-ab   → Pitfall #44 / Phase 1b: die Verlaufsableitung
 *     rekonstruiert die VERGANGENHEIT; der Pfad, der den GELTENDEN Status bestimmt
 *     (status-canonical, snapshot, kategorie-ableitung, zah-phasen, phasen-schnitt),
 *     darf sie nicht importieren. Sonst entsteht die zweite Ableitung wieder, die
 *     mit v2.385 zurueckgebaut wurde. Die Richtung ist verlauf/ → status, nie zurueck.
 *   - trigger-regeln-nur-im-verlauf     → Phase 1b: KUERZEL_TRIGGER_REGELN sind
 *     ausnahmslos `aktiv: false` (erfasst, nicht wirksam). Gelesen werden sie nur in
 *     src/core/status/verlauf/; ein zweiter Konsument waere der Weg, sie versehentlich
 *     scharf zu schalten.
 *   - band-fuellung-kontrast           → VerlaufsBand (v3.38): jedes --tf-kanban-*
 *     Token, zu TOENUNG auf --tf-bg gemischt, muss >= 4,5:1 gegen --tf-text erreichen —
 *     in BEIDEN Modi, an den echten Werten aus theme.css. Der Stand bis v3.37 (satte
 *     Fuellung, weisse Schrift) lag bei 3,02-5,06:1 hell und 2,14-2,92:1 dunkel; ein
 *     zweiter Testfall haelt fest, dass der Guard genau den verworfen haette.
 *   - no-index-punkt-id                 → Klaerung (v2.412): eine Punkt-Id im Seed von
 *     src/plugins/zu-klaeren/ darf NIE aus einem Schleifenindex entstehen. Die Antworten
 *     liegen append-only auf dem Share und zeigen auf die Id; ein eingefuegter Punkt
 *     verschoebe sonst lautlos alle Antworten dahinter, und korrigieren laesst sich das
 *     nicht. Aus DATEN abgeleitete Ids (`code-${code}`) sind ausdruecklich erlaubt.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';
import { PRESET_COLORS } from '../components/ui/theme';
import { KURATION_PLUGIN_IDS } from '../core/services/feedback/screenContext';
import { KANONISCHE_CODE_FELDER } from '../core/status/seed-kanonisch';
import { ebenenKonflikte } from '../core/status/seed-codes';
import { baueSeedVersion } from '../core/status/seed';
import { JOURNAL_AUSGESCHLOSSEN } from '../core/status/journal/felder';
// Datei-Walk + Such-Primitive liegen in der Lib; die REGELN bleiben hier
// (CLAUDE.md Doku-Konvention 4: alle Konventionen in EINER Datei).
import {
  ROOT, ALL_TS_FILES, ALL_SOURCE_FILES,
  relPath, findInFile, fmt, findFilesViolating,
  hslToRgb, relLuminance, kontrast, mische, parseCssFarbe, themeFarbTokens,
  type Finding, type ThemeFarbSatz,
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

describe('kuerzel-nie-flach (v3.13 — Kürzel × Projektform)', () => {
  // Dieselbe Abkuerzung bedeutet je nach Projektform etwas anderes: `AB` ist in
  // DL die „Bewilligungsempfehlung durch Haushaltsbeauftragte", sonst
  // „bewilligungsreif/Akte an Euronorm". Gemessen am Produktivbestand tragen
  // 11 216 von 14 222 Antraegen (78,9 %) mindestens ein Kuerzel, dessen flach
  // nachgeschlagener Klartext fuer ihre Projektform falsch ist.
  //
  // Die Rohtabelle darf deshalb nur ihre eigene Tuer kennen: wer sie direkt
  // importiert, kann `formen` nach Belieben anfassen und baut den flachen
  // Zugriff nach.
  const rohImport = /from\s+['"](?:[^'"]*\/)?kuerzel-katalog\.data['"]/;
  const HEIMAT = `${sep}core${sep}status${sep}kuerzel-katalog.ts`;

  it('KUERZEL_KATALOG wird nur von kuerzel-katalog.ts importiert', () => {
    const findings: Finding[] = [];
    for (const file of ALL_TS_FILES) {
      if (file.endsWith(HEIMAT)) continue;
      if (file.includes(`${sep}__tests__${sep}`) || file.endsWith('.test.ts')) continue;
      findings.push(...findInFile(file, l => rohImport.test(l), 'allow-kuerzel-flach'));
    }

    if (findings.length > 0) {
      const msg =
        `Der Kuerzel-Katalog wird nur ueber seine Tuer nachgeschlagen (v3.13).\n` +
        `Stattdessen:\n` +
        `  import { kuerzelAuskunft, projektformVonVbPhase } from '@/core/status';\n` +
        `  const pf = projektformVonVbPhase(antrag.vb_phase);   // null = unbekannt\n` +
        `  const a = kuerzelAuskunft(code, pf);\n` +
        `  if (!a.eindeutig) { /* Kuerzel zeigen, keine geratene Bedeutung */ }\n` +
        `Flach nachgeschlagen zeigt die App fuer 78,9 % der Antraege den falschen\n` +
        `Klartext — das war der Zustand bis v3.13.\n\nTreffer:\n${fmt(findings)}`;
      expect.fail(msg);
    }
  });
});

describe('verlauf-leitet-keinen-status-ab (Phase 1b — Pitfall #44)', () => {
  // Die Verlaufsableitung rekonstruiert die VERGANGENHEIT aus den `D_`-Spalten.
  // Der GELTENDE Status kommt weiter aus dem Export und wird nie berechnet —
  // genau das war die Ableitungs-Engine, die mit v2.385 zurueckgebaut wurde
  // (485 von 7 534 Verbuenden sagten etwas anderes als das Fachsystem).
  //
  // Der Guard haelt die Trennung an der einzigen Stelle, an der sie mechanisch
  // pruefbar ist: der Pfad, der den geltenden Status bestimmt, darf das
  // Verlaufs-Modul nicht kennen. Umgekehrt ist erlaubt.
  const verlaufImport = /from\s+['"][^'"]*(?:core\/status\/verlauf|\.\/verlauf|\.\.\/verlauf)['"]/;
  const STATUS_PFAD = [
    `${sep}core${sep}utils${sep}status-canonical.ts`,
    `${sep}core${sep}status${sep}snapshot.ts`,
    `${sep}core${sep}status${sep}kategorie-ableitung.ts`,
    `${sep}core${sep}status${sep}zah-phasen.ts`,
    `${sep}core${sep}status${sep}phasen-schnitt.ts`,
  ];

  it('der Status-Pfad kennt das Verlaufs-Modul nicht', () => {
    const findings: Finding[] = [];
    let gescannt = 0;
    for (const file of ALL_TS_FILES) {
      if (!STATUS_PFAD.some(p => file.endsWith(p))) continue;
      gescannt++;
      findings.push(...findInFile(file, l => verlaufImport.test(l), 'allow-verlauf-im-status-pfad'));
    }
    expect(gescannt, 'Pfad-Filter trifft keine Datei — der Guard prueft nichts')
      .toBe(STATUS_PFAD.length);

    if (findings.length > 0) {
      const msg =
        `Die App leitet keinen geltenden Status ab (Pitfall #44).\n` +
        `src/core/status/verlauf/ rekonstruiert die Vergangenheit; wer den\n` +
        `AKTUELLEN Status bestimmt, darf davon nichts wissen — sonst entsteht\n` +
        `die zweite Ableitung wieder, die mit v2.385 zurueckgebaut wurde.\n` +
        `Die Abhaengigkeit laeuft nur in eine Richtung: verlauf/ → status.\n\n` +
        `Treffer:\n${fmt(findings)}`;
      expect.fail(msg);
    }
  });
});

describe('status-ebene-folgt-x-praefix (Phase 2a)', () => {
  // Die SETZEBENE eines Statusfeldes steht nicht frei: das Fachsystem erzwingt
  // sie ueber das Kuerzel selbst — `X` am Anfang heisst Verbund, alles andere
  // Teilvorhaben. `ebeneVonCode` leitet das beim Katalogbau ab; wer die `ebene`
  // eines Seed-Eintrags spaeter von Hand setzt, haengt den Termin an die falsche
  // Bahn und die Verlaufsableitung rechnet ihn dem falschen Objekt zu.
  //
  // Hier bricht der Build, weil der Seed UNSERE Daten sind. Eine kuratierte
  // Fassung meldet sich stattdessen zur Laufzeit laut (`snapshot.ts`): ein Wurf
  // beim Aktivieren naehme dem Team die ganze App statt ihm den Datenfehler zu
  // zeigen — dieselbe Abwaegung wie in `programmNummer.ts`.
  //
  // NICHT zu verwechseln mit der WIRKUNGSEBENE: `ABB` traegt kein `X`, wird am
  // Teilvorhaben gesetzt und kippt ueber seine C16-Zeile trotzdem den
  // Verbundstatus. Zwei Felder, nie eines.
  it('kein Seed-Statusfeld widerspricht seinem Code', () => {
    const konflikte = ebenenKonflikte(baueSeedVersion().felder);
    const felder = baueSeedVersion().felder.filter(f => f.code).length;
    expect(felder, 'Seed traegt keine Code-Felder — der Guard prueft nichts')
      .toBeGreaterThan(400);
    expect(
      konflikte.map(k => `${k.feldId} (${k.code}: ist ${k.ist}, soll ${k.soll})`),
      'X am Codeanfang heisst Verbund-Ebene, alles andere Teilvorhaben',
    ).toEqual([]);
  });
});

describe('trigger-regeln-nur-im-verlauf (Phase 1b)', () => {
  // `KUERZEL_TRIGGER_REGELN` sind ausnahmslos `aktiv: false`: importiert heisst
  // erfasst und pruefbar, nicht wirksam. Seit v3.23 sind sie ueberhaupt keine
  // Regelquelle mehr (die Verlaufsableitung rechnet gegen C16) — der Guard
  // bleibt trotzdem scharf: er verhindert, dass sie ueber eine Hintertuer
  // zurueckkommen.
  //
  // Seit v3.21 OHNE Ausnahme: `verlauf/fuer-vorgang.ts` haelt die Regeln fuer
  // alle Aufrufer, der Cockpit-Hook reicht sie nicht mehr durch. Wer eine neue
  // Ausnahme braucht, ruft stattdessen `baueVerlaufFuerVorgang`.
  const rohImport = /from\s+['"](?:[^'"]*\/)?kuerzel-trigger\.data['"]/;
  const ERLAUBT = `${sep}core${sep}status${sep}verlauf${sep}`;

  it('die Regeln der Zuarbeit werden nur im Verlaufs-Modul gelesen', () => {
    const findings: Finding[] = [];
    let gescannt = 0;
    for (const file of ALL_TS_FILES) {
      if (file.includes(ERLAUBT)) continue;
      if (file.includes(`${sep}__tests__${sep}`) || file.endsWith('.test.ts')) continue;
      gescannt++;
      findings.push(...findInFile(file, l => rohImport.test(l), 'allow-trigger-regeln'));
    }
    expect(gescannt, 'Pfad-Filter trifft keine Datei — der Guard prueft nichts')
      .toBeGreaterThan(100);

    if (findings.length > 0) {
      const msg =
        `KUERZEL_TRIGGER_REGELN sind alle aktiv:false — erfasst, nicht wirksam.\n` +
        `Gelesen werden sie nur in src/core/status/verlauf/, und dort nur fuer\n` +
        `die Rekonstruktion der Vergangenheit. Wer sie anderswo auswertet, baut\n` +
        `die Status-Ableitung nach, die Pitfall #44 ausschliesst.\n\n` +
        `Treffer:\n${fmt(findings)}`;
      expect.fail(msg);
    }
  });
});

describe('no-inline-frist-arithmetik (v3.6 — die Uhr hat EINE Heimat)', () => {
  // Die 90-Tage-Bearbeitungsfrist rechnete bis v3.6 fuer JEDEN Antrag weiter,
  // auch fuer einen 2018 abgelehnten („seit 2 760 T"). Der Fix sitzt in der
  // BERECHNUNG (`frist-ergebnis.ts`), nicht im Renderer — sonst bliebe die
  // falsche Zahl in Export, Board und Widgets stehen, waehrend die Tabelle
  // stimmt. Genau das war der Zustand davor: drei Achsen mit eigenen Literalen.
  //
  // Der Guard trifft BEWUSST NICHT jede Tages-Differenz — es gibt ~30 legitime
  // (Liegezeiten, Journal-Alter, Meilenstein-Abstaende). Er trifft die LITERALE
  // 90 (und ihre Woche-davor-Schwester 84) in Frist-Naehe.
  //
  // `ANTRAG_SLA_DAYS` ist ausdruecklich NICHT verboten — die Konstante ist
  // exportiert, damit man sie benutzt. Die Regel lautet „schreib die Zahl
  // nicht", nicht „fass die Frist nicht an": eine 90 im Tooltip luegt beim
  // naechsten Wechsel, die Konstante nicht.
  const zahl = /(?<![\w.])(?:90|84)(?![\w.])/;
  const fristNah = /frist|sla|ueberfaellig|überfällig|faellig|fällig|deadline/i;

  const HEIMAT = [
    `${sep}core${sep}services${sep}csv${sep}frist.ts`,
    `${sep}core${sep}services${sep}csv${sep}frist-ergebnis.ts`,
  ];

  /** Prosa erklaert die Regel, sie fuehrt sie nicht aus — ein Guard gegen
   *  RECHNEN darf nicht am Kommentar haengenbleiben, der sie begruendet. */
  const istKommentar = (l: string): boolean => /^\s*(?:\/\/|\/?\*)/.test(l);

  it('keine 90-Tage-Rechnung ausserhalb des Fristmoduls', () => {
    const findings: Finding[] = [];
    for (const file of ALL_TS_FILES) {
      if (HEIMAT.some(h => file.endsWith(h))) continue;
      if (file.includes(`${sep}__tests__${sep}`) || file.endsWith('.test.ts')) continue;
      // `src/generated/` traegt das inline-gzippte ORT-WASM als base64-Zeile
      // (~19 MB). Jede Ziffernfolge kommt darin vor; ohne diesen Ausschluss
      // meldet der Guard sie und die Fehlermeldung sprengt jede Konsole.
      if (file.includes(`${sep}src${sep}generated${sep}`)) continue;
      findings.push(...findInFile(
        file,
        l => !istKommentar(l) && zahl.test(l) && fristNah.test(l),
        'allow-inline-frist-arithmetik',
      ));
    }

    if (findings.length > 0) {
      const msg =
        `Frist-Arithmetik gehoert in src/core/services/csv/frist-ergebnis.ts (v3.6).\n` +
        `Stattdessen:\n` +
        `  import { berechneFrist } from '@/core/services/csv/frist-ergebnis';\n` +
        `  // in den Antraegen: fristErgebnisVon(a) / fristTageVon(a) / fristAnzeige(a)\n` +
        `Ein Renderer, der selbst rechnet, ist die zweite Ableitung — und die lief\n` +
        `bisher jedes Mal auseinander (Tab-Zaehler 84/90 vs. Frist-Spalte).\n` +
        `Misst die Stelle etwas ANDERES als die Bearbeitungsfrist (Eingangsalter,\n` +
        `Liegezeit, Meilenstein-Soll), Zeile mit\n` +
        `'// allow-inline-frist-arithmetik: <grund>' markieren.\n\nTreffer:\n${fmt(findings)}`;
      expect.fail(msg);
    }
  });

  // v3.31: derselbe Gedanke eine Ebene höher. Die 90 stand nie zweimal da, die
  // RECHNUNG schon: `useZeilenVerlauf` rief `fristFuerVorkommen`, und der
  // Frist-Reiter rief es gleich darauf noch einmal mit denselben Eingaben. Das
  // fiel niemandem auf, solange beide dasselbe Ergebnis lieferten — und genau
  // das endete, als die eine Seite die Verlaufsquelle fürs Haltedatum bekam und
  // die andere nicht. Wer die Frist braucht, nimmt sie aus dem Hook.
  const RECHNER = [
    `${sep}core${sep}status${sep}frist-bezug.ts`,
    `${sep}plugins${sep}antraege${sep}ausklapp${sep}useZeilenVerlauf.ts`,
    `${sep}plugins${sep}status-cockpit${sep}useFristErhebung.ts`,
  ];

  it('fristFuerVorkommen wird nicht in einer Komponente aufgerufen', () => {
    const findings: Finding[] = [];
    for (const file of ALL_TS_FILES) {
      if (RECHNER.some(h => file.endsWith(h))) continue;
      if (file.includes(`${sep}__tests__${sep}`) || file.endsWith('.test.ts')) continue;
      findings.push(...findInFile(
        file,
        l => !istKommentar(l) && /\bfristFuerVorkommen\s*\(/.test(l),
        'allow-zweite-fristrechnung',
      ));
    }

    if (findings.length > 0) {
      expect.fail(
        `Die Frist wird EINMAL gerechnet (v3.31).\n`
        + `Stattdessen: den fertigen \`FristBezug\` aus \`useZeilenVerlauf\` lesen\n`
        + `(\`daten.frist\`) — er trägt die Verlaufsquelle fürs Haltedatum bereits.\n`
        + `Ein zweiter Aufruf mit denselben Eingaben ist die zweite Ableitung.\n\nTreffer:\n${fmt(findings)}`,
      );
    }
  });
});

describe('no-w-full-neben-fixer-breite (v2.351.2)', () => {
  // Tailwind sortiert `w-full` HINTER die Arbitrary-Values: im gebauten
  // Stylesheet steht `.w-[64px]` bei 20 202 035, `.w-full` bei 20 202 869. Bei
  // gleicher Spezifitaet gewinnt die spaetere Regel — `w-full w-[64px]` ist
  // also 100 % breit, nicht 64 px. Zusammen mit `shrink-0` fordert so ein Feld
  // die ganze Flex-Zeile und quetscht seine Nachbarn auf null (der Ordner-Name
  // im Status-Cockpit verschwand daran zweimal).
  // `max-w-[…]`/`min-w-[…]` sind harmlos (andere Eigenschaft) und ausgenommen.
  const arbitraerW = /(?<![-\w])w-\[/;
  const wFull = /\bw-full\b/;
  const feldKlasseInterpolation = /\$\{feldKlasse\}/;

  it('keine feste Breite in derselben Klasse wie `w-full`', () => {
    const findings: Finding[] = [];
    for (const file of ALL_TS_FILES) {
      if (!file.endsWith('.tsx')) continue;
      findings.push(...findInFile(
        file,
        l => arbitraerW.test(l) && (wFull.test(l) || feldKlasseInterpolation.test(l)),
        'allow-w-full-neben-fixer-breite',
      ));
    }

    if (findings.length > 0) {
      const msg =
        `\`w-full\` und \`w-[…]\` in derselben Klasse — \`w-full\` gewinnt (v2.351.2).\n`
        + `Stattdessen die Basis-Klasse OHNE w-full nehmen:\n`
        + `  <input className={\`\${feldKlasseSchmal} w-[64px]\`} />   // labels.ts\n`
        + `oder das w-full weglassen. Bewusst so gewollt (z.B. Breite nur im\n`
        + `Container-Query-Fall): Zeile mit\n`
        + `'// allow-w-full-neben-fixer-breite: <grund>' markieren.\n\nTreffer:\n${fmt(findings)}`;
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

describe('no-headless-tree-outside-wrapper (Tree-Basis, v2.393)', () => {
  // `@headless-tree/*` ist die Mechanik hinter `TfTree`, nicht die Schnittstelle
  // der App. Wer sie direkt importiert, baut einen zweiten Baum mit eigenem
  // Aufklapp-/Auswahl-/DnD-Verhalten -- genau die Duplikation, die die
  // gemeinsame Basis beendet hat (Status-Filter, Textbausteine, Status-Ordner,
  // Meilenstein-Konfiguration hatten je einen eigenen). Fehlt eine Faehigkeit,
  // wird sie im Wrapper ergaenzt, nicht daneben.
  const pattern = /from\s+['"]@headless-tree\//;
  const wrapper = `${sep}src${sep}components${sep}tree${sep}`;

  it('kein Import von @headless-tree ausserhalb src/components/tree/', () => {
    const findings: Finding[] = [];
    for (const file of ALL_TS_FILES) {
      if (file.includes(wrapper)) continue;
      if (file.includes(`${sep}__tests__${sep}`) || file.endsWith('.test.ts') || file.endsWith('.test.tsx')) continue;
      findings.push(...findInFile(file, l => pattern.test(l), 'allow-no-headless-tree-outside-wrapper'));
    }

    if (findings.length > 0) {
      const msg =
        `Direkter @headless-tree-Import ausserhalb der Tree-Basis verboten.\n` +
        `Baeume laufen ueber src/components/tree/ (TfTree + TfTreeNode):\n` +
        `  import { TfTree } from '@/components/tree';\n` +
        `Fehlende Faehigkeit? Im Wrapper als Feature-Flag ergaenzen.\n` +
        `Nur mit sehr gutem Grund: Zeile mit\n` +
        `'// allow-no-headless-tree-outside-wrapper: <grund>' markieren.\n\nTreffer:\n${fmt(findings)}`;
      expect.fail(msg);
    }
  });
});

describe('no-plugins-config-in-components (Konsolidierungs-Pass, Zyklen-Wurzel)', () => {
  // `src/components/` ist die geteilte, domaenenfreie Blatt-Schicht (CLAUDE.md
  // "UI-Muster / Layout-Schicht"). Wer von dort `@/plugins.config` importiert,
  // zieht JEDES Plugin in den Modulgraphen -- und damit alles, was Plugins
  // importieren, inklusive dieser Blatt-Schicht selbst. Genau daran hingen die
  // vier Laufzeit-Zyklen aus v2.302.4: eine einzige Zeile in FeedbackPanel.tsx
  // ("Anzeigename zur aktiven Plugin-ID") vergiftete das Feedback-Barrel fuer
  // jeden Konsumenten. Plugin-Wissen kommt als Prop oder ueber den
  // NavigationContext (`activeName`) herein, nicht per Import.
  const pattern = /from\s+['"]@\/plugins\.config['"]/;

  it('src/components/ importiert nicht @/plugins.config', () => {
    const findings: Finding[] = [];
    for (const file of ALL_TS_FILES) {
      if (!file.includes(`${sep}src${sep}components${sep}`)) continue;
      if (file.includes(`${sep}__tests__${sep}`) || file.endsWith('.test.ts') || file.endsWith('.test.tsx')) continue;
      findings.push(...findInFile(file, l => pattern.test(l), 'allow-plugins-config-in-components'));
    }

    if (findings.length > 0) {
      const msg =
        `Import von @/plugins.config in der geteilten Komponenten-Schicht verboten.\n` +
        `Er zieht jedes Plugin in den Modulgraphen und erzeugt Laufzeit-Zyklen\n` +
        `(npm run cycles). Plugin-Wissen hereinreichen statt importieren:\n` +
        `  - Anzeigename des aktiven Plugins: useNavigation().activeName\n` +
        `  - alles andere: als Prop von der Shell/dem Plugin uebergeben.\n` +
        `Nur mit sehr gutem Grund: Zeile mit\n` +
        `'// allow-plugins-config-in-components: <grund>' markieren.\n\nTreffer:\n${fmt(findings)}`;
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

describe('no-direct-feedback-user-id-compare (v3.7)', () => {
  // Wem ein Feedback-Eintrag gehoert, entscheidet die tolerante Identitaet
  // (istMeinTicket/istMeineId aus core/services/feedback/feedbackIdentitaet),
  // nicht ein Vergleich gegen EINE Id. Grund: erfasst wurde unter
  // `profile.name`, verglichen wurde gegen das Kuerzel — damit war jedes eigene
  // Ticket fremd („Von mir" leer, keine Glocke, kein „Antwort"-Marker, kein
  // „Ergaenzen"). Bestandsdaten heilt nur der tolerante Lesepfad.
  const ALLOWED_PATH_FRAGMENTS = [
    `${sep}__tests__${sep}`,
    `.test.ts`,
    `${sep}feedback${sep}feedbackIdentitaet.ts`, // die kanonische Quelle selbst
  ];
  const isAllowed = (file: string): boolean =>
    ALLOWED_PATH_FRAGMENTS.some(frag => file.includes(frag));

  const isComment = (l: string): boolean => {
    const t = l.trim();
    return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
  };
  // Gemeint ist die Zugehoerigkeit eines TICKETS. Stimmen/Sponsoren/Kommentare
  // vergleichen bewusst gegen die EINE kanonische Schreib-Id (`userId`): dort
  // muss das Entfernen denselben Eintrag treffen wie das Anlegen, ein tolerantes
  // Lesen ohne tolerantes Entfernen erzeugte eine nicht abwaehlbare Stimme.
  // Deshalb greift das Muster nur auf ticket-artige Bezeichner.
  const pattern = /\b(ticket|t|item|fb|feedback)\.user_id\s*[!=]==\s*(meId|meineUserId|userId)\b/;

  it('Feedback-Zugehoerigkeit nur ueber istMeinTicket/istMeineId', () => {
    const findings: Finding[] = [];
    for (const file of ALL_TS_FILES) {
      if (isAllowed(file)) continue;
      findings.push(...findInFile(file, l => !isComment(l) && pattern.test(l), 'allow-user-id-compare'));
    }

    if (findings.length > 0) {
      const msg =
        `Direkter user_id-Vergleich verboten (v3.7, Feedback-Identitaet).\n` +
        `Nutze istMeinTicket(ticket, ich) bzw. istMeineId(id, ich) aus\n` +
        `src/core/services/feedback/feedbackIdentitaet.ts — die Identitaet kommt\n` +
        `aus useMeineFeedbackIdentitaet() und kennt Kuerzel UND Profilname.\n` +
        `Echter Einzelfall? Zeile mit '// allow-user-id-compare: <grund>' markieren.\n\n` +
        `Treffer:\n${fmt(findings)}`;
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

describe('local-fs-gate-eingegrenzt (Variante „local")', () => {
  // Die Variante „local" haengt den Ordner-Picker aus und verdrahtet feste
  // Entwickler-Pfade. Das Gate `__TEAMFLOW_LOCAL_FS__` darf deshalb NICHT quer
  // durch die Codebase wandern: je mehr Stellen es abfragen, desto groesser die
  // Chance, dass ein Zweig ohne Absicht in einer ausgelieferten Variante landet.
  // Erlaubt sind der Adapter selbst und die wenigen Einhaengepunkte.
  //
  // Zusatzschichten (nicht hier pruefbar): `validateConfig` bricht bei
  // `local` + variant="production" ab, und das Define haengt an
  // `command === 'serve'` — jeder Build faltet es auf `false`.
  // relPath() liefert `src/...` mit Forward-Slashes (auch auf Windows).
  const ERLAUBT = [
    'src/core/services/infrastructure/local-fs/',      // der Adapter selbst
    'src/core/services/infrastructure/smb-handle.ts',  // Haupt-Einhaengepunkt
    'src/core/services/gutachten-vorlagen/vorlagen-quelle.ts',
    'src/plugins/csv-sources-kuration/csv-source-handle.ts',
    'src/core/App.tsx',                                // Profil-Seed
    'src/__tests__/codebase-conventions.test.ts',      // diese Regel selbst
  ];

  it('__TEAMFLOW_LOCAL_FS__ nur im local-fs-Adapter und den Einhaengepunkten', () => {
    const treffer: Finding[] = [];
    for (const file of ALL_SOURCE_FILES) {
      const rel = relPath(file);
      if (ERLAUBT.some(pfad => rel === pfad || rel.startsWith(pfad))) continue;
      treffer.push(...findInFile(
        file,
        line => {
          // Nur echte VERWENDUNG zaehlt. Kommentare duerfen das Define
          // erklaeren (runtime-config.ts, Test-Header) — sonst muesste jede
          // Doku-Stelle in die Allowlist und die Regel waere Papier.
          const t = line.trim();
          if (t.startsWith('*') || t.startsWith('//') || t.startsWith('/*')) return false;
          return t.includes('__TEAMFLOW_LOCAL_FS__');
        },
        'allow-local-fs-gate',
      ));
    }
    if (treffer.length > 0) {
      expect.fail(
        `__TEAMFLOW_LOCAL_FS__ ausserhalb der erlaubten Stellen verwendet.\n` +
        `Der Lokal-Modus soll an wenigen, klar benannten Punkten einhaken —\n` +
        `neue Bedarfsstellen bitte ueber src/core/services/infrastructure/local-fs/\n` +
        `kapseln (z.B. leseHandleKey/lokalerSlotHandle) statt das Define zu streuen.\n\n` +
        `Treffer:\n${fmt(treffer)}`,
      );
    }
  });

  it('der window.__tf-Hook zieht den Brueckenadapter NICHT in den Bundle', () => {
    // window-hook.ts haengt an devFixtures, nicht am Lokal-Modus. Ein Import aus
    // local-fs/ wuerde den Adapter in JEDEN dev-Build ziehen (auch `npm run dev`
    // ohne local-Block) — unnoetig und irrefuehrend.
    const src = readFileSync(join(ROOT, 'dev-fixtures', 'window-hook.ts'), 'utf-8');
    expect(src).not.toMatch(/from\s+['"][^'"]*local-fs/);
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

describe('status-achsen (Arbeitsliste fest, Verfahrensschritt beweglich)', () => {
  // Die beiden Achsen des Status-Systems sind bewusst verschieden gebaut: der
  // Verfahrensschnitt (ZAH-Phasen) steht seit v2.409 in der Katalog-Fassung, die
  // Arbeitsliste (StatusCategory) bleibt im Code — sonst koennte eine Iteration
  // am Phasenschnitt nebenbei die taegliche Arbeitsliste der ABs leeren.
  const LABEL_QUELLE = `${sep}core${sep}utils${sep}status-category-labels.ts`;

  it('status-category-not-curated: die Fassung fuehrt keine Kategorien-LISTE', () => {
    // Der Katalog darf die Kategorie ABLEITEN (ZahPhase.kategorieVorgabe traegt
    // EINEN Wert je Phase) — aber kein Feld der Fassung darf eine Liste von
    // StatusCategory fuehren. Das waere die zweite, bewegliche Achse.
    // Strukturell geprueft am Fassungs-Typ selbst statt per Tree-Grep: nur hier
    // entstuende so ein Feld.
    const typen = readFileSync(join(ROOT, 'core', 'status', 'typen.ts'), 'utf8');
    const block = typen.slice(typen.indexOf('export interface MappingVersion'));
    const ende = block.indexOf('\n}');
    const felder = block.slice(0, ende);
    const treffer = felder.split('\n').filter(l => /StatusCategory\s*\[\]/.test(l));
    if (treffer.length > 0) {
      expect.fail(
        `MappingVersion fuehrt eine Kategorien-Liste:\n${treffer.join('\n')}\n\n` +
        `Die Arbeitslisten-Achse (StatusCategory) bleibt im Code. Die PL\n` +
        `entscheidet ueber ZahPhase.kategorieVorgabe, in WELCHE Arbeitsliste ein\n` +
        `Verfahrensschritt einzahlt — nicht, welche Arbeitslisten es gibt.`,
      );
    }
  });

  it('status-labels-single-source: keine Kategoriebezeichnung als Literal daneben', () => {
    // Die neun Bezeichnungen leben in status-category-labels.ts. Gesucht wird
    // die Zuweisungs-Form (`offen: 'Zu bearbeiten'`), nicht der blosse Text.
    //
    // Nur die SECHS umbenannten Paare: „Bewilligt", „Begleitung" und
    // „Abgelehnt" sind blosse Gross-Schreibungen ihres Schluessels und kommen
    // zu Recht in fremden Domaenen vor (FeedbackStatus, Roh-Status-Labels) —
    // ein Guard, der die mitfaengt, meldet fuer immer Fehlalarm.
    const paare: [string, string][] = [
      ['offen', 'Zu bearbeiten'], ['in_pruefung', 'In Arbeit'],
      ['nachforderung', 'Wartet auf Antragsteller'], ['entscheidung', 'Zu entscheiden'],
      ['abgeschlossen', 'Erledigt'], ['sonstige', 'Ohne Zuordnung'],
    ];
    const muster = paare.map(([k, v]) => new RegExp(`\\b${k}\\s*:\\s*['"\`]${v}['"\`]`));
    const findings: Finding[] = [];
    for (const file of ALL_TS_FILES) {
      if (file.includes(LABEL_QUELLE)) continue;
      if (file.includes(`${sep}__tests__${sep}`) || file.includes('.test.ts')) continue;
      findings.push(...findInFile(
        file, l => muster.some(m => m.test(l)), 'allow-kategorie-label',
      ));
    }
    if (findings.length > 0) {
      expect.fail(
        `Kategoriebezeichnung ausserhalb der Einzelquelle.\n` +
        `Vier Module fuehrten bis v2.409 eigene Vokabulare fuer dieselben neun\n` +
        `Werte — sie liefen auseinander, sobald eines angefasst wurde.\n` +
        `Stattdessen: getStatusCategoryLabel() / getStatusCategoryLabelKurz().\n\n` +
        `Treffer:\n${fmt(findings)}`,
      );
    }
  });

  it('status-label-namensraeume-disjunkt: kein Name auf beiden Ebenen', async () => {
    // Ein Reiter „Zu bearbeiten", der drei Kategorien meint, von denen eine
    // ebenfalls so heisst, waere die Verwechslung eine Ebene hoeher — also
    // genau das, was A3 beseitigt hat. Aggregatnamen muessen eigen sein.
    const { KATEGORIE_TEXTE, AGGREGAT_TEXTE } =
      await import('@/core/utils/status-category-labels');
    const kategorieNamen = new Set(
      Object.values(KATEGORIE_TEXTE).flatMap(b => [b.lang, b.kurz]),
    );
    const kollision = Object.entries(AGGREGAT_TEXTE)
      .flatMap(([id, b]) => [[id, b.lang], [id, b.kurz]] as [string, string][])
      .filter(([, name]) => kategorieNamen.has(name));
    if (kollision.length > 0) {
      expect.fail(
        `Aggregatname deckt sich mit einer Kategoriebezeichnung:\n` +
        kollision.map(([id, name]) => `  ${id} → „${name}"`).join('\n') +
        `\n\nZusammenfassungen brauchen einen EIGENEN Namen — sonst heisst der\n` +
        `Reiter wie eine der Kategorien darin.`,
      );
    }
  });
});

describe('status-kurzlabel-single-source (Rohstatus-Beschriftung: eine Quelle)', () => {
  // Bis v3.15 fuehrten DREI Module ihre eigene Kurzform desselben Statuswerts:
  // STATUS_LABELS in core/utils/status-mappings.ts, STATUS_LABEL_OVERRIDES in
  // plugins/suche/columns.tsx (abweichende Schreibweise, Tippfehler
  // „Wiederspr.") und ein Literal in plugins/antraege/arbeitsvorrat.ts.
  // Derselbe Status sah je nach Ansicht anders aus; die STATUS_LABELS-Fassung
  // fuer Code 72 war zudem auf eine Schreibweise geschluesselt, die im
  // Produktivbestand gar nicht vorkommt, und griff deshalb nie.
  //
  // Die Quelle ist jetzt StatusCodeEintrag.kurz (Auslieferung) +
  // StatusWertEintrag.kurzLabel (Kuration), gelesen ueber statusKurzLabel() /
  // statusLabel() in core/utils/status-wert-labels.ts.
  //
  // Bewusst NICHT ueber eine Pfad-Allowlist fuer die gleichnamige
  // Feedback-Map: `STATUS_LABELS` aus components/feedback/constants.ts wird in
  // 16 Dateien genutzt, vier davon ausserhalb von feedback/ — eine
  // `${sep}feedback`-Allowlist meldete Fehlalarme und deckte zugleich ganze
  // Plugin-Baeume ab. Geprueft wird stattdessen die HERKUNFT.
  const KURZLABEL_QUELLE = `${sep}core${sep}status${sep}status-codes.ts`;
  const istTest = (file: string): boolean =>
    file.includes(`${sep}__tests__${sep}`) || file.includes('.test.ts');
  // Kommentarzeilen bleiben aussen vor: die Begruendungen, WARUM es die eine
  // Quelle gibt, nennen die alten Namen und die Kurzformen zwangslaeufig beim
  // Wort. Ein Guard, der seine eigene Dokumentation anmeckert, wird abgeschaltet.
  const istKommentar = (l: string): boolean => /^\s*(\/\/|\/\*|\*)/.test(l);
  // Generierte Fremddaten der Kuerzel-Zuarbeit (Pitfall #43): dort steht
  // „techn. geprüft" als Teil einer amtlichen Kuerzel-Bezeichnung, nicht als
  // unsere Beschriftung. Von Hand wird da ohnehin nichts eingetragen.
  const istGeneriert = (file: string): boolean => file.endsWith('.data.ts');

  it('kein zweiter Kurzform-Lookup (STATUS_LABEL_OVERRIDES / shortStatus)', () => {
    const findings: Finding[] = [];
    for (const file of ALL_TS_FILES) {
      if (istTest(file)) continue;
      findings.push(...findInFile(
        file,
        l => !istKommentar(l)
          && (l.includes('STATUS_LABEL_OVERRIDES') || /\bshortStatus\b/.test(l)),
        'allow-status-kurzlabel',
      ));
    }
    if (findings.length > 0) {
      expect.fail(
        `Zweiter Kurzform-Lookup fuer Antragsstatus verboten.\n` +
        `Genau eine Quelle: StatusCodeEintrag.kurz (+ kuratiertes kurzLabel),\n` +
        `gelesen ueber statusKurzLabel() aus core/utils/status-wert-labels.ts.\n` +
        `Echte Ausnahme: '// allow-status-kurzlabel: <grund>'.\n\n` +
        `Treffer:\n${fmt(findings)}`,
      );
    }
  });

  it('status-mappings.ts fuehrt keine Beschriftung mehr, nur noch die Farbe', () => {
    // Strukturell an der Datei geprueft (Muster: status-category-not-curated):
    // nur hier entstuende die Map erneut, und ein Grep nach `STATUS_LABELS`
    // kollidierte mit der gleichnamigen Feedback-Map.
    const src = readFileSync(join(ROOT, 'core', 'utils', 'status-mappings.ts'), 'utf8');
    const treffer = [
      /export\s+const\s+STATUS_LABELS\b/,
      /export\s+function\s+getStatusLabel\b/,
    ].filter(m => m.test(src)).map(m => m.source);
    if (treffer.length > 0) {
      expect.fail(
        `status-mappings.ts beschriftet wieder Status:\n  ${treffer.join('\n  ')}\n\n` +
        `Die Datei haelt seit v3.15 nur noch STATUS_VARIANTS (Pillenfarbe).\n` +
        `Wie ein Status heisst, beantwortet core/utils/status-wert-labels.ts.`,
      );
    }
  });

  it('niemand importiert die entfernten Symbole aus status-mappings', () => {
    const findings: Finding[] = [];
    for (const file of ALL_TS_FILES) {
      if (istTest(file)) continue;
      findings.push(...findInFile(
        file,
        l => /from\s+['"]@\/core\/utils\/status-mappings['"]/.test(l)
          && /\b(getStatusLabel|STATUS_LABELS)\b/.test(l),
        'allow-status-kurzlabel',
      ));
    }
    if (findings.length > 0) {
      expect.fail(
        `getStatusLabel/STATUS_LABELS gibt es nicht mehr.\n` +
        `Kurzform: statusKurzLabel() · voller Bezeichner: statusLabel()\n` +
        `(beide aus @/core/utils/status-wert-labels).\n\nTreffer:\n${fmt(findings)}`,
      );
    }
  });

  /**
   * Die echten ABKUERZUNGEN — kuratiert, nicht abgeleitet.
   *
   * Ein programmatisch aus STATUS_CODE_KATALOG gezogener Satz meldete dauerhaft
   * Fehlalarm: „Bewilligt"/„Beendet"/„Abgebrochen" sind blosse Gross-
   * Schreibungen ihres Rohwerts und stehen zu Recht in fremden Domaenen
   * (status-category-labels.ts, batch-indexer.ts), „Ablehnung" und
   * „Bewilligungsentwurf" sind amtliche Varianten. Dieselbe Entscheidung wie
   * bei status-labels-single-source oben. Der Test darunter haelt die Liste
   * vollstaendig.
   */
  const ABKUERZUNGEN = [
    'Skizze eing.', 'techn. geprüft', 'kaufm. geprüft', 'Bewilligungsentw.',
    'Rücknahmeempf.', 'Stelln. zur RNE', 'abgel./zurückgez.', 'Widerspruch Abl.',
    'Anhörung Widerruf', 'Assoz. Partner', 'Intl. Partner', 'VN techn. gepr.',
  ];
  // Als GANZES String-Literal, nicht als Teilkette: „Rücknahmeempf." steckt in
  // der amtlichen Variante „Stellungnahme zur Rücknahmeempf." (Code 72), und die
  // ist ein legitimer Rohwert — u.a. im Meilenstein-Seed als Bedingung.
  const ALS_LITERAL = ABKUERZUNGEN.map(a => new RegExp(
    `(['"\`])${a.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}\\1`,
  ));

  it('keine Kurzform als Literal ausserhalb des Katalogs', () => {
    const findings: Finding[] = [];
    for (const file of ALL_TS_FILES) {
      if (istTest(file) || istGeneriert(file) || file.includes(KURZLABEL_QUELLE)) continue;
      findings.push(...findInFile(
        file,
        l => !istKommentar(l) && ALS_LITERAL.some(m => m.test(l)),
        'allow-status-kurzlabel',
      ));
    }
    if (findings.length > 0) {
      expect.fail(
        `Status-Kurzform als Literal ausserhalb von status-codes.ts.\n` +
        `Das ist die vierte Kopie — genau die Klasse, die v3.15 aufgeloest hat.\n` +
        `Stattdessen: statusKurzLabel(rohwert).\n\nTreffer:\n${fmt(findings)}`,
      );
    }
  });

  it('die Liste bleibt vollstaendig: jede abgekuerzte Kurzform steht drin', async () => {
    // Maschinelle Untergrenze, damit die Handliste nicht verwaist: eine
    // Kurzform mit Punkt IST eine Abkuerzung. Kapitalisierungen ohne Punkt
    // („Bewilligt") bleiben bewusst draussen, siehe oben.
    const { STATUS_CODE_KATALOG } = await import('@/core/status/status-codes');
    const fehlend = STATUS_CODE_KATALOG
      .filter(e => e.kurz.includes('.') && !ABKUERZUNGEN.includes(e.kurz))
      .map(e => `${e.code}: „${e.kurz}"`);
    if (fehlend.length > 0) {
      expect.fail(
        `Neue Kurzform, die der Guard noch nicht schuetzt:\n  ${fehlend.join('\n  ')}\n\n` +
        `In ABKUERZUNGEN aufnehmen (codebase-conventions.test.ts) — sonst kann\n` +
        `sie unbemerkt ein zweites Mal getippt werden.`,
      );
    }
  });
});

describe('zah-phasen-snapshot-single-writer (ZAH-Phasen: genau ein Setzweg)', () => {
  // Seit v2.409 ist der Phasenschnitt kuratierbar; welcher Schnitt GILT, steht in
  // zwei Modul-Registern in core/status/zah-phasen.ts. Weil die Modul-global sind,
  // gewinnt bei zwei Schreibwegen die Import-Reihenfolge — also gibt es genau
  // einen: setStatusKatalogSnapshot in core/status/snapshot.ts, dieselbe Stelle
  // wie die Kategorien-Map. Tests raeumen ueber resetZahPhasenSnapshotFuerTests().
  const SETZER = ['setZahPhasenSnapshot', 'setCodePhasenSnapshot'];
  const ALLOWED_PATH_FRAGMENTS = [
    `${sep}core${sep}status${sep}zah-phasen.ts`,   // Heimat der Register
    `${sep}core${sep}status${sep}snapshot.ts`,     // der EINE Aufrufer
    `${sep}__tests__${sep}`,
    `.test.ts`,
  ];
  const isAllowed = (file: string): boolean =>
    ALLOWED_PATH_FRAGMENTS.some(frag => file.includes(frag));

  it('die Phasen-Register werden nur aus snapshot.ts gesetzt', () => {
    const findings: Finding[] = [];
    for (const file of ALL_TS_FILES) {
      if (isAllowed(file)) continue;
      findings.push(...findInFile(
        file, l => SETZER.some(s => l.includes(s)), 'allow-zah-phasen-setter',
      ));
    }
    if (findings.length > 0) {
      const msg =
        `Zweiter Schreibweg auf die ZAH-Phasen-Register verboten.\n` +
        `Wer die geltenden Phasen setzt, entscheidet fuer die ganze App —\n` +
        `Sidebar-Gruppierung, Verfahrensleiste, Zieltage, Kategorie-Ableitung.\n` +
        `Genau ein Aufrufer: setStatusKatalogSnapshot() in core/status/snapshot.ts.\n` +
        `In Tests: resetZahPhasenSnapshotFuerTests().\n` +
        `Echte Ausnahme: '// allow-zah-phasen-setter: <grund>'.\n\nTreffer:\n${fmt(findings)}`;
      expect.fail(msg);
    }
  });

  it('kein Leser faellt auf eine leere Phasenliste zurueck', () => {
    // `zahPhasenVon()` liefert IMMER mindestens den Seed. Ein `?? []` daneben
    // waere die stille Rueckkehr zu „keine Phasen" — und damit zu einer Leiste
    // ohne Stationen und einer Sidebar ohne Gruppen.
    const findings: Finding[] = [];
    for (const file of ALL_TS_FILES) {
      if (file.includes(`${sep}__tests__${sep}`) || file.includes('.test.ts')) continue;
      findings.push(...findInFile(
        file, l => /zahPhasenVon\([^)]*\)\s*\?\?\s*\[\]/.test(l), 'allow-leere-phasen',
      ));
    }
    if (findings.length > 0) {
      expect.fail(
        `zahPhasenVon() liefert nie eine leere Liste — ein '?? []' daneben ist\n` +
        `entweder toter Code oder ein Missverstaendnis.\n\nTreffer:\n${fmt(findings)}`,
      );
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
  const MAX_FEATURE_FLAGS = 27;    // Ist 27 — v3.0 (Varianten-Zusammenlegung 5→3) hat ELF Flags entfernt: 'feedback'/'suche'/'antraege'/'streamlitBridge' (standen in JEDER Variante auf true), 'volltextsuche'/'auslastungSelbstEintragung'/'embeddingCorpusBuild' (durch die Zusammenlegung ueberall true), 'auslastungNurKorpus'/'kuerzelDropdown' (bedienten nur die abgeschafften Varianten kurator/as) sowie 'deAnonymisierung'/'maVerwaltungPasswort' (gaten nur Oberflaeche INNERHALB des Auslastungs-Moduls, das selbst hinter dem Zusatzpasswort liegt — ein Schloss im Tresor; beide jetzt aus 'auslastung' abgeleitet). Ein Flag lohnt sich nur, wenn er in den Varianten UNTERSCHIEDLICHE Werte hat. Davor 38; +1 'vorgangssystem' (Status-Erklaerung, Kuerzel-Glossar/Navigator, To-do-Board, Waechter, Fristen-Cockpit — dev/pl; setzt 'statusCockpit' voraus und gated die gesamte neue Schicht); davor 37 (+1 'meilensteinMonitoring' (Bearbeitungs-Meilensteine + Fristen-Monitoring: Plan/Bewertung/Cockpit/Widget, dev/pl/as/kurator); davor 36 (+1 'statusCockpit'); davor 35 (+1 'artefaktWerkbank'); davor 34 (+1 'mapFoerderfaehig'); davor 33 (+1 'assistentGedaechtnis'); davor 32 (+1 'assistentPanel'); davor 31 (+1 'assistentProtokoll'); davor 30 (+1 'antragAufbereitung')
  const MAX_SERVICE_DIRS = 21;     // Ist 21; Konsolidierungs-Pass: 'review' + 'versioning' geloescht (MVP-Reste vom Maerz 2026, null Konsumenten). Davor 23 (+1 'assistent'), davor 22 (+ msg)
  const MAX_FILE_LOC = 2900;       // Ist ~2882 (DIESE Datei; davor 2850 / +band-fuellung-kontrast v3.38 — das VerlaufsBand schrieb WEISS auf den satten --tf-kanban-Akzent: gemessen 3,02-5,06:1 hell (sechs von neun unter AA) und 2,14-2,92:1 dunkel (alle neun), weil die Tokens als kleine Farbchips fuer Lane-Koepfe gedacht waren, nie als Textuntergrund; beim Anheben ist das Parsen von theme.css in die Lib gewandert und hat den zweiten Parser von `theme-token-contract` gleich mit abgeloest (-27); davor 2810 / +frist-eine-rechnung v3.31 — die 90 stand nie zweimal da, die RECHNUNG schon: `useZeilenVerlauf` rief `fristFuerVorkommen`, der Frist-Reiter gleich darauf noch einmal, und das fiel erst auf, als die eine Seite die Verlaufsquelle fuers Haltedatum bekam und die andere nicht; davor 2756 / +verlauf-leitet-keinen-status-ab + trigger-regeln-nur-im-verlauf (Phase 1b) — die Verlaufsableitung rekonstruiert die Vergangenheit aus den `D_`-Spalten und darf dem Pfad, der den GELTENDEN Status bestimmt, nie bekannt werden; und die Regeln der Kuerzel-Zuarbeit sind alle `aktiv: false` und haben genau einen Konsumenten; davor 2560 / +status-kurzlabel-single-source v3.15 — die Kurzform eines Rohstatus lag dreifach hartkodiert, eine Kopie mit Tippfehler und eine auf eine Schreibweise geschluesselt, die im Bestand gar nicht vorkommt (Code 72, 29 Faelle): der Guard prueft die Herkunft und sperrt die echten Abkuerzungen als Literal; davor 2510 / +kuerzel-nie-flach v3.13 — dasselbe Kuerzel bedeutet je Projektform etwas anderes, flach nachgeschlagen zeigt die App 78,9 % der Antraege den falschen Klartext; davor 2460 / +no-inline-frist-arithmetik v3.6 — die 90-Tage-Uhr rechnete fuer JEDEN Antrag weiter, auch fuer einen 2018 abgelehnten: der Fix gehoert in die Berechnung, sonst bleibt die falsche Zahl in Export, Board und Widgets stehen; davor 2410 / Ist ~2363; +no-direct-feedback-user-id-compare v3.7 — wem ein Ticket gehoert, entscheidet die tolerante Identitaet (Kuerzel UND Profilname): erfasst wurde unter profile.name, verglichen gegen das Kuerzel, damit war jedes eigene Ticket fremd; davor 2360 / Ist ~2318; +no-index-punkt-id v2.412 — Klaerungs-Punkt-Ids duerfen nicht aus der Schleifenposition entstehen: die Antworten liegen append-only auf dem Share und ein eingefuegter Punkt verschoebe sie alle; +status-achsen v2.409 — drei Zusagen zu den beiden Status-Achsen: die Arbeitsliste bleibt Code, ihre Bezeichnungen haben genau eine Heimat, und Aggregatnamen decken sich mit keiner Kategoriebezeichnung; davor 2200 / Ist ~2155; +zah-phasen-snapshot-single-writer v2.409 — der Phasenschnitt ist jetzt kuratierbar und steht in zwei Modul-Registern: bei zwei Schreibwegen entschiede die Import-Reihenfolge, welcher Schnitt gilt; davor 2150 / Ist ~2118; +zaehler-eine-grundmenge v2.400.1 — Sicht-Zahlen kommen aus EINER Grundmenge; +no-headless-tree-outside-wrapper v2.393 — `@headless-tree/*` gehoert hinter TfTree: vier Module hatten je einen eigenen Baum mit eigenem Aufklapp-/Auswahl-/DnD-Verhalten, und genau das soll nicht wieder entstehen; davor 2100 / Ist ~2088; +journal-ohne-personen-achse v2.392 — das Import-Diff-Journal darf keine Personen-Achse bekommen, weder in der Projektion noch in einer Ansicht: mit Bearbeiterspalte plus Datumsverlauf waere es ein Aktivitaetsprotokoll und mitbestimmungspflichtig; davor 2010 / Ist ~1968; +kuerzel-genau-ein-speicherort v2.386 — vier Kuerzel haengen an einem kanonischen Feld, ein zweites `D_<code>`-Feld dafuer bleibt fuer immer leer und laesst jede Trigger-Bedingung „nie gesetzt" antworten; davor 1960 / Ist ~1931; +prompt-nur-im-ram v2.372 — der gesendete Prompt traegt die Vorhabensbeschreibung im Volltext und darf in keinen persistierten Record; davor 1900 / Ist ~1849; +local-fs-gate-eingegrenzt v2.371 — die Variante „local" haengt den Ordner-Picker aus, das Define darf nicht durch die Codebase wandern; davor 1800 / Ist ~1781; +no-w-full-neben-fixer-breite v2.351.2 — `w-full` schlaegt `w-[64px]`, das hat den Ordner-Namen zweimal auf null gequetscht; +status-kategorie-nur-aus-katalog v2.345 — der Ordnerbaum ist Team-Kuration, ein zweites Mapping im Code liefe bei der ersten Umbenennung auseinander; +status-katalog-share-only / status-event-log-local-only v2.332 — die Katalog-Umstellung auf den Daten-Share spaltet den frueheren Ein-Guard in zwei, weil Katalog und Event-Log jetzt verschiedene Zusagen tragen; +status-system-local-only v2.322; +no-plugins-config-in-components (Zyklen-Wurzel), davor 1600 nach Auslagerung der Scan-Infrastruktur; Konsolidierungs-Pass: Scan-Infrastruktur nach conventions-lib.ts ausgelagert (-105), davor 1700 wegen +no-raw-clipboard; +keine-kompakt-anweisung-neben-json-beispiel + Prompt-Datei-Scope Audit 2026-07, +keine-elidierte-wortlaut-vorgabe v2.284.1, +no-blanket-idb-wipe v2.277.1 — kohaerenter Guard-Aggregator, waechst mit jeder Convention; +preset-contrast-contract v2.144 +no-parallel-scope-tabs v2.148 +no-raw-cta-fill v2.150 +cta-fill-Hex-Route v2.164 +screen-context-coverage v2.165 +arbeitskontext-log-idb-only v2.170 +aufbereitung-eval-fictional-only v2.223 +home-widgets-local-only v2.226 +notizen-strikt v2.229 +djb2-single-source v2.231); groesste Nicht-Test-Datei: 846 (smb-handle.ts)
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
  // Es gibt KEIN Zeichen-Budget mehr, nur eine Reissleine gegen ausufernde Docs.
  //
  // Warum kein Budget: pro Feedback-Lauf gehen genau ZWEI Docs raus
  // (getAppOverview() + getScreenContext(pluginId), nie alle) — bei den heutigen
  // Groessen ~2000 Token gegen ein Modell mit 62k-256k Kontext. "Sonst sprengt
  // es den Prompt" war jahrelang die Begruendung und war immer falsch. Das alte
  // Limit von 2500 band real: 10 von 16 Docs klebten bei 2446-2499, also an der
  // Wand — geschrieben bis zum Limit, dann anderswo weggekuerzt. Das kostete pro
  // Feature einen Extra-Loop und machte die Docs schlechter, nicht kuerzer.
  //
  // Die eigentliche Disziplin ist inhaltlich und steht in der README: hier steht
  // WAS der Nutzer sieht und benennt, das WIE gehoert ins Architektur-Doc. Ein
  // Doc, das anschwillt, hat fast immer WIE drin — dagegen hilft Lesen, keine
  // Zahl. Die Reissleine faengt nur den Unfall (Architektur-Doc reinkopiert,
  // generierter Dump) und liegt bewusst weit ueber jeder legitimen Laenge.
  //
  // Angehoben von 10000 auf 20000 (v2.409): status-cockpit.md stand bei 9992
  // Zeichen an der Wand — nicht durch WIE-Text, sondern weil die Seite drei
  // Reiter, einen Ordnerbaum, die Regel-Kaskade und jetzt den
  // Veroeffentlichungs-Konflikt traegt. Genau der Effekt, den der Kommentar oben
  // beim alten 2500er-Limit beschreibt. Die urspruengliche Begruendung „rund das
  // Vierfache des groessten Docs" war mitgewandert und stimmte nicht mehr; der
  // Unfall, den die Zahl faengt, liegt bei 30000+.
  //
  // Angehoben von 20000 auf 24000 (v3.37): jetzt steht antraege.md an der Wand —
  // dieselbe Ursache, eine Ebene groesser. Die Seite traegt fuenf Ansichten,
  // Quickfilter, Spaltenfilter, den Ausklappbereich mit zwei Reitern, das
  // VerlaufsBand und die Vorgangs-Bloecke; jede Runde legt WAS-Text nach, kein
  // WIE. Gegengeprueft: die Rationale-Saetze („warum sitzt der Anker am
  // Balken") sind beim Anheben aus dem Doc GEFLOGEN, sie stehen im
  // Architektur-Doc. Die 30000er-Unfallgrenze bleibt unangetastet.
  const DOCS_DIR = join(ROOT, '..', 'docs', 'feedback-kontext');
  const REISSLEINE_DOC_CHARS = 24000;

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

  it(`kein Kontext-Doc ufert aus (Reissleine ${REISSLEINE_DOC_CHARS} Zeichen)`, () => {
    const findings: string[] = [];
    for (const entry of readdirSync(DOCS_DIR)) {
      if (!entry.endsWith('.md') || entry.toLowerCase() === 'readme.md') continue;
      const chars = readFileSync(join(DOCS_DIR, entry), 'utf-8').length;
      if (chars > REISSLEINE_DOC_CHARS) findings.push(`  ${entry}: ${chars} Zeichen`);
    }
    if (findings.length > 0) {
      expect.fail(
        `Kontext-Doc(s) ueber der Reissleine von ${REISSLEINE_DOC_CHARS} Zeichen:\n` +
        `${findings.join('\n')}\n` +
        `Das ist kein knappes Budget — diese Laenge deutet auf einen Unfall hin ` +
        `(Architektur-Doc reinkopiert, generierter Dump) oder darauf, dass WIE-Text ` +
        `ins Doc gewandert ist. Inhaltlich pruefen statt blind kuerzen; wenn die ` +
        `Laenge legitim ist, die Reissleine bewusst anheben.`,
      );
    }
  });
});

describe('gutachten-entwurf-kein-plain-textarea (Live-Preview statt <textarea>)', () => {
  // Der Gutachten-Entwurfs-Editor muss der Live-Preview-Editor bleiben (MarkdownEditor +
  // markdownLivePreview) und nicht auf ein nacktes <textarea> zurueckfallen.
  //
  // Seit dem Vier-Ebenen-Umbau (v2.337) ist die Karte auf mehrere Dateien verteilt:
  // der Editor blieb in SectionReviewCard, das Feedback-Notizfeld wanderte in die
  // Fusszeile. Beide Dateien werden geprueft — sonst waere der Guard nach dem Split
  // still wirkungslos fuer die Stelle, an der das Notizfeld heute lebt.
  const DIR = join(ROOT, 'plugins', 'antraege', 'gutachten');
  const EDITOR_FILE = join(DIR, 'SectionReviewCard.tsx');
  const KARTEN_DATEIEN = [EDITOR_FILE, join(DIR, 'AbschnittFuss.tsx')];

  it('SectionReviewCard nutzt markdownLivePreview', () => {
    expect(
      readFileSync(EDITOR_FILE, 'utf-8').includes('markdownLivePreview'),
      'SectionReviewCard.tsx muss markdownLivePreview importieren/verwenden.',
    ).toBe(true);
  });

  it('keine Karten-Datei faellt auf ein rohes <textarea> zurueck', () => {
    for (const datei of KARTEN_DATEIEN) {
      expect(
        readFileSync(datei, 'utf-8').includes('<textarea'),
        `${datei}: Gutachten-Entwurf + Feedback-Notiz duerfen keinen rohen <textarea> nutzen — ` +
        'MarkdownEditor + markdownLivePreview bzw. <input>. Buffer bleibt rohes Markdown.',
      ).toBe(false);
    }
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
  // Gelesen wird die Datei EINMAL, in der Lib — `band-fuellung-kontrast` braucht
  // dieselben Deklarationen samt Werten.
  function readGlobalTfTokens(): Set<string> {
    const [hell, dunkel] = themeFarbTokens();
    const defined = new Set([...hell.werte.keys(), ...dunkel.werte.keys()]);
    expect(defined.size, 'src/theme.css: keine --tf-*-Tokens gefunden').toBeGreaterThan(0);
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

describe('band-fuellung-kontrast (Balkenschrift des VerlaufsBands lesbar)', () => {
  // Der Befund, der diesen Guard begruendet (v3.38): das VerlaufsBand fuellte
  // seine Balken mit dem SATTEN --tf-kanban-*-Akzent und schrieb weiss darauf.
  // Gemessen ergab das 3,02-5,06:1 im hellen Modus (sechs von neun unter den
  // 4,5:1, die AA fuer kleine Schrift verlangt) und 2,14-2,92:1 im dunklen —
  // dort sind die Tokens Pastelltoene, und JEDE Beschriftung fiel durch. Sie
  // waren als kleine Farbchips fuer Kanban-Lane-Koepfe gedacht, nie als
  // Textuntergrund.
  //
  // Seit v3.38 toent `segmentFuellung()` den Akzent auf --tf-bg und schreibt in
  // --tf-text. Dieser Guard rechnet genau das nach — an den ECHTEN Werten aus
  // theme.css, in BEIDEN Modi. Wer ein Kanban-Token aendert (es gehoert auch
  // dem Home-Widget) oder die Toenung "satter" dreht, merkt es hier.
  const THRESHOLD = 4.5;
  // Muss zu TOENUNG in src/plugins/antraege/verlauf-band/bandFarbe.ts passen.
  const TOENUNG = 0.30;

  const farbe = (satz: ThemeFarbSatz, name: string): [number, number, number] => {
    const rgb = parseCssFarbe(satz.werte.get(name) ?? '');
    expect(rgb, `${name} (${satz.modus}) fehlt oder ist nicht lesbar`).toBeTruthy();
    return rgb!;
  };

  /** Die neun Lane-Akzente; die Mono-Rampe haengt an --tf-primary-h und faerbt
   *  keinen Balken. */
  const akzente = (satz: ThemeFarbSatz): string[] => [...satz.werte.keys()]
    .filter(n => n.startsWith('--tf-kanban-') && !n.includes('mono'));

  it(`jede getoente --tf-kanban-Fuellung hat >= ${THRESHOLD}:1 gegen --tf-text`, () => {
    const schlecht: string[] = [];
    for (const satz of themeFarbTokens()) {
      const namen = akzente(satz);
      expect(namen.length, `keine --tf-kanban-Tokens fuer "${satz.modus}"`).toBeGreaterThan(0);
      const grund = farbe(satz, '--tf-bg');
      const tinte = farbe(satz, '--tf-text');
      for (const name of namen) {
        const v = kontrast(mische(farbe(satz, name), grund, TOENUNG), tinte);
        if (v < THRESHOLD) schlecht.push(`  - ${satz.modus} ${name}: ${v.toFixed(2)}:1`);
      }
    }
    if (schlecht.length > 0) {
      expect.fail(
        `Balkenfuellung(en) mit zu geringem Kontrast (Schwelle ${THRESHOLD}:1):\n` +
        schlecht.join('\n') +
        `\nFix: TOENUNG in src/plugins/antraege/verlauf-band/bandFarbe.ts senken ` +
        `(weniger Akzent = mehr Kontrast) ODER das Token in src/theme.css anpassen. ` +
        `NICHT die Schwelle senken — 4,5:1 ist AA fuer Text unter 18,66 px, und die ` +
        `Balkenschrift misst 11 px.`,
      );
    }
  });

  it('haette den Stand bis v3.37 (satte Fuellung, weisse Schrift) verworfen', () => {
    // Ein Guard, der nicht fehlschlagen KANN, ist keiner. Dieselbe Rechnung auf
    // den alten Entwurf angewandt muss durchfallen — und zwar breit: sechs von
    // neun im hellen Modus, alle neun im dunklen. Das haelt zugleich den Befund
    // fest, der die Umstellung ausgeloest hat.
    const WEISS: [number, number, number] = [1, 1, 1];
    const durchgefallen = themeFarbTokens().map(satz => ({
      modus: satz.modus,
      anzahl: akzente(satz).filter(n => kontrast(farbe(satz, n), WEISS) < THRESHOLD).length,
      gesamt: akzente(satz).length,
    }));
    expect(durchgefallen).toEqual([
      { modus: 'hell', anzahl: 6, gesamt: 9 },
      { modus: 'dunkel', anzahl: 9, gesamt: 9 },
    ]);
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

describe('prompt-nur-im-ram (der gesendete Prompt wird nie persistiert)', () => {
  // `SkillRunResult.gesendet` trägt den vollständigen Prompt — inklusive der
  // Vorhabensbeschreibung im Volltext. Er dient allein der Prompt-ANSICHT und lebt
  // in einer React-Ref für die Dauer der Sitzung. Landete er in einem Record, ginge
  // Dokumentinhalt in IDB-Persistenz, Snapshot und Personal-Mirror — vervielfacht
  // um jeden Abschnitt und jeden Lauf.
  it('kein persistierender Gutachten-Reducer nimmt ein `gesendet`-Feld auf', () => {
    const dateien = ['runner.ts', 'types.ts', 'workflow-persistenz.ts']
      .map(f => join(ROOT, 'plugins', 'antraege', 'gutachten', f));
    const treffer: string[] = [];
    for (const file of dateien) {
      const lines = readFileSync(file, 'utf-8').split(/\r?\n/);
      lines.forEach((l, i) => {
        const t = l.trim();
        if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;
        if (/\bgesendet\b/.test(l)) treffer.push(`${relPath(file)}:${i + 1}`);
      });
    }
    expect(
      treffer,
      'Der gesendete Prompt (Dokumentinhalt) darf in keinen persistierten Record wandern.\n'
      + `Fundstelle(n): ${treffer.join(', ')}`,
    ).toEqual([]);
  });

  it('das Session-Protokoll liegt in einer Ref, nicht in IDB/Share', () => {
    const file = join(ROOT, 'plugins', 'antraege', 'gutachten', 'useGutachtenWorkflow.ts');
    const content = readFileSync(file, 'utf-8');
    expect(content).toContain('gesendetRef');
    const zeile = content.split(/\r?\n/).find(l => l.includes('gesendetRef.current.set'));
    expect(zeile, 'merkeGesendet muss in die Ref schreiben').toBeDefined();
    // Kein Persistenz-Aufruf in derselben Anweisung.
    expect(zeile).not.toMatch(/persist|put\(|atomicWrite/);
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
    // SMB-Snapshot; getDatenShareHandle = Daten-Share-Handle; mirrorJsonToPersonal
    // bewusst mit verboten — der Personal-Mirror laeuft ueber genau EINEN
    // Mechanismus (savePersonalSettings), nicht ueber zwei.
    const verboten = [
      'atomicWrite',
      'appendToFile',
      'writeProgrammSnapshot',
      'getDatenShareHandle',
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

describe('status-event-log-local-only (Event-Log verlaesst das Geraet nie)', () => {
  // Das Status-Event-Log haelt fest, wann DIESE Installation eine Aenderung
  // beobachtet hat (`erfasstAm` = Importzeitpunkt auf diesem Geraet, Backfill-
  // Marke je Programm). Zwei Rechner, die an verschiedenen Tagen importieren,
  // schreiben fuer denselben Vorgang verschiedene Zeitstempel — zusammengefuehrt
  // ergaebe das eine widerspruechliche Historie. Es bleibt deshalb geraetelokal,
  // auch seit der KATALOG (v2.332) team-weit auf dem Daten-Share liegt.
  const EVENT_LOG_MODULE = [
    'event-store.ts', 'event-typen.ts', 'event-sort.ts', 'reconcile.ts', 'timeline.ts',
  ];
  const SHARE_WRITER = [
    'atomicWrite', 'appendToFile', 'writeProgrammSnapshot',
    'getDatenShareHandle', 'mirrorJsonToPersonal', 'savePersonalSettings',
  ];
  const istCode = (l: string): boolean => {
    const t = l.trim();
    return !(t.startsWith('//') || t.startsWith('*') || t.startsWith('/*'));
  };

  it('die Event-Log-Module referenzieren keinerlei Share-/Snapshot-/Personal-Writer', () => {
    const treffer: string[] = [];
    for (const file of ALL_TS_FILES) {
      const p = relPath(file);
      if (!p.startsWith('src/core/status/') || p.includes('__tests__')) continue;
      if (!EVENT_LOG_MODULE.some(m => p.endsWith(`/${m}`))) continue;
      const lines = readFileSync(file, 'utf-8').split(/\r?\n/);
      for (const v of SHARE_WRITER) {
        if (lines.some(l => istCode(l) && l.includes(v))) treffer.push(`${p} → ${v}`);
      }
    }
    expect(
      treffer,
      `Das Status-Event-Log ist geraetespezifisch (Beobachtungszeitpunkte dieses Rechners) `
      + `und darf das Geraet nie verlassen.\nVerbotene Referenz(en): ${treffer.join(', ')}`,
    ).toEqual([]);
  });

  it('Snapshot-Allowlist (snapshot.ts) kennt keine Status-Stores', () => {
    const snapshot = readFileSync(join(ROOT, 'core', 'services', 'csv', 'snapshot.ts'), 'utf-8');
    for (const key of ['status_katalog', 'status_event', 'status-katalog', 'status-timeline']) {
      expect(
        snapshot.includes(key),
        `snapshot.ts darf '${key}' nicht kennen — der Status-Katalog hat seine EIGENE Sidecar `
        + `(katalog-share.ts), das Event-Log bleibt geraetelokal. Beides gehoert strukturell `
        + `ausserhalb von SNAPSHOT_FILES.`,
      ).toBe(false);
    }
  });
});

describe('status-katalog-share-only (Katalog: genau EIN Weg auf den Share)', () => {
  // Der Status-Katalog ist seit v2.332 Team-Daten und liegt als Sidecar
  // `_intern/status-katalog.json`. Genau ein Modul fasst dafuer den Share an —
  // sonst entstuende ein zweiter Schreibweg mit eigener Konflikt-Semantik.
  // Registry, SMB-Snapshot und Personal-Mirror bleiben tabu.
  //
  // Seit dem Vorgangssystem gibt es ZWEI Sidecars (Katalog + Trigger-Tabelle),
  // aber weiterhin nur EINE Mechanik: `sidecar-datei.ts`. Der Guard wandert
  // deshalb von `katalog-share.ts` dorthin — und wird dabei strenger, weil jetzt
  // auch die Katalog-Datei nicht mehr selbst auf den Share greift.
  const istCode = (l: string): boolean => {
    const t = l.trim();
    return !(t.startsWith('//') || t.startsWith('*') || t.startsWith('/*'));
  };

  // Das Klärungs-Modul wohnt im Plugin (ein Konsument, ein Blatt), legt seine
  // Antworten aber auf denselben Share. Damit es dadurch nicht aus der Aufsicht
  // faellt, gilt der Guard hier mit: auch `zu-klaeren` geht ueber sidecar-datei.ts.
  const SHARE_AUFSICHT = ['src/core/status/', 'src/plugins/zu-klaeren/'];

  it('nur sidecar-datei.ts fasst den Daten-Share an', () => {
    const treffer: string[] = [];
    for (const file of ALL_TS_FILES) {
      const p = relPath(file);
      if (!SHARE_AUFSICHT.some(d => p.startsWith(d)) || p.includes('__tests__')) continue;
      if (p.endsWith('/sidecar-datei.ts')) continue;
      const lines = readFileSync(file, 'utf-8').split(/\r?\n/);
      for (const v of ['atomicWrite', 'getDatenShareHandle']) {
        if (lines.some(l => istCode(l) && l.includes(v))) treffer.push(`${p} → ${v}`);
      }
    }
    expect(
      treffer,
      `Der Share-Zugriff des Status-Systems gehoert ausschliesslich in sidecar-datei.ts.\n`
      + `Verbotene Referenz(en): ${treffer.join(', ')}`,
    ).toEqual([]);
  });

  it('kein Status-Modul schreibt in registry.json oder den Personal-Mirror', () => {
    const treffer: string[] = [];
    for (const file of ALL_TS_FILES) {
      const p = relPath(file);
      if (!p.startsWith('src/core/status/') || p.includes('__tests__')) continue;
      const lines = readFileSync(file, 'utf-8').split(/\r?\n/);
      for (const v of ['registry.json', 'mirrorJsonToPersonal', 'savePersonalSettings', 'writeProgrammSnapshot']) {
        if (lines.some(l => istCode(l) && l.includes(v))) treffer.push(`${p} → ${v}`);
      }
    }
    expect(treffer, `Verbotene Referenz(en): ${treffer.join(', ')}`).toEqual([]);
  });

  it('jeder Sidecar-Pfad steht genau einmal im Code', () => {
    // Ein Pfad, der an zwei Stellen steht, driftet beim ersten Umbenennen
    // auseinander — und die zweite Stelle schreibt dann leise ins Nirgendwo.
    const pfade: [string, string][] = [
      ['_intern/status-katalog.json', 'src/core/status/katalog-share.ts'],
      ['_intern/status-trigger.json', 'src/core/status/trigger-share.ts'],
      // Das Journal ist die dritte Sidecar. Stand und Monatsdateien leiten sich
      // beide aus DIESER Wurzel ab — stünde sie zweimal, schriebe die zweite
      // Stelle beim ersten Umbenennen leise ins Nirgendwo.
      ['_intern/vorgangssystem/journal', 'src/core/status/journal/pfade.ts'],
      // Die Klaerungs-Ablage ist die vierte. Verzeichnis UND Autor-Dateiname
      // leiten sich aus dieser Wurzel ab — stuende sie zweimal, schriebe die
      // zweite Stelle beim ersten Umbenennen leise ins Nirgendwo.
      ['_intern/klaerung', 'src/plugins/zu-klaeren/pfade.ts'],
    ];
    for (const [pfad, heimat] of pfade) {
      // Nur CODE zaehlt: ein Modulkopf, der den Nachbar-Sidecar erklaert, ist
      // Dokumentation und kein zweiter Schreibweg.
      const treffer = ALL_TS_FILES.filter(f =>
        !relPath(f).includes('__tests__')
        && readFileSync(f, 'utf-8').split(/\r?\n/).some(l => istCode(l) && l.includes(pfad)),
      ).map(relPath);
      expect(treffer, `Sidecar-Pfad ${pfad} gehoert nur nach ${heimat}.`).toEqual([heimat]);
    }
  });
});

describe('status-kategorie-nur-aus-katalog (Ordnerbaum ist Daten, kein Code)', () => {
  // Der Ordnerbaum des Fachsystems ist kuratierbare Team-Kuration: die PL legt
  // Ordner an und haengt Felder um, ohne dass ein Build noetig waere. Genau
  // deshalb darf der Baum NUR an zwei Stellen im Code stehen — im Seed (als
  // Vorbelegung) und in den Tests. Ein zweites Ordner-Mapping (z.B. eine
  // hartkodierte Kategorie-Liste in einer UI) waere ein stiller Fork, der bei
  // der ersten Umbenennung durch die PL auseinanderlaeuft.
  const KATEGORIE_ID = /['"](?:vb|tv)\.[a-z0-9-]+(?:\.[a-z0-9-]+)*['"]/;
  const ERLAUBT = [
    'src/core/status/seed-kategorien.ts',
    'src/core/status/seed-codes.ts',
    'src/core/status/seed.ts',                 // kanonische Felder haengen im Baum
    'src/core/status/seed-kanonisch.ts',       // ebendiese, seit dem Zyklenschnitt hier
    'src/core/status/kategorien.ts',           // NICHT_ZUGEORDNET_ID (Sammelordner)
  ];

  it('Kategorie-Ids stehen nur im Seed und in den Sammelordner-Konstanten', () => {
    const treffer = ALL_TS_FILES.filter(f => {
      const p = relPath(f);
      if (p.includes('__tests__') || ERLAUBT.includes(p)) return false;
      return readFileSync(f, 'utf-8').split(/\r?\n/).some(l => {
        const t = l.trim();
        if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return false;
        return KATEGORIE_ID.test(l);
      });
    }).map(relPath);
    expect(
      treffer,
      'Kategorie-Ids (`vb.…`/`tv.…`) gehoeren in den Seed, nicht in die Anwendung. '
      + 'Wer einen Ordner braucht, liest ihn aus `version.kategorien` — die PL kann ihn '
      + `jederzeit umbenennen oder umhaengen. Gefunden in: ${treffer.join(', ')}`,
    ).toEqual([]);
  });
});

describe('bereich-nie-im-daten-layer (Pitfall #46)', () => {
  // Der Betrachtungsbereich ist ein EXPLIZITER Parameter jedes Konsumenten —
  // Arbeitsvorrat folgt ihm, Evidenz nicht. Zöge ihn stattdessen der Daten-Layer
  // (IDB-Leser, CSV-Dienste, Suchkorpus), gäbe es keine Stelle mehr, an der man
  // ihn abschalten könnte: die Suche fände dann nur noch, was ohnehin sichtbar
  // ist, und ein Deep-Link auf ein Altprogramm liefe ins Leere.
  const VERBOTEN = /\bistImBereich\b|useBereich\b/;
  const TABU = [
    'src/core/services/csv/',        // IDB-Leser + Projektionen
    'src/core/services/search/',     // Suchkorpus + Orama
    'src/plugins/antraege/services/', // Antrags-Suchkorpus
  ];

  it('kein Bereichs-Filter in Daten-Layer oder Suchkorpus', () => {
    const treffer = ALL_TS_FILES.filter(f => {
      const p = relPath(f);
      if (p.includes('__tests__')) return false;
      if (!TABU.some(t => p.startsWith(t))) return false;
      return readFileSync(f, 'utf-8').split(/\r?\n/).some(l => {
        const t = l.trim();
        if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return false;
        return VERBOTEN.test(l);
      });
    }).map(relPath);
    expect(
      treffer,
      'Der Betrachtungsbereich gehört an den Konsumenten, nicht in den Daten-Layer. '
      + 'Die globale Suche bleibt am Vollbestand, und ein Antrag muss per Deep-Link '
      + `immer erreichbar sein (Pitfall #46). Gefunden in: ${treffer.join(', ')}`,
    ).toEqual([]);
  });

  it('Sicht-Zaehler kommen aus EINER Grundmenge', () => {
    // Gegenprobe zum Obigen: der Bereich gehoert an den Konsumenten — aber dann
    // muss auch JEDE Oberflaeche, die Sicht-Zahlen zeigt, denselben Konsumenten
    // benutzen. Solange die Chips in der Filter-Sidebar selbst zaehlten, liessen
    // sie den Bereich aus: Chip 555, Tab 541, dieselbe Sicht. Zaehlen darf
    // deshalb nur die Pipeline, die auch die Liste erzeugt; alle anderen lesen
    // `useFilteredAntraege().counts`.
    const ERLAUBT = [
      'src/plugins/antraege/views.ts',              // Definition
      'src/plugins/antraege/useFilteredAntraege.ts', // einzige Zaehlstelle
    ];
    // Positiv-Kontrolle: greift der Pfad-Filter nicht, liefe der Guard ins Leere
    // und meldete fuer immer „alles gut".
    const gescannt = ALL_TS_FILES.map(relPath).filter(p => p.startsWith('src/plugins/antraege/'));
    expect(gescannt, 'Pfad-Filter trifft keine Datei — der Guard prueft nichts').toContain(ERLAUBT[1]);
    const treffer = ALL_TS_FILES.filter(f => {
      const p = relPath(f);
      if (p.includes('__tests__') || ERLAUBT.includes(p)) return false;
      if (!p.startsWith('src/plugins/antraege/')) return false;
      return readFileSync(f, 'utf-8').split(/\r?\n/).some(l => {
        const t = l.trim();
        if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return false;
        return /\bviewCounts?\s*\(/.test(l);
      });
    }).map(relPath);
    expect(
      treffer,
      'Sicht-Zahlen kommen aus `useFilteredAntraege().counts` — dieselbe Grundmenge '
      + 'wie die Liste (Bereich, Inaktiv-Ausschluss, Irrlaeufer-Schalter). Eine eigene '
      + `Zaehlung driftet still von der Liste darunter weg (Pitfall #46). Gefunden in: ${treffer.join(', ')}`,
    ).toEqual([]);
  });
});

describe('journal-ohne-personen-achse (Pitfall #48)', () => {
  // Das Import-Diff-Journal beantwortet „was hat sich geaendert", nicht „wer war
  // das". Mit Bearbeiter-Spalte plus Datumsverlauf entstuende ein
  // personenbezogenes Aktivitaetsprotokoll — Leistungs- und
  // Verhaltenskontrolle, mitbestimmungspflichtig. Das ist eine bewusste
  // Gestaltungsentscheidung und keine Auslassung; deshalb steht sie hier.
  const JOURNAL = 'src/core/status/journal/';
  const ANSICHTEN = [
    'src/plugins/home/widgets/NachtlaufWidget.tsx',
    'src/plugins/antraege/status/JournalVerlauf.tsx',
    // Die Frische-Diagnose im Status-Cockpit: sie beantwortet „laeuft das
    // Journal noch", nie „wer war das". Deshalb steht sie in einer EIGENEN
    // Datei — an eine Sammel-Sektion gehaengt liesse sich die Regel nicht mehr
    // pruefen, ohne deren uebrige Diagnosen mitzufangen.
    'src/plugins/status-cockpit/JournalFrische.tsx',
  ];
  const istCode = (l: string): boolean => {
    const t = l.trim();
    return !(t.startsWith('//') || t.startsWith('*') || t.startsWith('/*'));
  };

  it('JOURNAL_AUSGESCHLOSSEN nennt jede bekannte Bearbeiterspalte', () => {
    expect([...JOURNAL_AUSGESCHLOSSEN].sort())
      .toEqual(['BFM_KUERZ', 'BIB_KUERZ', 'PFM_KUERZ', 'TIB_KUERZ', 'ZTP_KUERZ']);
  });

  it('kein Journal-Modul und keine Journal-Ansicht liest ein Bearbeiter-Kuerzel', () => {
    const VERBOTEN = /\b\w*_kuerz\b|\bbearbeiter_kuerzel\b|\buseMeinKuerzel\b/i;
    const treffer: string[] = [];
    for (const file of ALL_TS_FILES) {
      const p = relPath(file);
      if (p.includes('__tests__')) continue;
      if (!p.startsWith(JOURNAL) && !ANSICHTEN.includes(p)) continue;
      for (const l of readFileSync(file, 'utf-8').split(/\r?\n/)) {
        // Die Ausschluss-Liste selbst DARF die Namen nennen — sie ist der Ort,
        // an dem die Entscheidung nachlesbar steht.
        if (p.endsWith('/felder.ts')) continue;
        if (istCode(l) && VERBOTEN.test(l)) treffer.push(`${p}: ${l.trim().slice(0, 70)}`);
      }
    }
    expect(
      treffer,
      'Das Journal fuehrt keine Personen-Achse: keine Bearbeiterspalte in der Projektion, '
      + 'keine Gruppierung/Sortierung/Filterung nach Bearbeiter in einer Journal-Ansicht '
      + `(Pitfall #48).\nGefunden: ${treffer.join(' | ')}`,
    ).toEqual([]);
  });

  it('das Journal schreibt nie in IndexedDB — eine geraetelokale Historie divergiert', () => {
    const treffer: string[] = [];
    for (const file of ALL_TS_FILES) {
      const p = relPath(file);
      if (!p.startsWith(JOURNAL) || p.includes('__tests__')) continue;
      for (const l of readFileSync(file, 'utf-8').split(/\r?\n/)) {
        if (istCode(l) && /\bidb\.(set|delete|append)\b/.test(l)) treffer.push(`${p}: ${l.trim()}`);
      }
    }
    expect(
      treffer,
      'Der Journal-Stand liegt auf dem Share. Gerätelokal gefuehrt erzeugte er genau die '
      + `Divergenz, die das Vorgangssystem beseitigt hat.\nGefunden: ${treffer.join(' | ')}`,
    ).toEqual([]);
  });

  it('der Journal-Bereich kommt aus der TEAM-Kuration, nie aus der persoenlichen Auswahl', () => {
    const treffer: string[] = [];
    for (const file of ALL_TS_FILES) {
      const p = relPath(file);
      if (!p.startsWith(JOURNAL) || p.includes('__tests__')) continue;
      for (const l of readFileSync(file, 'utf-8').split(/\r?\n/)) {
        if (istCode(l) && /useBereich|useBetrachtungsbereich/.test(l)) treffer.push(`${p}: ${l.trim()}`);
      }
    }
    expect(
      treffer,
      'Der Bereich des Journals kommt aus `bereichsProgramme(getAktiveVersion())`. Aus der '
      + 'persoenlichen Auswahl gespeist entschiede die Einstellung EINES Rechners ueber den '
      + `Inhalt einer geteilten Datei.\nGefunden: ${treffer.join(' | ')}`,
    ).toEqual([]);
  });
});

describe('kuerzel-genau-ein-speicherort (Regression des v2.376-Doppelfelds)', () => {
  // Vier Kürzel des Fachsystems hängen an einem KANONISCHEN Feld (`AAE` →
  // antragsdatum, `ABB` → bewilligung_datum, `AZ1` → erstentscheidung, `VBE` →
  // vn_eingang_datum). Sie dürfen NICHT zusätzlich als `D_<code>`-Feld geführt
  // werden: die Kollisionsregel der Feld-Auflösung gibt dem kanonischen Feld den
  // Wert, das `D_`-Feld bleibt für immer leer. Solange `ABB` doppelt hing, galt
  // es überall als „nie gesetzt" — und fast jede Trigger-Bedingung lautet „TV
  // hat kein ABB" (Pitfall #44).
  //
  // Die Liste wird AUS `KANONISCHE_CODE_FELDER` gebaut, nie von Hand gepflegt:
  // ein fünftes kanonisches Feld ist damit ab dem ersten Tag mit bewacht.
  const CODES = [...KANONISCHE_CODE_FELDER.keys()];
  // `D_AAE` als ganzer String/Bezeichner — `D_AZ1_1` (die echte CSV-Spalte, per
  // Alias kanonisch gemappt) endet nicht hier und bleibt erlaubt.
  const LITERAL = new RegExp(`['"\`]D_(?:${CODES.join('|')})['"\`]`);
  // Scope: die Module, in denen ein `D_<code>` einen KATALOG-FELD-Eintrag meint.
  // Außerhalb (z.B. die CSV-Label-Tabelle der Auslastung) ist `D_AAE` schlicht
  // der Name einer Export-Spalte — den gibt es wirklich, und ihn zu benennen ist
  // richtig. Der Fehler entsteht erst dort, wo daraus ein Feld des Katalogs wird.
  const SCOPE = [
    'src/core/status/',
    'src/plugins/status-cockpit/',
    'src/plugins/vorgangs-board/',
    'src/plugins/antraege/status/',
  ];

  it('LITERAL trifft das Code-Feld, nicht die CSV-Spalte', () => {
    expect(LITERAL.test("feld('D_ABB')")).toBe(true);
    expect(LITERAL.test('"D_AAE"')).toBe(true);
    expect(LITERAL.test("'D_AZ1_1'")).toBe(false);   // CSV-Spalte, kanonisch gemappt
    expect(LITERAL.test("'D_ABLZ'")).toBe(false);    // fremdes Kürzel
  });

  it('kein kanonisch belegtes Kürzel wird als D_-Feld geschrieben', () => {
    const findings: Finding[] = [];
    for (const file of ALL_TS_FILES) {
      if (file.includes(`${sep}__tests__${sep}`)) continue;
      if (!SCOPE.some(s => relPath(file).startsWith(s))) continue;
      findings.push(...findInFile(
        file,
        l => !/^\s*(?:\/\/|\*|\/\*)/.test(l) && LITERAL.test(l),
        'allow-kanonisches-doppelfeld',
      ));
    }
    if (findings.length > 0) {
      expect.fail(
        `Ein kanonisch belegtes Kürzel darf kein zweites \`D_\`-Feld bekommen.\n`
        + `Den Spaltennamen über todoFeld()/feld() aus KANONISCHE_CODE_FELDER holen —\n`
        + `dort steht, wie das Feld im Katalog wirklich heißt. Ein hart geschriebenes\n`
        + `\`D_<code>\` findet für diese vier Kürzel NIE einen Wert und schweigt für immer.\n`
        + `\nTreffer:\n${fmt(findings)}`,
      );
    }
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

describe('no-index-punkt-id (Klärungs-Punkte tragen stabile Ids)', () => {
  // Die Urteile und Kommentare der Klärung liegen append-only als JSONL auf dem
  // Share und sind über `autor|punktId` gekeyt. Eine Id aus der Schleifenposition
  // (`frage-${i + 1}`) verschiebt beim nächsten eingefügten Punkt alle Antworten
  // dahinter — lautlos, und in einer Datei, die sich nicht korrigieren lässt.
  // Erlaubt bleibt, was aus DATEN entsteht (`code-${code}`): dieselbe Eingabe
  // ergibt dieselbe Id, egal an welcher Position sie steht.
  const istIndexId = (l: string): boolean => {
    const t = l.trim();
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return false;
    // `id: \`…${i}…\`` bzw. `${index}` / `${ i + 1 }` — der Schleifenzähler selbst.
    return /\bid:\s*`[^`]*\$\{\s*(i|j|idx|index|nr)\b/.test(l);
  };

  it('erkennt die Formen (Selbsttest)', () => {
    expect(istIndexId('    id: `frage-${i + 1}`,')).toBe(true);
    expect(istIndexId('  id: `punkt-${index}`,')).toBe(true);
    expect(istIndexId('      id: `code-${code}`,')).toBe(false);
    expect(istIndexId('   * Bis v2.412 stand hier id: `frage-${i + 1}`.')).toBe(false);
  });

  it('kein Klärungs-Punkt bekommt seine Id aus der Position', () => {
    const findings: Finding[] = [];
    for (const file of ALL_TS_FILES) {
      if (!relPath(file).startsWith('src/plugins/zu-klaeren/')) continue;
      if (file.includes(`${sep}__tests__${sep}`)) continue;
      findings.push(...findInFile(file, istIndexId, 'allow-index-id'));
    }
    if (findings.length > 0) {
      expect.fail(
        `Eine Punkt-Id aus dem Schleifenindex ist verboten (Klärung, v2.412).\n`
        + `Die Antworten auf dem Share zeigen auf die Id; eine eingefügte Frage\n`
        + `verschöbe sie alle, und die Datei ist append-only.\n`
        + `Stattdessen: sprechende Id am Datensatz (\`frage-32-ablehnungsreif\`) oder\n`
        + `aus den Daten ableiten (\`code-\${code}\`). Alte Ids übersetzt ALT_PUNKT_IDS.\n`
        + `\nTreffer:\n${fmt(findings)}`,
      );
    }
  });
});
