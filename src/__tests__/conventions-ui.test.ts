/**
 * Codebase-Conventions — Oberflaeche, Tokens, Kontrast, geteilte Bauteile.
 *
 * Statt einer separaten ESLint-Konfiguration (Projekt nutzt nur tsc + vitest)
 * laufen die Pattern-Checks als Vitest-Tests. Schlaegt ein Check fehl, listet
 * die Fehlermeldung die Treffer mit Datei:Zeile + die zu nutzende Alternative.
 *
 * Inline-Whitelist: Zeilen mit Marker-Kommentar `// allow-<rule>: <reason>`
 * werden ignoriert. Bitte den Grund knapp dokumentieren — das macht die
 * Ausnahme review-bar.
 *
 * Geschwister-Dateien: conventions-status.test.ts, conventions-daten.test.ts, health-baseline.test.ts. Der Schnitt ist thematisch;
 * Datei-Walk + Such-Primitive liegen gemeinsam in conventions-lib.ts.
 *
 * Geprueft:
 *   - no-raw-async-onclick              → Pitfall #15, useAsyncAction-Hook.
 *   - no-raw-clipboard                  → v2.301.3, Zwischenablage nur ueber
 *     kopiereText() aus src/core/utils/kopieren.ts (execCommand-Rueckfall +
 *     wirft statt still zu scheitern); "kopieren und oeffnen" erst kopieren.
 *   - dom-attribut-per-callback-ref     → Bug-Klasse 23: DOM-Attribute
 *     nicht ueber eine useRef setzen. Hinter bedingtem Rendern steht der Knoten
 *     beim Mount-Effekt nicht da, und []-Deps laufen nie wieder — eine
 *     Callback-Ref laeuft bei JEDEM Montieren.
 *   - no-headless-tree-outside-wrapper  → Tree-Basis (v2.393): @headless-tree/*
 *     nur in src/components/tree/; Verbraucher nutzen TfTree statt einen zweiten
 *     Baum mit eigenem Aufklapp-/Auswahl-/DnD-Verhalten zu bauen.
 *   - no-raw-modal                      → recurring-bug-classes Klasse 7, Modals
 *     ueber den Dialog aus @/components/ui/dialog rendern (Hoehen-Cap + Scroll
 *     eingebaut) statt per Hand `fixed inset-0`.
 *   - no-new-tf-ui-files                → P1b, src/ui/ ist nur noch Re-Export-Shim;
 *     neue UI-Komponenten gehoeren nach src/components/ui/.
 *   - gutachten-entwurf-kein-plain-textarea → Gutachten-Entwurf nutzt den
 *     Live-Preview-Editor (MarkdownEditor + markdownLivePreview), kein rohes
 *     <textarea> (Buffer bleibt rohes Markdown = Ground-Truth, kein Roundtrip).
 *   - theme-token-contract              → Design-Handoff-Token-Vertrag (v2.119):
 *     jedes via var(--tf-…) OHNE Fallback in CSS/TSX/TS referenzierte Token MUSS
 *     global in src/theme.css definiert sein, sonst die "nackt"-Falle v2.67.1 (ein
 *     undefiniertes var() macht die GANZE CSS-Deklaration ungueltig). Mit-Fallback-
 *     Nutzung undefinierter Tokens nur Warnung. Ausnahme '// allow-tf-token: <grund>'.
 *   - band-fuellung-kontrast           → VerlaufsBand (v3.38): jedes --tf-kanban-*
 *     Token, zu TOENUNG auf --tf-bg gemischt, muss >= 4,5:1 gegen --tf-text erreichen —
 *     in BEIDEN Modi, an den echten Werten aus theme.css. Der Stand bis v3.37 (satte
 *     Fuellung, weisse Schrift) lag bei 3,02-5,06:1 hell und 2,14-2,92:1 dunkel; ein
 *     zweiter Testfall haelt fest, dass der Guard genau den verworfen haette.
 *   - hilfe-knopf-am-blattrand          → Seiten-Hilfe steht rechts AUSSEN: die
 *     Kopfzeile einer Seite spannt die volle Blattbreite, ein schmalerer Rumpf
 *     beginnt erst darunter. Kein `max-w-*` in der Vorfahren-Kette des Knopfes.
 *   - no-raw-cta-fill                   → CTA-Buttons tragen die Profil-Primaerfarbe
 *     ueber die kanonische <Button>-Komponente (@/components/ui/button, variant=
 *     'primary' = --tf-primary); kein hand-gebauter Fill — weder als Klasse
 *     (`bg-[var(--tf-text)]`/`bg-[var(--tf-primary)]` + hover:opacity) noch inline
 *     (`background:'var(--tf-text)',color:'var(--tf-bg)'`). Inline '// allow-cta-fill'.
 *   - rollen-farbe-eine-quelle          → Chronik/Zeitstrahl (v4.48): die Zuordnung
 *     Rolle → Farbe steht genau einmal (src/core/status/rollen-farbe.ts), die Werte
 *     genau in theme.css; und jede Rollenfarbe muss auf ihrer eigenen Flaeche in
 *     BEIDEN Modi >= 4,5:1 erreichen. Inline '// allow-rollen-farbe: <grund>'.
 *   - spalten-hilfe-abdeckung           → Spaltenkoepfe erklaeren ihre Herkunft
 *     (v4.54): jede Spalte der Foerdertabelle traegt einen Satz in
 *     plugins/antraege/spaltenHilfe.ts. Eine neue Spalte ohne Erklaerung faellt
 *     hier auf, nicht erst im Betrieb; und ein Satz zu einer geloeschten Spalte
 *     faellt ebenfalls auf, statt als toter Text liegenzubleiben.
 *   - rueckweg-satz-abdeckung           → der Rueckweg aus dem Antrags-Detail
 *     nennt die Herkunftsseite im Dativ (v4.85.7): jede Seite hat ihre Fuegung in
 *     core/nav/rueckwegSatz.ts. Ein neues Plugin ohne Eintrag faellt hier auf
 *     (sonst stuende „Zurueck zu Suche" statt „zur Suche"), eine Fuegung ohne
 *     Seite ebenso.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';
import { PRESET_COLORS } from '../components/ui/theme';
import { ANTRAG_TABLE_COLUMNS } from '../plugins/antraege/tableColumns';
import { SPALTEN_MIT_SATZ, baueSpaltenHilfe } from '../plugins/antraege/spaltenHilfe';
import { SEITEN_FUEGUNG, rueckwegSatz } from '../core/nav/rueckwegSatz';
import {
  ROOT, ALL_TS_FILES, ALL_SOURCE_FILES, relPath, findInFile, fmt, hslToRgb, relLuminance, kontrast, mische, parseCssFarbe, themeFarbTokens, type Finding, type ThemeFarbSatz,
} from './conventions-lib';

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
    // Dokumentenquellen — v1.15, Migration laeuft. Mit v4.34 aus
    // `src/plugins/dokumentenquellen-kuration/` in den Kuration-Hub gezogen;
    // die Pfade ziehen mit, damit ein UMZUG alte Schuld nicht als neue meldet
    // (und umgekehrt der Guard nicht still aufhoert, sie zu bewachen).
    'src/plugins/kuration/dokumentenquellen/components/SourceFormDialog.tsx',
    'src/plugins/kuration/dokumentenquellen/sections/AktivierenIndexierenSection.tsx',
    'src/plugins/kuration/dokumentenquellen/sections/VerwaltenSection.tsx',
    'src/plugins/kuration/dokumentenquellen/components/SubRootsTreePicker.tsx',
    // Filter + Programme — mit v4.36 aus `src/plugins/{filter,programme}-kuration/`
    // ins Panel „Förderprogramme" gezogen (bis v4.40 „Verzeichnisse"); die
    // Pfade ziehen mit (siehe oben).
    'src/plugins/kuration/foerderprogramme/filter/dialogs/FilterEditDialog.tsx',
    'src/plugins/kuration/foerderprogramme/filter/sections/AdminCustomFilterList.tsx',
    'src/plugins/kuration/foerderprogramme/programme/unterprogramme/UnterprogrammXlsxImportDialog.tsx',
    // antraege/, einstellungen/ etc.
    'src/plugins/antraege/filter/FilterSidebar.tsx',
    'src/plugins/antraege/filter/SavePresetDialog.tsx',
    // (einstellungen/MeineTechnologienTab.tsx + KuratorSessionPanel.tsx sind mit
    //  dem Redesign v4.28/v4.29 entfallen — die Nachfolger nutzen useAsyncAction.)
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
        `Referenz: src/plugins/kuration/csv-quellen/CsvQuellenPanel.tsx,\n` +
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

describe('dom-attribut-per-callback-ref (Bug-Klasse 23)', () => {
  // Ein DOM-Attribut ueber eine `useRef` zu setzen, verlangt, dass der Knoten
  // da IST, wenn der Code laeuft — und der Mount-Effekt der Elternkomponente
  // ist genau der Moment, in dem das NICHT garantiert ist: steckt der Knoten
  // hinter einem bedingten Rendern (`SettingsKlappe` mit `{offen && …}`, ein
  // Tab, ein `{laedt ? … : …}`), greift der Effekt ins Leere und laeuft bei
  // `[]`-Deps nie wieder.
  //
  // Real passiert (seit v4.31): das Bridge-Lesezeichen bekam sein
  // `javascript:`-href aus einem Mount-Effekt, sass aber in einer zugeklappten
  // SettingsKlappe. Der Anker montierte spaeter — ohne `href` — und liess sich
  // nicht in die Chrome-Lesezeichenleiste ziehen. Vorher lag derselbe Anker in
  // einem `<details>`, das seine Kinder MONTIERT haelt; nur der Behaelter
  // wechselte, und die stille Annahme kippte.
  //
  // Eine Callback-Ref hat das Problem nicht: sie laeuft bei jedem Montieren des
  // Knotens und bekommt ihn als Argument.
  // KEIN `\b` vor `current`-Traeger: der Treffer heisst real `linkRef.current`,
  // und `\bref` faende darin nichts (zwischen 'k' und 'R' liegt keine
  // Wortgrenze). Der Selbsttest unten haelt genau das fest.
  const pattern = /\.\s*current\s*[!?]?\s*\.\s*(setAttribute|removeAttribute)\s*\(|\.\s*current\s*[!?]?\s*\.\s*(href|src)\s*=[^=]/;

  it('kein DOM-Attribut-Schreiben ueber eine Ref (Callback-Ref stattdessen)', () => {
    const findings: Finding[] = [];
    for (const file of ALL_TS_FILES) {
      if (!file.endsWith('.tsx')) continue;
      if (file.includes(`${sep}__tests__${sep}`)) continue;
      findings.push(...findInFile(file, l => pattern.test(l), 'allow-ref-dom-attribut'));
    }

    if (findings.length > 0) {
      const msg =
        `DOM-Attribute nicht ueber eine useRef setzen (Bug-Klasse 23).\n` +
        `Der Knoten muss dafuer schon dastehen — hinter einem bedingten Rendern\n` +
        `(SettingsKlappe '{offen && …}', Tab, Ladezustand) tut er das nicht, und\n` +
        `ein Mount-Effekt mit []-Deps laeuft nie wieder.\n\n` +
        `Stattdessen eine CALLBACK-Ref, die bei jedem Montieren laeuft:\n` +
        `  const setzeX = useCallback((el: HTMLAnchorElement | null) => {\n` +
        `    if (el) el.setAttribute('href', URL);\n` +
        `  }, []);\n` +
        `  <a ref={setzeX} />\n\n` +
        `Faesst die Stelle wirklich einen dauerhaft montierten Fremd-Knoten an,\n` +
        `Zeile mit '// allow-ref-dom-attribut: <grund>' markieren.\n\nTreffer:\n${fmt(findings)}`;
      expect.fail(msg);
    }
  });

  // Ein Guard, der den Fall nicht faengt, den er verhindern soll, ist keiner.
  // Die erste Fassung dieses Musters begann mit `\bref` und verfehlte damit
  // ausgerechnet den echten Treffer (`linkRef.current`) — hier festgenagelt.
  it('haette den historischen Defekt gefangen', () => {
    const defekt = `    if (linkRef.current) linkRef.current.setAttribute('href', BRIDGE_BOOKMARKLET);`;
    expect(pattern.test(defekt)).toBe(true);
    expect(pattern.test(`  bildRef.current!.src = quelle;`)).toBe(true);

    // Und laesst die legitimen `.current`-Zugriffe der Codebase in Ruhe.
    for (const harmlos of [
      `  const rect = wrapperRef.current.getBoundingClientRect();`,
      `  wideScrollRef.current.scrollTop = wideScrollTop.current;`,
      `  handlersRef.current.uebernehmen = onUebernehmen;`,
      `  signal: abortRef.current.signal,`,
      `  if (!containerRef.current.contains(e.target as Node)) onClose();`,
      `  el.setAttribute('href', BRIDGE_BOOKMARKLET);`,
    ]) {
      expect(pattern.test(harmlos), harmlos).toBe(false);
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

describe('no-parallel-board-geometry (Bahn-Layout gehört in TfBoard)', () => {
  // Die gedrehte Schmalschiene ist die Signatur eines nachgebauten Kanban-Bahn-
  // Layouts: eine schmale Spur, in der die Bezeichnung senkrecht steht, weil die
  // Bahn leer bzw. eingeklappt ist. Genau daran hingen die Zahlen, die zwischen
  // v2.228 (Extraktion nach `KanbanBoard`) und v3.17 (Nachbau im Feedback-Board)
  // auseinanderliefen: 46 gegen 44 px, dieselbe 30%-Mischung in zwei Sprachen,
  // die „+ N weitere"-Fußzeile dreimal. Und der Beweis, dass so etwas nicht
  // auffällt: `spalten: 1|2` wurde im Popover angeboten, persistiert,
  // durchgereicht — und im Nachbau nie gelesen.
  //
  // Signatur-basiert wie no-parallel-scope-tabs, nicht Import-basiert wie
  // no-headless-tree-outside-wrapper: das Board hat keine Bibliothek, die man
  // importieren müsste, also gibt es nichts zu verbieten außer der Form selbst.
  const SIGNATUREN = ['writing-mode: vertical-rl', '[writing-mode:vertical-rl]'];
  // Kanonische Heimat + die eingeklappte PANE, die dieselbe Drehung nutzt und
  // etwas anderes ist: eine je Bildschirm, ohne Zähler, ohne Lane-Akzent, ohne
  // Wiederholung. Ihr Primitiv ist MasterDetailLayout, nicht TfBoard.
  const ALLOWED_SUFFIXES = [
    'components/kanban/tf-board.css',                   // Primitiv-Definition
    'components/master-detail/MasterDetailLayout.tsx',  // Pane-Schiene (kanonisch)
    'plugins/antraege/AntraegePage.tsx',                // Pane-Schiene, dokumentierter
                                                        // MasterDetailLayout-Nachbau
                                                        // (docs/layout-audit.md → Adoptions-Status)
    'plugins/chat/assistent/AssistentSpine.tsx',        // Pane-Schiene (seit v3.50
                                                        // eigenes Bauteil: Dock UND
                                                        // Suche tragen denselben
                                                        // Streifen — ein Nachbau
                                                        // wäre genau die Drift,
                                                        // die dieser Guard meint)
    'plugins/antraege/gutachten/gutachten.css',         // Pane-Schiene (g-ctx-reopen-lbl)
  ];
  const isAllowed = (file: string): boolean => {
    const rel = relPath(file);
    return rel.includes('/__tests__/') || ALLOWED_SUFFIXES.some(s => rel.endsWith(s));
  };

  it('keine gedrehte Bahn-Schmalschiene außerhalb des Board-Primitivs', () => {
    const findings: Finding[] = [];
    for (const file of ALL_SOURCE_FILES) {
      if (isAllowed(file)) continue;
      findings.push(...findInFile(file, l => SIGNATUREN.some(s => l.includes(s)), 'allow-board-geometry'));
    }
    if (findings.length > 0) {
      expect.fail(
        `Kanban-Bahn-Layout gehört in das Board-Primitiv (@/components/kanban/TfBoard\n` +
        `+ tf-board.css) — nicht hand-bauen. Schmalschiene, getönter Bahn-Kopf,\n` +
        `Zähler-Pille, „+ N weitere"-Fußzeile und die Kartenspalten gehören\n` +
        `zusammen; getrennt driften sie.\n` +
        `Fehlende Fähigkeit? Im Primitiv als Feature-Flag ergänzen, nicht daneben.\n` +
        `Senkrechte Beschriftung an einer eingeklappten PANE (nicht an einer Bahn)?\n` +
        `→ MasterDetailLayout. Echte Ausnahme: '// allow-board-geometry: <grund>'.\n\n` +
        `Treffer:\n${fmt(findings)}`,
      );
    }
  });

  // Zweiter Teil, ohne Whitelist: Karten-Ziehen und Datei-Ablage sind über das
  // benutzte dataTransfer-Feld trennscharf. Datei-Ablagen (FileDropZone,
  // FeedbackFileInput, chat/Composer, KompetenzImportDialog) lesen ausschliesslich
  // `.files`; ein Karten-Drag braucht setData/getData/dropEffect/effectAllowed.
  // Damit bleibt die Drop-Naht im Primitiv — und ein spaeterer Wechsel auf eine
  // Bibliothek (Touch, Tastatur, Auto-Scroll) fasst keinen Aufrufer an.
  const DND = /dataTransfer\.(setData|getData|dropEffect|effectAllowed)\b/;
  const DND_HEIMAT = `${sep}src${sep}components${sep}kanban${sep}`;

  it('kein hand-gebautes Karten-Ziehen außerhalb des Board-Primitivs', () => {
    const findings: Finding[] = [];
    for (const file of ALL_TS_FILES) {
      if (file.includes(DND_HEIMAT)) continue;
      if (file.includes(`${sep}__tests__${sep}`)) continue;
      findings.push(...findInFile(file, l => DND.test(l), 'allow-board-dnd'));
    }
    if (findings.length > 0) {
      expect.fail(
        `Karten-Ziehen läuft über die Drop-Naht des Board-Primitivs:\n` +
        `  <TfBoard dnd={{ idOf, onDrop }} renderCard={(k, bahn, zieh) => …} />\n` +
        `Der Aufrufer spreizt \`zieh\` auf seinen Kartenknoten und schreibt NIE selbst\n` +
        `in dataTransfer — sonst hängt die Mechanik an zwei Stellen und ein\n` +
        `Bibliotheks-Einzug müsste jeden Aufrufer anfassen.\n` +
        `Datei-Ablage aus dem Betriebssystem (dataTransfer.files) trifft diese\n` +
        `Signatur nicht. Echte Ausnahme: '// allow-board-dnd: <grund>'.\n\n` +
        `Treffer:\n${fmt(findings)}`,
      );
    }
  });
});

describe('no-parallel-fenster-features (eigene Fenster kommen aus components/fenster)', () => {
  // Zwei Stellen öffnen ein eigenes Browser-Fenster: die Seiten-Hilfe (v2.402,
  // rohes DOM) und das Kanban-Vollbild (v3.47, zweite React-Wurzel). Beide
  // brauchen denselben `window.open`-Features-String — und der trägt eine Zusage,
  // die man beim Abschreiben verliert: KEIN `noopener`, sonst ist das Handle
  // `null` und die ganze Mechanik tot.
  //
  // Signatur ist `popup=yes`, nicht `window.open`: sechs Aufrufe im Bestand
  // (KI-Tab, Streamlit-Bridge, DMS-Dokument, Recherche-Link, Dashboard) öffnen
  // legitim einen normalen Tab und hätten alle eine Ausnahme gebraucht. Wer ein
  // Fenster mit eigener Geometrie aufmacht, meint dagegen genau dieses Bauteil.
  const SIGNATUR = 'popup=yes';
  const HEIMAT = `${sep}src${sep}components${sep}fenster${sep}`;

  it('kein hand-gebauter window.open-Features-String', () => {
    const findings: Finding[] = [];
    for (const file of ALL_SOURCE_FILES) {
      if (file.includes(HEIMAT)) continue;
      if (file.includes(`${sep}__tests__${sep}`)) continue;
      findings.push(...findInFile(file, l => l.includes(SIGNATUR), 'allow-fenster-features'));
    }
    if (findings.length > 0) {
      expect.fail(
        `Fenster-Geometrie und Features-String wohnen in\n` +
        `  @/components/fenster/fensterGeometrie (fensterFeatures + berechne*Geometrie)\n` +
        `Eine zweite Fassung verliert beim ersten Abschreiben die Zusage „kein\n` +
        `noopener" — damit wäre das Fenster-Handle null und weder Inhalt noch\n` +
        `Theme-Nachführung noch Schließen funktionierten.\n` +
        `Echte Ausnahme: '// allow-fenster-features: <grund>'.\n\n` +
        `Treffer:\n${fmt(findings)}`,
      );
    }
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

describe('hilfe-knopf-am-blattrand (Seiten-Hilfe steht rechts aussen)', () => {
  // Der Hilfe-Knopf ist auf jeder Seite dasselbe Bauteil und gehoert an den
  // rechten BLATTRAND — so, wie ihn die Startseite zeigt. Bis v4.14 steckte er
  // auf elf Seiten in der schmalen Inhaltsspalte (max-w-6xl/5xl/4xl/2xl, zum
  // Teil zusaetzlich mittig) und hing dadurch bis zu 200 px vor dem Rand in der
  // Flaeche — auf jeder Seite woanders. Die Regel, die das traegt:
  // die KOPFZEILE spannt die volle Blattbreite, ein schmalerer Rumpf beginnt
  // erst darunter (docs/architecture/ui-muster.md).
  //
  // Geprueft wird die Vorfahren-Kette des Knopfes ueber die EINRUECKUNG — der
  // Bestand ist durchgaengig zweier-eingerueckt, damit ist sie ohne JSX-Parser
  // ablesbar. Mehrzeilige Oeffnungs-Tags werden vorher zu je einer logischen
  // Zeile gefaltet; sonst bliebe das `className` einer ueber drei Zeilen
  // geschriebenen `<div …>` ungelesen.
  //
  // BEWUSSTE LUECKE: steht der Kopf in einer hochgezogenen Konstante
  // (`const kopf = (…)` — so in meilensteine/zu-klaeren), endet die Kette am
  // `const`, und wo diese Konstante eingebettet wird, sieht der Guard nicht.
  // Beide Seiten stehen heute in einem vollbreiten Container.
  interface JsxZeile { text: string; tiefe: number; zeile: number }

  const ohneStrings = (s: string): string => s.replace(/'[^']*'|"[^"]*"|`[^`]*`/g, '""');

  /** Quelltext → logische JSX-Zeilen (mehrzeilige Oeffnungs-Tags gefaltet). */
  function falteTags(zeilen: readonly string[]): JsxZeile[] {
    const out: JsxZeile[] = [];
    for (let i = 0; i < zeilen.length; i++) {
      const roh = zeilen[i] ?? '';
      const text = roh.trim();
      if (text === '') continue;
      const tiefe = roh.length - roh.trimStart().length;
      if (!text.startsWith('<') || ohneStrings(text).includes('>')) {
        out.push({ text, tiefe, zeile: i + 1 });
        continue;
      }
      const teile = [text];
      let j = i + 1;
      for (; j < zeilen.length; j++) {
        const t = (zeilen[j] ?? '').trim();
        teile.push(t);
        if (ohneStrings(t).includes('>')) break;
      }
      out.push({ text: teile.join(' '), tiefe, zeile: i + 1 });
      i = j;
    }
    return out;
  }

  // Woran die Kette endet: ab hier steht kein JSX-Vorfahre mehr, sondern der
  // umgebende Code (Funktionsrumpf, Konstante, Rueckgabe).
  const KETTEN_ENDE = /^(return\b|const\b|let\b|var\b|function\b|export\b|\}|\);)/;

  /** Oeffnende Tags oberhalb von `idx`, von innen nach aussen. */
  function vorfahren(gefaltet: readonly JsxZeile[], idx: number): JsxZeile[] {
    let grenze = gefaltet[idx]?.tiefe ?? 0;
    const kette: JsxZeile[] = [];
    for (let i = idx - 1; i >= 0; i--) {
      const z = gefaltet[i];
      if (z === undefined || z.tiefe >= grenze) continue;
      grenze = z.tiefe;
      if (KETTEN_ENDE.test(z.text)) break;
      if (z.text.startsWith('<') && !z.text.startsWith('</')) kette.push(z);
    }
    return kette;
  }

  /**
   * Klassen-Konstanten der Datei (`const innerClass = narrow ? '…' : '… max-w-5xl'`).
   * Ohne sie versteckt sich die Breite hinter einem Namen — genau so stand sie
   * bis v4.15 in der Dokumente-Liste, und der Guard haette dort nichts gesehen.
   */
  function klassenKonstanten(zeilen: readonly string[]): Map<string, string> {
    const map = new Map<string, string>();
    for (let i = 0; i < zeilen.length; i++) {
      const m = (zeilen[i] ?? '').match(/^\s*const\s+([A-Za-z_$][\w$]*)\s*=/);
      if (m === null) continue;
      const name = m[1] ?? '';
      const teile: string[] = [];
      for (let j = i; j < zeilen.length && j < i + 6; j++) {
        const t = (zeilen[j] ?? '').trim();
        teile.push(t);
        if (t.endsWith(';')) break;
      }
      map.set(name, teile.join(' '));
    }
    return map;
  }

  /** Traegt dieses Tag eine Breitenbegrenzung — literal oder ueber eine Konstante? */
  function istEng(tag: string, konstanten: Map<string, string>): boolean {
    if (tag.includes('max-w-')) return true;
    for (const ausdruck of tag.match(/className=\{[^}]*\}/g) ?? []) {
      for (const bezeichner of ausdruck.match(/[A-Za-z_$][\w$]*/g) ?? []) {
        if (konstanten.get(bezeichner)?.includes('max-w-') === true) return true;
      }
    }
    return false;
  }

  /** Die Fundstellen einer Datei, deren Vorfahren-Kette eine Breite begrenzt. */
  function engeVorfahren(quelle: string): Array<{ zeile: number; wrapper: string }> {
    const zeilen = quelle.split(/\r?\n/);
    const gefaltet = falteTags(zeilen);
    const konstanten = klassenKonstanten(zeilen);
    const out: Array<{ zeile: number; wrapper: string }> = [];
    for (let i = 0; i < gefaltet.length; i++) {
      const z = gefaltet[i];
      if (z === undefined || !z.text.includes('SeitenHilfeButton pluginId=')) continue;
      if (z.text.includes('allow-hilfe-am-blattrand')) continue;
      const eng = vorfahren(gefaltet, i).find(v => istEng(v.text, konstanten));
      if (eng !== undefined) out.push({ zeile: z.zeile, wrapper: eng.text.trim() });
    }
    return out;
  }

  it('engeVorfahren: findet die schmale Fassung, auch mehrzeilig geschrieben', () => {
    const eng = [
      '  return (',
      '    <div',
      '      className="px-8 pt-4 pb-6 max-w-5xl"',
      '    >',
      '      <PageHeader',
      '        title="Einstellungen"',
      '        actions={<SeitenHilfeButton pluginId="einstellungen" />}',
      '      />',
      '    </div>',
      '  );',
    ].join('\n');
    expect(engeVorfahren(eng)).toHaveLength(1);

    // Richtig: Kopf vollbreit, `max-w-` erst am GESCHWISTER darunter.
    const weit = [
      '  return (',
      '    <div className="px-8 pt-4 pb-6">',
      '      <div className="flex items-center gap-3">',
      '        <h1>Einstellungen</h1>',
      '        <div className="ml-auto shrink-0"><SeitenHilfeButton pluginId="einstellungen" /></div>',
      '      </div>',
      '      <div className="max-w-5xl">Rumpf</div>',
      '    </div>',
      '  );',
    ].join('\n');
    expect(engeVorfahren(weit)).toEqual([]);
  });

  it('engeVorfahren: sieht die Breite auch hinter einer Klassen-Konstante', () => {
    const quelle = [
      "  const innerClass = narrow ? 'px-6 pt-4 pb-6' : 'px-8 pt-4 pb-6 max-w-5xl';",
      '  return (',
      '    <div className={innerClass}>',
      '      <div className="flex"><SeitenHilfeButton pluginId="dokumente" /></div>',
      '    </div>',
      '  );',
    ].join('\n');
    expect(engeVorfahren(quelle)).toHaveLength(1);
  });

  it('kein Hilfe-Knopf in einer breitenbegrenzten Spalte', () => {
    const findings: Finding[] = [];
    for (const file of ALL_TS_FILES) {
      if (!file.endsWith('.tsx')) continue;
      if (file.includes(`${sep}__tests__${sep}`)) continue;
      const quelle = readFileSync(file, 'utf-8');
      if (!quelle.includes('SeitenHilfeButton pluginId=')) continue;
      for (const t of engeVorfahren(quelle)) {
        findings.push({ file: relPath(file), line: t.zeile, text: t.wrapper });
      }
    }
    if (findings.length > 0) {
      expect.fail(
        `Der Hilfe-Knopf steckt in einer breitenbegrenzten Spalte und landet damit\n` +
        `mitten in der Flaeche statt am rechten Blattrand.\n` +
        `Regel (docs/architecture/ui-muster.md): die KOPFZEILE spannt die volle\n` +
        `Blattbreite (nur das Seiten-Padding), der schmalere RUMPF beginnt darunter:\n` +
        `  <div className="px-8 pt-4 pb-6">\n` +
        `    <div className="flex items-center gap-3">… <SeitenHilfeButton …/></div>\n` +
        `    <div className="max-w-5xl">…Rumpf…</div>\n` +
        `  </div>\n` +
        `Echte Ausnahme: '// allow-hilfe-am-blattrand: <grund>' auf der Knopf-Zeile.\n\n` +
        `Treffer (Zeile des Knopfes, darunter der zu enge Vorfahre):\n${fmt(findings)}`,
      );
    }
  });
});

