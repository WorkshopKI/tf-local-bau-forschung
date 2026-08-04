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
  /** Nur für `duplikat`: Originalfeld. */
  dupOf?: string;
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
  { match: ['Gesamtkosten'], kind: 'duplikat', dupOf: 'beantragte Kosten' },
  { match: ['VB Beginn'], kind: 'duplikat', dupOf: 'TV Beginn' },
  { match: ['VB Ende'], kind: 'duplikat', dupOf: 'TV Ende' },
  { match: ['Org Ast', 'antragsteller_ast'], kind: 'duplikat', dupOf: 'Antragsteller' },
  { match: ['Buland Ast', 'buland_ast'], kind: 'duplikat', dupOf: 'Bundesland' },
  // AFS-Varianten duplizieren die AST-Adresse (Antragsteller-/Forschungsstelle gleicher Ort).
  { match: ['ort_afs', 'Ort (AFS)'], kind: 'duplikat', dupOf: 'Ort Antragsteller' },
  { match: ['plz_afs', 'PLZ (AFS)'], kind: 'duplikat', dupOf: 'PLZ (AST)' },
  { match: ['buland_afs', 'BL (AFS)'], kind: 'duplikat', dupOf: 'BL (AST)' },
  // ---- Rohfelder (technische Hilfs-/ID-Felder ohne fachlichen Anzeigewert) ----
  { match: ['Ddsid'], kind: 'roh' },
  { match: ['ZIM-Foyer Vorgangscode', 'ZIM Foyer Vorgangscode'], kind: 'roh' },
  { match: ['Akz', 'akz_intern'], kind: 'roh' },
  { match: ['Wahlkreisname (AFS)', 'Wahlkreisname AFS'], kind: 'roh' },
  { match: ['Wahlkreisnummer (AFS)', 'Wahlkreisnummer AFS'], kind: 'roh' },
];

/** Normalisierter Lookup-Index: Label-/Key-Token → Klassifikation. Einmalig gebaut. */
const INDEX: Map<string, FieldClassification> = (() => {
  const m = new Map<string, FieldClassification>();
  for (const e of KURATION) {
    const cls: FieldClassification = { admin: true, kind: e.kind, dupOf: e.dupOf };
    for (const token of e.match) m.set(normLabel(token), cls);
  }
  return m;
})();

const NORMAL: FieldClassification = { admin: false };

/**
 * Klassifiziert eine Feld-Row gegen die kuratierte Liste. Treffer über
 * normalisiertes Label ODER Feld-Key. Default ist immer `{ admin: false }` —
 * ohne Treffer bleibt das Feld sichtbar (nie still ausblenden).
 */
export function classifyField(row: DisplayRow): FieldClassification {
  return INDEX.get(normLabel(row.label)) ?? INDEX.get(normLabel(row.field)) ?? NORMAL;
}

/** Badge-Text für eine klassifizierte Row (oder `null`, wenn normal). */
export function adminBadgeLabel(cls: FieldClassification): string | null {
  if (!cls.admin) return null;
  return cls.kind === 'duplikat' ? 'Duplikat' : 'Roh';
}
