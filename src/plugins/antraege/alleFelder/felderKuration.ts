/**
 * Kuratierte Feld-Klassifikation für den „Relevant"-Filter (Hebel 4).
 *
 * **Bausteine = kuratierte App-Daten** (analog
 * `src/core/services/skills/registry/nf-bausteine.seed.ts`): diese Liste ist die
 * Quelle der Wahrheit dafür, welche Felder Duplikate (`duplikat`) bzw. technische
 * Rohfelder (`roh`) sind. Im „Relevant"-Tab werden sie ausgeblendet und tragen
 * sonst ein Badge. Das Team **erweitert die Liste laufend**, wenn neue
 * Duplikat-/Rohfelder auffallen — kein Generierungs-Schritt, keine Heuristik.
 *
 * Gematcht wird tolerant über das normalisierte **Label** ODER den Feld-**Key**
 * (Custom-Slugs sind import-abhängig, Labels stabiler — beide Welten abgedeckt):
 * - Echte C16-Labels (wie in den Screenshots / im Handoff benannt)
 * - Fixture-Keys (`docs/fixtures/schema-a.ts` etc.)
 */
import type { DisplayRow } from './buildDisplayRows';
import { normLabel } from './flags';

export type FieldKind = 'duplikat' | 'roh';

export interface FieldClassification {
  /** `true` ⇒ im „Relevant"-Tab ausgeblendet. */
  admin: boolean;
  kind?: FieldKind;
  /** Bei `duplikat`: Klartext-Name des Originalfelds, das diesen Wert bereits trägt. */
  dupOf?: string;
}

interface KurationEntry {
  /** Labels und/oder Feld-Keys (roh — werden hier normalisiert), die diese Klassifikation auslösen. */
  match: string[];
  kind: FieldKind;
  /** Nur für `duplikat`: Originalfeld (Klartext, für Badge-Tooltip). */
  dupOf?: string;
  /**
   * Nur für `duplikat`: Labels/Keys, unter denen das Originalfeld in derselben
   * Feldliste zu finden ist. Ohne Angabe wird `dupOf` selbst gesucht. Nötig,
   * wo der Klartext-Name nicht dem Feld-Label entspricht („beantragte Kosten"
   * heißt im Export „beantragte Kosten (Deckblatt Mantelbogen)").
   */
  dupQuelle?: string[];
}

/**
 * Seed aus den im Handoff (`felder-data.js`) benannten Beispielen + den
 * Fixture-Custom-Keys. Append-only erweitern, nicht umsortieren.
 */
const KURATION: KurationEntry[] = [
  // ---- Duplikate (Wert steht bereits in einem anderen Feld) ----
  { match: ['Netzwerk "Kurzname" FKZ_ZTP', 'Netzwerk Kurzname FKZ_ZTP'], kind: 'duplikat', dupOf: 'Netzwerk' },
  { match: ['Anz. erw. TV inkl. Assoz.'], kind: 'duplikat', dupOf: 'Anz. erw. TV' },
  { match: ['Attribut neuer Platz'], kind: 'duplikat', dupOf: 'Attribut' },
  {
    match: ['Gesamtkosten'], kind: 'duplikat', dupOf: 'beantragte Kosten',
    dupQuelle: ['beantragte Kosten', 'beantragte Kosten (Deckblatt Mantelbogen)', 'beantragte_kosten_deckblatt_mantelbogen'],
  },
  { match: ['VB Beginn'], kind: 'duplikat', dupOf: 'TV Beginn', dupQuelle: ['TV Beginn', 'tv_beginn'] },
  { match: ['VB Ende'], kind: 'duplikat', dupOf: 'TV Ende', dupQuelle: ['TV Ende', 'tv_ende'] },
  {
    match: ['Org Ast', 'antragsteller_ast'], kind: 'duplikat', dupOf: 'Antragsteller',
    dupQuelle: ['Antragsteller', 'antragsteller', 'Org Afs', 'org_afs'],
  },
  {
    match: ['Buland Ast', 'buland_ast'], kind: 'duplikat', dupOf: 'BL (AST)',
    dupQuelle: ['BL (AST)', 'bl_ast'],
  },
  // AFS-Varianten duplizieren die AST-Adresse (Antragsteller-/Forschungsstelle gleicher Ort).
  { match: ['ort_afs', 'Ort (AFS)'], kind: 'duplikat', dupOf: 'Ort Antragsteller', dupQuelle: ['Ort Antragsteller', 'Ort (AST)', 'ort_ast'] },
  { match: ['plz_afs', 'PLZ (AFS)'], kind: 'duplikat', dupOf: 'PLZ (AST)', dupQuelle: ['PLZ (AST)', 'plz_ast'] },
  { match: ['buland_afs', 'BL (AFS)'], kind: 'duplikat', dupOf: 'BL (AST)', dupQuelle: ['BL (AST)', 'bl_ast'] },
  // ---- Rohfelder (technische Hilfs-/ID-Felder ohne fachlichen Anzeigewert) ----
  { match: ['Ddsid'], kind: 'roh' },
  { match: ['ZIM-Foyer Vorgangscode', 'ZIM Foyer Vorgangscode'], kind: 'roh' },
  { match: ['Akz', 'akz_intern'], kind: 'roh' },
  { match: ['Wahlkreisname (AFS)', 'Wahlkreisname AFS'], kind: 'roh' },
  { match: ['Wahlkreisnummer (AFS)', 'Wahlkreisnummer AFS'], kind: 'roh' },
];

