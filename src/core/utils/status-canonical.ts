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
  | 'begleitung'    // nach Bewilligung, vor Schlussvermerk: Verwendungsnachweis-/
                    // Zwischenbericht-Pruefung (VN/ZB-Stati). Andere Zustaendigkeit
                    // (ZTP/PFM) als die Antrags-Phase (TIB/BIB).
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
  // Begleitung (nach Bewilligung): Verwendungsnachweis-Pruefung.
  // Pattern-Fallback unten matched zusaetzlich alle Stati die mit "VN " oder
  // "ZB " beginnen — neue VN-/ZB-Varianten muessen nicht zwingend manuell
  // gelistet werden.
  ['vn geprüft', 'begleitung'],
  ['vn techn. geprüft', 'begleitung'],
  // Entscheidungs-Vorbereitung + in-Process-Negativ-Entscheidungen.
  // Solange der Vorgang in Widerruf/Anhoerung/Ablehnungsreif laeuft, ist er
  // aktiv im Verfahren — NICHT final-abgelehnt. Erst der abschliessende
  // Status `abgelehnt/zurueckgezogen` (Kategorie `abgeschlossen`) macht den
  // negativen Ausgang final. Konsequenz: `isOpenStatus` matched diese,
  // `isClosedStatus` nicht. `isAbgelehntStatus` (Bauantrag-Domain) matched
  // sie ebenfalls nicht.
  ['bewilligungsreif', 'entscheidung'],
  ['bewilligungsentwurf vdi/vde-it', 'entscheidung'],
  ['ablehnungsreif', 'entscheidung'],
  ['ablehnung', 'entscheidung'],
  ['widerruf', 'entscheidung'],
  ['anhörung zum widerruf', 'entscheidung'],
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

/** Mappt einen rohen Status-Wert auf eine Kategorie. Lookup-Reihenfolge:
 *  1. Explizite Map (Foerderantrag + Bauantrag Stati)
 *  2. VN/ZB-Pattern → Begleitung
 *  3. Sonstige (unbekannt, leer) */
export function getStatusCategory(raw: unknown): StatusCategory {
  const key = normalize(raw);
  if (!key) return 'sonstige';
  const explicit = CATEGORY_MAP.get(key);
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

/** True, wenn final entschieden (bewilligt, abgelehnt, abgeschlossen). */
export function isClosedStatus(raw: unknown): boolean {
  const c = getStatusCategory(raw);
  return c === 'bewilligt' || c === 'abgelehnt' || c === 'abgeschlossen';
}
