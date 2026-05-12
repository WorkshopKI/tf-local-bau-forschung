/**
 * Kanonische Status-Kategorien fuer Antrag-Status.
 *
 * Die App haelt zwei Welten von Status-Werten parallel:
 * - Welt A (Snake-Case Seed-Werte): `eingereicht`, `in_pruefung`, `genehmigt`, `bewilligt`,
 *   `nachforderung`, `nachbesserung`, ... — kommen aus den Seed-Fixtures.
 * - Welt B (CSV-Rohwerte aus dem Forschungsfoerderungs-Quellsystem): `beantragt`,
 *   `bearbeitungsreif`, `VN geprueft`, `NF gestellt`, `Schlussvermerk`,
 *   `abgelehnt/zurueckgezogen`, ... — kommen aus echten CSV-Importen.
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
  | 'in_pruefung'   // wird gerade geprueft (VN, techn, kaufm, Gutachten)
  | 'nachforderung' // wartet auf Nachforderung
  | 'entscheidung'  // Entscheidungs-Vorbereitung (bewilligungsreif, ablehnungsreif, ...)
  | 'bewilligt'     // positiv entschieden
  | 'abgelehnt'     // negativ entschieden
  | 'abgeschlossen' // abgeschlossen (Schlussvermerk, abgebrochen, zurueckgezogen)
  | 'sonstige';     // Irrlaeufer, unvollstaendig, leer, unbekannt

const WELT_B: ReadonlyArray<readonly [string, StatusCategory]> = [
  // Eingang
  ['beantragt', 'offen'],
  ['bearbeitungsreif', 'offen'],
  ['nl eingegangen', 'offen'],
  // Pruefung
  ['vn geprüft', 'in_pruefung'],
  ['vn techn. geprüft', 'in_pruefung'],
  ['techn geprüft', 'in_pruefung'],
  ['kaufm geprüft', 'in_pruefung'],
  ['gutachten fertig', 'in_pruefung'],
  // Entscheidungs-Vorbereitung
  ['bewilligungsreif', 'entscheidung'],
  ['bewilligungsentwurf vdi/vde-it', 'entscheidung'],
  ['ablehnungsreif', 'entscheidung'],
  ['anhörung zum widerruf', 'entscheidung'],
  ['rücknahmeempfehlung', 'entscheidung'],
  ['stellungnahme zur rücknahmeempf.', 'entscheidung'],
  ['widerspruch zur ablehnung', 'entscheidung'],
  // Positiv
  ['bewilligt', 'bewilligt'],
  // Negativ
  ['ablehnung', 'abgelehnt'],
  ['widerruf', 'abgelehnt'],
  // Nachforderung
  ['nf gestellt', 'nachforderung'],
  ['keine weiteren nf', 'nachforderung'],
  // Abgeschlossen
  ['schlussvermerk', 'abgeschlossen'],
  ['beendet', 'abgeschlossen'],
  ['abgelehnt/zurückgezogen', 'abgeschlossen'],
  ['abgebrochen', 'abgeschlossen'],
  // Sonstige
  ['irrläufer', 'sonstige'],
  ['unvollständig', 'sonstige'],
];

const WELT_A: ReadonlyArray<readonly [string, StatusCategory]> = [
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
  // Positiv (Welt A nennt es `genehmigt`, Welt B `bewilligt` — beide sind "positiv entschieden")
  ['genehmigt', 'bewilligt'],
  // Negativ
  ['abgelehnt', 'abgelehnt'],
  // Abgeschlossen
  ['archiviert', 'abgeschlossen'],
  ['abgeschlossen', 'abgeschlossen'],
];

const CATEGORY_MAP: ReadonlyMap<string, StatusCategory> = (() => {
  const m = new Map<string, StatusCategory>();
  for (const [key, cat] of WELT_B) m.set(key, cat);
  for (const [key, cat] of WELT_A) m.set(key, cat);
  return m;
})();

function normalize(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim().toLowerCase();
  return t.length === 0 ? null : t;
}

/** Mappt einen rohen Status-Wert (Welt A oder Welt B) auf eine Kategorie.
 *  Unbekannte oder leere Werte → `'sonstige'`. */
export function getStatusCategory(raw: unknown): StatusCategory {
  const key = normalize(raw);
  if (!key) return 'sonstige';
  return CATEGORY_MAP.get(key) ?? 'sonstige';
}

/** True, wenn der Antrag fachlich noch offen ist (nicht final entschieden). */
export function isOpenStatus(raw: unknown): boolean {
  const c = getStatusCategory(raw);
  return c === 'offen' || c === 'in_pruefung' || c === 'nachforderung' || c === 'entscheidung';
}

export function isInPruefungStatus(raw: unknown): boolean {
  return getStatusCategory(raw) === 'in_pruefung';
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

/** True, wenn final entschieden (bewilligt, abgelehnt, abgeschlossen). */
export function isClosedStatus(raw: unknown): boolean {
  const c = getStatusCategory(raw);
  return c === 'bewilligt' || c === 'abgelehnt' || c === 'abgeschlossen';
}