describe('settings-treffer-weg (Hub-Suche nennt ihr Ziel)', () => {
  // Jeder Treffer einer Hub-Suche zeigt „Seite › Gruppe", damit vor dem Sprung
  // klar ist, WO er landet — eine Seite traegt bis zu acht Karten. Das haelt
  // nur, solange der `gruppe`-Wert der Registry wortgleich zum `titel`-Prop der
  // gerenderten SettingsGruppe ist; sonst zeigt die Suche nach der ersten
  // Umbenennung still auf eine Karte, die es nicht mehr gibt.
  //
  // Geprueft wird je Hub gegen ALLE seine Gruppentitel, nicht je Seite: die
  // Seiten-Zuordnung steht im selben Objektliteral wie der Anker und ist per
  // Textscan nicht verlaesslich zu trennen. Der reale Driftfall (Titel
  // umbenannt, Registry vergessen) wird so trotzdem gefangen.
  //
  // Seit v4.34 gibt es zwei Wirte derselben Seitenform — beide stehen hier,
  // sonst waere der zweite ungehalten.
  const HUBS = [
    { name: 'Einstellungen', ordner: join(ROOT, 'plugins', 'einstellungen'), registry: 'settingsPanels.tsx' },
    { name: 'Kuration', ordner: join(ROOT, 'plugins', 'kuration'), registry: 'kurationPanels.tsx' },
  ];

  /**
   * Alle `titel="…"`/`titel={'…'}`-Literale eines Hub-Ordners. Zeilen mit
   * `InfoHint` bleiben aussen vor — dessen `titel` ist die Ueberschrift des
   * Popovers, keine Karte.
   */
  function gruppenTitel(ordner: string): Set<string> {
    const titel = new Set<string>();
    for (const file of ALL_TS_FILES) {
      if (!file.startsWith(ordner) || !file.endsWith('.tsx')) continue;
      for (const zeile of readFileSync(file, 'utf-8').split('\n')) {
        if (zeile.includes('InfoHint')) continue;
        const m = /titel=(?:"([^"]+)"|\{'([^']+)'\})/.exec(zeile);
        if (m) titel.add(m[1] ?? m[2] ?? '');
      }
    }
    return titel;
  }

  /** Ein Eintrag der Anker-Registry: `{ id: 'sec-…', label: …, gruppe: … }`. */
  function eintraege(registry: string): { id: string; gruppe: string | null }[] {
    const quelle = readFileSync(registry, 'utf-8');
    return [...quelle.matchAll(/\{\s*id:\s*'(sec-[^']+)'([^}]*)\}/g)].map(m => ({
      id: m[1]!,
      gruppe: /gruppe:\s*'([^']+)'/.exec(m[2]!)?.[1] ?? null,
    }));
  }

  for (const hub of HUBS) {
    const REGISTRY = join(hub.ordner, hub.registry);

    it(`${hub.name}: jeder Registry-Eintrag nennt seine Gruppe`, () => {
      const ohne = eintraege(REGISTRY).filter(e => !e.gruppe).map(e => e.id);
      expect(ohne, `Ohne \`gruppe\`: ${ohne.join(', ')} — die Trefferzeile zeigte dann nur die Seite.`).toEqual([]);
    });

    it(`${hub.name}: jede genannte Gruppe existiert als Karte`, () => {
      const titel = gruppenTitel(hub.ordner);
      const unbekannt = [...new Set(eintraege(REGISTRY).map(e => e.gruppe).filter((g): g is string => g != null))]
        .filter(g => !titel.has(g));
      if (unbekannt.length > 0) {
        expect.fail(
          `Die Suche in „${hub.name}" verweist auf Karten, die es nicht (mehr) gibt:\n` +
          `  ${unbekannt.join('\n  ')}\n\n` +
          `Der \`gruppe\`-Wert in ${hub.registry} muss WORTGLEICH dem \`titel\`-Prop\n` +
          `der SettingsGruppe sein, in deren Karte der Anker sitzt. Wurde eine Karte\n` +
          `umbenannt, zieht die Registry mit (docs/agents/add-settings-section.md).\n\n` +
          `Vorhandene Kartentitel:\n  ${[...titel].sort().join('\n  ')}`,
        );
      }
    });

    it(`${hub.name}: Registry-Anker existiert im DOM-Baum`, () => {
      // Gegenrichtung derselben Regel: kein Eintrag ohne Anker, sonst springt die
      // Suche ins Leere (v4.31 hatte das fuer zwei Abschnitte).
      const anker = new Set<string>();
      for (const file of ALL_TS_FILES) {
        if (!file.startsWith(hub.ordner) || !file.endsWith('.tsx') || file === REGISTRY) continue;
        const quelle = readFileSync(file, 'utf-8');
        for (const m of quelle.matchAll(/id=(?:"(sec-[^"]+)"|\{[^}]*'(sec-[^']+)'[^}]*\})/g)) {
          anker.add(m[1] ?? m[2] ?? '');
        }
      }
      const fehlend = eintraege(REGISTRY).map(e => e.id).filter(id => !anker.has(id));
      expect(fehlend, `Ohne Anker im DOM: ${fehlend.join(', ')}`).toEqual([]);
    });
  }
});

