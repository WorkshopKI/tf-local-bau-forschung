/**
 * Kanonische Status-Kategorien fuer Antrag-Status.
 *
 * Die App haelt zwei Domaenen von Status-Werten parallel:
 * - **Bauantraege** (Snake-Case-Werte aus dem Bauantrag-Workflow): `neu`,
 *   `in_bearbeitung`, `in_pruefung`, `nachforderung`, `genehmigt`, `abgelehnt`,
 *   `archiviert`. Auch in den Snake-Case-Seeds verbreitet (`eingereicht`,
 *   `in_begutachtung`, `bewilligt`, `nachbesserung`, `abgeschlossen`).
 * - **Foerderantraege** (CSV-Rohwerte aus dem Foyer-Quellsystem):
 *   `beantragt`, `bearbeitungsreif`, `VN geprueft`, `NF gestellt`,
 *   `Schlussvermerk`, `abgelehnt/zurueckgezogen`, ... — kommen aus echten
 *   CSV-Importen + den anonymisierten Real-Fixtures.
 *
 * Views, Dashboard und Workflow-Logik sollten NICHT direkt gegen einen der beiden
 * Werte-Saetze vergleichen. Stattdessen die Helper hier nutzen:
 *
 *     // FALSCH:  a.status === 'bewilligt' || a.status === 'genehmigt'
 *     // RICHTIG: isBewilligtStatus(a.status)
 *
 * Die Filter-Sidebar (`StatusFilterFacet` / `statusGroups.ts`) ist hiervon
 * unberuehrt — sie zeigt die rohen CSV-Werte und gruppiert sie fuer die UI nach
 * `getPhaseForStatus()`. Dieses Modul beantwortet eine andere Frage: "ist dieser
 * Antrag fachlich offen / in Pruefung / bewilligt / abgelehnt / abgeschlossen?".
 *
 * Vergleich case-insensitive und whitespace-tolerant.
 */

export type StatusCategory =
  | 'offen'         // Eingang, noch nicht in Pruefung
  | 'in_pruefung'   // Antrags-Pruefung (techn, kaufm, Gutachten) — VOR der Bewilligung
  | 'nachforderung' // wartet auf Nachforderung
  | 'entscheidung'  // Entscheidungs-Vorbereitung (bewilligungsreif, ablehnungsreif, ...)
  | 'bewilligt'     // positiv entschieden
  | 'begleitung'    // nach Bewilligung: Verwendungsnachweis-/Zwischenbericht-
                    // Pruefung (VN/ZB-Stati) + Widerrufs-Verfahren (Widerruf,
                    // Anhoerung zum Widerruf). Andere Zustaendigkeit (ZTP/PFM)
                    // als die Antrags-Phase (TIB/BIB).
  | 'abgelehnt'     // negativ entschieden
  | 'abgeschlossen' // abgeschlossen (Schlussvermerk, abgebrochen, zurueckgezogen)
  | 'sonstige';     // Irrlaeufer, unvollstaendig, leer, unbekannt

