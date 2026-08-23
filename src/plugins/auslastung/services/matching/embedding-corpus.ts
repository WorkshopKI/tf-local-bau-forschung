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
  aktuelleKorpusSignatur,
  ladeKorpusSignatur,
  merkeKorpusSignatur,
  signaturenGleich,
  signaturText,
  hashEmbeddingText,
  ladeTextHashes,
  merkeTextHashes,
  waehleZuEmbedden,
  erzeugeErholer,
  embedMitErholung,
  aktivesEmbeddingGeraet,
  type EmbeddingGeraet,
  type ErholungsMeldung,
} from '@/core/services/embedding-corpus';
import { buildDescriptorsText } from '@/plugins/antraege/services/descriptor-text';
import {
  baueKorpusFeldKarte, baueSlotIndex, leseSlots, KORPUS_BASIS,
  type KorpusSlot,
} from '@/plugins/antraege/services/korpusFeldAufloesung';
import { listSchemasByProgramm, forEachAntragChunkByProgramm } from '@/core/services/csv/idb-csv';

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

/**
 * Welche Antraege braucht ein (inkrementeller) Lauf — fehlend ODER mit
 * geaendertem Text?
 *
 * **Die Vorschau fragt dieselbe Regel wie der Lauf** ({@link waehleZuEmbedden}),
 * sonst zaehlt sie etwas anderes, als der Lauf dann tut — und ein Nachlauf, der
 * „3 Anträge" ankuendigt und null einbettet, ist schlimmer als keiner.
 */
export async function ermittleZuEmbedden(
  idb: IDBStore,
  antraege: Antrag[],
  felder: EmbeddingFeldIndex,
): Promise<string[]> {
  const { aktenzeichen, frisch } = hashePraeparate(antraege, felder);
  return waehleZuEmbedden({
    aktenzeichen,
    frisch,
    vorhanden: await listEmbeddingKeys(idb),
    gemerkt: await ladeTextHashes(idb),
  });
}

/**
 * Ein Durchgang ueber den Bestand: welche Antraege sind embedbar, und wie
 * lautet der Hash ihres Embedding-Texts?
 *
 * Reine String-Arbeit, **kein Modell** — deshalb darf das auch beim Start
 * laufen. Die Texte selbst werden bewusst NICHT behalten: 14 k Texte à ~1 kB
 * waeren ~30 MB Heap neben einem 200-MB-Modell, und der Text ist billig genug,
 * um im Lauf noch einmal aus DERSELBEN Funktion zu kommen (nie aus einer
 * zweiten — sonst misst der Hash etwas anderes als der Vektor).
 */
interface HashPraeparat {
  /** Embedbare Aktenzeichen in Bestandsreihenfolge. */
  aktenzeichen: string[];
  /** Hash des Embedding-Texts je Aktenzeichen. */
  frisch: Map<string, string>;
}

/** Der Akkumulator — EINE Implementierung fuer den Voll-Lauf und den Stream. */
function sammleHashes(
  records: readonly Antrag[],
  felder: EmbeddingFeldIndex,
  ziel: HashPraeparat,
): void {
  for (const a of records) {
    const text = buildEmbeddingTextForAntrag(a, felder);
    if (!text) continue;
    ziel.aktenzeichen.push(a.aktenzeichen);
    ziel.frisch.set(a.aktenzeichen, hashEmbeddingText(text));
  }
}

function hashePraeparate(antraege: Antrag[], felder: EmbeddingFeldIndex): HashPraeparat {
  const ziel: HashPraeparat = { aktenzeichen: [], frisch: new Map() };
  sammleHashes(antraege, felder, ziel);
  return ziel;
}

/**
 * Wie steht der Korpus zum Bestand? — ohne die vollen Records zu behalten.
 *
 * Der Auslastungs-Cache (`useAntraegeCache`) beantwortet das auch, aber er
 * traegt Deskriptoren, Anonym-Map und Kuerzel mit; ihn fuer eine Zahl in der
 * Kuration zu wecken, hiesse ein Modul zu laden, um in ein anderes zu schauen.
 * Diese Passage streamt in Chunks (Bulk-Speed bei beschraenktem Peak) und
 * behaelt nur Aktenzeichen und Hashes.
 *
 * **Kein Modell** — reine String-Arbeit. Deshalb darf das auch beim Start laufen.
 */
