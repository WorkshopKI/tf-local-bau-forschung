/**
 * Datenmodell der Skill-Registry (v1). Skills + Qualitätsregeln werden als
 * Kurator-pflegbare DATEN gehalten (nicht als Code) und gemeinsam in
 * `_intern/skills/registry.json` auf dem Daten-Share persistiert.
 *
 * Vorwärts-Kompatibilität (über Jahre lebende Records): `typ` ist bewusst
 * `string` (keine strikte Union) und `params` ein offenes Objekt — unbekannte
 * Regel-Typen werden beim Lesen BEHALTEN, in Checks übersprungen und im UI als
 * „unbekannter Typ" inert angezeigt, statt verworfen zu werden. Beim Lesen
 * gilt: unbekannte Felder ignorieren, fehlende defaulten (siehe `normalize`).
 */

/** Re-Invocation-Modifikatoren eines Skills (Editor + Runner). */
export type SkillModifierKey = 'neu' | 'kuerzer' | 'laenger';

/** Bekannte Regel-Typen v1. Erweiterbar — Leser tolerieren unbekannte Typen. */
export type RegelTyp =
  | 'zeichen_max'
  | 'wortanzahl'
  | 'satzanzahl'
  | 'satzlaenge_max'
  | 'verbotenes_muster'
  | 'pflicht_anfang'
  | 'keine_aufzaehlungen'
  | 'absatz_min'
  | 'nf_keine_platzhalter_reste';

/** Set für O(1)-Lookup, ob ein (string-)Typ bekannt ist. */
export const KNOWN_REGEL_TYPEN: ReadonlySet<string> = new Set<RegelTyp>([
  'zeichen_max',
  'wortanzahl',
  'satzanzahl',
  'satzlaenge_max',
  'verbotenes_muster',
  'pflicht_anfang',
  'keine_aufzaehlungen',
  'absatz_min',
  'nf_keine_platzhalter_reste',
]);

/** Schweregrad eines Regel-Verstoßes. */
export type Schweregrad = 'fehler' | 'hinweis';

/**
 * Prüfart einer Qualitätsregel (Artefakt-Engine, additiv). Trennt, WIE eine Regel
 * ausgeführt wird:
 *  - `'textlich'` (Default): deterministischer Check-Engine-Lauf (Zeichen/Wörter/
 *    Sätze/Muster) — byte-identisch zum Bestandsverhalten.
 *  - `'fachlich'`: qualitativer LLM-QS-Lauf (Quellenabgleich, Halluzination,
 *    Konsistenz) — liefert BERATENDE Befunde, überschreibt nie den Text.
 *  - `'administrativ'`: struktureller Vollständigkeits-/Platzhalter-Check
 *    (alle Abschnitte/Platzhalter vorhanden).
 * Erweiterbar — Leser tolerieren Unbekanntes (→ `'textlich'`, siehe `normalize`).
 */
export type Pruefart = 'textlich' | 'fachlich' | 'administrativ';

/**
 * Kuratierter Reifegrad eines Skills (vom Kurator gesetzt, NICHT automatisch).
 * `'entwurf'` = Default/neu, `'erprobt'` = im Team genutzt, `'empfohlen'` = Standard.
 * Das Skill-Feedback-Substrat liefert dazu nur einen BERATENDEN Vorschlag
 * (`suggestReifegrad`), das Setzen bleibt ein Kurator-Registry-Write. Erweiterbar —
 * Leser tolerieren Unbekanntes (→ `'entwurf'`, siehe `normalizeSkill`).
 */
export type Reifegrad = 'entwurf' | 'erprobt' | 'empfohlen';

/**
 * Parametrisierte Qualitätsregel. `typ` entscheidet, wie `params` interpretiert
 * werden (siehe `check-engine.ts`). Eine Regel erzeugt zugleich einen Prompt-
 * Hinweis (KI zielt darauf) UND einen Check (System prüft es) — eine Quelle.
 */