const FOERDERANTRAG_STATUSES: ReadonlyArray<readonly [string, StatusCategory]> = [
  // Eingang
  ['beantragt', 'offen'],
  ['bearbeitungsreif', 'offen'],
  ['nl eingegangen', 'offen'],
  // Antrags-Pruefung (vor Bewilligung)
  ['techn geprüft', 'in_pruefung'],
  ['kaufm geprüft', 'in_pruefung'],
  ['gutachten fertig', 'in_pruefung'],
  // Begleitung (nach Bewilligung): Verwendungsnachweis-Pruefung + Widerrufs-
  // Verfahren. Pattern-Fallback unten matched zusaetzlich alle Stati die mit
  // "VN " oder "ZB " beginnen — neue VN-/ZB-Varianten muessen nicht zwingend
  // manuell gelistet werden. Widerruf-Stati gehoeren konzeptionell zur
  // Begleitphase (post-Bewilligungs-Verfahren, gleicher Lebenszyklus); sie
  // werden hier explizit gelistet, weil das VN-/ZB-Pattern sie nicht faengt.
  ['vn geprüft', 'begleitung'],
  ['vn techn. geprüft', 'begleitung'],
  ['widerruf', 'begleitung'],
  ['anhörung zum widerruf', 'begleitung'],
  // Entscheidungs-Vorbereitung + in-Process-Negativ-Entscheidungen
  // (pre-Bewilligung). Solange der Vorgang in Ablehnungsreif/Ruecknahme/
  // Widerspruch laeuft, ist er aktiv im Verfahren — NICHT final-abgelehnt.
  // Erst der abschliessende Status `abgelehnt/zurueckgezogen` (Kategorie
  // `abgeschlossen`) macht den negativen Ausgang final. Konsequenz:
  // `isOpenStatus` matched diese, `isClosedStatus` nicht. `isAbgelehntStatus`
  // (Bauantrag-Domain) matched sie ebenfalls nicht.
  ['bewilligungsreif', 'entscheidung'],
  ['bewilligungsentwurf vdi/vde-it', 'entscheidung'],
  ['ablehnungsreif', 'entscheidung'],
  ['ablehnung', 'entscheidung'],
  ['rücknahmeempfehlung', 'entscheidung'],
  ['stellungnahme zur rücknahmeempf.', 'entscheidung'],
  ['widerspruch zur ablehnung', 'entscheidung'],
  // Positiv (final)
  ['bewilligt', 'bewilligt'],
  // Nachforderung
  ['nf gestellt', 'nachforderung'],
  ['keine weiteren nf', 'nachforderung'],
  // Abgeschlossen (final — schliesst auch den negativ-finalen Pfad
  // `abgelehnt/zurueckgezogen` ein; Foerderantrag-Domain hat keinen
  // separaten `abgelehnt`-Endzustand).
  ['schlussvermerk', 'abgeschlossen'],
  ['beendet', 'abgeschlossen'],
  ['abgelehnt/zurückgezogen', 'abgeschlossen'],
  ['abgebrochen', 'abgeschlossen'],
  // Sonstige
  ['irrläufer', 'sonstige'],
  ['unvollständig', 'sonstige'],
];

const BAUANTRAG_STATUSES: ReadonlyArray<readonly [string, StatusCategory]> = [
  // Eingang
  ['neu', 'offen'],
  ['eingereicht', 'offen'],
  // Pruefung
  ['in_pruefung', 'in_pruefung'],
  ['in_begutachtung', 'in_pruefung'],
  ['in_bearbeitung', 'in_pruefung'],
  // Nachforderung
  ['nachforderung', 'nachforderung'],
  ['nachbesserung', 'nachforderung'],
  // Positiv (Bauantrag-Domain nennt es `genehmigt`, Foerderantrag-Domain
  // `bewilligt` — beide sind "positiv entschieden")
  ['genehmigt', 'bewilligt'],
  // Negativ (final, nur Bauantrag-Domain — bei Foerderantraegen geht der
  // negativ-finale Pfad ueber `abgelehnt/zurueckgezogen` in `abgeschlossen`)
  ['abgelehnt', 'abgelehnt'],
  // Abgeschlossen
  ['archiviert', 'abgeschlossen'],
  ['abgeschlossen', 'abgeschlossen'],
];

const CATEGORY_MAP: ReadonlyMap<string, StatusCategory> = (() => {
  const m = new Map<string, StatusCategory>();
  for (const [key, cat] of FOERDERANTRAG_STATUSES) m.set(key, cat);
  for (const [key, cat] of BAUANTRAG_STATUSES) m.set(key, cat);
  return m;
})();

/**
 * Status-System neu: optionaler Katalog-Snapshot. Ist er gesetzt, liest
 * `getStatusCategory` / `getStatusValuesByCategory` die kollabierte
 * `normalisiert(wert) → Kategorie`-Map aus dem kuratierten Katalog statt aus der
 * eingebauten `CATEGORY_MAP`. Ohne Snapshot (Tests, früher Boot, Flag aus) greift
 * die eingebaute Map — bei identischem Mapping bitweise gleiches Ergebnis.
 *
 * Einbahn-Abhängigkeit: NUR `src/core/status/snapshot.ts` ruft den Setter
 * (core/status → core/utils), damit kein Laufzeit-Zyklus entsteht.
 */