export async function ermittleKorpusBestand(
  idb: IDBStore,
  programmId: string | null,
): Promise<KorpusBestand> {
  if (!programmId) return { gesamt: 0, embeddableAz: [], zuEmbedden: [], lokal: 0 };
  const felder = await ladeEmbeddingFeldIndex(idb, programmId);
  const ziel: HashPraeparat = { aktenzeichen: [], frisch: new Map() };
  let gesamt = 0;
  await forEachAntragChunkByProgramm(idb, programmId, (records) => {
    gesamt += records.length;
    sammleHashes(records, felder, ziel);
  });
  const vorhanden = await listEmbeddingKeys(idb);
  return {
    gesamt,
    embeddableAz: ziel.aktenzeichen,
    zuEmbedden: waehleZuEmbedden({
      aktenzeichen: ziel.aktenzeichen,
      frisch: ziel.frisch,
      vorhanden,
      gemerkt: await ladeTextHashes(idb),
    }),
    lokal: vorhanden.size,
  };
}

export interface KorpusBestand {
  /** Antraege im Programm — auch die ohne Text. */
  gesamt: number;
  /** Aktenzeichen mit Text; nur sie koennen einen Vektor haben. */
  embeddableAz: string[];
  /** Wer fehlt ODER hat geaenderten Text (die Arbeitsliste eines Laufs). */
  zuEmbedden: string[];
  /** Wie viele Vektoren lokal liegen. */
  lokal: number;
}

export interface BuildProgress {
  done: number;
  total: number;
  lastAntrag?: string;
}

export interface BuildOptions {
  onProgress?: (p: BuildProgress) => void;
  signal?: AbortSignal;
  /** Nur fehlende neu embedden. Default true. */
  incremental?: boolean;
  /** Programm, aus dessen Schema die Quell-Spalten aufgeloest werden. `null` =
   *  nur die fest verdrahtete Basis (siehe {@link ladeEmbeddingFeldIndex}). */
  programmId?: string | null;
  /**
   * Genau diese Aktenzeichen bearbeiten — der Rest der Liste bleibt liegen.
   *
   * Fuer die **Fortsetzung nach einem Seiten-Neustart**
   * ([korpus-fortsetzung.ts](./korpus-fortsetzung.ts)): ein abgebrochener
   * Vollbau im GLEICHEN Vektorraum hinterlaesst einen Zustand, in dem
   * `incremental` nichts mehr findet (die alten Vektoren liegen da, ihre Hashes
   * stimmen). Nur eine explizite Restliste weiss, was dieser Lauf noch vorhat.
   *
   * Schlaegt `incremental` und `fremderRaum` gleichermassen: wer die Liste
   * nennt, hat sie sich selbst zusammengestellt.
   */
  nurDiese?: ReadonlySet<string>;
  /** Das Rechenwerk ist weggebrochen, das Modell wird nachgeladen — die
   *  Oberflaeche steht sonst wortlos still ([erholung.ts](src/core/services/embedding-corpus/erholung.ts)). */
  onLadenBeginnt?: (geraet: EmbeddingGeraet, nummer: number) => void;
  /** Das Modell steht wieder. */
  onErholt?: (m: ErholungsMeldung) => void;
}

