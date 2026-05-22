/**
 * Hybrid-Such-Korpora fuer das Antraege-Plugin.
 *
 * Zwei Hilfsstrukturen, die fuer die Hybrid-Suche (Substring auf CSV-Volltext
 * + Embedding-Match aus dem Auslastungs-Korpus + DMS-Index-Treffer) gebraucht
 * werden:
 *
 *  - `loadAntraegeTextCorpus` — projiziert den vollen `Antrag`-Record auf die
 *    drei suchrelevanten Text-Felder (`verbund_titel`, `titel`,
 *    `projektbeschreibung_text`) und cached zusaetzlich die lowercase-Variante
 *    (Substring-Match per Keystroke wird so von ~500 ms auf ~10–30 ms reduziert).
 *
 *  - `loadDmsFilenameToAkz` — Umkehr-Lookup fuer Phase-2-Treffer: Orama
 *    liefert pro Hit den `source`-Filename, wir wollen den `matched_antrag_id`
 *    (Aktenzeichen) wissen. Filter auf `triage_state === 'relevant'`.
 */
import type { IDBStore } from '@/core/services/storage/idb-store';
import { CSV_STORES } from '@/core/services/storage/idb-store';
import type { Antrag } from '@/core/services/csv/types';
import { listManifestEntries } from '@/phase2/scanner/manifest-store';
import { normalizeKey } from '../fieldLookup';
import { buildDescriptorsText } from './descriptor-text';

export interface AntragTextEntry {
  /** Verbund-Titel. */
  vb: string;
  /** Teilvorhaben-Titel (CSV-Spalte `titel`). */
  tv: string;
  /** Kurzbeschreibung / Abstract / VB-Inhalt. */
  abstract: string;
  /** Konkatenierte Deskriptor-Werte: TECHN/BRANCHE/ANWEND-Strings +
   *  Klartexte der gesetzten ZT-Flags. Siehe `descriptor-text.ts`. */
  descriptors: string;
  /** Pre-computed lowercase. Einmal beim Load berechnen, dann per Keystroke
   *  nur `.includes(q)` ohne neue String-Allokation. Wichtig fuer 13k-Korpora,
   *  sonst ~100 MB GC-Druck pro Keystroke. */
  vbLower: string;
  tvLower: string;
  absLower: string;
  descriptorsLower: string;
}

/**
 * Feld-Name-Kandidaten je Spalte. Der CSV-Merger
 * ([helpers.ts](src/core/services/csv/merger/helpers.ts)) speichert ein
 * Feld unter `entry.canonical ?? entry.custom ?? col.toLowerCase()`. Foyer
 * exportiert mit Leerzeichen im Spaltennamen (`VB INHALT`, `VB TITEL`) →
 * ohne Wizard-Mapping landet das als `'vb inhalt'` / `'vb titel'` (mit
 * Space, nicht Underscore). Wir gleichen deshalb gegen die NORMALISIERTE
 * Form (lowercase + alle Trenner raus) ab — gleicher Algorithmus wie
 * `findFieldValue` in `fieldLookup.ts`, der das im Detail-View erfolgreich
 * loest.
 *
 * Listen identisch zu `findFieldValue`-Aliasen in `TvDetailBlock.tsx`
 * plus die Canonical-Variante `projektbeschreibung_text`. Vorberechnete
 * Sets als Modul-Konstanten — der Cursor-Walk macht 13 k × 2 Lookups,
 * Re-Hashing der Kandidaten pro Eintrag waere Verschwendung.
 */
const VB_TITEL_NORMALIZED: ReadonlySet<string> = new Set(
  ['verbund_titel', 'vb_titel', 'vb titel'].map(normalizeKey),
);
const ABSTRACT_NORMALIZED: ReadonlySet<string> = new Set(
  [
    'projektbeschreibung_text',
    'vb_inhalt', 'vb inhalt',
    'vorhaben_inhalt', 'vorhabeninhalt',
    'kurzbeschreibung', 'beschreibung', 'inhalt',
  ].map(normalizeKey),
);

function pickByNormalized(
  record: Record<string, unknown>,
  targets: ReadonlySet<string>,
): string {
  for (const key of Object.keys(record)) {
    if (key.startsWith('_')) continue;
    const v = record[key];
    if (typeof v !== 'string' || v.length === 0) continue;
    if (targets.has(normalizeKey(key))) return v;
  }
  return '';
}