describe('kuration-hub-eine-schicht (der Hub baut die Seitenform nicht nach)', () => {
  // Dieselbe Reissleine wie bei Baum und Board: die Einstellungs-Seitenform
  // liegt in `@/components/settings` und hat seit v4.34 zwei Wirte. Baute der
  // zweite Spaltenraster, Trefferring oder Navigationsspalte selbst nach, waere
  // die Schicht nach einem Patch wieder zwei Schichten — und der Haertefall
  // „Sprung ohne Scroll-Weg" (v4.32) koennte in einer davon zurueckkehren.
  const VERBOTEN: { muster: RegExp; was: string }[] = [
    { muster: /tf-set-(cols|grid|neben)/, was: 'Zweispalten-Raster (→ SettingsZweiSpalten)' },
    { muster: /data-tf-treffer/, was: 'Trefferring (→ useSprungTreffer / die Layout-Bauteile)' },
    { muster: /grid-cols-\[224px/, was: 'Navigationsspalte (→ SettingsHubPage)' },
  ];

  it('keine Datei unter plugins/kuration baut Raster, Ring oder Nav nach', () => {
    const KURATION = join(ROOT, 'plugins', 'kuration');
    const findings: string[] = [];
    for (const file of ALL_TS_FILES) {
      if (!file.startsWith(KURATION)) continue;
      const zeilen = readFileSync(file, 'utf-8').split('\n');
      zeilen.forEach((zeile, i) => {
        if (zeile.includes('allow-eigene-schicht')) return;
        for (const { muster, was } of VERBOTEN) {
          if (muster.test(zeile)) findings.push(`  ${relPath(file)}:${i + 1} — ${was}`);
        }
      });
    }
    if (findings.length > 0) {
      expect.fail(
        `Der Kuration-Hub baut die geteilte Seitenform nach:\n${findings.join('\n')}\n\n` +
        `Bauteile kommen aus @/components/settings (docs/agents/add-settings-section.md).\n` +
        `Wenn wirklich noetig: '// allow-eigene-schicht: <grund>' inline.`,
      );
    }
  });
});

describe('rollen-farbe-eine-quelle (Chronik/Zeitstrahl, v4.48)', () => {
  // Die Rollen des Fachsystems (PA/AB/FB/QS/Jur) sind eine der wenigen Stellen,
  // an denen Farbe Information traegt. Damit sie ueberall DIESELBE Information
  // traegt, gibt es genau eine Zuordnung Rolle → Tokenname
  // (src/core/status/rollen-farbe.ts) und genau einen Ort fuer die Werte
  // (src/theme.css, Hell + Dunkel). Ein zweiter Ort waere ein zweites
  // Farbsystem, und die Filterleiste waere nicht mehr die Legende.
  const ROLLEN = ['pa', 'ab', 'fb', 'qs', 'jur'] as const;
  const QUELLE = 'core/status/rollen-farbe.ts';

  it('nennt --tf-rolle-* nur in der Zuordnung und in theme.css', () => {
    const findings: Finding[] = [];
    for (const file of ALL_SOURCE_FILES) {
      const rel = relPath(file);
      if (rel.endsWith(QUELLE) || rel.endsWith('src/theme.css')) continue;
      if (rel.includes('/__tests__/')) continue;
      findings.push(...findInFile(file, l => l.includes('--tf-rolle-'), 'allow-rollen-farbe'));
    }
    if (findings.length > 0) {
      expect.fail(
        `Rollen-Farbtokens gehoeren in ${QUELLE} (Namen) und theme.css (Werte):\n`
        + `${fmt(findings)}\n\n`
        + `Komponenten lesen rollenFarbe(rolle) aus @/core/status.\n`
        + `Echte Ausnahme: '// allow-rollen-farbe: <grund>'.`,
      );
    }
  });

  it('schreibt in den Verlaufs-Ansichten keine Farbe von Hand', () => {
    // Ein literales hsl()/rgb() in Chronik, Matrix oder Zeitstrahl waere eine
    // zweite Rollenzuordnung — und der Dunkelmodus waere verloren, bevor ihn
    // jemand testet. Die drei Ansichten lesen ausschliesslich Tokens.
    const ORDNER = ['src/plugins/antraege/status/', 'src/plugins/antraege/verlauf-band/'];
    const findings: Finding[] = [];
    for (const file of ALL_SOURCE_FILES) {
      const rel = relPath(file).split(sep).join('/');
      if (!ORDNER.some(o => rel.includes(o))) continue;
      findings.push(...findInFile(
        file, l => /\b(hsl|rgb)a?\(/.test(l) && !l.trimStart().startsWith('*'), 'allow-rollen-farbe',
      ));
    }
    if (findings.length > 0) {
      expect.fail(
        `Farbe von Hand in einer Verlaufs-Ansicht — Tokens statt Literale:\n${fmt(findings)}\n\n`
        + `Rollenfarben ueber rollenFarbe(rolle), alles andere ueber var(--tf-*).\n`
        + `Echte Ausnahme: '// allow-rollen-farbe: <grund>'.`,
      );
    }
  });

  it('haelt jede Rollenfarbe auf ihrer eigenen Flaeche ueber 4,5:1 — in beiden Modi', () => {
    const problem: string[] = [];
    for (const satz of themeFarbTokens()) {
      for (const r of ROLLEN) {
        const text = satz.werte.get(`--tf-rolle-${r}`);
        const flaeche = satz.werte.get(`--tf-rolle-${r}-bg`);
        if (text === undefined || flaeche === undefined) {
          problem.push(`  ${satz.modus}: --tf-rolle-${r}(-bg) fehlt in theme.css`);
          continue;
        }
        const a = parseCssFarbe(text);
        const b = parseCssFarbe(flaeche);
        if (a === null || b === null) {
          problem.push(`  ${satz.modus}: --tf-rolle-${r} nicht lesbar (${text} / ${flaeche})`);
          continue;
        }
        const k = kontrast(a, b);
        if (k < 4.5) problem.push(`  ${satz.modus}: ${r} = ${k.toFixed(2)}:1 (< 4,5)`);
      }
    }
    if (problem.length > 0) {
      expect.fail(
        `Rollen-Marken sind zu kontrastarm — sie tragen zweistellige Schriftgroessen\n`
        + `und muessen als Text lesbar sein, nicht nur als Flaeche:\n${problem.join('\n')}`,
      );
    }
  });
});

describe('spalten-hilfe-abdeckung (jeder Spaltenkopf erklaert seine Herkunft, v4.54)', () => {
  it('jede Spalte der Foerdertabelle traegt einen Satz', () => {
    const ohne = ANTRAG_TABLE_COLUMNS
      .filter(c => !SPALTEN_MIT_SATZ.includes(c.key))
      .map(c => `  ${c.key} („${c.label}")`);
    if (ohne.length > 0) {
      expect.fail(
        `Spalten ohne Herkunftsangabe:\n${ohne.join('\n')}\n\n`
        + `Einen Satz in SAETZE (src/plugins/antraege/spaltenHilfe.ts) ergaenzen —\n`
        + `er steht im Kopf-Tooltip und am ⓘ des Spalten-Pickers. Wo die Spalte sich\n`
        + `aus CSV-Feldern speist, kommt die Feldliste automatisch aus dem Schema.`,
      );
    }
  });

  it('kein Satz zeigt auf eine Spalte, die es nicht mehr gibt', () => {
    const keys = new Set(ANTRAG_TABLE_COLUMNS.map(c => c.key));
    const verwaist = SPALTEN_MIT_SATZ.filter(k => !keys.has(k));
    if (verwaist.length > 0) {
      expect.fail(
        `Herkunftstexte ohne Spalte: ${verwaist.join(', ')}\n\n`
        + `Die Spalte wurde entfernt oder umbenannt — den Eintrag in SAETZE\n`
        + `(src/plugins/antraege/spaltenHilfe.ts) mitziehen, statt ihn liegenzulassen.`,
      );
    }
  });

  it('baut die Karte auch ohne geladenes Schema — mit Satz, ohne erfundene Felder', () => {
    // Der Zustand vor dem ersten Import: eine Erklaerung ohne Belege ist
    // richtig, eine erfundene Feldliste waere schlimmer als keine.
    const karte = baueSpaltenHilfe({ schemas: [] });
    for (const c of ANTRAG_TABLE_COLUMNS) {
      const h = karte.get(c.key);
      expect(h?.satz, `${c.key} ohne Satz`).toBeTruthy();
    }
    // Einzige Ausnahme: die Frist rechnet mit fest benannten Codes, die kein
    // Schema liefert — sie darf ihre Felder auch ohne Import nennen.
    const mitFeldernOhneSchema = ANTRAG_TABLE_COLUMNS
      .filter(c => (karte.get(c.key)?.felder?.length ?? 0) > 0)
      .map(c => c.key);
    expect(mitFeldernOhneSchema).toEqual(['frist']);
  });
});

describe('rueckweg-satz-abdeckung (der Rueckweg nennt die Seite im Dativ, v4.85.7)', () => {
  // Die Anzeigenamen kommen aus den Plugin-Manifesten — TEXTUELL gelesen, nicht
  // importiert: `plugins.config.ts` zieht die React-Komponenten aller Plugins
  // nach, und dieser Guard braucht nur die Namen.
  const PLUGIN_DIR = join(ROOT, 'plugins'); // ROOT ist src/

  function seitenNamen(): string[] {
    const namen: string[] = [];
    for (const ordner of readdirSync(PLUGIN_DIR)) {
      for (const datei of ['index.ts', 'index.tsx']) {
        const pfad = join(PLUGIN_DIR, ordner, datei);
        let quelle: string;
        try { quelle = readFileSync(pfad, 'utf-8'); } catch { continue; }
        // Manifest-Ebene (zwei Leerzeichen Einrueckung), Literal oder Konstante.
        const treffer = /^ {2}name: (?:'([^']+)'|([A-Z][A-Z0-9_]*))/m.exec(quelle);
        if (!treffer) continue;
        if (treffer[1]) { namen.push(treffer[1]); continue; }
        // Konstante im Plugin-Ordner aufloesen (z. B. KURATION_SEITENNAME).
        const konstante = treffer[2];
        for (const geschwister of readdirSync(join(PLUGIN_DIR, ordner))) {
          if (!/\.tsx?$/.test(geschwister)) continue;
          const q = readFileSync(join(PLUGIN_DIR, ordner, geschwister), 'utf-8');
          const wert = new RegExp(`export const ${konstante} = '([^']+)'`).exec(q);
          if (wert?.[1]) { namen.push(wert[1]); break; }
        }
      }
    }
    return namen;
  }

  it('findet die Manifest-Namen ueberhaupt (sonst prueft der Guard nichts)', () => {
    const namen = seitenNamen();
    expect(namen.length, `Nur ${namen.length} Plugin-Namen gefunden`).toBeGreaterThan(15);
    expect(namen).toContain('Vorgangs-Board');
    expect(namen).toContain('Datenpflege'); // ueber die Konstante aufgeloest
  });

  it('jede Seite traegt ihre Fuegung', () => {
    const ohne = seitenNamen().filter(n => !(n in SEITEN_FUEGUNG));
    if (ohne.length > 0) {
      expect.fail(
        `Seiten ohne Rueckweg-Fuegung: ${ohne.map(n => `„${n}"`).join(', ')}\n\n`
        + `Einen Eintrag in SEITEN_FUEGUNG (src/core/nav/rueckwegSatz.ts) ergaenzen —\n`
        + `die fertige Dativ-Fuegung, z. B. 'zum Vorgangs-Board'. Ohne Eintrag steht\n`
        + `im Detail-Kopf „Zurueck zu <Name>", was fuer die halbe Navigation falsch ist.`,
      );
    }
  });

  it('keine Fuegung zeigt auf eine Seite, die es nicht mehr gibt', () => {
    const namen = new Set(seitenNamen());
    const verwaist = Object.keys(SEITEN_FUEGUNG).filter(n => !namen.has(n));
    if (verwaist.length > 0) {
      expect.fail(
        `Fuegungen ohne Seite: ${verwaist.map(n => `„${n}"`).join(', ')}\n\n`
        + `Die Seite wurde umbenannt oder entfernt — den Eintrag in SEITEN_FUEGUNG\n`
        + `(src/core/nav/rueckwegSatz.ts) mitziehen. Ein verwaister Eintrag greift nie,\n`
        + `und der neue Name faellt still auf „zu <Name>" zurueck.`,
      );
    }
  });

  it('unbekannte Namen fallen auf die zurueckhaltende Form zurueck', () => {
    expect(rueckwegSatz('Suche')).toBe('Zurück zur Suche');
    expect(rueckwegSatz('Vorgangs-Board')).toBe('Zurück zum Vorgangs-Board');
    expect(rueckwegSatz('Irgendwas Neues')).toBe('Zurück zu Irgendwas Neues');
  });
});




describe('suche-eine-gezeigte-menge (Kopfzahl, Liste, Tabelle und Export zeigen dasselbe, v4.102.1)', () => {
  // Die Suche fuehrt ZWEI Mengen: `sichtbar` speist den Antwort-Lauf der KI,
  // `angezeigt` ist dieselbe Menge nach dem Chip „nur die genannten" (die
  // Trennung ist Absicht, siehe useAntwortBruecke.ts). Genau deshalb kann eine
  // Anzeigestelle die falsche erwischen: in v4.101 bekam die TABELLE weiter die
  // ungefilterte, waehrend Kopfzahl und Chip „6 Treffer" behaupteten.
  //
  // Der Guard prueft nicht, WELCHE Menge — nur, dass alle Anzeigestellen
  // DIESELBE nennen. Eine Stelle, die bewusst abweicht, traegt
  // `// allow-suche-eine-gezeigte-menge: <grund>`.
  const DATEI = 'plugins/suche/SuchSeite.tsx';
  const quelle = readFileSync(join(ROOT, DATEI), 'utf-8');

  const STELLEN: readonly (readonly [string, RegExp])[] = [
    ['Kopfzahl', /<ErgebnisZahl[\s\S]{0,300}?anzahl=\{(\w+)\.length\}/],
    ['Liste', /<TrefferListe[\s\S]{0,300}?treffer=\{(\w+)\}/],
    ['Tabelle', /<SearchResultsTable[\s\S]{0,400}?results=\{(\w+)\}/],
    ['CSV-Export', /exportCSV\((\w+),/],
    ['XLSX-Export', /exportXLSX\((\w+),/],
    ['Zwischenablage', /exportClipboard\((\w+),/],
    ['KI-Kontext', /contextResults=\{(\w+)\}/],
  ];

  const gefunden = (): { stelle: string; menge: string }[] => STELLEN
    .map(([stelle, muster]) => ({ stelle, menge: muster.exec(quelle)?.[1] }))
    .filter((t): t is { stelle: string; menge: string } => t.menge !== undefined);

  it('findet jede Anzeigestelle (sonst prueft der Guard nichts)', () => {
    const fehlend = STELLEN.map(([s]) => s).filter(s => !gefunden().some(g => g.stelle === s));
    expect(fehlend, `Anzeigestellen in ${DATEI} nicht mehr auffindbar: ${fehlend.join(', ')}`
      + ` — das Muster im Guard nachziehen, sonst prueft er stillschweigend weniger.`).toEqual([]);
  });

  it('alle Anzeigestellen nennen dieselbe Menge', () => {
    const treffer = gefunden().filter(g => !new RegExp(
      `${g.menge}\b.*// allow-suche-eine-gezeigte-menge`,
    ).test(quelle));
    const mengen = [...new Set(treffer.map(g => g.menge))];
    if (mengen.length > 1) {
      expect.fail(
        `Die Suche zeigt an verschiedenen Stellen verschiedene Mengen:\n`
        + treffer.map(g => `  ${g.stelle}: ${g.menge}`).join('\n')
        + `\n\nKopfzahl, Liste, Tabelle, Export und KI-Kontext muessen dieselbe Menge`
        + `\nnennen — sonst behauptet die Zahl ueber der Tabelle etwas, das die Tabelle`
        + `\nnicht einloest (v4.102.1: Chip „nur die genannten 6", Kopf „6 Treffer",`
        + `\nTabelle alle 671).`,
      );
    }
  });
});