export interface QualitaetsRegel {
  id: string;
  name: string;
  /** Bekannter `RegelTyp` ODER ein zukünftiger, hier unbekannter String. */
  typ: string;
  params: Record<string, unknown>;
  schweregrad: Schweregrad;
  aktiv: boolean;
  erstellt_am: string;
  geaendert_am: string;
  /**
   * Prüfart (additiv, Artefakt-Engine). Fehlt in Alt-Records → `normalize`
   * defaultet `'textlich'` (byte-identisch). Steuert, über welchen Pfad die
   * Regel ausgewertet wird (deterministisch / LLM-QS / strukturell).
   */
  pruefart?: Pruefart;
  /**
   * Explizit gesetzte „Art"/Kategorie (additiv, Kurator-override). Fehlt → die
   * Kategorie wird zur Laufzeit aus `typ`+`pruefart` abgeleitet
   * (`effektiveKategorie`, siehe `kategorien.ts`). Der abgeleitete Default wird
   * NIE in die Daten geschrieben — nur ein explizit gesetzter Wert persistiert.
   */
  kategorie?: string;
}

/**
 * Ein gekappter Snapshot eines Skill-Standes VOR einer Änderung (Versions-
 * Historie, additiv). Bewusst schlank — nur die kuratierbaren Inhalte, die ein
 * Diff/Rollback braucht; kein Volltext-Doppel des Records. Wird beim Speichern
 * vorangestellt und auf `MAX_HISTORIE` gekappt (siehe `versioning.ts`).
 */
export interface SkillVersionSnapshot {
  /** Versionsnummer dieses (alten) Standes. */
  version: number;
  promptTemplate: string;
  regelIds: string[];
  modifiers: Record<SkillModifierKey, string>;
  /** Zeitstempel, zu dem dieser Stand galt (`geaendert_am` des alten Records). */
  geaendert_am: string;
  /** Wer die nachfolgende Änderung vorgenommen hat (S1-`getUserId`, optional). */
  userId?: string;
  /** Optionale Kurator-Begründung der nachfolgenden Änderung. */
  begruendung?: string;
}

/** Join-Strategie der Teilfelder eines strukturierten `finalerText`. */
export type TeilJoin = '\n\n' | '\n' | ' ';

/** Deklaration EINES Teilfelds (Key zum Befüllen + Anzeige-Label fürs Badge). */
export interface TeilDeklaration {
  key: string;
  label: string;
}

/** Ein gefülltes Teilfeld: Deklaration + vom LLM gelieferter Text. */
export interface TeilFeld extends TeilDeklaration {
  text: string;
}

/**
 * Ein benannter KI-Arbeitsschritt. Reine Daten — die Laufzeit-Funktionen
 * (`parse`, Checks, Prompt-Vorgaben) kommen aus dem Skills-Service bzw. der
 * Check-Engine, NICHT aus dem Record.
 */
