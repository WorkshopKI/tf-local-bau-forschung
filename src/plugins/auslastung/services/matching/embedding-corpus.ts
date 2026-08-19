/**
 * Auslastungs-Wrapper um den generischen Embedding-Korpus.
 *
 * Schmale Antrag-spezifische Schicht ueber `@/core/services/embedding-corpus`:
 *  - Antrag → Embedding-Text-Mapping (welche Felder fliessen ins Embedding)
 *  - Build-Pipeline, die diesen Mapper + den generischen IDB-Cache nutzt
 *
 * Generische Operationen (IDB-CRUD, SMB-Mirror, Modell-Init) leben in core.
 * Die historischen IDB-Prefixe + SMB-Pfade (`auslastung-*`) bleiben dort
 * unveraendert — siehe core/services/embedding-corpus/storage.ts.
 */
import type { IDBStore } from '@/core/services/storage/idb-store';
import type { Antrag } from '@/core/services/csv/types';
import { CANONICAL_TITEL } from '../../types';
import {
  storeEmbedding,
  listEmbeddingKeys,
  countEmbeddings,
  ensureEmbeddingReady,
  embedText,
  aktuelleKorpusSignatur,
  ladeKorpusSignatur,
  merkeKorpusSignatur,
  signaturenGleich,
  signaturText,
} from '@/core/services/embedding-corpus';
import { buildDescriptorsText } from '@/plugins/antraege/services/descriptor-text';
import {
  baueKorpusFeldKarte, baueSlotIndex, leseSlots, KORPUS_BASIS,
  type KorpusSlot,
} from '@/plugins/antraege/services/korpusFeldAufloesung';
import { listSchemasByProgramm } from '@/core/services/csv/idb-csv';

/**
 * Unter welchem Schluessel die Textfelder eines Antrags im Store liegen —
 * aufgeloest aus dem CSV-Schema, nicht geraten.
 *
 * Dasselbe Verzeichnis, das der Wortlaut-Korpus benutzt
 * ([korpusFeldAufloesung.ts](src/plugins/antraege/services/korpusFeldAufloesung.ts)).
 */
export type EmbeddingFeldIndex = ReadonlyMap<string, KorpusSlot>;

/**
 * Baut das Verzeichnis fuer ein Programm. Einmal je Lauf — nicht je Antrag.
 *
 * Faellt auf die fest verdrahtete Basis zurueck, wenn kein Schema da ist
 * (Dev-Fixtures, Alt-Importe ohne Mapping); das Verhalten kann dadurch nirgends
 * unter den heutigen Stand fallen.
 */
export async function ladeEmbeddingFeldIndex(
  idb: IDBStore,
  programmId: string | null,
): Promise<EmbeddingFeldIndex> {
  const schemas = programmId
    ? await listSchemasByProgramm(idb, programmId).catch(() => [])
    : [];
  return baueSlotIndex(baueKorpusFeldKarte(schemas, KORPUS_BASIS));
}

/** Verzeichnis ohne Schema — nur die fest verdrahteten Alias-Listen. Fuer
 *  Aufrufer ohne Programm-Bezug (Tests, Einzel-Embedding einer Frage). */
export function embeddingFeldIndexOhneSchema(): EmbeddingFeldIndex {
  return baueSlotIndex(baueKorpusFeldKarte([], KORPUS_BASIS));
}

/**
 * Erzeugt den Embedding-Text fuer einen Antrag. Reihenfolge: VB-Titel,
 * Titel, Projektbeschreibung, Deskriptoren (TECHN/BRANCHE/ANWEND + ZT-Klartexte).
 *
 * **Die Quell-Schluessel werden AUFGELOEST, nicht geraten** (v4.113). Vorher las
 * diese Funktion `verbund_titel`, `titel` und `projektbeschreibung_text` hart —
 * und am echten Bestand (14 225 Antraege, Schema `9052-prjbsp`) war davon genau
 * einer gefuellt:
 *
 * | Schluessel | gefuellt |
 * |---|---|
 * | `projektbeschreibung_text` | **0 von 14 225** (existiert in keinem Record) |
 * | `verbund_titel` | **0 von 14 225** |
 * | `titel` | 14 220 |
 * | `inhalt_kurzzusammenfassung` — *hier steht der Inhalt* | **9 259**, Median 834 Zeichen |
 *
 * Der Vektor eines Vorhabens kannte damit nur seinen Titel und die Deskriptoren
 * (Einbettungstext im Median 147 Zeichen), waehrend die WORTLAUT-Stufe denselben
 * Inhalt in 9 259 Faellen sah. Eine Suche nach „Verfahren zur Kadaversuche aus
 * der Luft" konnte den Antrag `16DS250121` nicht finden, obwohl er genau das
 * ueber 1 131 Zeichen beschreibt — kein Wort davon stand im Titel.
 *
 * Es ist wortgleich die Bug-Klasse, die fuer den Wortlaut-Korpus mit v4.42
 * behoben wurde (recurring-bug-classes Klasse 5): welcher Schluessel es wird,
 * entscheidet das Wizard-Mapping, nicht der Code.
 *
 * Der Titel bleibt VORN. Gemessen (40 Antraege, vier Fassungen): nimmt man den
 * Inhalt auf und laesst den Titel weg, sinkt die Trefferquote fuer
 * Titel-Anfragen von 40/40 auf 24/40 — wer den Inhalt aufnimmt, darf den Titel
 * nicht aus dem Text verdraengen.
 */
