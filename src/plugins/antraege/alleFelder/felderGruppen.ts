/**
 * Kuratierte Feld→Gruppe-Zuordnung für die „Alle Felder"-Ansicht (Hebel: saubere
 * Akkordeon-Gruppen wie im Handoff).
 *
 * **Warum kuratiert:** Die Gruppierung kommt sonst allein aus dem CSV-Schema-
 * `group_path` (siehe `groupDisplayRows`). Der echte C16-Label-XLS lumpt aber
 * ~36 Felder unter EINE Kategorie „Vorhabensinformation" und kennt keine
 * sauberen „Finanzen"/„Termine"/„Klassifikation"-Gruppen. Das SOLL (Design-
 * Handoff `_design/handoff/alle-felder/felder-data.js` `FIELD_GROUPS`) re-
 * bucketiert die Felder in fünf Lesegruppen. Diese Tabelle ist die Quelle der
 * Wahrheit dafür — **kuratierte App-Daten**, append-only erweitern (analog
 * [felderKuration.ts]).
 *
 * Gematcht wird tolerant über das normalisierte **Label** ODER den Feld-**Key**
 * (canonical-Keys sind stabil, C16-Labels stabiler als import-abhängige
 * Custom-Slugs — beide Welten abgedeckt). Reines Exact-Match (keine Keyword-
 * Heuristik — `normLabel("Kosten")` enthält z.B. „ost", Substring-Regeln wären
 * fehleranfällig).
 *
 * **Flag-Felder bleiben ausgespart** (`zt_*` / boolean Technologie-Kennzeichen):
 * die hebt der Flag-Cluster (`flags.ts` / `AlleFelderSection`) ohnehin aus jeder
 * Gruppe heraus — hier `null` zurückgeben, damit sie nicht doppelt einsortiert
 * werden.
 */
import type { DisplayRow } from './buildDisplayRows';
import { normLabel } from './flags';

/** SOLL-Reihenfolge der kuratierten Lesegruppen (Handoff). Technologie-Kennzeichen
 *  (Flag-Cluster) + „Weitere Felder" werden von `groupDisplayRows`/`AlleFelderSection`
 *  separat hinten einsortiert. */
export const GRUPPEN_ORDER: string[] = [
  'Vorhabensinformation',
  'Finanzen',
  'Termine',
  'Nachforderung',
  'Klassifikation & Deskriptoren',
];

interface GruppenEntry {
  gruppe: string;
  /** Labels und/oder Feld-Keys (roh — werden hier normalisiert). Quelle: Handoff
   *  `FIELD_GROUPS` + canonical-Keys aus `@/core/services/csv/constants`. */
  match: string[];
}

const GRUPPEN: GruppenEntry[] = [
  {
    gruppe: 'Vorhabensinformation',
    match: [
      'akronym', 'Akronym',
      'verbund_id', 'Verbund-ID',
      'vb_phase', 'VB-Phase',
      'unterprogramm_id', 'Unterprogramm-ID',
      'netzwerkname', 'Netzwerk',
      'Netzwerk "Kurzname" FKZ_ZTP',
      'nat_zuord', 'nationale Zuordnung',
      'Projektform',
      'Anz. erw. TV',
      'Anz. erw. TV inkl. Assoz.',
      'Attribut',
      'Attribut neuer Platz',
      'Attribut Kurzfassung',
      't_hint', 'Bemerkung',
    ],
  },
  {
    gruppe: 'Finanzen',
    match: [
      'beantragte Kosten (Deckblatt Mantelbogen)', 'beantragte Kosten',
      'Gesamtkosten',
      'VerbundBilanz laut Anlage 1',
      'VerbundUmsatz laut Anlage 1',
      'Mitarbeiter Anzahl Anlage 1',
      'Anzahl der Mitarbeiter (Mantelbogen)',
      'Anzahl JAE',
      'Auszahlungen',
      'Aktuelle Zuwendung',
      'Zuwendung Bewilligung',
      'foerdersumme', 'Fördersumme',
    ],
  },
  {
    gruppe: 'Termine',
    match: [
      'antragsdatum', 'Antragsdatum',
      'Eingangsbestätigung an Ast',
      'Antrag in C16 eingestellt',
      'Antragsimport aus ZIM-Foyer',
      'alle Anträge da',
      'alle Anträge in C16 eingegeben',
      'Termin Vollständigkeit Verbund',
      'laufzeitbeginn', 'TV Beginn',
      'laufzeitende', 'TV Ende',
      'VB Beginn',
      'VB Ende',
      'frist_datum', 'Fristdatum',
    ],
  },
  {
    gruppe: 'Nachforderung',
    match: [
      'alle erforderlichen Nachforderungen sind fertig (AB/FB)',
      'NF an ASt',
      'Brief NF von BB angelegt/ergänzt',
      'Brief NF von TB angelegt/ergänzt',
      'TB ohne (weitere) Nachforderungen',
      'Nachlieferung Eingang',
      'Termin für Nachlieferung',
      'pre-check positiv',
    ],
  },
  {
    gruppe: 'Klassifikation & Deskriptoren',
    match: [
      'NACE-Code (FuE) Organisationsebene', 'NACE-Code',
      'Zuordnung GRW-Gebiet 2014–2021', 'Zuordnung GRW-Gebiet',
      'Ost(nBL)/West(aBL)',
      'Ddsid',
      'Gründungsjahr – Antragsebene', 'Gründungsjahr - Antragsebene', 'Gründungsjahr',
    ],
  },
];

/** Normalisierter Lookup-Index: Label-/Key-Token → Gruppenname. Einmalig gebaut. */
const INDEX: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const e of GRUPPEN) {
    for (const token of e.match) m.set(normLabel(token), e.gruppe);
  }
  return m;
})();

/**
 * Kuratierte Ziel-Gruppe einer Feld-Row, oder `null`:
 * - `null` für Flag-Felder (`zt_*`) → bleiben dem Flag-Cluster überlassen.
 * - `null`, wenn das Feld nicht kuratiert ist → Aufrufer fällt auf den Schema-
 *   `group_path` (bzw. „Weitere Felder") zurück.
 */
export function kuratierteGruppe(row: DisplayRow): string | null {
  if (row.field.startsWith('zt_')) return null;
  return INDEX.get(normLabel(row.label)) ?? INDEX.get(normLabel(row.field)) ?? null;
}