let snapshotMap: ReadonlyMap<string, StatusCategory> | null = null;

/** Setzt (oder löscht mit `null`) den Katalog-Snapshot. Siehe oben. */
export function setStatusKatalogSnapshotMap(m: ReadonlyMap<string, StatusCategory> | null): void {
  snapshotMap = m;
}

function effektiveMap(): ReadonlyMap<string, StatusCategory> {
  return snapshotMap ?? CATEGORY_MAP;
}

/** Alle eingebauten (normalisiert(Rohwert) → Kategorie)-Paare — Einzelquelle für
 *  den deterministischen Seed des Status-Katalogs. Liefert IMMER die eingebaute
 *  `CATEGORY_MAP` (nie den Snapshot): der Seed leitet SICH aus ihr ab. */
export function getCanonicalStatusEntries(): ReadonlyArray<readonly [string, StatusCategory]> {
  return [...CATEGORY_MAP.entries()];
}

function normalize(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim().toLowerCase();
  return t.length === 0 ? null : t;
}

/** Pattern fuer Begleit-Stati: Status-Werte die mit "VN " oder "ZB " (case-
 *  insensitive, gefolgt von Whitespace oder Punkt) beginnen, werden als
 *  Begleitung kategorisiert — auch wenn sie nicht explizit gelistet sind.
 *  Beispiele: "VN geprueft" (explizit + Pattern), "ZB eingegangen" (nur
 *  Pattern), "VN angefordert" (nur Pattern). */
const BEGLEITUNG_PATTERN = /^(vn|zb)[\s.]/;

/** Liefert alle bekannten Status-Werte einer Kategorie (lowercase, normalized).
 *  Wird vom Status-Quickfilter genutzt, um Chips auf Filter-Werte zu mappen.
 *  VN/ZB-Pattern-only-Stati (z.B. „VN angefordert") sind hier NICHT enthalten —
 *  der Filter arbeitet auf den explizit gelisteten Status-Werten. */
export function getStatusValuesByCategory(category: StatusCategory): string[] {
  const out: string[] = [];
  for (const [key, cat] of effektiveMap()) {
    if (cat === category) out.push(key);
  }
  return out;
}

/** Mappt einen rohen Status-Wert auf eine Kategorie. Lookup-Reihenfolge:
 *  1. Explizite Map (Foerderantrag + Bauantrag Stati)
 *  2. VN/ZB-Pattern → Begleitung
 *  3. Sonstige (unbekannt, leer) */
export function getStatusCategory(raw: unknown): StatusCategory {
  const key = normalize(raw);
  if (!key) return 'sonstige';
  const explicit = effektiveMap().get(key);
  if (explicit) return explicit;
  if (BEGLEITUNG_PATTERN.test(key)) return 'begleitung';
  return 'sonstige';
}

/** True, wenn der Antrag fachlich noch offen ist (nicht final entschieden).
 *  Schliesst Begleitung mit ein — ein Antrag in der VN/ZB-Pruefung ist noch
 *  nicht abgeschlossen, auch wenn er bereits bewilligt wurde. */
export function isOpenStatus(raw: unknown): boolean {
  const c = getStatusCategory(raw);
  return c === 'offen' || c === 'in_pruefung' || c === 'nachforderung'
    || c === 'entscheidung' || c === 'begleitung';
}

export function isInPruefungStatus(raw: unknown): boolean {
  return getStatusCategory(raw) === 'in_pruefung';
}

/** True wenn der Antrag in der Begleit-Phase ist (nach Bewilligung,
 *  vor Schlussvermerk: VN-/ZB-Pruefung). Andere Zustaendigkeit (ZTP/PFM). */