export interface LoadCorpusOptions {
  /** Cancel-Signal fuer lange Laufzeiten (Programm-Switch). */
  signal?: AbortSignal;
  /** Wenn `true`, kommen auch Antraege ohne jeglichen Text in die Map
   *  (mit leeren Strings). Default `false` — die Hybrid-Suche braucht keine
   *  Eintraege ohne Text, der XLSX-Export aber schon (sonst Lücken in der
   *  FKZ-Spalte). */
  includeEmpty?: boolean;
}

/**
 * Laedt den vollen Antrag-Store fuer das aktive Programm und projiziert auf
 * die drei suchrelevanten Strings. Default: nur Antraege mit mindestens einem
 * nicht-leeren Feld kommen in die Map. Mit `includeEmpty: true` werden auch
 * leere Eintraege geliefert (fuer den Export, wo jede gelistete Akz eine
 * Zeile braucht).
 *
 * Statt `index.getAll` (liefert ~500 MB Structured-Clone in einem Stoss und
 * blockiert den Main-Thread mehrere Sekunden) iterieren wir den Index mit
 * einem Cursor. Chrome liefert die Records inkrementell, der Peak-Speicher
 * bleibt bei ~36 KB pro Schritt, und es gibt keine langen Sync-Blocker mehr
 * — der Browser kann zwischen Cursor-Steps Frames rendern.
 */
export async function loadAntraegeTextCorpus(
  idb: IDBStore,
  programmId: string,
  opts: LoadCorpusOptions = {},
): Promise<Map<string, AntragTextEntry>> {
  const { signal, includeEmpty = false } = opts;
  const db = idb.getDb();
  const result = new Map<string, AntragTextEntry>();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(CSV_STORES.ANTRAEGE, 'readonly');
    const idx = tx.objectStore(CSV_STORES.ANTRAEGE).index('programm_id');
    const req = idx.openCursor(IDBKeyRange.only(programmId));
    req.onsuccess = () => {
      if (signal?.aborted) { resolve(); return; }
      const cursor = req.result;
      if (!cursor) { resolve(); return; }
      const a = cursor.value as Antrag;
      const rec = a as unknown as Record<string, unknown>;
      const vb = pickByNormalized(rec, VB_TITEL_NORMALIZED);
      const tv = typeof a.titel === 'string' ? a.titel : '';
      const ab = pickByNormalized(rec, ABSTRACT_NORMALIZED);
      const descriptors = buildDescriptorsText(a);
      if (includeEmpty || vb.length > 0 || tv.length > 0 || ab.length > 0 || descriptors.length > 0) {
        result.set(a.aktenzeichen, {
          vb,
          tv,
          abstract: ab,
          descriptors,
          vbLower: vb.toLowerCase(),
          tvLower: tv.toLowerCase(),
          absLower: ab.toLowerCase(),
          descriptorsLower: descriptors.toLowerCase(),
        });
      }
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
    tx.onerror = () => reject(tx.error);
  });
  return result;
}

/**
 * Filename → Aktenzeichen fuer alle relevanten Phase-2-Manifest-Eintraege.
 * Wird einmal pro Plugin-Mount geladen; Konsumenten (DMS-Index-Suche) lookup'en
 * pro Orama-Hit ihren `source`-Filename, um auf den zugehoerigen Antrag zu
 * mappen.
 *
 * Filter: nur Eintraege mit `triage_state === 'relevant'` und gesetztem
 * `matched_antrag_id`. Irrelevante Dokumente oder Orphans bleiben aussen vor.
 *
 * Liefert leere Map wenn der Manifest-Store leer ist (keine Phase-2-Daten).
 */
export async function loadDmsFilenameToAkz(idb: IDBStore): Promise<Map<string, string>> {
  const entries = await listManifestEntries(idb);
  const result = new Map<string, string>();
  for (const e of entries) {
    if (e.triage_state !== 'relevant') continue;
    if (typeof e.matched_antrag_id !== 'string' || e.matched_antrag_id.length === 0) continue;
    result.set(e.filename, e.matched_antrag_id);
  }
  return result;
}