export interface SkillRecord {
  id: string;
  name: string;
  beschreibung: string;
  /** Wird bei jedem Speichern inkrementiert (leichtgewichtig, keine Historie). */
  version: number;
  /** Statisches Template mit deklarierten `{{slot}}`-Platzhaltern. */
  promptTemplate: string;
  modifiers: Record<SkillModifierKey, string>;
  /** IDs der zugeordneten Qualitätsregeln (aus der gemeinsamen Bibliothek). */
  regelIds: string[];
  /** Deklarierte Kontext-Slots (v1: `stammdaten`, `vbMarkdown`). */
  slots: string[];
  geaendert_am: string;
  /**
   * Kuratierter Reifegrad (additiv, fehlt in Alt-Records → `normalize` defaultet
   * `'entwurf'`). Vom Kurator gesetzt; das Feedback-Substrat liefert nur einen
   * beratenden Vorschlag. Roh-Signale (Nutzung/Feedback) liegen NICHT hier,
   * sondern in den Pro-Nutzer-Dateien des `skill-feedback`-Substrats.
   */
  reifegrad?: Reifegrad;
  /**
   * Explizit gesetzte fachliche Kategorie (additiv, Kurator-override). Fehlt →
   * die Kategorie wird zur Laufzeit aus `id`- bzw. `name`-Präfix abgeleitet
   * (`effektiveSkillKategorie`, siehe `skill-kategorien.ts`). Der abgeleitete
   * Default wird NIE in die Daten geschrieben — nur ein explizit gesetzter Wert
   * persistiert (gleiches Modell wie `QualitaetsRegel.kategorie`).
   */
  kategorie?: string;
  /**
   * Bounded Versions-Historie (additiv, neueste zuerst, max `MAX_HISTORIE`).
   * Fehlt in Alt-Records → `normalize` defaultet einen Eintrag aus dem aktuellen
   * Stand (verlustfreie Migration). Pflege ausschließlich über `appendHistorie`.
   */
  historie?: SkillVersionSnapshot[];
  /** Optional (aus dem Seed; in v1 nicht UI-editierbar) — System-Rolle fürs LLM. */
  systemPrompt?: string;
  /** Optional — Token-Limit fürs LLM (Default im Runner). */
  maxTokens?: number;
  /**
   * Optionaler Lektor-Zweitpass (additiv, opt-in). Ist das Feld gesetzt, fährt
   * `runSkill` nach dem Inhalts-Call einen zweiten LLM-Call (gleicher Transport),
   * der den `finalerText`-Entwurf rein sprachlich/formal überarbeitet. Template mit
   * **nur** dem `{{entwurf}}`-Slot (kein VB). Fehlt das Feld → kein zweiter Call →
   * exakt heutiges Verhalten. DSGVO: der `{{entwurf}}`-Slot zählt als inhalts-tragend
   * (siehe `src/core/services/ai/transport-policy.ts`).
   */
  lektorPromptTemplate?: string;
  /**
   * Optionaler Override für die DSGVO-Transport-Policy (additiv). **Ableitung
   * schlägt Flag**: referenziert `promptTemplate` einen Inhalts-Slot
   * (`{{vbMarkdown}}`/`{{stammdaten}}`/`{{zielText}}`/`{{vorherigeAbschnitte}}`/`{{vbRelevant}}`),
   * ist der Skill intern-pflichtig — egal was dieser Flag sagt. Nur ein
   * inhaltsfreies Template kann hiermit explizit als inhalts-tragend markiert
   * werden. Fehlt der Flag, gilt fail-safe `true`. Siehe
   * `src/core/services/ai/transport-policy.ts`.
   */
  enthaeltDokumentInhalte?: boolean;
  /**
   * Opt-in (additiv): deklarierte Teilfelder für strukturierte Ausgabe des
   * `### Finaler Text`-Blocks. Ist das Feld gesetzt, instruiert `composeSkillPrompt`
   * das LLM, diesen Block als JSON-Array `[{key,text}]` zu liefern, und
   * `parseSkillOutput` mappt die Teile (Reihenfolge + Labels aus DIESER Deklaration)
   * auf `ParsedSkillOutput.teile`. `finalerText` bleibt die flache Quelle der
   * Wahrheit (Teile per `teilJoin` verbunden, ohne Badge). Fehlt das Feld oder
   * liefert das Modell kein JSON → exakt heutiges Verhalten (Prosa-finalerText).
   * Badges sind render-only. Siehe CLAUDE.md „Strukturierte Skill-Ausgabe".
   */
  teilStruktur?: TeilDeklaration[];
  /** Join-String der Teile zum flachen `finalerText` (Default `'\n\n'`). */
  teilJoin?: TeilJoin;
  /**
   * Opt-in Aktivierungs-Gate (additiv). Skills in der geteilten `registry.json`
   * sind über alle Build-Varianten sofort live — ein neuer, noch ungeprüfter Skill
   * (z.B. der Anfragen-Anonymisierer) startet daher mit `aktiv: false` und wird erst
   * nach bestandenem Eval-/Recall-Gate manuell freigeschaltet. **Fehlt das Feld
   * (`undefined`) gilt der Skill als aktiv** — Bestands-Skills bleiben unverändert
   * live. Konsumenten, die das Gate respektieren müssen, prüfen `aktiv === false`.
   */
  aktiv?: boolean;
}