export function buildEmbeddingTextForAntrag(
  antrag: Antrag,
  felder: EmbeddingFeldIndex,
): string {
  const slots = leseSlots(antrag as unknown as Record<string, unknown>, felder);
  const fields = [
    slots.vbTitel,
    (antrag as unknown as Record<string, unknown>)[CANONICAL_TITEL],
    slots.abstract,
    buildDescriptorsText(antrag),
  ];
  const parts: string[] = [];
  for (const f of fields) {
    if (typeof f === 'string' && f.trim()) parts.push(f.trim());
  }
  return parts.join(' \n ').slice(0, 4000); // cap fuer Modell-Token-Limit
}

/**
 * True wenn ein Antrag genug Text-Daten fuer ein Embedding hat. Identische
 * Bedingung wie im Build-Loop ({@link buildEmbeddingCorpus}, der ohne Text
 * skipt). Wird in der UI gebraucht, damit Drift-Detection (lokaler Hash vs.
 * Share-Manifest-Hash) nur ueber die tatsaechlich embedbaren Akz rechnet —
 * sonst weicht der Hash strukturell ab, weil C16-Exporte regelmaessig
 * 5–10 Antraege ohne Titel/VB-Titel/Projektbeschreibung enthalten.
 */
export function isEmbeddableAntrag(antrag: Antrag, felder: EmbeddingFeldIndex): boolean {
  return buildEmbeddingTextForAntrag(antrag, felder).length > 0;
}

/** Sortierte aktenzeichen-Liste der embedbaren Antraege — Input fuer
 *  `hashAktenzeichenSet`. */
export function getEmbeddableAktenzeichen(
  antraege: Antrag[],
  felder: EmbeddingFeldIndex,
): string[] {
  const out: string[] = [];
  for (const a of antraege) {
    if (isEmbeddableAntrag(a, felder)) out.push(a.aktenzeichen);
  }
  return out;
}

/** Wieviele Antraege haben noch kein Embedding? */
export async function countMissing(idb: IDBStore, antraege: Antrag[]): Promise<number> {
  const existing = await listEmbeddingKeys(idb);
  let missing = 0;
  for (const a of antraege) {
    if (!existing.has(a.aktenzeichen)) missing++;
  }
  return missing;
}

export interface BuildProgress {
  done: number;
  total: number;
  lastAntrag?: string;
  /** Geschaetzte verbleibende Zeit in Sekunden, oder undefined wenn noch zu unsicher. */
  etaSec?: number;
}

export interface BuildOptions {
  onProgress?: (p: BuildProgress) => void;
  signal?: AbortSignal;
  /** Nur fehlende neu embedden. Default true. */
  incremental?: boolean;
  /** Programm, aus dessen Schema die Quell-Spalten aufgeloest werden. `null` =
   *  nur die fest verdrahtete Basis (siehe {@link ladeEmbeddingFeldIndex}). */
  programmId?: string | null;
}

export interface BuildErgebnis {
  done: number;
  skipped: number;
  aborted: boolean;
  /** `true`, wenn der Lauf trotz `incremental` VOLL gebaut hat, weil der lokale
   *  Korpus aus einem anderen Vektorraum stammte (siehe unten). */
  vollErzwungen: boolean;
}

