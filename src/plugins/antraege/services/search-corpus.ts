/**
 * Hybrid-Such-Korpora fuer das Antraege-Plugin.
 *
 * Zwei Hilfsstrukturen, die fuer die Hybrid-Suche (Substring auf CSV-Volltext
 * + Embedding-Match aus dem Auslastungs-Korpus + DMS-Index-Treffer) gebraucht
 * werden:
 *
 *  - `loadAntraegeTextCorpus` — projiziert den vollen `Antrag`-Record auf die
 *    drei suchrelevanten Text-Felder (`verbund_titel`, `titel`,
 *    `projektbeschreibung_text`). Liegt im RAM des aktiven Programms.
 *
 *  - `loadDmsFilenameToAkz` — Umkehr-Lookup fuer Phase-2-Treffer: Orama
 *    liefert pro Hit den `source`-Filename, wir wollen den `matched_antrag_id`
 *    (Aktenzeichen) wissen. Filter auf `triage_state === 'relevant'`.
 */
import type { IDBStore } from '@/core/services/storage/idb-store';
import { listAntraegeByProgramm } from '@/core/services/csv/idb-csv';
import { listManifestEntries } from '@/phase2/scanner/manifest-store';

export interface AntragTextEntry {
  /** Verbund-Titel (CSV-Spalte `verbund_titel`, fuer Master-Records). */
  vb: string;
  /** Teilvorhaben-Titel (CSV-Spalte `titel`). */
  tv: string;
  /** Kurzbeschreibung / Abstract (CSV-Spalte `projektbeschreibung_text`). */
  abstract: string;
}

/**
 * Laedt den vollen Antrag-Store fuer das aktive Programm und projiziert auf
 * die drei suchrelevanten Strings. Nur Antraege mit mindestens einem nicht-
 * leeren Feld kommen in die Map.
 *
 * Kosten: einmaliger structured-clone-Roundtrip ueber den vollen Store
 * (~36 KB × Antrags-Anzahl). Bei 13k Antraegen ~500 MB serialisiertes JSON
 * im Worst-Case, GC raeumt direkt nach der Projektion. Typische Laufzeit
 * 1–3 s — akzeptabel, weil einmalig pro Programm-Switch.
 */
export async function loadAntraegeTextCorpus(
  idb: IDBStore,
  programmId: string,
): Promise<Map<string, AntragTextEntry>> {
  const all = await listAntraegeByProgramm(idb, programmId);
  const result = new Map<string, AntragTextEntry>();
  for (const a of all) {
    const vb = typeof a.verbund_titel === 'string' ? a.verbund_titel : '';
    const tv = typeof a.titel === 'string' ? a.titel : '';
    const abstract = typeof a.projektbeschreibung_text === 'string' ? a.projektbeschreibung_text : '';
    if (vb.length > 0 || tv.length > 0 || abstract.length > 0) {
      result.set(a.aktenzeichen, { vb, tv, abstract });
    }
  }
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
