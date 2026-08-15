/**
 * Welche Antrags-Feld-Schluessel der Suchkorpus lesen muss — aufgeloest aus dem
 * CSV-Schema statt fest verdrahtet.
 *
 * Hintergrund (recurring-bug-classes #5, „Stumme Feature-Deaktivierung bei
 * abweichendem CSV-Mapping"): der Merger legt eine Spalte unter
 * `canonical ?? custom ?? spalte.toLowerCase()` ab
 * ([helpers.ts](src/core/services/csv/merger/helpers.ts)). Welcher Schluessel
 * das ist, entscheidet also der Kurator im Import-Wizard — nicht der Code. Wer
 * den Schluessel raet, verliert die Spalte lautlos, sobald jemand anders mappt.
 *
 * Genau das war passiert, am echten Bestand gemessen (Stand 2026-08, drei
 * aktive Quellen, 14 097 FKZ):
 *
 *  - `VB_INHALT` liegt unter `inhalt_kurzzusammenfassung`, der Korpus suchte
 *    `vb_inhalt` → die GESAMTE Projektbeschreibung fehlte im Suchindex
 *    (Quelle deckt 14 084 der 14 097 FKZ ab). Das Verbund-Detail hatte den
 *    Alias laengst nachgezogen, der Korpus nie.
 *  - `ORG_AST` liegt je Quelle unter DREI verschiedenen Schluesseln:
 *    `org_ast` (9052), `antragsteller_ast` (9097) und — als Kollision mit der
 *    kanonischen ausfuehrenden Stelle — `antragsteller` (7737).
 *
 * Deshalb wird hier ueber den Spalten-CODE aufgeloest. Gleiches Muster wie
 * [fb-status-felder.ts](src/core/services/csv/fb-status-felder.ts) und
 * [status-datum-gruppen.ts](src/core/services/csv/status-datum-gruppen.ts).
 *
 * Rein: keine IDB-Zugriffe, kein React — die Schemas laedt der Aufrufer.
 */
import { resolveFieldKey } from '@/core/services/csv/merger/helpers';
import type { CsvSchema } from '@/core/services/csv/types';
import { normalizeKey } from '../fieldLookup';

/** Die Textfelder des Korpus, die aus einer CSV-Spalte stammen. */
export type KorpusSlot =
  | 'vbTitel'
  | 'abstract'
  | 'akronym'
  | 'orgAfs'
  | 'orgAst'
  | 'ortAfs'
  | 'ortAst'
  | 'landAfs'
  | 'landAst'
  | 'emailPl'
  | 'netzwerk'
  | 'notizWichtig'
  | 'notizBemerkung'
  | 'wahlkreis'
  | 'nace';

/**
 * Spalten-CODES je Slot, in der REIHENFOLGE, in der sie ihren Schluessel
 * beanspruchen duerfen.
 *
 * Die Reihenfolge ist die Kollisions-Regel und kein Zufall: Quelle 7737 mappt
 * `ORG_AST` auf denselben Schluessel wie das kanonische `ORG_AFS`
 * (`antragsteller`). Wer beide Slots auf diesen Schluessel zeigen liesse,
 * verschlechterte die Suche gegenueber heute — gelesen wird der ERSTE passende
 * Schluessel, und der waere dann fuer beide Slots derselbe Wert. Die 2,5 % der
 * Saetze, in denen Rechtsperson und ausfuehrende Stelle auseinandergehen,
 * verloeren ihre zweite Organisation.
 *
 * Also: wer zuerst kommt, behaelt den Schluessel; der spaetere Slot verzichtet.
 * `ORG_AFS` steht vorn, weil es das kanonische Feld ist. Fuer die betroffene
 * Quelle heisst das: ihr `ORG_AST` bleibt unerreichbar — es ist im Store
 * ohnehin schon vom spaeter geschriebenen `ORG_AFS` ueberschrieben
 * ([single.ts](src/core/services/csv/merger/single.ts)).
 */