export function isBegleitungStatus(raw: unknown): boolean {
  return getStatusCategory(raw) === 'begleitung';
}

export function isNachforderungStatus(raw: unknown): boolean {
  return getStatusCategory(raw) === 'nachforderung';
}

export function isBewilligtStatus(raw: unknown): boolean {
  return getStatusCategory(raw) === 'bewilligt';
}

export function isAbgelehntStatus(raw: unknown): boolean {
  return getStatusCategory(raw) === 'abgelehnt';
}

/** True fuer final negativ ausgegangene Antraege: Foerderantrag
 *  `abgelehnt/zurückgezogen` (in der Map als Kategorie `abgeschlossen` gefuehrt,
 *  weil die Foerderantrag-Domain keinen separaten `abgelehnt`-Endzustand hat)
 *  ODER Bauantrag `abgelehnt` (Kategorie `abgelehnt`). Praeziser als
 *  `isClosedStatus` (das auch bewilligt + Schlussvermerk einschliesst) — fuer
 *  „wurde dieses Projekt schon einmal abgelehnt/zurueckgezogen?". */
export function isAbgelehntZurueckgezogenStatus(raw: unknown): boolean {
  if (getStatusCategory(raw) === 'abgelehnt') return true; // Bauantrag-Domain
  return normalize(raw) === 'abgelehnt/zurückgezogen';     // Foerderantrag-Domain
}

/** True, wenn final entschieden (bewilligt, abgelehnt, abgeschlossen). */
export function isClosedStatus(raw: unknown): boolean {
  const c = getStatusCategory(raw);
  return c === 'bewilligt' || c === 'abgelehnt' || c === 'abgeschlossen';
}

/**
 * Kategorien, deren Anträge als **terminal** (Arbeit abgeschlossen) gelten:
 * `abgeschlossen` (Schlussvermerk, beendet, abgebrochen, abgelehnt/zurückgezogen)
 * und `abgelehnt` (Bauantrag-Domain). Bewusst OHNE `bewilligt` — nach der
 * Bewilligung folgt noch die Begleitphase (VN/ZB), der Antrag ist also weiter
 * „in Arbeit". Einzelquelle für den Arbeitsvorrat/Archiv-Split (View „Alle")
 * und die PreCheck-Regeln in `naechsterSchritt`.
 */
export const TERMINAL_STATUS_CATEGORIES: ReadonlySet<StatusCategory> = new Set<StatusCategory>([
  'abgeschlossen',
  'abgelehnt',
]);

/** True für terminale Anträge (Kategorie `abgeschlossen` oder `abgelehnt`).
 *  Schlanker als `isClosedStatus` (das zusätzlich `bewilligt` einschließt). */
export function isTerminalStatus(raw: unknown): boolean {
  return TERMINAL_STATUS_CATEGORIES.has(getStatusCategory(raw));
}

/**
 * Kanonischer Sortier-Rang der Status-Kategorien entlang des Antrags-
 * Lebenszyklus (offen → Prüfung → … → abgeschlossen). Kleiner = früher im
 * Verfahren. Terminal-/Sonstige-Kategorien sinken ans Ende. Einzelquelle für
 * die Sortierung der kombinierten „Status und nächster Schritt"-Spalte —
 * ersetzt String-Literal-Vergleiche (Pitfall #12).
 */
const STATUS_CATEGORY_RANK: Record<StatusCategory, number> = {
  offen: 1,
  in_pruefung: 2,
  nachforderung: 3,
  entscheidung: 4,
  bewilligt: 5,
  begleitung: 6,
  abgeschlossen: 7,
  abgelehnt: 8,
  sonstige: 9,
};

/** Sortier-Rang eines rohen Status-Werts (1 = frühester Lebenszyklus-Schritt,
 *  9 = `sonstige`/unbekannt/leer). Basis für die Sortierung der kombinierten
 *  Status-Spalte; Sekundärschlüssel (Aktion) legt der Aufrufer an. */
export function statusRang(raw: unknown): number {
  return STATUS_CATEGORY_RANK[getStatusCategory(raw)];
}
