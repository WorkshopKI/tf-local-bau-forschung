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
  | 'nace'
  | 'verbundNr'
  | 'akzC16';

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
  // Die beiden Kennzeichen (v4.53). `VB_NUMMER` ist in allen drei Quellen auf
  // das kanonische `verbund_id` gemappt, `AKZ` auf die Custom-Spalte `akz` —
  // beide standen im Store und waren trotzdem nicht auffindbar.
  verbundNr: ['VB_NUMMER'],
  akzC16: ['AKZ'],
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
  'verbundNr', 'akzC16',
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
  const mehrdeutig = mehrdeutigeSchluessel(schemas);

  for (const slot of SLOT_REIHENFOLGE) {
    const kandidaten = new Set<string>(basis[slot]);
    for (const key of aufgeloesteSchluessel(schemas, SPALTEN_CODES[slot])) {
      if (mehrdeutig.has(key)) continue;
      kandidaten.add(key);
    }

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

/**
 * Schluessel, auf die MEHRERE Spalten desselben Schemas zeigen — und die
 * deshalb nichts Verlaessliches mehr tragen.
 *
 * Am Bestand gemessen: das Schema `7737-bgl` wirft `PLZ_AFS`, `ORT_AFS` und
 * `BULAND_AFS` gemeinsam auf `ausfuhrende_stelle` (Artefakt der Label-XLS-
 * Gruppierung — alle drei tragen die Gruppenbeschriftung „ausfuehrende Stelle").
 * Der Import schreibt Spalte fuer Spalte, die letzte gewinnt: im Store steht das
 * BUNDESLAND-Kuerzel. Weil `SLOT_REIHENFOLGE` den Ort vor dem Land bedient,
 * las der Korpus „SN" als Ortsnamen und bot ihn in der Vorschlagsliste unter
 * `ort:` an (1 508 Antraege, v4.81).
 *
 * Solche Schluessel werden fuer KEINEN Slot vergeben. Die Sperre gilt nur fuer
 * die schema-aufgeloesten Zugaenge, nie fuer die fest verdrahtete `basis`:
 * `antragsteller` ist in 7737 ebenfalls doppelt belegt (`ORG_AST` + `ORG_AFS`),
 * kommt aber ueber die Basis herein und bleibt deshalb erhalten — sonst verloere
 * die Einrichtungs-Suche ihr Feld fuer alle Quellen.
 *
 * Repariert wird der Datenschaden damit nicht: die betroffene Quelle liefert
 * ihren Ort erst wieder, wenn ihr Mapping im CSV-Wizard auf getrennte Schluessel
 * gestellt und neu importiert wird.
 */
function mehrdeutigeSchluessel(schemas: readonly CsvSchema[]): ReadonlySet<string> {
  const out = new Set<string>();
  for (const schema of schemas) {
    const mapping = schema.column_mapping ?? {};
    const zaehler = new Map<string, number>();
    for (const col of Object.keys(mapping)) {
      const entry = mapping[col];
      if (!entry || entry.ignore) continue;
      const feld = resolveFieldKey(col, entry);
      if (!feld) continue;
      const key = normalizeKey(feld);
      zaehler.set(key, (zaehler.get(key) ?? 0) + 1);
    }
    for (const [key, n] of zaehler) if (n > 1) out.add(key);
  }
  return out;
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