export const SPALTEN_CODES: Readonly<Record<KorpusSlot, readonly string[]>> = {
  vbTitel: ['VB_TITEL'],
  abstract: ['VB_INHALT'],
  akronym: ['VB_KURZNAM'],
  orgAfs: ['ORG_AFS'],
  orgAst: ['ORG_AST'],
  ortAfs: ['ORT_AFS'],
  ortAst: ['ORT_AST'],
  landAfs: ['BULAND_AFS', 'BL_AFS'],
  landAst: ['BULAND_AST', 'BL_AST'],
  emailPl: ['EMAIL_PL'],
  // Ab hier die v4.50-Felder. Alle vier standen laengst im Store und waren
  // trotzdem unauffindbar — der Korpus las sie nur nicht. Zahlen zur Deckung
  // stehen bei den Feldern selbst in `search-corpus.ts`.
  netzwerk: ['NETZWERKNA'],
  notizWichtig: ['T_YW'],
  notizBemerkung: ['T_HINT'],
  wahlkreis: ['WKNAAK_AFS'],
  nace: ['NACE_LANG'],
};

/**
 * Reihenfolge der Schluessel-Vergabe — siehe Kollisions-Regel oben. `ORG_AFS`
 * steht vor `ORG_AST`.
 *
 * Eine eigene Liste statt `Object.keys(SPALTEN_CODES)`, weil die Reihenfolge
 * hier eine ENTSCHEIDUNG ist und keine Schreibreihenfolge. Dass sie vollstaendig
 * bleibt, sichert `korpusFeldAufloesung.test.ts` — ein vergessener Slot bliebe
 * sonst ohne Feldmenge, und sein Korpus-Feld waere still leer.
 */
export const SLOT_REIHENFOLGE: readonly KorpusSlot[] = [
  'vbTitel', 'abstract', 'akronym',
  'orgAfs', 'orgAst',
  'ortAfs', 'ortAst', 'landAfs', 'landAst',
  'emailPl',
  'netzwerk', 'notizWichtig', 'notizBemerkung', 'wahlkreis', 'nace',
];

/** Normalisierte Schluessel-Kandidaten je Slot — Vorlage fuer das Umkehr-
 *  Verzeichnis, mit dem der Korpus jeden Record in EINEM Durchgang liest. */
export type KorpusFeldKarte = Readonly<Record<KorpusSlot, ReadonlySet<string>>>;

/**
 * Baut die Feldkarte aus den Schemas eines Programms.
 *
 * `basis` sind die bisherigen, fest verdrahteten Alias-Listen. Sie bleiben als
 * FALLBACK erhalten und werden nicht ersetzt: ein Programm ohne passendes
 * Schema (Dev-Fixtures, C16-Exporte mit Leerzeichen-Spaltennamen, Alt-Importe
 * ohne Mapping) muss weiter so suchen wie bisher. Aufgeloest wird additiv —
 * das Verhalten kann dadurch nirgends unter den heutigen Stand fallen.
 */
export function baueKorpusFeldKarte(
  schemas: readonly CsvSchema[],
  basis: KorpusFeldKarte,
): KorpusFeldKarte {
  const karte = {} as Record<KorpusSlot, ReadonlySet<string>>;
  // Schon vergebene Schluessel — siehe Kollisions-Regel bei `SLOT_CODES`.
  const vergeben = new Set<string>();

  for (const slot of SLOT_REIHENFOLGE) {
    const kandidaten = new Set<string>(basis[slot]);
    for (const key of aufgeloesteSchluessel(schemas, SPALTEN_CODES[slot])) kandidaten.add(key);

    const eigen = new Set<string>();
    for (const key of kandidaten) {
      if (vergeben.has(key)) continue;
      eigen.add(key);
    }
    for (const key of eigen) vergeben.add(key);
    karte[slot] = eigen;
  }

  return karte;
}

/** Alle Feld-Schluessel, unter denen diese Spalten-Codes im Store landen. */
function aufgeloesteSchluessel(
  schemas: readonly CsvSchema[],
  codes: readonly string[],
): string[] {
  const ziele = new Set(codes.map(normalizeKey));
  const out: string[] = [];
  for (const schema of schemas) {
    const mapping = schema.column_mapping ?? {};
    for (const col of Object.keys(mapping)) {
      if (!ziele.has(normalizeKey(col))) continue;
      const entry = mapping[col];
      if (!entry || entry.ignore) continue;
      const feld = resolveFieldKey(col, entry);
      if (feld) out.push(normalizeKey(feld));
    }
  }
  return out;
}