/* -------------------------------------------------------------------------- */
/* Kuratierbare Workflow-Definitionen (geordnete Schritt-Sequenz, additiv)      */
/* -------------------------------------------------------------------------- */

/**
 * Deklaratives Anwendbarkeits-Gate eines Schritts. Erweiterbar — Leser tolerieren
 * Unbekanntes (→ `'immer'`). Die Logik liegt im reinen `evalGate`-Resolver, NICHT
 * im Datensatz (keine Funktionen/`eval()` im JSON).
 */
export type GateExpr = 'immer' | 'hat_teilvorhaben';

/**
 * Rolle eines Schritts. `'generierung'` (Default) erzeugt einen Abschnitt;
 * `'llm_qs'` bewertet einen Generierungs-Abschnitt qualitativ und liefert
 * BERATENDE Befunde (überschreibt nie den Text). Erweiterbar — Leser tolerieren
 * Unbekanntes (→ `'generierung'`).
 */
export type WorkflowStepRolle = 'generierung' | 'llm_qs';

/**
 * Wie viel VB-Kontext ein Schritt braucht (Relevanz-Map):
 *  - `'voll'` (Default): voller `{{vbMarkdown}}` wie bisher — byte-identisch.
 *  - `'relevant'`: nur die per Relevanz-Map ausgewählten VB-Sektionen
 *    (`{{vbRelevant}}`); fehlt/leer die Map oder ist die VB klein → Volltext-Fallback.
 *  - `'nur_zieltext'`: kein VB (nutzt `{{zielText}}`, z. B. reine QS).
 *  - `'kein'`: kein Antragskontext.
 * Erweiterbar — Leser tolerieren Unbekanntes (→ `'voll'`, siehe `normalizeStepRolle`).
 */
export type KontextBedarf = 'voll' | 'relevant' | 'nur_zieltext' | 'kein';

/**
 * Ein kuratierbarer Workflow-Schritt. Flach gehalten — Hierarchie ausschließlich
 * über `parentStepId` mit GENAU einer Ebene (die Engine lehnt Tiefe >1 ab). Die
 * Laufzeit-Funktionen (Generierung, Checks) kommen aus dem zugeordneten Skill,
 * nicht aus diesem Record.
 */
export interface WorkflowStep {
  /** Stabile ID (z.B. `"A"` / `"5"` / `"5a"`). Persistenz-Key in `WorkflowRun.schritte`. */
  id: string;
  /** Anzeige-Nummer (`"5"`, `"5a"`) — aus der Hierarchie berechnet (`computeStepNumbers`). */
  nr: string;
  /** GENAU eine Ebene: darf nur auf einen Schritt OHNE eigenen `parentStepId` zeigen. */
  parentStepId?: string;
  label: string;
  /** Kurzlabel für den Stepper-Pill. */
  kurz: string;
  /** Skill-Registry-ID, die diesen Schritt generiert (bzw. bei `llm_qs` bewertet). */
  skillId: string;
  /** Schlüssel für die DOCX-Anker-Tabelle. Fehlt/ungültig → Export überspringt den Schritt. */
  ankerKey?: string;
  /** Anwendbarkeits-Gate (default `'immer'`). */
  gateExpr?: GateExpr;
  /** SEAM (in v1 ungenutzt): abschnittsbezogene Retrieval-Queries. */
  retrievalQueries?: string[];
  /** VB-Kontext-Bedarf (default `'voll'`; fehlt/`'voll'` → weggelassen, kein Daten-Drift). */
  kontextBedarf?: KontextBedarf;
  /** Rolle des Schritts (default `'generierung'`; fehlt → Generierung). */
  rolle?: WorkflowStepRolle;
  /** Nur bei `rolle === 'llm_qs'`: ID des bewerteten Generierungs-Schritts. */
  qsZielStepId?: string;
  /** Nur bei `rolle === 'generierung'`: beschränkter Auto-Retry nach Fehl-Checks (opt-in). */
  autoRetry?: boolean;
  /** Harte Versuchs-Obergrenze des Auto-Retry (`normalizeStepRolle` klemmt auf `[0..3]`, Default 2). */
  maxRetries?: number;
}