/** Normalisierter Lookup-Index: Label-/Key-Token → Kurations-Eintrag. Einmalig gebaut. */
const INDEX: Map<string, KurationEntry> = (() => {
  const m = new Map<string, KurationEntry>();
  for (const e of KURATION) {
    for (const token of e.match) m.set(normLabel(token), e);
  }
  return m;
})();

const NORMAL: FieldClassification = { admin: false };

/**
 * Werte-Verzeichnis eines Antrags: normalisiertes Label/Key → Anzeigewert.
 * Grundlage der Duplikat-PRÜFUNG (siehe `classifyField`).
 */
export type FelderWerte = ReadonlyMap<string, string>;

/** Baut das Werte-Verzeichnis über alle Feld-Zeilen eines Antrags. */
export function baueFelderWerte(rows: readonly DisplayRow[]): FelderWerte {
  const m = new Map<string, string>();
  for (const r of rows) {
    const v = r.value.trim();
    if (v.length === 0) continue;
    for (const token of [normLabel(r.label), normLabel(r.field)]) {
      if (token && !m.has(token)) m.set(token, v);
    }
  }
  return m;
}

/**
 * Klassifiziert eine Feld-Row gegen die kuratierte Liste. Treffer über
 * normalisiertes Label ODER Feld-Key. Default ist immer `{ admin: false }` —
 * ohne Treffer bleibt das Feld sichtbar (nie still ausblenden).
 *
 * **Duplikate werden am Wert geprüft, nicht behauptet** (v4.124): ein
 * `duplikat`-Eintrag blendet nur aus, wenn das Originalfeld in DIESEM Antrag
 * vorhanden ist und denselben Anzeigewert trägt. Ohne `werte` bleibt es beim
 * alten Verhalten (Behauptung genügt) — für Aufrufer, die keine Feldliste
 * haben. Grund: am echten Bestand stimmte die Behauptung reihenweise nicht
 * (z. B. „Gesamtkosten = beantragte Kosten" nur in 40 % der Sätze, das
 * Originalfeld fehlt in 6 120 ganz), und das Ausblenden kostete dann echte
 * Information statt Redundanz zu sparen.
 */
export function classifyField(row: DisplayRow, werte?: FelderWerte): FieldClassification {
  const e = INDEX.get(normLabel(row.label)) ?? INDEX.get(normLabel(row.field));
  if (!e) return NORMAL;
  if (e.kind === 'duplikat' && werte) {
    const eigen = row.value.trim();
    const quellen = e.dupQuelle ?? (e.dupOf ? [e.dupOf] : []);
    const trifft = eigen.length > 0
      && quellen.some(q => werte.get(normLabel(q)) === eigen);
    if (!trifft) return NORMAL;
  }
  return { admin: true, kind: e.kind, dupOf: e.dupOf };
}

/** Badge-Text für eine klassifizierte Row (oder `null`, wenn normal). */
export function adminBadgeLabel(cls: FieldClassification): string | null {
  if (!cls.admin) return null;
  return cls.kind === 'duplikat' ? 'Duplikat' : 'Roh';
}