export interface BuildErgebnis {
  done: number;
  /** `ohneText + fehlgeschlagen` — die Summe, mit der Aufrufer seit jeher rechnen. */
  skipped: number;
  /** Antraege, die gar keinen Embedding-Text haben (C16-Exporte fuehren regelmaessig ein paar). */
  ohneText: number;
  /**
   * Antraege, deren Einbettung GESCHEITERT ist.
   *
   * Bis v6.15 lag das mit `ohneText` in einem Topf, und ein Lauf, dem nach 807
   * Vektoren die Pipeline wegbrach, meldete „13.418 uebersprungen (kein Text
   * oder Fehler)" — ununterscheidbar von einem Bestand ohne Texte, obwohl
   * dieselbe App 14.221 Antraege als embedbar zaehlte.
   */
  fehlgeschlagen: number;
  aborted: boolean;
  /** Warum abgebrochen wurde — `undefined`, wenn der Lauf durchlief. */
  abbruchGrund?: BuildAbbruchGrund;
  /** Wortlaut des ERSTEN Fehlers; alles Weitere ist meist derselbe. */
  ersterFehler?: string;
  /**
   * Hat dieser Lauf den Vektorraum als abgeloest vermerkt?
   *
   * Die Oberflaeche sagt dem Leser, was mit seinem Korpus passiert ist — sie
   * darf das nicht raten. „Die Textfassung wurde nicht vermerkt" ist eine
   * Aussage ueber DIESEN Lauf, nicht ueber Fehler im Allgemeinen.
   */
  signaturGestempelt: boolean;
  /** `true`, wenn der Lauf trotz `incremental` VOLL gebaut hat, weil der lokale
   *  Korpus aus einem anderen Vektorraum stammte (siehe unten). */
  vollErzwungen: boolean;
  /** Jede Erholung von einem Geraeteverlust, in der Reihenfolge des Auftretens. */
  erholungen: readonly ErholungsMeldung[];
  /** Worauf am ENDE gerechnet wurde — kann vom Start abweichen. */
  geraet: EmbeddingGeraet | null;
  /**
   * Was dieser Lauf NICHT geschafft hat — weder eingebettet noch als textlos
   * abgehakt. Die Restliste fuer eine Fortsetzung nach einem Seiten-Neustart
   * ([korpus-fortsetzung.ts](./korpus-fortsetzung.ts)); bei einem sauberen
   * Durchlauf leer.
   */
  offeneAz: string[];
}

export type BuildAbbruchGrund = 'nutzer' | 'fehlerserie';

/**
 * Nach so vielen Fehlschlaegen HINTEREINANDER gilt die Pipeline als tot.
 *
 * Die zweite Verteidigungslinie, nicht die erste: einen Geraeteverlust behandelt
 * seit v6.18 die Erholung ([erholung.ts](src/core/services/embedding-corpus/erholung.ts)),
 * die das Modell nachlaedt und notfalls auf den Hauptprozessor wechselt. Was
 * HIER ankommt, hat sie nicht retten koennen — dann soll der Lauf stehen
 * bleiben, statt in ~1 min durch 13.418 Antraege zu rasen, keinen Vektor zu
 * schreiben und am Ende „fertig" zu melden. Zwanzig genuegen, um ein sproedes
 * Einzelrecord von einer toten Pipeline zu unterscheiden.
 */