/**
 * Artefakt-Typ einer Workflow-Definition (Artefakt-Engine, additiv). Trennt die
 * Artefakt-Achse von der amtlichen Status-Wirbelsäule: `'ga'` = ZIM-Gutachten
 * (Default, byte-identisch), `'nf'` = ZIM-Nachforderungen, `'abl'`/`'rne'` für
 * spätere Artefakte (noch nicht implementiert), `'precheck'` = Verständnis-
 * Artefakt der Vorhabenbeschreibung (in-App gerendert, kein DOCX). Erweiterbar —
 * Leser tolerieren Unbekanntes (→ `'ga'`, siehe `normalize`).
 */
export type ArtefaktTyp = 'ga' | 'nf' | 'abl' | 'rne' | 'precheck';

/**
 * Ebene, auf der ein Artefakt erzeugt wird: `'verbund'` (Default, ein Lauf pro
 * Verbund — GA) oder `'tv'` (ein Lauf pro Teilvorhaben — NF). Erweiterbar — Leser
 * tolerieren Unbekanntes (→ `'verbund'`).
 */
export type WorkflowEbene = 'verbund' | 'tv';

/**
 * Eine benannte, geordnete Workflow-Definition (z.B. `zim-ep`). `steps` ist FLACH;
 * Hierarchie nur über `WorkflowStep.parentStepId`.
 */
export interface WorkflowDef {
  id: string;
  name: string;
  /** Wird bei jedem Speichern inkrementiert (leichtgewichtig, wie Skills). */
  version: number;
  steps: WorkflowStep[];
  /** Draft-vs-Live (Phase 6; fehlt → als aktiv behandeln). */
  aktiv?: boolean;
  /**
   * Artefakt-Typ (additiv, Artefakt-Engine). Fehlt in Alt-Defs → `normalize`
   * defaultet `'ga'` (GA byte-identisch). Treibt Run-Keying, Vorlagen-/Dateiname
   * und QS-Regel-Auswahl.
   */
  artefaktTyp?: ArtefaktTyp;
  /** Ebene (additiv). Fehlt → `'verbund'` (GA). NF = `'tv'`. */
  ebene?: WorkflowEbene;
  /**
   * Lebenszyklus-Achse (additiv), getrennt von `aktiv` (globaler An/Aus-Schalter):
   * `'entwurf'` = nur in dev sichtbar/ausführbar, `'freigegeben'` = überall.
   * Fehlt in Alt-Defs → `normalize` defaultet `'freigegeben'` (fail-safe — zim-ep
   * und jeder Bestands-Workflow bleibt in allen Varianten verfügbar). Die
   * Variant-Sichtbarkeit ergibt sich aus `freigabe` + `features.workflowEntwuerfe`
   * (siehe `istWorkflowVerfuegbar`), NICHT aus `aktiv`.
   */
  freigabe?: WorkflowFreigabe;
}

/** Lebenszyklus-Stand einer Workflow-Definition (gleiches Vokabular wie Abschnitts-Stände). */
export type WorkflowFreigabe = 'entwurf' | 'freigegeben';

/** Inhalt der gemeinsamen `_intern/skills/registry.json` (Skills + Regeln + Workflows). */
export interface SkillRegistryFile {
  version: 1;
  updated_at: string;
  skills: SkillRecord[];
  regeln: QualitaetsRegel[];
  /** Kuratierbare Workflow-Definitionen. Fehlt in Alt-Dateien → `normalize` defaultet `[]`. */
  workflows?: WorkflowDef[];
  /**
   * IDs bereits angewandter einmaliger Registry-Migrationen (team-weit, idempotent).
   * Verhindert, dass eine Auto-Reconciliation (z.B. Anonymisierer-Freischaltung) eine
   * spätere bewusste Kurator-Entscheidung wieder überschreibt. `normalize` bewahrt das
   * Feld (sonst liefe die Migration bei jedem Laden erneut). Siehe `migrations.ts`.
   */
  angewandteMigrationen?: string[];
}