/**
 * Hauptpfad: laeuft durch alle Antraege, embed't den Text (VB-Titel + Titel
 * + Projektbeschreibung + Deskriptoren) und schreibt in den IDB-Cache.
 *
 * **Der Korpus fuehrt seit v4.113 eine SIGNATUR mit** — und ein inkrementeller
 * Lauf verlaengert keinen fremden Vektorraum mehr.
 *
 * Das war die schaerfste offene Frage der Bug-Jagd, und die Antwort war „ja, er
 * mischt": `incremental` filterte allein ueber die EXISTENZ des
 * Aktenzeichen-Schluessels. Praefix, `dtype`, Pooling, Normalisierung und die
 * Textzusammensetzung gingen in keinen Schluessel, keinen Hash und keinen
 * Merkschluessel ein. Wer eines davon aenderte, liess alle vorhandenen Vektoren
 * liegen, legte neue aus einem ANDEREN Raum daneben — und nichts wurde rot.
 * `checkCompat` verglich nur `modellId` und `dim`, die beide gleich blieben.
 *
 * Jetzt: weicht die gespeicherte Signatur ab (oder fehlt sie bei nicht-leerem
 * Korpus, also vor v4.113), wird VOLL gebaut, auch wenn `incremental` gesetzt
 * ist. Der Aufrufer erfaehrt es ueber `vollErzwungen`.
 *
 * Annahme: Caller hat `ensureEmbeddingReady(idb)` bereits aufgerufen — wenn
 * nicht, machen wir das hier nochmal idempotent.
 */
export async function buildEmbeddingCorpus(
  idb: IDBStore,
  antraege: Antrag[],
  opts: BuildOptions = {},
): Promise<BuildErgebnis> {
  const incremental = opts.incremental ?? true;
  const config = await ensureEmbeddingReady(idb);
  const felder = await ladeEmbeddingFeldIndex(idb, opts.programmId ?? null);

  // Signatur des Vektorraums, den dieser Lauf erzeugt — gegen den, der lokal liegt.
  const signatur = aktuelleKorpusSignatur(config);
  const gespeichert = await ladeKorpusSignatur(idb);
  const lokalNichtLeer = (await countEmbeddings(idb)) > 0;
  const fremderRaum = lokalNichtLeer
    && (gespeichert === null || !signaturenGleich(gespeichert, signatur));
  if (fremderRaum) {
    console.warn(
      '[embedding-corpus] Der lokale Korpus stammt aus einem anderen Vektorraum '
      + `(${gespeichert ? signaturText(gespeichert) : 'ohne Signatur, vor v4.113'} `
      + `≠ ${signaturText(signatur)}) — es wird VOLL neu gebaut statt gemischt.`,
    );
  }

  // Liste filtern
  let queue: Antrag[];
  if (incremental && !fremderRaum) {
    const existing = await listEmbeddingKeys(idb);
    queue = antraege.filter(a => !existing.has(a.aktenzeichen));
  } else {
    queue = antraege;
  }

  const total = queue.length;
  let done = 0;
  let skipped = 0;
  const startedAt = Date.now();

  for (const a of queue) {
    if (opts.signal?.aborted) {
      return { done, skipped, aborted: true, vollErzwungen: fremderRaum };
    }
    const text = buildEmbeddingTextForAntrag(a, felder);
    if (!text) {
      skipped++;
      done++;
      opts.onProgress?.({ done, total, lastAntrag: a.aktenzeichen });
      continue;
    }
    try {
      const vec = await embedText(text, 'document');
      await storeEmbedding(idb, a.aktenzeichen, vec);
      done++;
      const elapsed = (Date.now() - startedAt) / 1000;
      const etaSec = done > 5 ? (elapsed / done) * (total - done) : undefined;
      opts.onProgress?.({ done, total, lastAntrag: a.aktenzeichen, etaSec });
    } catch (err) {
      console.warn(`[embedding-corpus] embed failed for ${a.aktenzeichen}:`, err);
      skipped++;
      done++;
      opts.onProgress?.({ done, total, lastAntrag: a.aktenzeichen });
    }
    // Yield zwischen Iterations -> UI bleibt responsiv
    await new Promise(r => setTimeout(r, 0));
  }

  // Erst nach dem vollstaendigen Durchlauf: ein abgebrochener Lauf hat den
  // fremden Raum nicht abgeloest, seine Signatur darf nicht behauptet werden.
  await merkeKorpusSignatur(idb, signatur);

  return { done, skipped, aborted: false, vollErzwungen: fremderRaum };
}