export const FEHLERSERIE_ABBRUCH = 20;

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

  // Ein Vorlauf ohne Modell: Hash je embedbarem Antrag. Er entscheidet die
  // Queue UND wird am Ende fuer die tatsaechlich eingebetteten gestempelt.
  const { aktenzeichen, frisch } = hashePraeparate(antraege, felder);

  // Liste filtern — „fehlt ODER Text geaendert" statt nur „fehlt" (v4.127).
  let queue: Antrag[];
  if (opts.nurDiese) {
    // Der Aufrufer hat die Restliste selbst bestimmt (Fortsetzung nach einem
    // Neustart) — sie schlaegt beide Regeln.
    queue = antraege.filter(a => opts.nurDiese!.has(a.aktenzeichen));
  } else if (incremental && !fremderRaum) {
    const dran = new Set(waehleZuEmbedden({
      aktenzeichen,
      frisch,
      vorhanden: await listEmbeddingKeys(idb),
      gemerkt: await ladeTextHashes(idb),
    }));
    queue = antraege.filter(a => dran.has(a.aktenzeichen));
  } else {
    queue = antraege;
  }

  const total = queue.length;
  let done = 0;
  let ohneText = 0;
  let fehlgeschlagen = 0;
  let serie = 0;
  let ersterFehler: string | undefined;
  /** Nur die, deren Vektor in DIESEM Lauf entstanden ist — siehe `merkeTextHashes`. */
  const gestempelt = new Map<string, string>();
  /**
   * Wer keinen zweiten Versuch mehr braucht: eingebettet ODER ohne Text.
   * Ein FEHLGESCHLAGENER gehoert ausdruecklich nicht dazu — er ist der Grund,
   * warum eine Fortsetzung ueberhaupt gebraucht wird.
   */
  const erledigt = new Set<string>();
  const erholer = erzeugeErholer(idb, {
    onLadenBeginnt: opts.onLadenBeginnt,
    onErholt: opts.onErholt,
  });

  const ergebnis = (
    aborted: boolean,
    abbruchGrund?: BuildAbbruchGrund,
    signaturGestempelt = false,
  ): BuildErgebnis => ({
    done,
    skipped: ohneText + fehlgeschlagen,
    ohneText,
    fehlgeschlagen,
    aborted,
    abbruchGrund,
    ersterFehler,
    signaturGestempelt,
    vollErzwungen: fremderRaum,
    erholungen: erholer.meldungen,
    geraet: aktivesEmbeddingGeraet(),
    offeneAz: queue.filter(a => !erledigt.has(a.aktenzeichen)).map(a => a.aktenzeichen),
  });

  for (const a of queue) {
    if (opts.signal?.aborted) {
      // Ein Abbruch verwirft die bis dahin geschriebenen Vektoren nicht — ihre
      // Hashes duerfen also auch nicht verloren gehen, sonst gaelten sie beim
      // naechsten Lauf als „unbekannt" und wuerden nie wieder aufgefrischt.
      await merkeTextHashes(idb, gestempelt);
      return ergebnis(true, 'nutzer');
    }
    const text = buildEmbeddingTextForAntrag(a, felder);
    if (!text) {
      ohneText++;
      erledigt.add(a.aktenzeichen);
      done++;
      opts.onProgress?.({ done, total, lastAntrag: a.aktenzeichen });
      continue;
    }
    try {
      const vec = await embedMitErholung(text, 'document', erholer);
      await storeEmbedding(idb, a.aktenzeichen, vec);
      // Der Stempel gehoert an den Vektor, nicht an den Durchlauf: nur wo beides
      // aus demselben Text stammt, darf spaeter „unveraendert" behauptet werden.
      const h = frisch.get(a.aktenzeichen);
      if (h !== undefined) gestempelt.set(a.aktenzeichen, h);
      erledigt.add(a.aktenzeichen);
      done++;
      serie = 0;
      opts.onProgress?.({ done, total, lastAntrag: a.aktenzeichen });
    } catch (err) {
      if (ersterFehler === undefined) {
        ersterFehler = err instanceof Error ? err.message : String(err);
        // Einmal laut, mit vollem Objekt — der Rest ist erfahrungsgemaess
        // derselbe Fehler und soll die Konsole nicht 13.000-fach zumuellen.
        console.error(`[embedding-corpus] embed failed for ${a.aktenzeichen}:`, err);
      } else {
        console.warn(`[embedding-corpus] embed failed for ${a.aktenzeichen}:`, err);
      }
      fehlgeschlagen++;
      serie++;
      done++;
      opts.onProgress?.({ done, total, lastAntrag: a.aktenzeichen });
      if (serie >= FEHLERSERIE_ABBRUCH) {
        console.error(
          `[embedding-corpus] ${serie} Fehlschlaege hintereinander — Lauf abgebrochen `
          + `(${done} von ${total} durchlaufen). Erster Fehler: ${ersterFehler}`,
        );
        await merkeTextHashes(idb, gestempelt);
        return ergebnis(true, 'fehlerserie');
      }
    }
    // Yield zwischen Iterations -> UI bleibt responsiv
    await new Promise(r => setTimeout(r, 0));
  }

  await merkeTextHashes(idb, gestempelt);
  // Erst nach dem vollstaendigen Durchlauf: ein abgebrochener Lauf hat den
  // fremden Raum nicht abgeloest, seine Signatur darf nicht behauptet werden.
  //
  // Und ein Lauf MIT Fehlern auch nicht, solange er einen fremden Raum abloesen
  // sollte: was scheiterte, behielt seinen alten Vektor: Signatur v3 ueber einem
  // Korpus, der zu 94 % aus v2 besteht, ist genau das Mischen zweier Raeume, das
  // v4.113 abgestellt hat — nur durch den Fehlerpfad. Im GLEICHEN Raum ist der
  // Stempel harmlos, dort hat sich nichts am Raum geaendert.
  const stempeln = !(fremderRaum && fehlgeschlagen > 0);
  if (stempeln) {
    await merkeKorpusSignatur(idb, signatur);
  }

  return ergebnis(false, undefined, stempeln);
}
