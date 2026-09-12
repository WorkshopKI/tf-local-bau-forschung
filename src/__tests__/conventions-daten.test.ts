/**
 * Codebase-Conventions — Persistenz, Share, Transport, Prompts, Feedback.
 *
 * Statt einer separaten ESLint-Konfiguration (Projekt nutzt nur tsc + vitest)
 * laufen die Pattern-Checks als Vitest-Tests. Schlaegt ein Check fehl, listet
 * die Fehlermeldung die Treffer mit Datei:Zeile + die zu nutzende Alternative.
 *
 * Inline-Whitelist: Zeilen mit Marker-Kommentar `// allow-<rule>: <reason>`
 * werden ignoriert. Bitte den Grund knapp dokumentieren — das macht die
 * Ausnahme review-bar.
 *
 * Geschwister-Dateien: conventions-status.test.ts, conventions-ui.test.ts, conventions-bestand.test.ts
 * (Bestands-Generation: ein Schreiber, alle Leser folgen), health-baseline.test.ts. Der Schnitt ist thematisch;
 * Datei-Walk + Such-Primitive liegen gemeinsam in conventions-lib.ts.
 *
 * Geprueft:
 *   - no-raw-worker                     → Pitfall #5, Worker als
 *     `?worker&inline`-Import einbinden (file://-Kompat).
 *   - orama-create-mit-indexsprache     → jede Datei, die eine Orama-DB anlegt,
 *     nennt INDEX_SPRACHE; ohne sie trennt Orama englisch und zerreisst jedes
 *     Umlautwort (docs/architecture/suche-relevanz.md).
 *   - no-plugins-config-in-components   → Konsolidierungs-Pass, src/components/
 *     (geteilte Blatt-Schicht) importiert nicht @/plugins.config; Plugin-Wissen
 *     kommt als Prop oder via useNavigation().activeName herein.
 *   - no-direct-feedback-status-compare → Pitfall #21 (Feedback-Status),
 *     FEEDBACK_STATUS / Praedikate aus src/core/services/feedback/feedback-status.ts.
 *   - no-direct-bearbeiter-kuerzel      → Pitfall #27, useMeinKuerzel() statt
 *     direktem profile.bearbeiter_kuerzel-Lesezugriff.
 *   - anzeigetokens-nur-anzeigen        → v4.48, `anzeigeTokens` (Schreibweise
 *     der Kuerzel) steht in keinem Vergleich; gematcht wird mit `tokens`.
 *   - no-direct-feedback-user-id-compare → v3.7, Feedback-Zugehoerigkeit ueber
 *     istMeinTicket/istMeineId (Kuerzel UND Profilname), nie `user_id === meId`.
 *   - no-hardcoded-datenshare-mode      → Pitfall #25, Daten-Share-Modus
 *     ('read'/'readwrite') ausschliesslich via canWriteDatenShare() entscheiden,
 *     nicht `isKurator ? 'readwrite' : 'read'` hart kodieren.
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
 *   - keine-elidierte-wortlaut-vorgabe   → Prompt-Hygiene: eine Anweisung, die einen
 *     Wortlaut EXAKT/woertlich verlangt, darf ihn nicht zitiert-und-abgeschnitten
 *     ("… “") zeigen — das Modell kann die String-Grenze nicht bestimmen und
 *     dreht in eine Reasoning-Schleife (v2.284.1; Vorlaeufer: Beleg-Kontrakt-Rueckbau).
 *   - screen-context-coverage           → Feedback-KI-Kontext (docs/feedback-kontext/):
 *     jede nicht-dev Plugin-ID (Text-Scan von src/plugins/index.ts(x) je Ordner, da ein
 *     Import von plugins.config.ts unter Vitest an pdfjs-dist-Workern bricht) hat
 *     ein eigenes Kontext-Doc oder ist Mitglied von KURATION_PLUGIN_IDS (teilt
 *     kuration.md). KEIN Zeichen-Budget mehr, nur eine Reissleine (10000) gegen
 *     ausufernde Docs — die Disziplin ist inhaltlich (WAS statt WIE), nicht numerisch.
 *   - eval-gui-fictional-only            → Skill-Eval-GUI (dev): SkillEvalPanel +
 *     runEvalBatch importieren KEINE Real-Antrag-Pfade (listAllAntraegeListView,
 *     findVorhabensbeschreibung, doc:-Scan) — Fixtures nur via loadEvalFixtures();
 *     Scoring nur ueber das geteilte runJudge/aggregate (kein dup. Judge-Call).
 *   - aufbereitung-eval-fictional-only   → Aufbereitung-Eval (dev): eval-panel/
 *     importiert KEINE Real-Antrag-Pfade (gleicher Verbots-Katalog) — seit dem
 *     OpenRouter-Generierungs-Modus duerfen NUR gebrandete fiktive Fixtures
 *     (loadEvalFixtures + isFromEvalBundle) in einen externen Call gelangen.
 *   - personal-roots-single-reader      → v4.1: die persoenlichen Ordner liegen unter
 *     MEHREREN Wurzeln (personalFolder.roots). Der Einzel-Slot-Name gehoert in die
 *     Slot-Schicht (infrastructure/types.ts + smb-handle.ts + local-fs/);
 *     Anwendungscode liest ueber getUserFoldersRoots(idb) — ein zurueckkehrender
 *     Einzel-Leser saehe still nur die erste Gruppe, und Teil-Einsammeln saehe
 *     wieder aus wie Erfolg.
 *   - eigene-spalten-lokal              → Die PERSOENLICHEN Spalten-Definitionen
 *     der Foerdertabelle sind geraetelokal (kv `eigene-spalten:personal`): nie
 *     Share, nie Snapshot, nie Personal-Mirror. Funktionsbedingung, nicht
 *     Bequemlichkeit — in prod fehlen dem Nutzer die Schreibrechte.
 *   - home-widgets-local-only           → Home-Widget-Config + Notizen sind
 *     persoenliche Darstellungs-Daten: IDB primaer, Mirror NUR ueber
 *     savePersonalSettings; keine Share-/Snapshot-Writer unter
 *     src/plugins/home/widgets/, kein Widget-Key in SNAPSHOT_FILES.
 *   - kein-oeffnender-ping              → ein Verfuegbarkeits-Check darf keinen KI-Tab
 *     aufreissen: `transport.ping()` traegt `openIfNeeded: true` als Vorgabe und ruft
 *     `ensureConnection()` → window.open. Entweder ausdruecklich passiv pingen
 *     (`{ openIfNeeded: false }`) oder in derselben Datei den Guard
 *     `kiVerbindungBereit`/`kiVerbindungGeprueft` fuehren (src/core/services/ai/ki-guard.ts).
 *   - no-index-punkt-id                 → Klaerung (v2.412): eine Punkt-Id im Seed von
 *     src/plugins/zu-klaeren/ darf NIE aus einem Schleifenindex entstehen. Die Antworten
 *     liegen append-only auf dem Share und zeigen auf die Id; ein eingefuegter Punkt
 *     verschoebe sonst lautlos alle Antworten dahinter, und korrigieren laesst sich das
 *     nicht. Aus DATEN abgeleitete Ids (`code-${code}`) sind ausdruecklich erlaubt.
 *   - csv-quellordner-nicht-kopieordner → keine Variante darf ihren CSV-Quellordner
 *     (`local.csvSourceDir`) auf `<datenShare>/programm/antraege/imports` legen. Dort
 *     liegt die App-EIGENE, nach UTF-8 normalisierte Kopie (`saveCsvSourceFile`): die
 *     App importiert dann ihr eigenes Erzeugnis, die Schema-Baseline beschreibt eine
 *     andere Datei als die einer zweiten Instanz mit dem echten Export — beide melden
 *     bei JEDEM Start „neuer Export" und kippen abwechselnd das `encoding`
 *     (gemessen 18.08.2026: 195x csv_schema_encoding_korrigiert, 0 inhaltliche Deltas).
 *   - reserve-deckt-output-budget       → v4.115.1, RESERVE_TOKENS (llm-context.ts)
 *     deckt das Output-Budget eines Laufs (DEFAULT_MAX_TOKENS +
 *     THINKING_OUTPUT_HEADROOM) und jedes Seed-`maxTokens`; sonst reicht der
 *     abgeleitete VB-Cap weiter, als das Kontextfenster traegt.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';
import { KURATION_PLUGIN_IDS } from '../core/services/feedback/screenContext';
import { CSV_SOURCES_SUBDIR } from '../core/services/csv/constants';
import { RESERVE_TOKENS } from '../core/services/ai/llm-context';
import { DEFAULT_MAX_TOKENS, THINKING_OUTPUT_HEADROOM } from '../core/services/skills';
import {
  ROOT, ALL_TS_FILES, ALL_SOURCE_FILES, relPath, findInFile, fmt, findFilesViolating, type Finding,
} from './conventions-lib';

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

describe('orama-create-mit-indexsprache', () => {
  // Ein Orama-Index ohne gesetzte Sprache trennt Woerter englisch — `ä ö ü ß`
  // sind dort Trennzeichen, „Foerdergeber" zerfaellt in `f` + `rdergeber`.
  // Wer eine zweite `create(...)`-Stelle aufmacht und die Sprache vergisst, baut
  // stillschweigend einen Index mit anderer Worttrennung als der Rest der App.
  const nutztOrama = /from\s+'@orama\/orama'/;
  const legtAn = /\bcreate\s*\(/;

  it('jede Datei, die eine Orama-DB anlegt, nennt INDEX_SPRACHE', () => {
    const treffer: string[] = [];
    for (const file of ALL_TS_FILES) {
      if (file.includes(`${sep}__tests__${sep}`) || file.endsWith('.test.ts')) continue;
      const inhalt = readFileSync(file, 'utf8');
      if (!nutztOrama.test(inhalt) || !legtAn.test(inhalt)) continue;
      if (!inhalt.includes('INDEX_SPRACHE')) treffer.push(relPath(file));
    }

    if (treffer.length > 0) {
      expect.fail(
        `Orama-DB ohne Worttrennung angelegt.\n` +
        `create({ schema, language: INDEX_SPRACHE }) — die Konstante liegt in\n` +
        `src/core/services/search/orama-store.ts und begruendet sich dort.\n` +
        `Ohne sie trennt Orama englisch und zerreisst jedes Umlautwort.\n\n` +
        `Dateien:\n${treffer.map(t => `  ${t}`).join('\n')}`,
      );
    }
  });
});

describe('no-raw-lock-heartbeat-interval (CLAUDE.md Pitfall #52)', () => {
  // Ein selbst gebauter `setInterval`-Takt um `heartbeat()` laesst sich nicht
  // sauber stoppen: `clearInterval` verhindert nur KUENFTIGE Schlaege, ein
  // bereits gestarteter laeuft weiter (sein erstes `await` ist ein IDB-Read) und
  // legt die inzwischen freigegebene Lock-Datei neu an — mit dem eigenen Namen
  // und frischem Zeitstempel. Der naechste Schritt desselben Laufs lief dann
  // gegen den eigenen Nachhall (belegt im Audit-Log, v3.46.1). Das Muster lag
  // dreimal kopiert im Code. Kanonischer Pfad:
  //   const hb = startHeartbeat(idb);
  //   try { … } finally { await hb.stop(); await releaseLock(idb); }
  const takt = /\bsetInterval\s*\(/;
  const schlag = /\bheartbeat\s*\(/; // case-sensitiv: `startHeartbeat(` faellt raus
  const mechanismus = `${sep}infrastructure${sep}build-lock.ts`;

  it('kein `heartbeat()` in einer Datei, die den Takt selbst per setInterval baut', () => {
    const findings: Finding[] = [];
    for (const file of ALL_TS_FILES) {
      if (file.includes(`${sep}__tests__${sep}`) || file.endsWith('.test.ts') || file.endsWith('.test.tsx')) continue;
      // build-lock.ts IST der Mechanismus — dort lebt `startHeartbeat`.
      if (file.endsWith(mechanismus)) continue;
      if (findInFile(file, l => takt.test(l), 'allow-raw-lock-heartbeat').length === 0) continue;
      findings.push(...findInFile(file, l => schlag.test(l), 'allow-raw-lock-heartbeat'));
    }

    if (findings.length > 0) {
      const msg =
        `Eigener Heartbeat-Takt verboten (CLAUDE.md Pitfall #52).\n` +
        `Ein bereits gestarteter Schlag ueberlebt clearInterval und schreibt die\n` +
        `freigegebene Lock-Datei neu. Stattdessen den Runner nutzen:\n` +
        `  const hb = startHeartbeat(idb);\n` +
        `  try { … } finally { await hb.stop(); await releaseLock(idb); }\n` +
        `Ausnahme inline: // allow-raw-lock-heartbeat: <grund>\n\nTreffer:\n${fmt(findings)}`;
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
    // Das editierbare Profilfeld selbst (Schreib-Quelle) — seit v4.29 in der
    // Gruppe „Welche Anträge du siehst" statt im alten ProfilTab.
    `${sep}profil${sep}AntraegeSichtGruppe.tsx`,
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

describe('anzeigetokens-nur-anzeigen (v4.48)', () => {
  // `BearbeiterFilterMode` fuehrt die Kuerzel in ZWEI Fassungen: `tokens`
  // (uppercase, die Vergleichsform) und `anzeigeTokens` (die Schreibweise der
  // Daten, „THue" statt „THUE"). Gematcht wird ausschliesslich mit `tokens`.
  // Wer gegen die Anzeige-Fassung vergleicht, baut eine Gabel, an der dasselbe
  // Kuerzel je nach Aufrufer mal trifft und mal nicht — und der Fehler faellt
  // erst bei einem der 81 gemischt geschriebenen Kuerzel auf, nie bei den 31
  // rein grossgeschriebenen.
  const VERGLEICH = /===|!==|[^=!<>]==[^=]|\.includes\(|\.indexOf\(|\.has\(|\.some\(|\.startsWith\(/;
  const isComment = (l: string): boolean => {
    const t = l.trim();
    return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
  };

  it('anzeigeTokens steht in keinem Vergleich', () => {
    const findings: Finding[] = [];
    for (const file of ALL_TS_FILES) {
      if (file.includes(`${sep}__tests__${sep}`) || file.endsWith('.test.ts')) continue;
      findings.push(...findInFile(
        file,
        l => !isComment(l) && l.includes('anzeigeTokens') && VERGLEICH.test(l),
        'allow-anzeigetokens-vergleich',
      ));
    }

    if (findings.length > 0) {
      const msg =
        `anzeigeTokens ist NUR zum Anzeigen (bearbeiterFilter.ts).\n` +
        `Verglichen wird mit mode.tokens — sonst trifft ein gemischt\n` +
        `geschriebenes Kuerzel je nach Aufrufer mal und mal nicht.\n\n` +
        `Treffer:\n${fmt(findings)}`;
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
    'src/core/services/infrastructure/smb-handle/',    // Haupt-Einhaengepunkt (v6.42: Ordner statt Datei)
    'src/core/services/gutachten-vorlagen/vorlagen-quelle.ts',
    'src/plugins/csv-sources-kuration/csv-source-handle.ts',
    'src/core/App.tsx',                                // Profil-Seed
    'src/__tests__/conventions-daten.test.ts',         // diese Regel selbst
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

describe('korpus-felder-ueber-schema (recurring-bug-classes Klasse 5)', () => {
  // Zweiter Fall derselben Klasse, v4.42.0: der Suchkorpus las seine
  // Quell-Spalten unter GERATENEN Feld-Schluesseln. Am Bestand lag `VB_INHALT`
  // unter `inhalt_kurzzusammenfassung` statt `vb_inhalt` — die gesamte
  // Projektbeschreibung fehlte im Suchindex, ohne dass irgendetwas rot wurde.
  // Die Suche sah nur aus wie ein duenner Bestand.
  //
  // Reissleine, kein Muster-Verbot: wer die Aufloesung entfernt und wieder raet,
  // faellt hier auf. Welche Spalte zu welchem Feld gehoert, prueft der
  // Modul-Test korpusFeldAufloesung.test.ts.
  //
  // Und er gilt fuer BEIDE Korpora. Dass er nur den Wortlaut-Korpus bewachte, war
  // v4.113 der Grund, warum derselbe Defekt im EMBEDDING-Korpus weitere Monate
  // stand: `buildEmbeddingTextForAntrag` las `projektbeschreibung_text`, am echten
  // Bestand in 0 von 14 225 Saetzen gefuellt — der Vektor eines Vorhabens kannte
  // nie seinen Inhalt, nur seinen Titel. Ein Guard, der nur EINE Datei kennt,
  // faengt keine KLASSE.
  const KORPORA = [
    join('plugins', 'antraege', 'services', 'search-corpus.ts'),
    join('plugins', 'auslastung', 'services', 'matching', 'embedding-corpus.ts'),
  ];

  it.each(KORPORA)('%s loest seine Spalten ueber das CSV-Schema auf', (KORPUS) => {
    const quelle = readFileSync(join(ROOT, KORPUS), 'utf-8');
    if (quelle.includes('allow-korpus-felder')) return;
    const nutztResolver = quelle.includes('baueKorpusFeldKarte');
    if (!nutztResolver) {
      expect.fail(
        `${KORPUS} baut seinen Korpus ohne Schema-Aufloesung\n` +
        `(recurring-bug-classes Klasse 5). Unter welchem Schluessel eine CSV-Spalte\n` +
        `im Antrags-Record landet, entscheidet das Wizard-Mapping — nicht der Code\n` +
        `(resolveFieldKey: canonical → custom → col.toLowerCase()). Ein geratener\n` +
        `Schluessel laesst das Feld still leer.\n` +
        `Zuordnung ueber baueKorpusFeldKarte (korpusFeldAufloesung.ts) beziehen.\n` +
        `Echte Ausnahme: '// allow-korpus-felder: <grund>'.`,
      );
    }
  });

  // Die zweite Haelfte derselben Reissleine: wer ueber das Schema aufloest, darf
  // die Feld-Schluessel nicht DANEBEN noch hart lesen. Genau so sah der Embedding-
  // Bauer aus — drei `antrag[KONSTANTE]`-Zugriffe, von denen zwei ins Leere gingen.
  it('der Embedding-Korpus liest keine Textfelder an der Aufloesung vorbei', () => {
    const pfad = join('plugins', 'auslastung', 'services', 'matching', 'embedding-corpus.ts');
    const quelle = readFileSync(join(ROOT, pfad), 'utf-8');
    if (quelle.includes('allow-korpus-felder')) return;
    for (const konstante of ['CANONICAL_VERBUND_TITEL', 'FIELD_PROJEKTBESCHREIBUNG']) {
      expect(
        quelle.includes(konstante),
        `${pfad} liest ${konstante} direkt. Am echten Bestand ist dieser Schluessel\n`
        + `in 0 von 14 225 Saetzen gefuellt — der Wert kommt ueber leseSlots() aus der\n`
        + `Schema-Aufloesung. Echte Ausnahme: '// allow-korpus-felder: <grund>'.`,
      ).toBe(false);
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
    // v4.12 (Cross-Cutting-Review): der Scope war zu eng geschnitten und liess zwei
    // inhalts-tragende Laeufe ausserhalb der Gutachten-Domaene durch.
    // - skill-verwaltung-kuration/: der Real-Daten-Testlauf schickt den VB-Volltext
    //   eines produktiven Antrags (SkillTestlauf) → getTransportForSkillRun.
    // - auslastung/: die LLM-Klassifizierung schickt Verbund-/TV-Titel und
    //   Antragsteller, also `stammdaten` aus INHALTS_SLOTS → getTransportForDatenLauf.
    `${sep}plugins${sep}skill-verwaltung-kuration${sep}`,
    `${sep}plugins${sep}auslastung${sep}`,
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
  // Die Zahl soll auf der UNFALLGRENZE stehen, nicht auf einem Budget: eine
  // Reissleine, die im Normalbetrieb reisst, ist keine Reissleine. Sie wurde
  // viermal knapp nachgezogen (10000 → 20000 → 24000 → 26000), jedes Mal von
  // derselben Seite (erst status-cockpit.md, dann dreimal antraege.md), jedes Mal
  // ohne WIE-Text im Doc — und jedes Mal kostete es eine eigene Runde, weil der
  // Riss erst im Voll-Gate auffiel. Deshalb ging sie mit v2.409 auf 30000, mit der
  // Begruendung: wer die erreicht, hat einen Unfall drin.
  //
  // Diese Annahme ist mit v4.48 widerlegt — antraege.md erreichte 30058 durch
  // gewachsenen Nutzertext. Nachgesehen statt vermutet: „UI-Elemente & Begriffe"
  // 24842 Zeichen ueber ~90 Punkte, laengste Zeile 565, kein eingefuegtes
  // Architektur-Doc, kein Dump, keine Route/Komponente ausserhalb von „Technik".
  // Die groesste Seite der App traegt legitim so viel. 40000 haelt den Unfall
  // weiter (ein reinkopiertes Doc bringt fuenfstellig mit) und liegt ueber dem
  // groessten echten Doc statt darauf.
  //
  // Mit v4.63 erneut gerissen (42304): die Foerderantraege-Seite bekam in EINER
  // Version drei Bereiche dazu — Mehrfachauswahl samt Massen-Leiste, den
  // Schnellzugriff zum Anpinnen und die Zeilendichte. Wieder nachgesehen statt
  // vermutet: alles WAS-Text, kein Architektur-Doc, keine Route/Komponente
  // ausserhalb von „Technik". 46000 liegt wieder ueber dem groessten echten Doc
  // statt darauf. Wer sie erneut reisst, sieht erst nach, WAS gewachsen ist.
  //
  // Mit v4.65 erneut gerissen (46486). Nachgesehen: die Seite hat in dieser
  // Version mehr WEGgenommen als bekommen (zwei Reiter, eine Pille, die
  // gespiegelte Schnellauswahl) — dazugekommen sind vier kurze Regeln, die
  // erklaeren, WARUM ein Segment fehlt. Beim Nachsehen fielen zwei ueberholte
  // Historien-Saetze raus (Doku-Konvention 1: Ist-Zustand). Der Rest ist
  // WAS-Text; 47000 liegt wieder ueber dem groessten echten Doc statt darauf.
  //
  // Mit v4.67 erneut gerissen (47960) — die dritte Reisse in drei Versionen, und
  // damit ist die Schwelle selbst der Befund: antraege.md waechst pro Version um
  // rund tausend Zeichen ECHTEN WAS-Text, weil die Seite die groesste der App ist
  // und jede Version etwas dazubekommt. Wieder nachgesehen: dazu kamen fuenf
  // Punkte zu den eigenen Reitern und ein Satz zur Spaltenkopf-Auswahl, raus
  // flogen drei Historien-Nebensaetze (Doku-Konvention 1: Ist-Zustand). Kein
  // Architektur-Doc, kein Dump. 49000 statt 48000, damit die naechste Version
  // nicht schon wieder an dieser Schraube dreht — als Unfall-Faenger taugt die
  // Zahl weiter: ein reinkopiertes Doc bringt fuenfstellig mit.
  //
  // Mit v4.72 die vierte Reisse (49134). Nachgesehen wie beim letzten Mal: dazu
  // kamen drei Zeilen zum Anpinnen an Phasen und Spannen, WAS-Text zu einer
  // Funktion, nach der der Nutzer gefragt hat. Zwei davon waren wortreich und
  // sind gekuerzt (48992) — und genau deshalb steigt die Schwelle trotzdem: bei
  // acht Zeichen Luft risse die naechste Doc-Pflege aus einem fremden Grund, und
  // dann wird gekuerzt, um eine Zahl zu treffen. 52000 statt 49000.
  //
  // Mit v4.105 die fuenfte Reisse (53165): Frage an die Liste + Stillstands-
  // Pille, WAS-Text zu zwei erfragten Funktionen. Erklaerendes gekuerzt (52489),
  // angehoben trotzdem — mit 500 Zeichen Luft risse die naechste Doc-Pflege aus
  // fremdem Grund. `antraege.md` ist mit Abstand das groesste (naechstes: 28k).
  //
  // Mit v4.131.1 die sechste Reisse (55232) — diesmal ist die BAUART der Grenze
  // der Befund. Die Reisse kam bei einer korrekten Drei-Zeilen-Ergaenzung, die
  // auf einen Halbsatz eingedampft wurde, bis 54999 dastand: genau das, wovor
  // der v4.72-Eintrag warnt und was die README verbietet. Eine Reissleine mit
  // einem Zeichen Luft ist ein Budget.
  //
  // Nachgesehen wie jedes Mal: der Zuwachs seit v4.105 (+2508) ist WAS-Text zu
  // echten Funktionen. Gemessen am sichtbaren Teil: 53141 Zeichen auf 177
  // Punkte = 300 je Punkt (zwei Saetze), laengste Zeile 666 von 700, NULL
  // Code-/Routen-/Pfad-Marker ausserhalb „Technik". 1300 Zeichen flogen raus,
  // die nicht hierher gehoerten (Layout-Begruendung, drei Historien-Nebensaetze,
  // eine doppelt beschriebene Trefferzahl). Auf 48-50k kaeme man nur, indem man
  // 17 beschriebene Faehigkeiten loescht.
  //
  // Deshalb ZWEI Zahlen: der globale Wert hing zuletzt allein an antraege.md und
  // verlor mit jeder Anhebung seine Wirkung fuer die uebrigen 18 Docs — bei
  // 55000 haette suche.md (36k) sich verdoppeln koennen, ohne dass etwas reisst.
  // Global 45000, antraege.md eigene Grenze. `REISSLEINE_JE_DOC` ist KEINE
  // Budget-Tabelle: ein Eintrag kommt nur mit derselben Messung wie oben dazu.
  const DOCS_DIR = join(ROOT, '..', 'docs', 'feedback-kontext');
  const REISSLEINE_DOC_CHARS = 45000;
  const REISSLEINE_JE_DOC: Readonly<Record<string, number>> = {
    // 58000 → 60000 (v6.65): Die Fördertabelle hat statt einer PreCheck-Spalte
    // zwei (TV/Verbund) plus die Rangfolge, nach der die verdichtete Spalte
    // entscheidet — Bildschirm-Fakten, die die Feedback-KI braucht. Vorher
    // wurden nach der README-Reihenfolge Historien-Nebensätze und
    // Layout-Begründungen entfernt; gemessen bleiben 58208 Zeichen, und die
    // sind belegt. Nicht weiter kürzen, um eine Zahl zu treffen.
    'antraege.md': 60000,
  };

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
      const grenze = REISSLEINE_JE_DOC[entry] ?? REISSLEINE_DOC_CHARS;
      if (chars > grenze) findings.push(`  ${entry}: ${chars} Zeichen (Grenze ${grenze})`);
    }
    if (findings.length > 0) {
      expect.fail(
        `Kontext-Doc(s) ueber ihrer Reissleine:\n` +
        `${findings.join('\n')}\n` +
        `Das ist kein knappes Budget — diese Laenge deutet auf einen Unfall hin ` +
        `(Architektur-Doc reinkopiert, generierter Dump) oder darauf, dass WIE-Text ` +
        `ins Doc gewandert ist. Inhaltlich pruefen statt blind kuerzen — und NICHT ` +
        `Richtiges wegkuerzen, nur um die Zahl zu treffen (README, Punkt 4). Ist ` +
        `die Laenge belegt legitim, die Grenze bewusst anheben: global hier, oder ` +
        `fuer dieses eine Doc in REISSLEINE_JE_DOC — mit Begruendung im Kommentar.`,
      );
    }
  });

  /**
   * Die Ausnahme-Tabelle darf nicht zur Budget-Tabelle werden: ein Eintrag, der
   * ueber seinem Doc liegt, waere eine Grenze, die nie reisst — und damit keine.
   */
  it('jede Doc-eigene Grenze gehoert zu einem Doc und laesst ihm Luft, nicht mehr', () => {
    for (const [datei, grenze] of Object.entries(REISSLEINE_JE_DOC)) {
      const pfad = join(DOCS_DIR, datei);
      let chars: number;
      try {
        chars = readFileSync(pfad, 'utf-8').length;
      } catch {
        expect.fail(
          `REISSLEINE_JE_DOC nennt '${datei}' — die Datei gibt es nicht (mehr). ` +
          `Eintrag entfernen.`,
        );
      }
      expect(grenze).toBeGreaterThan(REISSLEINE_DOC_CHARS);
      // Mehr als das Doppelte waere keine Reissleine mehr, sondern ein Freibrief.
      expect(
        grenze, `${datei}: Grenze ${grenze} bei ${chars} Zeichen — zu weit weg`,
      ).toBeLessThan(chars * 2);
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

describe('personal-roots-single-reader (v4.1 — die Wurzeln haben EINE Lesestelle)', () => {
  // Bis v4.0 gab es EINEN Slot `user-folders-root`, und acht Stellen holten ihn
  // sich direkt. Seit v4.1 sind es mehrere Wurzeln aus der Config — ein
  // zurueckkehrender Einzel-Leser wuerde still nur die erste Gruppe sehen, und
  // Teil-Einsammeln saehe wieder aus wie Erfolg. Der Slot-Name gehoert deshalb
  // in die Slot-Schicht; Anwendungscode liest ueber `getUserFoldersRoots`.
  const ERLAUBT = [
    `${sep}infrastructure${sep}types.ts`,
    `${sep}infrastructure${sep}smb-handle${sep}`,   // v6.42: Ordner statt Datei
    `${sep}infrastructure${sep}local-fs${sep}`,
    `${sep}__tests__${sep}`,
  ];

  it('SMB_HANDLE_USER_FOLDERS_ROOT nur in der Slot-Schicht', () => {
    const findings: Finding[] = [];
    for (const file of ALL_TS_FILES) {
      if (ERLAUBT.some(frag => file.includes(frag))) continue;
      findings.push(...findInFile(
        file,
        line => {
          const t = line.trim();
          if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return false;
          return line.includes('SMB_HANDLE_USER_FOLDERS_ROOT');
        },
        'allow-personal-roots-single-reader',
      ));
    }
    if (findings.length > 0) {
      expect.fail(
        `Direkter Zugriff auf den Einzel-Slot ausserhalb der Slot-Schicht (v4.1).\n`
        + `Pflicht: getUserFoldersRoots(idb) — liefert ALLE Wurzeln inkl. der nicht\n`
        + `verbundenen und des Alt-Slots (Id "legacy").\n`
        + `Wenn wirklich noetig: '// allow-personal-roots-single-reader: <grund>' inline.\n\n`
        + `Treffer:\n${fmt(findings)}`,
      );
    }
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

describe('eigene-spalten-lokal (persoenliche Spalten: nie Daten-Share/Snapshot)', () => {
  // Die PERSOENLICHEN Spalten-Definitionen sind geraetelokal (IDB, kv-Key
  // `eigene-spalten:personal`) — nicht aus Bequemlichkeit, sondern als
  // Funktionsbedingung: in prod hat ein normaler Nutzer keine Schreibrechte auf
  // den Daten-Share, eine geteilte Ablage waere dort tot. Team-Spalten sind der
  // ANDERE Weg (Sidecar, Kurator) und leben in einer eigenen Datei.
  const STORE = join(ROOT, 'core', 'spalten', 'store.ts');

  it('store.ts referenziert keine Share-/Snapshot-Writer', () => {
    const verboten = [
      'atomicWrite',
      'appendToFile',
      'writeProgrammSnapshot',
      'getDatenShareHandle',
      'mirrorJsonToPersonal',
      'savePersonalSettings',
    ];
    const lines = readFileSync(STORE, 'utf-8').split(/\r?\n/);
    const treffer = verboten.filter(v =>
      lines.some(l => {
        const t = l.trim();
        if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return false;
        return l.includes(v);
      }),
    );
    expect(
      treffer,
      `Die persoenlichen Spalten muessen geraetelokal bleiben (nur idb.get/set/delete).\n`
      + `Verbotene Referenz(en): ${treffer.join(', ')}\n`
      + `Team-Spalten gehoeren in eine eigene Datei mit Kurator-Gate.`,
    ).toEqual([]);
  });

  it('Snapshot-Allowlist (snapshot.ts) kennt den Key nicht', () => {
    const snapshot = readFileSync(join(ROOT, 'core', 'services', 'csv', 'snapshot.ts'), 'utf-8');
    expect(
      snapshot.includes('eigene-spalten'),
      `snapshot.ts darf 'eigene-spalten' nicht kennen — die persoenlichen `
      + `Definitionen sind geraetelokal (kv-Store, strukturell ausserhalb von SNAPSHOT_FILES).`,
    ).toBe(false);
  });

  it('team-store.ts ist der EINZIGE Share-Beruehrpunkt unter core/spalten/', () => {
    // Die Trennung „geraetelokal vs. geteilt" ist nur so lange wahr, wie sie an
    // EINER Datei haengt. Ein zweiter Share-Zugriff (etwa ein bequemer
    // Direkt-Write aus der Aufloesung) waere ein Weg an Recht und Gate vorbei —
    // und niemand saehe ihn, weil er woanders steht.
    const DIR = join(ROOT, 'core', 'spalten');
    const share = ['getDatenShareHandle', 'atomicWrite', 'appendToFile', 'getPersoenlichHandle'];
    const treffer: string[] = [];
    for (const name of readdirSync(DIR)) {
      if (name === 'team-store.ts' || !name.endsWith('.ts')) continue;
      if (statSync(join(DIR, name)).isDirectory()) continue;
      const lines = readFileSync(join(DIR, name), 'utf-8').split(/\r?\n/);
      for (const bezeichner of share) {
        if (lines.some(l => {
          const t = l.trim();
          if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return false;
          return l.includes(bezeichner);
        })) treffer.push(`${name}: ${bezeichner}`);
      }
    }
    expect(
      treffer,
      `Share-Zugriff unter core/spalten/ gehoert ausschliesslich in team-store.ts `
      + `(dort self-gated ueber queryPermission).\nGefunden: ${treffer.join(', ')}`,
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

describe('kein-oeffnender-ping (ein Verfügbarkeits-Check reißt keinen KI-Tab auf)', () => {
  // `AITransport.ping()` trägt `openIfNeeded: true` als VORGABE. Bei der
  // Streamlit-Bridge ruft das `ensureConnection()` → `window.open` — ein Tab
  // OHNE Bookmarklet, der die Anfrage nie beantwortet. Ein bloßer „läuft die KI
  // überhaupt?"-Check darf das nicht: die Meldung stimmt, und der nutzlose Tab
  // bleibt trotzdem stehen. Zuletzt gemeldet an „Warum?" auf der Suchseite
  // (v4.17.0); der Review fand die Klasse an fünf weiteren Stellen.
  //
  // Zwei zulässige Formen, beide in derselben DATEI nachweisbar:
  //  (a) ausdrücklich passiv: `ping({ openIfNeeded: false })`,
  //  (b) vorgelagerter Guard: `kiVerbindungBereit` / `kiVerbindungGeprueft`
  //      (src/core/services/ai/ki-guard.ts) — danach ist der Tab schon offen,
  //      der Ping öffnet also nichts mehr (Muster: workflow-generierung.ts).
  //
  // Nicht getroffen wird die Durchreiche `ping(opts)` — sie entscheidet nichts.
  const GUARD_MARKER = ['kiVerbindungBereit', 'kiVerbindungGeprueft'];

  const istOeffnenderPing = (l: string): boolean => {
    const t = l.trim();
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return false;
    // Leere Klammern = Vorgabe greift; explizites `true` = derselbe Effekt.
    return /\.ping\(\s*\)/.test(l) || /\.ping\(\s*\{[^}]*openIfNeeded:\s*true/.test(l);
  };

  it('erkennt die Formen (Selbsttest)', () => {
    expect(istOeffnenderPing('  const ok = await transport.ping();')).toBe(true);
    expect(istOeffnenderPing('  await t.ping({ openIfNeeded: true });')).toBe(true);
    expect(istOeffnenderPing('  await t.ping({ openIfNeeded: false });')).toBe(false);
    expect(istOeffnenderPing('    ping: (opts) => inner.ping(opts),')).toBe(false);
    expect(istOeffnenderPing('   * sauberer als rohes getActiveTransport().ping()')).toBe(false);
  });

  it('kein Verfügbarkeits-Check öffnet ungefragt ein Bridge-Fenster', () => {
    const findings: Finding[] = [];
    for (const file of ALL_TS_FILES) {
      if (file.includes(`${sep}__tests__${sep}`) || file.endsWith('.test.ts')) continue;
      // Der Guard selbst und die Bridge-Innereien (ensureConnection, Heartbeat,
      // Durchreichen) sind die IMPLEMENTIERUNG dieser Regel, nicht ihr Adressat.
      const rel = relPath(file);
      if (rel.startsWith('src/core/services/ai/transports/')) continue;
      if (rel === 'src/core/services/ai/ki-guard.ts') continue;
      // Node-CLI: kein Fenster, kein Tab — `openIfNeeded` ist dort wirkungslos.
      if (rel.startsWith('src/core/services/skill-eval/cli')) continue;
      const inhalt = readFileSync(file, 'utf-8');
      if (GUARD_MARKER.some(m => inhalt.includes(m))) continue;
      findings.push(...findInFile(file, istOeffnenderPing, 'allow-oeffnender-ping'));
    }
    if (findings.length > 0) {
      expect.fail(
        `Ein Verfügbarkeits-Check darf keinen KI-Tab öffnen.\n`
        + `\`ping()\` ohne Argument nutzt die Vorgabe \`openIfNeeded: true\` und ruft bei der\n`
        + `Streamlit-Bridge \`ensureConnection()\` → window.open — ein Tab ohne Bookmarklet,\n`
        + `der die Anfrage nie beantwortet.\n`
        + `Entweder \`ping({ openIfNeeded: false })\`, oder in derselben Datei zuerst\n`
        + `\`kiVerbindungGeprueft(bridge)\` (src/core/services/ai/ki-guard.ts) — der öffnet\n`
        + `statt eines Tabs den app-weiten Verbinden-Dialog.\n`
        + `Echte Ausnahme (ein ausdrücklicher „Verbindung testen"-Knopf):\n`
        + `'// allow-oeffnender-ping: <grund>'.\n\nTreffer:\n${fmt(findings)}`,
      );
    }
  });
});

describe('csv-quellordner-nicht-kopieordner', () => {
  /** Windows-Pfade vergleichbar machen: Trenner vereinheitlichen, Fall ignorieren. */
  const norm = (p: string) => p.replace(/[\\/]+/g, '/').replace(/\/+$/, '').toLowerCase();

  it('keine Variante liest ihre CSV-Quellen aus dem App-eigenen Kopie-Ordner', () => {
    const configsDir = join(ROOT, '..', 'configs');
    const treffer: string[] = [];
    // Nur `.json` — `_template.config.jsonc` traegt Kommentare und ist kein Build-Input.
    for (const datei of readdirSync(configsDir).filter(f => f.endsWith('.config.json'))) {
      const cfg = JSON.parse(readFileSync(join(configsDir, datei), 'utf-8')) as {
        local?: { csvSourceDir?: string | null };
      };
      const quelle = cfg.local?.csvSourceDir;
      if (!quelle) continue;
      if (norm(quelle).endsWith(`/programm/${norm(CSV_SOURCES_SUBDIR)}`)) {
        treffer.push(`configs/${datei}: local.csvSourceDir = ${quelle}`);
      }
    }
    if (treffer.length > 0) {
      expect.fail(
        `Der CSV-Quellordner zeigt auf den App-EIGENEN Kopie-Ordner.\n`
        + `Dorthin schreibt \`saveCsvSourceFile\` die nach UTF-8 normalisierte Kopie jeder\n`
        + `Quelle (CSV_SOURCES_SUBDIR). Die App importiert damit ihr eigenes Erzeugnis:\n`
        + `die Baseline im Schema (mtime/Groesse/Checksum/Encoding) beschreibt danach eine\n`
        + `ANDERE Datei als die, die eine zweite Instanz mit dem echten Export stempelt —\n`
        + `beide melden bei JEDEM Start "neuer Export", importieren voll und kippen per\n`
        + `Encoding-Heilung abwechselnd das \`encoding\`-Feld.\n`
        + `Richtig ist der Ordner, in dem der taegliche EXPORT liegt.\n\nTreffer:\n`
        + treffer.map(t => `  ${t}`).join('\n'),
      );
    }
  });
});

describe('reserve-deckt-output-budget (v4.115.1 — der Zeichen-Cap muss den Output tragen)', () => {
  // Der VB-Zeichen-Cap ist abgeleitet: `(Kontextfenster − RESERVE_TOKENS) ×
  // CHARS_PER_TOKEN`. RESERVE_TOKENS ist damit die Zusage, wie viel Fenster
  // NEBEN der Vorhabensbeschreibung frei bleibt — und der grösste Posten darin
  // ist das Output-Budget des Laufs (`renderSkillPrompt`: `skill.maxTokens ??
  // DEFAULT_MAX_TOKENS`, bei aktivem Thinking plus THINKING_OUTPUT_HEADROOM).
  //
  // Bis v4.115.1 stand die Reserve auf 4.096 und deckte 10.240 Output-Tokens
  // NICHT. Das fiel nie auf, weil ein Ueberlauf nichts meldet: llama.cpp schiebt
  // dann den ANFANG aus dem Fenster — also den System-Prompt — und das Ergebnis
  // ist still falsch statt sichtbar gekuerzt. Zwei unabhaengige Zahlen, deren
  // Verhaeltnis niemand nachrechnete.
  //
  // Der Guard rechnet es nach. Wer THINKING_OUTPUT_HEADROOM, DEFAULT_MAX_TOKENS
  // oder ein `maxTokens` am Skill anhebt, hebt entweder die Reserve mit — oder
  // begruendet inline, warum der Lauf den Cap nicht beruehrt.

  /** Output-Budget, das die Reserve tragen muss: Antwort + Reasoning gemeinsam. */
  const budgetMitThinking = DEFAULT_MAX_TOKENS + THINKING_OUTPUT_HEADROOM;
  /** Was einem Skill an eigenem `maxTokens` bleibt, ohne die Reserve zu sprengen. */
  const maxTokensObergrenze = RESERVE_TOKENS - THINKING_OUTPUT_HEADROOM;
  const SEED_DIR = join(ROOT, 'core', 'services', 'skills', 'registry');
  const MARKER = 'allow-reserve-output-budget';

  it('die Reserve deckt das Default-Output-Budget eines Laufs mit Thinking', () => {
    expect(
      RESERVE_TOKENS,
      `RESERVE_TOKENS (${RESERVE_TOKENS}) muss mindestens das Output-Budget eines Laufs\n`
      + `decken: DEFAULT_MAX_TOKENS (${DEFAULT_MAX_TOKENS}) + THINKING_OUTPUT_HEADROOM\n`
      + `(${THINKING_OUTPUT_HEADROOM}) = ${budgetMitThinking}. Sonst reicht der abgeleitete\n`
      + `VB-Cap weiter, als das Fenster traegt — und der Ueberlauf schiebt den System-Prompt\n`
      + `hinaus, statt sichtbar zu kuerzen.\n`
      + `Entweder RESERVE_TOKENS (llm-context.ts) anheben oder das Output-Budget senken.`,
    ).toBeGreaterThanOrEqual(budgetMitThinking);
  });

  it('kein Seed-Skill fordert mehr Output, als die Reserve traegt', () => {
    const dateien = readdirSync(SEED_DIR)
      .filter(n => n.endsWith('.seed.ts'))
      .map(n => join(SEED_DIR, n));
    const alle: Finding[] = [];
    const zuGross: Finding[] = [];
    for (const file of dateien) {
      // Ohne Marker gemessen — `alle` ist die Positiv-Kontrolle und muss auch
      // die begruendeten Ausnahmen sehen, sonst zaehlt sie den Scan gesund.
      alle.push(...findInFile(file, l => /^\s*maxTokens:\s*\d+\s*,/.test(l), '\u0000'));
      zuGross.push(...findInFile(file, l => {
        const m = l.match(/^\s*maxTokens:\s*(\d+)\s*,/);
        return m !== null && Number(m[1]) > maxTokensObergrenze;
      }, MARKER));
    }

    // Positiv-Kontrolle: findet der Scan ueberhaupt Budgets? Ohne sie liefe der
    // Guard auch dann gruen, wenn die Seeds umbenannt oder das Feld umgeschrieben
    // waere — gruen hiesse dann „nicht geprueft", nicht „in Ordnung".
    expect(
      alle.length,
      `Der Scan fand kein einziges \`maxTokens:\` in ${SEED_DIR} — der Guard hat seinen\n`
      + `Griff verloren (Seeds umbenannt? Feld umgeschrieben?). Bitte das Muster nachziehen.`,
    ).toBeGreaterThan(10);

    if (zuGross.length > 0) {
      expect.fail(
        `Skill-Budget sprengt die Kontext-Reserve.\n`
        + `RESERVE_TOKENS (${RESERVE_TOKENS}) − THINKING_OUTPUT_HEADROOM (${THINKING_OUTPUT_HEADROOM})\n`
        + `= ${maxTokensObergrenze} Tokens bleiben einem Skill fuer sein eigenes \`maxTokens\`.\n`
        + `Darueber reicht der abgeleitete VB-Cap weiter, als das Fenster traegt.\n\n`
        + `Entweder RESERVE_TOKENS (llm-context.ts) anheben — dann sinkt der Cap fuer ALLE —,\n`
        + `oder inline begruenden, warum dieser Lauf den Cap nicht beruehrt:\n`
        + `  // ${MARKER}: <grund>\n\nTreffer:\n${fmt(zuGross)}`,
      );
    }
  });
});

/* -------------------------------------------------------------------------- */
/* modellname-nur-im-katalog                                                    */
/* -------------------------------------------------------------------------- */

describe('modellname-nur-im-katalog', () => {
  const MARKER = 'allow-modellname-nur-im-katalog';
  const KATALOG = `services${sep}ai${sep}modell-katalog.ts`;

  /**
   * Modelle der internen KI. Absichtlich eng: es geht um die Namen, die in IHRER
   * Auswahlliste stehen — nicht um jeden Begriff, in dem „Qwen" vorkommt.
   */
  const MODELLNAME = /gpt-oss-120b|Qwen3[._-]/;

  /**
   * OpenRouter-Modell-Ids bezeichnen etwas anderes: ein extern gehostetes Modell,
   * das wir per Id ansprechen. Die Id IST dort der Wert und darf nicht durch eine
   * Rolle ersetzt werden.
   */
  const OPENROUTER = /openai\//;

  /** Kommentarzeilen bleiben aussen vor — sie erklären, sie behaupten nicht. */
  function istKommentar(line: string): boolean {
    const t = line.trim();
    return t.startsWith('*') || t.startsWith('//') || t.startsWith('/*') || t.startsWith('{/*');
  }

  it('nennt Modelle der internen KI nur im Katalog beim Namen', () => {
    const treffer = ALL_TS_FILES
      .filter(f => !f.includes(`${sep}__tests__${sep}`) && !f.endsWith(KATALOG))
      .flatMap(f => findInFile(
        f,
        line => !istKommentar(line) && MODELLNAME.test(line) && !OPENROUTER.test(line),
        MARKER,
      ));

    if (treffer.length > 0) {
      expect.fail(
        `Ein Modellname der internen KI steht ausserhalb von modell-katalog.ts.\n\n`
        + `Die interne KI wird von Kollegen betrieben und tauscht ihre Modelle nach\n`
        + `ihrem eigenen Fahrplan. Ein hier eingetragener Name veraltet dann STILL —\n`
        + `die Oberflaeche behauptet weiter „gpt-oss-120b", waehrend etwas anderes laeuft.\n\n`
        + `Stattdessen:\n`
        + `  - Anzeige  → modellLabel(rolle) aus core/services/ai/bridge-modelle\n`
        + `  - Auswahl  → die Rolle 'standard' | 'stark' (KiRolle)\n`
        + `  - Erkennung→ ein Eintrag in MODELL_KATALOG (die EINE Stelle, die Namen kennt)\n\n`
        + `Ist der Name hier wirklich der Wert (z.B. eine OpenRouter-Modell-Id), inline\n`
        + `begruenden: // ${MARKER}: <grund>\n\nTreffer:\n${fmt(treffer)}`,
      );
    }
  });

  it('der Katalog selbst nennt weiterhin Namen (Positiv-Kontrolle)', () => {
    // Ohne diese Gegenprobe liefe der Guard auch dann gruen, wenn das Muster
    // nicht mehr greift — gruen hiesse dann „nicht geprueft", nicht „in Ordnung".
    const katalog = ALL_TS_FILES.find(f => f.endsWith(KATALOG));
    expect(katalog, 'modell-katalog.ts nicht gefunden — Guard hat seinen Griff verloren').toBeTruthy();
    expect(MODELLNAME.test(readFileSync(katalog!, 'utf-8'))).toBe(true);
  });
});
