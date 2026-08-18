/**
 * Antraege-Hybrid-Suche als reine Service-Funktion.
 *
 * Vereinigt drei Treffer-Quellen zu einer score-tragenden Liste:
 *  1. **Substring** auf VB-/TV-/Abstract-/Deskriptor-Volltext
 *     (synchron, Score = Relevanz aus den Fundstellen, method = 'fulltext';
 *     bis v4.4.4 war das ein fester 1.0 — siehe `trefferstelle.ts`)
 *  2. **Embedding-Cosine** gegen den Auslastungs-Korpus (768d)
 *     (asynchron, Score = cosine, adaptive Schwelle Floor 0.35 + 90% der
 *     besten Cosine — siehe EMBEDDING_SCORE_FLOOR, method = 'vector')
 *  3. **DMS-Index-Treffer** via Orama-`hybridSearch` mit `filenameToAkz`-Mapping
 *     (asynchron, Score = orama-Score 0..1, method = 'hybrid')
 *
 * **Quelle 1 und 3 laufen immer, Quelle 2 nur nach Opt-in.** Der Schnitt liegt
 * dort, wo die Kosten liegen: Quelle 2 lädt ein 768d-Modell, Quelle 3 fragt
 * einen bereits gebauten Index ab. Seit v4.64 hängen sie deshalb nicht mehr am
 * selben Schalter.
 *
 * Dedup-Strategie bei mehreren Quellen pro Aktenzeichen: **max-score**, method
 * der jeweils besten Quelle.
 *
 * Programm-scoped: der Substring-Korpus wird pro `programmId` gecached, die
 * Embedding-Map ist global aber kompatibel zur Dimension des aktiven Modells.
 *
 * Zwei Konsumenten:
 *  - {@link useAntraegeHybridSearch} (Antraege-Plugin) — mapped `hits` auf das
 *    `matchedAkz`-Set und schreibt es in den `AntraegeStore`.
 *  - {@link useUnifiedSearch} (Suchseite) — mapped `hits` auf
 *    `UnifiedSearchResult` mit voll angereicherten Antrags-Feldern.
 */
import {
  ensureEmbeddingReady,
  embedText,
  cosineSimilarity,
  loadAllEmbeddings,
  loadManifest as loadMirrorManifest,
  loadBin as loadMirrorBin,
  parseCorpus as parseMirrorCorpus,
  applyCorpusToIdb as applyMirrorCorpus,
  checkCompat as checkMirrorCompat,
} from '@/core/services/embedding-corpus';
import { getActiveModelId, getModelById } from '@/core/services/search/model-registry';
import { hybridSearch, getOramaDB } from '@/core/services/search/orama-store';
import type { StorageService } from '@/core/services/storage';
import type { IDBStore } from '@/core/services/storage/idb-store';
import { useSemanticSearchMode } from '@/core/hooks/useSemanticSearchMode';
import { verknuepfungAlsThreshold, type SuchVerknuepfung } from '@/core/hooks/useSuchVerknuepfung';
import {
  bundeslandCode,
  bundeslandCodeNadel,
  loadAntraegeTextCorpus,
  loadDmsFilenameToAkz,
  standortNadel,
  type AntragTextEntry,
} from './search-corpus';
import { leererWertIndexRoh, verdichteWertIndex, type WertIndex } from './wert-index';
import { berechneRelevanz, type Trefferfeld } from '@/core/services/search/trefferstelle';
import { bereichFelder, type Suchbereich } from '@/core/services/search/suchbereich';
import { zerlegeFeldAnfrage } from '@/core/services/search/feldpraefix';
import type { PlanBegriff } from '@/core/services/search/frageplan';
import {
  suchNadel, sammleVarianten, enthaeltAlsWortteil,
  baueNadelMuster, enthaeltMusterAlsWortteil, musterTrifft,
} from '@/core/services/search/wortstamm';
import type { HybridUnavailableSource } from '../store';

/**
 * Substring/Embedding/DMS-Pipeline darf laufen.
 *
 * v3.0: Die Oder-Kette ist entfallen — `suche` war in JEDER Variante an und hat
 * die anderen Glieder damit seit jeher ueberstimmt. Die Konstante bleibt als
 * benannter Anker stehen, weil das Laufzeit-Gate darunter auf sie verweist.
 *
 * Bewusst KEIN Bezug zur Modul-Freischaltung: das hier ist eine modul-globale
 * Konstante, sie wuerde sich sonst mitten in der Sitzung aendern.
 */
const SEMANTIC_SOURCES_ENABLED = true;

/**
 * Laufzeit-Gate der EMBEDDING-Quelle (v2.62): Build-Flag UND Session-Opt-in.
 * Die Ähnlichkeitssuche ist opt-in — Standard aus; der User schaltet sie über
 * den Hinweis unter dem Suchfeld ein, der erst bei laufender Suche erscheint.
 * Erst dann dürfen Modell-Init und Embedding-Map laufen. Der DMS-Index gehört
 * seit v4.64 NICHT mehr dazu (er kostet kein Modell). Alle Konsumenten
 * (searchAntraege, useUnifiedSearch, Preload-Hooks) routen durch diesen Helper.
 */
export function isSemanticSearchActive(): boolean {
  return SEMANTIC_SOURCES_ENABLED && useSemanticSearchMode.getState().enabled;
}

/**
 * Adaptive Schwelle fuer Embedding-Treffer (v2.62.4).
 *
 * Die fruehere starre 0.55-Schwelle stammte aus einer Validierung auf dem
 * v1-Korpus (nur Titel/Abstract). Auf dem v2-Korpus (lange Texte inkl.
 * Deskriptoren) staucht sich die Cosine-Skala fuer kurze Queries: Messung
 * pl-Echtdaten, Query „Bilderkennung" (eindeutig relevante Treffer im
 * Korpus) → beste Cosine 0.437 → 0 Treffer ueber 0.55, Aehnlichkeitssuche
 * wirkte tot. Daher relativ zur besten Cosine des Laufs schneiden:
 *  - `FLOOR` = absolute Untergrenze (Garbage-Schutz: liegt selbst die beste
 *    Cosine darunter, ist die Query semantisch nicht im Korpus → 0 Treffer).
 *  - `RELATIVE_CUTOFF` = behalte Treffer ≥ 90% der besten Cosine — adaptiert
 *    sich an die Query-Laenge (kurze Query: Band z.B. 0.39–0.44; lange
 *    Query: Band z.B. 0.63–0.70). `TOP_K` deckelt die Menge zusaetzlich.
 */
const EMBEDDING_SCORE_FLOOR = 0.35;
const EMBEDDING_RELATIVE_CUTOFF = 0.9;
const EMBEDDING_TOP_K = 50;
/** Untergrenze für die INDEX-Stufen (Embedding-Korpus + DMS-Volltext). Ein
 *  einzelnes Zeichen liefert dort nur Rauschen; die Substring-Stufe darüber
 *  arbeitet weiter ab dem ersten Zeichen. */
const MIN_QUERY_LEN_FOR_INDEX = 2;
const COSINE_YIELD_INTERVAL = 2000;
const DMS_HIT_LIMIT = 100;

export type SearchMethod = 'fulltext' | 'vector' | 'hybrid';

export interface AntragSearchHit {
  aktenzeichen: string;
  /** 0..1 normalisiert. Wortlaut=Relevanz aus den Fundstellen,
   *  Embedding=cosine (gedeckelt), DMS=orama-Score. */
  score: number;
  method: SearchMethod;
}

/**
 * Was die Wortlaut-Stufe über einen Treffer weiß: in welchen Feldern er lag und
 * wie viele der Suchwörter überhaupt eine Fundstelle hatten. Aus beidem rechnet
 * [trefferstelle.ts](src/plugins/antraege/services/trefferstelle.ts) die
 * Relevanz — die Stufe liefert die Belege, nicht das Urteil.
 */
export interface WortlautTreffer {
  felder: Set<Trefferfeld>;
  /** Anteil der Suchwörter mit Fundstelle (0..1). Bei UND immer 1. */
  abdeckung: number;
}

export interface AntraegeSearchResult {
  hits: AntragSearchHit[];
  unavailable: HybridUnavailableSource[];
}

export interface SearchAntraegeOptions {
  query: string;
  idb: IDBStore;
  programmId: string;
  abortSignal: AbortSignal;
  /**
   * Die Leitbegriffe eines Antragsplans (v4.105). Gesetzt heißt: die Suchteile
   * kommen VON DORT statt aus der Zerlegung der Eingabe — die Wortlaut-Stufe
   * kennt das längst (`WortlautOptionen.planTeile`), es fehlte nur der Weg
   * hierher. `undefined` ist der Normalfall und lässt alles bitweise so laufen
   * wie zuvor.
   */
  planTeile?: readonly PlanBegriff[];
}

interface ProgrammCaches {
  programmId: string;
  textCorpus: Map<string, AntragTextEntry>;
  filenameToAkz: Map<string, string>;
  /** Welche Werte die aufzählbaren Felder führen — für die Vervollständigung
   *  im Suchfeld. Fällt im selben Cursor-Walk ab wie der Korpus. */
  werteIndex: WertIndex;
}

// ----- Modul-Caches -----------------------------------------------------------

let cachedProgrammCaches: ProgrammCaches | null = null;
let cachedProgrammLoadPromise: Promise<ProgrammCaches> | null = null;

let cachedEmbeddings: Map<string, number[]> | null = null;
let cachedEmbeddingsLoadPromise: Promise<Map<string, number[]>> | null = null;
let cachedEmbeddingsDim: number | null = null;

let mirrorBootstrapPromise: Promise<void> | null = null;

export type MirrorBootstrapStatus =
  | 'idle' | 'no-action-needed' | 'downloading' | 'applying'
  | 'done' | 'incompatible' | 'error';

export async function getProgrammCaches(
  idb: IDBStore,
  programmId: string,
): Promise<ProgrammCaches> {
  if (cachedProgrammCaches && cachedProgrammCaches.programmId === programmId) {
    return cachedProgrammCaches;
  }
  if (cachedProgrammLoadPromise) return cachedProgrammLoadPromise;
  cachedProgrammLoadPromise = (async () => {
    const werteRoh = leererWertIndexRoh();
    const [textCorpus, filenameToAkz] = await Promise.all([
      loadAntraegeTextCorpus(idb, programmId, { werteIndex: werteRoh }),
      loadDmsFilenameToAkz(idb),
    ]);
    const result = {
      programmId, textCorpus, filenameToAkz, werteIndex: verdichteWertIndex(werteRoh),
    };
    cachedProgrammCaches = result;
    return result;
  })();
  try {
    return await cachedProgrammLoadPromise;
  } finally {
    cachedProgrammLoadPromise = null;
  }
}

export async function getEmbeddings(idb: IDBStore): Promise<Map<string, number[]>> {
  if (cachedEmbeddings) return cachedEmbeddings;
  if (cachedEmbeddingsLoadPromise) return cachedEmbeddingsLoadPromise;
  cachedEmbeddingsLoadPromise = (async () => {
    const map = await loadAllEmbeddings(idb);
    cachedEmbeddings = map;
    const first = map.values().next().value;
    cachedEmbeddingsDim = Array.isArray(first) ? first.length : null;
    return map;
  })();
  try {
    return await cachedEmbeddingsLoadPromise;
  } finally {
    cachedEmbeddingsLoadPromise = null;
  }
}

/** Cleart die Modul-Caches. Wird beim Programm-Switch via Hook getriggert. */
export function clearAntraegeSearchCaches(): void {
  cachedProgrammCaches = null;
  cachedProgrammLoadPromise = null;
  cachedEmbeddings = null;
  cachedEmbeddingsLoadPromise = null;
  cachedEmbeddingsDim = null;
}

/** Embedding-Cache invalidieren — z.B. nach einem Mirror-Bootstrap der
 *  frische Vektoren in die IDB geschrieben hat. */
export function invalidateEmbeddingsCache(): void {
  cachedEmbeddings = null;
  cachedEmbeddingsLoadPromise = null;
  cachedEmbeddingsDim = null;
}

// ----- Mirror-Bootstrap (Best-Effort Download vom SMB-Share) -----------------

/**
 * Best-Effort Auto-Download des Embedding-Korpus vom SMB-Daten-Share fuer
 * schlanke Varianten ohne Auslastungs-Plugin. Wird nur einmal pro Session
 * versucht (Singleton-Promise). Fehler werden ge-warned, nicht propagiert.
 */
export async function autoBootstrapEmbeddingMirror(
  storage: StorageService,
  onStatus?: (status: MirrorBootstrapStatus) => void,
): Promise<void> {
  if (mirrorBootstrapPromise) return mirrorBootstrapPromise;
  mirrorBootstrapPromise = (async () => {
    try {
      const idb = storage.idb;
      const existing = await loadAllEmbeddings(idb);
      if (existing.size > 0) { onStatus?.('no-action-needed'); return; }
      const manifest = await loadMirrorManifest(storage);
      if (!manifest) { onStatus?.('no-action-needed'); return; }
      const modelId = await getActiveModelId(idb);
      const cfg = getModelById(modelId);
      const compat = checkMirrorCompat(manifest, cfg.id, cfg.dimensions);
      if (compat.kind !== 'compatible') {
        console.warn(
          `[antraege-search-service] embedding mirror inkompatibel mit aktivem Modell (${compat.kind}) — kein Auto-Download.`,
        );
        onStatus?.('incompatible');
        return;
      }
      onStatus?.('downloading');
      const bin = await loadMirrorBin(storage, manifest.binBytes);
      if (!bin) { onStatus?.('error'); return; }
      const map = parseMirrorCorpus(manifest, bin);
      onStatus?.('applying');
      await applyMirrorCorpus(idb, map);
      onStatus?.('done');
    } catch (err) {
      mirrorBootstrapPromise = null;
      onStatus?.('error');
      throw err;
    }
  })();
  return mirrorBootstrapPromise;
}

// ----- Helpers ---------------------------------------------------------------

/**
 * Wortlaut-Treffer über den Antrags-Textkorpus.
 *
 * Bis v3.49 wurde die GANZE Anfrage als eine Zeichenkette gesucht — „laser
 * schweißen" fand nur die wörtliche Phrase, nie ein Vorhaben, in dem beide
 * Wörter getrennt stehen. Jetzt zählt jedes Wort für sich: `und` verlangt alle,
 * `oder` genügt eines. Ein Ein-Wort-Anfrage verhält sich in beiden Modi wie
 * bisher.
 *
 * `verknuepfung` ist ein EXPLIZITER Parameter, kein Griff in den Store: der
 * Aufrufer entscheidet, ob die Wahl des Nutzers auf seiner Seite gilt (die
 * Suchseite reicht sie durch, die Förderanträge-Liste bleibt beim Standard).
 *
 * Die ORTSFELDER (Standort, Web-Adresse, Wahlkreis) werden am Wortanfang
 * verglichen statt als freier Substring (siehe `standortSuchform` in
 * `search-corpus.ts`) — sonst holt „essen" die hessischen Anträge herein. Alle
 * übrigen Felder tragen Fließtext und vergleichen frei. Die Nadeln dafür
 * entstehen einmal je Anfrage, nicht je Eintrag; über 14 000 Einträge wäre das
 * sonst genau der GC-Druck, den die vorberechneten Felder vermeiden.
 *
 * Seit v4.49 trägt jeder Suchteil seine EIGENE Feldmenge: ein getipptes Präfix
 * (`ast:GMBU`, siehe [feldpraefix.ts](src/core/services/search/feldpraefix.ts))
 * bindet dieses Wort an sein Feld, alle übrigen folgen weiter dem Bereich.
 * Ein Teil mit leerer Feldmenge trifft nie — bei UND fällt der Antrag damit
 * heraus, bei ODER tragen die anderen Teile weiter. Genau das ist richtig, und
 * es ist derselbe Weg, auf dem „nur Dokumente" die Wortlaut-Stufe stilllegt.
 */
function substringMatches(
  query: string,
  textCorpus: Map<string, AntragTextEntry>,
  optionen: WortlautOptionen = {},
): WortlautErgebnis {
  const {
    verknuepfung = 'und',
    stammSuche = false,
    bereich = 'alles',
  } = optionen;
  const out = new Map<string, WortlautTreffer>();
  const leer: WortlautErgebnis = { treffer: out, varianten: [] };
  const bereichsFelder = bereichFelder(bereich);

  // Ein Frageplan ERSETZT die Zerlegung der Eingabe: dort steht dann die Frage
  // („Welche Vorhaben …"), und ihre Wörter sind keine Suchbegriffe. Ohne Plan
  // bleibt alles wie zuvor.
  const teile: SuchTeil[] = optionen.planTeile
    ? planSuchTeile(optionen.planTeile, bereichsFelder)
    : anfrageSuchTeile(query, verknuepfung, stammSuche, optionen.aktiveVarianten, bereichsFelder);
  if (teile.length === 0) return leer;
  // Alle Teile ohne Feld ⇒ nichts zu prüfen (der Bereich „nur Dokumente" ist
  // genau dieser Fall). Der Kurzschluss spart den Lauf über 14 000 Einträge.
  if (teile.every(t => t.erlaubt.size === 0)) return leer;

  // Einmal vorab getrennt: Einschränkungen müssen ALLE zutreffen, die Themen
  // folgen der eingestellten Verknüpfung. Ohne Pflichtteile — also überall außer
  // im Frageplan — ist der Ausdruck unten Zeichen für Zeichen der alte.
  const pflichtTeile = teile.filter(t => t.pflicht);
  const themenTeile = pflichtTeile.length === 0 ? teile : teile.filter(t => !t.pflicht);

  const varianten = new Map<string, { text: string; anzahl: number }>();
  let gescannt = 0;

  for (const [akz, entry] of textCorpus.entries()) {
    // `enthaeltAlsWortteil` statt `.includes`: die Nadel muss an einer Stelle
    // stehen, an der ein Wort beginnen kann (v4.68). Vorher zählte jede
    // Buchstabenfolge — „Normen" wurde zum Stamm `norm` und traf damit auch
    // „e-norm-es". Der Fund erschien dann als Treffer, den die Deutungszeile
    // nicht erklären konnte. Zusammengesetzte Wörter bleiben unberührt:
    // „Kalibrierstandards" trägt vor `standard` ein ganzes Wort, kein Fragment.
    const trifft = (t: SuchTeil): boolean => t.nadeln.some((nadel, i) => {
      // Ein Platzhalter aendert NUR, WOMIT verglichen wird — nie, WO. Deshalb
      // steht hier eine Weiche und keine zweite Feldliste: eine Suche mit `?`
      // muss dieselben Felder in derselben Reihenfolge sehen wie eine ohne,
      // sonst faende sie an anderer Stelle etwas anderes.
      const m = t.nadelMuster[i];
      const passt = m !== null && m !== undefined
        ? (text: string): boolean => enthaeltMusterAlsWortteil(text, m)
        : (text: string): boolean => enthaeltAlsWortteil(text, nadel);
      return (t.erlaubt.has('titel') && (passt(entry.vbLower) || passt(entry.tvLower)))
        || (t.erlaubt.has('kurzbeschreibung') && passt(entry.absLower))
        || (t.erlaubt.has('deskriptoren') && passt(entry.descriptorsLower))
        || (t.erlaubt.has('akronym') && passt(entry.akronymLower))
        || (t.erlaubt.has('aktenzeichen') && passt(entry.akzLower))
        || (t.erlaubt.has('verbundkennzeichen') && passt(entry.verbundNrLower))
        || (t.erlaubt.has('organisation') && passt(entry.organisationLower))
        // Netzwerk und Notiz sind Fliesstext wie der Titel — dieselbe Regel.
        || (t.erlaubt.has('netzwerk') && passt(entry.netzwerkLower))
        || (t.erlaubt.has('notiz') && passt(entry.notizLower));
    })
      // Leere Nadeln sind beim Bau ausgesiebt: `''.includes('')` wäre `true` und
      // träfe alles. Der Standort vergleicht bewusst das ROHE Wort, nicht den
      // Stamm: seine Suchform ist am Wortanfang verankert, ein gekürzter Stamm
      // holte über dieselbe Verankerung genau die Nachbarorte herein, die v4.4.4
      // ausgeschlossen hat.
      || (t.erlaubt.has('standort')
        && t.ortNadeln.some(n => entry.standortSuchform.includes(n)))
      || (t.erlaubt.has('bundesland') && trifftBundesland(t, entry))
      // Die Web-Adresse nutzt dieselbe verankerte Nadel — aus demselben Grund:
      // „gmbu" soll `gmbu.de` finden, aber nicht mitten in einer fremden Domain
      // treffen.
      || (t.erlaubt.has('domain')
        && t.ortNadeln.some(n => entry.domainSuchform.includes(n)))
      // Der Wahlkreis besteht aus Ortsnamen („Goslar - Northeim - Göttingen II")
      // und wird deshalb wie der Standort am Wortanfang verglichen.
      || (t.erlaubt.has('wahlkreis')
        && t.ortNadeln.some(n => entry.wahlkreisSuchform.includes(n)));
    const trifftThemen = verknuepfung === 'oder'
      ? themenTeile.some(trifft)
      : themenTeile.every(trifft);
    if (pflichtTeile.every(trifft) && trifftThemen) {
      out.set(akz, feldZuordnung(entry, teile));
      // Der Scan-Deckel bleibt die einzige Abbruchbedingung: Der frühere
      // Zusatz `varianten.size < VARIANTEN_MAX` hörte auf zu scannen, sobald 64
      // verschiedene Wörter beisammen waren — dann hätte der Zähler unten nur
      // die ersten Anträge gesehen und die Reihenfolge wäre wieder zufällig.
      if (stammSuche && !optionen.planTeile && gescannt < VARIANTEN_SCAN_MAX) {
        gescannt++;
        sammleAusEintrag(entry, teile, varianten);
      }
    }
  }
  // Häufigste zuerst: Die Deutungszeile zeigt nur die ersten acht, und die
  // sollen die gebräuchlichen Wörter des Bestands sein, nicht die des zufällig
  // ersten Treffers.
  const nachHaeufigkeit = Array.from(varianten.values())
    .sort((a, b) => b.anzahl - a.anzahl)
    .map(v => v.text);
  return { treffer: out, varianten: nachHaeufigkeit };
}

/** Ein Suchteil: der Wortlaut (für Anzeige und Zählung), die Nadeln (Wortlaut,
 *  Stamm, ausgewählte Varianten oder die Schreibweisen eines Frageplan-
 *  Leitbegriffs), die am Wortanfang verankerten Nadeln und die Felder, in denen
 *  DIESER Teil nachsehen darf. Die verankerten Nadeln bedienen Standort,
 *  Web-Adresse UND Wahlkreis — alle drei sind kurze, ineinander steckende
 *  Zeichenketten, in denen freies Substring-Matching Unsinn liefert. */
interface SuchTeil {
  wort: string;
  nadeln: string[];
  /**
   * Je Nadel ihr Platzhalter-Muster — `null`, wo keines noetig ist (der
   * Normalfall). EINMAL beim Bau compiliert, nicht je Eintrag: der Vergleich
   * laeuft ueber 14 000 Eintraege x Felder x Nadeln, und ein `new RegExp` oder
   * auch nur ein Map-Zugriff je Pruefung waere dort teurer als die Pruefung.
   */
  nadelMuster: Array<RegExp | null>;
  /** Verankerte Formen ALLER Nadeln, leere bereits ausgesiebt. */
  ortNadeln: string[];
  /** Die Länder-Kürzel, auf die sich dieser Teil auflösen lässt (gerahmt).
   *  Leer = der Teil benennt kein Bundesland, dann sucht `trifftBundesland`
   *  verankert weiter. */
  blNadeln: string[];
  /** Der Bereich — oder das eine Feld, wenn der Teil eines nennt. */
  erlaubt: ReadonlySet<Trefferfeld>;
  /**
   * Muss dieser Teil zutreffen? Nur ein Frageplan setzt das. Eine Ortsangabe
   * schränkt ein, sie ist keine weitere Alternative — als ODER-Teil lieferte
   * „in Bayern zu Normung" auch bayerische Vorhaben ohne Normungsbezug.
   */
  pflicht: boolean;
  /**
   * Wörtlich gemeint (der Teil stand in Anführungszeichen). Der Wortstamm bleibt
   * dann draußen — und mit ihm das Einsammeln der Wortformen: ein Chip
   * „Universitäten" unter `ast:"Technische Universität Chemnitz"` behauptete
   * eine Suche, die gar nicht läuft.
   */
  exakt: boolean;
}

/** Die Suchteile aus der getippten Anfrage — der Weg, den es immer gab.
 *
 *  „Genaue Wortfolge" sucht die Anfrage als EINE Zeichenkette; das Verhalten war
 *  bis v3.49 der einzige Weg. Als ausdrücklich gewählte Option ist es richtig,
 *  als stiller Standard war es der Defekt. */
function anfrageSuchTeile(
  query: string,
  verknuepfung: SuchVerknuepfung,
  stammSuche: boolean,
  aktiveVarianten: readonly string[] | undefined,
  bereichsFelder: ReadonlySet<Trefferfeld>,
): SuchTeil[] {
  return zerlegeFeldAnfrage(query, verknuepfung === 'wortfolge')
    .map(t => {
      const wort = t.wert.toLowerCase();
      const exakt = t.exakt === true;
      const nadeln = baueNadeln(wort, stammSuche && !exakt, aktiveVarianten);
      return {
        wort,
        nadeln,
        // Ein zitierter Teil ist woertlich gemeint — dort ist `?` ein
        // Fragezeichen und kein Platzhalter.
        nadelMuster: nadeln.map(n => (exakt ? null : baueNadelMuster(n))),
        ortNadeln: verankere([wort]),
        // Aus dem ROHEN Wort, nicht aus den Nadeln: der Stamm von „Sachsen"
        // benennt kein Land mehr, und ein halb getipptes Wort soll bewusst in
        // den Rückfall laufen.
        blNadeln: bundeslandNadeln([wort]),
        erlaubt: t.feld ? new Set<Trefferfeld>([t.feld]) : bereichsFelder,
        pflicht: false,
        exakt,
      };
    })
    .filter(t => t.wort.length > 0);
}

/**
 * Die Suchteile aus einem Frageplan: ein Leitbegriff wird EIN Teil, seine
 * Schreibweisen werden dessen Nadeln.
 *
 * Das ist der ganze Trick. Ein Teil gilt als getroffen, sobald irgendeine seiner
 * Nadeln trifft — `abdeckung` zählt damit die gefragten SACHEN, nicht die
 * Schreibweisen. Lägen die Schreibweisen als eigene Teile daneben, teilte die
 * Abdeckung durch ihre Anzahl und ein einschlägiges Vorhaben rutschte auf
 * „gering" (siehe [frageplan.ts](src/core/services/search/frageplan.ts)).
 *
 * Der Wortstamm läuft hier NICHT mit: die Wortformen hat der Plan schon benannt,
 * und ein zusätzlich abgeleiteter Stamm holte Treffer herein, die in keinem Chip
 * stehen.
 */
function planSuchTeile(
  plan: readonly PlanBegriff[],
  bereichsFelder: ReadonlySet<Trefferfeld>,
): SuchTeil[] {
  return plan
    .map(p => {
      const nadeln = p.nadeln.map(n => n.toLowerCase()).filter(n => n.length > 0);
      return {
        wort: p.begriff.toLowerCase(),
        nadeln,
        // Die Schreibweisen kommen aus dem Frageplan; ein `?` darin waere ein
        // Modell-Artefakt, kein Nutzerwunsch. Trotzdem dieselbe Weiche: die
        // KI darf Kennzeichen-Muster wie `16KN0830??` benennen.
        nadelMuster: nadeln.map(n => baueNadelMuster(n)),
        ortNadeln: verankere(nadeln),
        // Hier zählen die Schreibweisen mit: ein Frageplan nennt „Sachsen" und
        // „SN" als zwei Nadeln DESSELBEN Leitbegriffs.
        blNadeln: bundeslandNadeln([p.begriff, ...nadeln]),
        erlaubt: p.feld ? new Set<Trefferfeld>([p.feld]) : bereichsFelder,
        pflicht: p.pflicht,
        exakt: false,
      };
    })
    .filter(t => t.nadeln.length > 0);
}

/**
 * Trifft dieser Suchteil das Bundesland des Eintrags?
 *
 * **Erst vergleichen, dann suchen.** Löst sich das gefragte Wort auf eines der
 * 16 Länder auf — egal ob als Kürzel oder als Name getippt —, wird genau dieses
 * Land verglichen. Nur was sich NICHT auflöst (halb getippt, fremder Wert),
 * fällt auf die verankerte Suche zurück, damit die Suche beim Tippen weiter
 * etwas zeigt.
 *
 * Der Grund ist eine Eigenheit des Vokabulars: „Sachsen" steckt in
 * „Sachsen-Anhalt", und die Verankerung am Wortanfang trennt die beiden nicht —
 * `bl:Sachsen` lieferte am Bestand 3 278 statt 2 742 Treffer, darunter 536
 * Anträge aus Sachsen-Anhalt (v4.83). Wer ein Land aus der Vorschlagsliste
 * wählt, meint dieses Land, nicht seinen Namensvetter.
 */
function trifftBundesland(t: SuchTeil, entry: AntragTextEntry): boolean {
  if (t.blNadeln.length > 0) return t.blNadeln.some(n => entry.bundeslandCodes.includes(n));
  return t.ortNadeln.some(n => entry.bundeslandSuchform.includes(n));
}

/** Die aufgelösten Länder-Kürzel eines Suchteils, gerahmt und ohne Dubletten.
 *  Leer, sobald kein Wort ein Bundesland benennt — dann bleibt es beim
 *  Rückfall. */
function bundeslandNadeln(woerter: readonly string[]): string[] {
  const out: string[] = [];
  for (const w of woerter) {
    const n = bundeslandCodeNadel(bundeslandCode(w));
    if (n.length > 0 && !out.includes(n)) out.push(n);
  }
  return out;
}

/** Verankerte Formen für Standort, Web-Adresse und Wahlkreis. Leere Nadeln
 *  fallen hier heraus, damit die Match-Kette sie nicht mehr prüfen muss. */
function verankere(woerter: readonly string[]): string[] {
  const out: string[] = [];
  for (const w of woerter) {
    const n = standortNadel(w);
    if (n.length > 0 && !out.includes(n)) out.push(n);
  }
  return out;
}

/**
 * Wonach im Volltext gesucht wird.
 *
 * Drei Fälle, und der dritte ist der Grund für dieses ganze Konstrukt: sobald
 * der Nutzer eine Stamm-Variante ABWÄHLT, genügt der Stamm nicht mehr — er
 * fände sie ja weiterhin. Dann wird ausdrücklich nach dem getippten Wort und
 * den verbliebenen Varianten gesucht. Nur so hat das Abwählen eine Wirkung auf
 * die Treffermenge und ist nicht bloß eine Einfärbung.
 */
function baueNadeln(
  wort: string,
  stammSuche: boolean,
  aktiveVarianten: readonly string[] | undefined,
): string[] {
  if (!stammSuche) return [wort];
  if (aktiveVarianten === undefined) return [suchNadel(wort, true)];
  const stamm = suchNadel(wort, true);
  const passend = aktiveVarianten
    .map(v => v.toLowerCase())
    .filter(v => v.includes(stamm));
  return [wort, ...passend];
}

/**
 * Wie viele Varianten EINGESAMMELT werden — bewusst deutlich mehr, als die
 * Deutungszeile anzeigt.
 *
 * Der Grund ist keine Kosmetik: sobald der Nutzer eine Variante abwählt, sucht
 * die Stufe mit ausdrücklichen Nadeln (Wort + verbliebene Varianten) statt mit
 * dem Stamm. Was nie eingesammelt wurde, fehlt dann in den Nadeln — und der
 * Klick auf EINEN Chip nähme auch Treffer mit, die mit ihm nichts zu tun haben.
 * Am Bestand gemessen: mit Deckel 8 fiel „Normen" beim Abwählen einer Variante
 * von 28 auf 15 Treffer.
 */
const VARIANTEN_MAX = 64;
/** Wie viele Treffer dafür durchsucht werden. Das Einsammeln läuft mit einem
 *  Regex über den Volltext — bei einer ODER-Anfrage mit tausenden Treffern wäre
 *  das ohne Deckel der teuerste Teil der Suche. */
const VARIANTEN_SCAN_MAX = 200;

/**
 * Sammelt die Wörter, die dieser Eintrag über den Stamm mitbringt. Aus den
 * ROHEN Feldern, damit die Chips die Schreibweise des Antrags zeigen.
 *
 * Mitgezählt wird, in wie vielen Anträgen eine Variante vorkommt — die
 * Deutungszeile zeigt nur acht der bis zu 64 gesammelten, und bis v4.68 waren
 * das schlicht die ersten in Korpus-Reihenfolge. Am Bestand gemessen hieß das:
 * „Normen und Standards" zeigte „normotherme" (ein einziger Antrag) und ließ
 * „Standardisierung" (dutzende) unsichtbar. Ein Zähler kostet nichts und macht
 * aus dem beliebigen Ausschnitt die acht gebräuchlichsten Wörter.
 */
function sammleAusEintrag(
  entry: AntragTextEntry,
  teile: readonly SuchTeil[],
  ziel: Map<string, { text: string; anzahl: number }>,
): void {
  const text = `${entry.vb} ${entry.tv} ${entry.abstract} ${entry.descriptors}`;
  for (const t of teile) {
    if (t.exakt) continue; // wörtlich gesucht — es gibt keine Wortformen dazu
    const stamm = suchNadel(t.wort, true);
    if (stamm === t.wort) continue; // nichts abgelöst — keine Varianten möglich
    for (const v of sammleVarianten(text, stamm, t.wort, VARIANTEN_MAX)) {
      const key = v.toLowerCase();
      const da = ziel.get(key);
      if (da) { da.anzahl++; continue; }
      // Neue Varianten nur bis zum Deckel — vorhandene weiterzählen aber immer,
      // sonst hinge die Reihenfolge davon ab, wann der Deckel erreicht wurde.
      if (ziel.size < VARIANTEN_MAX) ziel.set(key, { text: v, anzahl: 1 });
    }
  }
}

/** Was die Wortlaut-Stufe wissen muss. Ein Objekt statt vier Stellungsparameter,
 *  weil sonst niemand mehr sieht, welches `true` welche Option meint. */
export interface WortlautOptionen {
  verknuepfung?: SuchVerknuepfung;
  /** Wortstamm-Varianten mitsuchen. */
  stammSuche?: boolean;
  /** Worin gesucht wird. */
  bereich?: Suchbereich;
  /**
   * Die NICHT abgewählten Stamm-Varianten. `undefined` heißt „der Nutzer hat
   * noch nichts abgewählt" — dann genügt der Stamm. Eine leere Liste heißt „alle
   * abgewählt" und ist etwas anderes.
   */
  aktiveVarianten?: readonly string[];
  /**
   * Die Leitbegriffe eines Frageplans. Gesetzt heißt: die Suchteile kommen VON
   * HIER, nicht aus `query` — im Feld steht dann die Frage, deren Wörter keine
   * Suchbegriffe sind.
   *
   * `undefined` ist der Normalfall und lässt die Stufe bitweise so laufen wie
   * vor dem Frageplan; ein Konventionstest hält das fest.
   */
  planTeile?: readonly PlanBegriff[];
}

/** Was ein Wortlaut-Lauf liefert: die Treffer und die Wörter, die der Bestand
 *  über den Stamm beigesteuert hat. */
export interface WortlautErgebnis {
  treffer: Map<string, WortlautTreffer>;
  varianten: string[];
}

/**
 * Zweiter Durchgang, NUR für bereits bestätigte Treffer: welche Felder trafen,
 * und wie viele der Suchwörter fanden überhaupt eine Fundstelle.
 *
 * Bewusst getrennt vom Match-Durchgang oben. Dort steht eine Oder-Kette, die
 * beim ersten Treffer abbricht — über 14 000 Einträge ist genau dieser
 * Kurzschluss der Grund, warum die Wortlaut-Stufe in ~10–30 ms durchläuft. Hier
 * werden alle Felder geprüft, aber nur für die Handvoll Einträge, die ohnehin
 * in der Ergebnisliste landen.
 */
function feldZuordnung(
  entry: AntragTextEntry,
  teile: readonly SuchTeil[],
): WortlautTreffer {
  const felder = new Set<Trefferfeld>();
  let getroffen = 0;
  // Gezählt werden nur die THEMEN. Eine Einschränkung ist bei jedem überlebenden
  // Treffer erfüllt — sie mitzuzählen hübe die Relevanz aller Treffer gleich an,
  // und die Stufe „hoch" sagte nichts mehr aus. Ohne Pflichtteile ist `zaehlbar`
  // gleich `teile.length`, also die Rechnung von zuvor.
  let zaehlbar = 0;
  for (const t of teile) {
    let trifftIrgendwo = false;
    const merke = (feld: Trefferfeld, bedingung: boolean): void => {
      if (!bedingung || !t.erlaubt.has(feld)) return;
      felder.add(feld);
      trifftIrgendwo = true;
    };
    // Der BELEG darf nie strenger sein als der Treffer: eine Nadel mit
    // Platzhalter faende `.includes('mobi?nspec')` nirgends, und die Zeile
    // stuende ohne Trefferstelle da — gefunden, aber unerklaert.
    const in_ = (feld: string): boolean => t.nadeln.some((n, i) => {
      const m = t.nadelMuster[i];
      return m !== null && m !== undefined ? musterTrifft(feld, m) : feld.includes(n);
    });
    merke('titel', in_(entry.vbLower) || in_(entry.tvLower));
    merke('kurzbeschreibung', in_(entry.absLower));
    merke('deskriptoren', in_(entry.descriptorsLower));
    merke('akronym', in_(entry.akronymLower));
    merke('aktenzeichen', in_(entry.akzLower));
    merke('verbundkennzeichen', in_(entry.verbundNrLower));
    merke('organisation', in_(entry.organisationLower));
    merke('netzwerk', in_(entry.netzwerkLower));
    merke('notiz', in_(entry.notizLower));
    merke('domain', t.ortNadeln.some(n => entry.domainSuchform.includes(n)));
    merke('standort', t.ortNadeln.some(n => entry.standortSuchform.includes(n)));
    merke('bundesland', trifftBundesland(t, entry));
    merke('wahlkreis', t.ortNadeln.some(n => entry.wahlkreisSuchform.includes(n)));
    if (t.pflicht) continue;
    zaehlbar++;
    if (trifftIrgendwo) getroffen++;
  }
  return { felder, abdeckung: zaehlbar > 0 ? getroffen / zaehlbar : 0 };
}

/** Effektiver Score-Cutoff fuer einen Lauf: nie unter dem absoluten Floor,
 *  sonst relativ zur besten Cosine (adaptive Schwelle, s.o.). Pure — testbar. */
export function computeEmbeddingCutoff(bestScore: number): number {
  return Math.max(EMBEDDING_SCORE_FLOOR, bestScore * EMBEDDING_RELATIVE_CUTOFF);
}

async function topKEmbeddingMatches(
  queryVec: number[],
  embeddings: Map<string, number[]>,
  topK: number,
  signal?: AbortSignal,
): Promise<Array<{ akz: string; score: number }>> {
  // Pass 1: Kandidaten ≥ Floor sammeln + beste Cosine tracken (der relative
  // Cutoff ist erst NACH dem Scan bekannt). Kandidaten-Menge bleibt klein
  // (nur ≥ Floor), kein zweiter Cosine-Pass noetig.
  const candidates: Array<{ akz: string; score: number }> = [];
  let i = 0;
  // Diagnose (v2.62.3): beste Cosine + Dim-Skips mitzählen — bei 0 Treffern
  // unterscheidet das Schwelle-zu-streng / Vektorraum-inkompatibel /
  // Dim-Mismatch. Unter file:// ist die Console die einzige Spur.
  let best = -Infinity;
  let bestAkz = '';
  let skippedDim = 0;
  for (const [akz, vec] of embeddings.entries()) {
    if (vec.length !== queryVec.length) { skippedDim++; continue; }
    const s = cosineSimilarity(queryVec, vec);
    if (s > best) { best = s; bestAkz = akz; }
    if (s >= EMBEDDING_SCORE_FLOOR) candidates.push({ akz, score: s });
    if (++i % COSINE_YIELD_INTERVAL === 0) {
      await new Promise(r => setTimeout(r, 0));
      if (signal?.aborted) return [];
    }
  }
  const cutoff = computeEmbeddingCutoff(best);
  const hits = candidates.filter(c => c.score >= cutoff);
  if (hits.length === 0) {
    console.info(
      `[antraege-search] Vector: 0 Treffer (Floor ${EMBEDDING_SCORE_FLOOR}) — beste Cosine ${Number.isFinite(best) ? best.toFixed(3) : 'n/a'}`
      + (bestAkz ? ` (${bestAkz})` : '')
      + (skippedDim > 0 ? `; ${skippedDim} Vektoren mit fremder Dimension übersprungen` : ''),
    );
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, topK);
}

/** Dedup-Strategie: max-score gewinnt, method-Tag wandert mit. */
function mergeHit(
  acc: Map<string, AntragSearchHit>,
  hit: AntragSearchHit,
): void {
  const prev = acc.get(hit.aktenzeichen);
  if (!prev || hit.score > prev.score) acc.set(hit.aktenzeichen, hit);
}

// ----- Public API ------------------------------------------------------------

/**
 * Fuehrt die Antrags-Hybrid-Suche aus und liefert dedupliziert/sortierte
 * Treffer mit Scores. Pure Funktion ohne Side-Effects auf Stores.
 *
 * Bei Abbruch via `abortSignal` wirft die Funktion `DOMException('Aborted')`.
 */
export async function searchAntraege(
  opts: SearchAntraegeOptions,
): Promise<AntraegeSearchResult> {
  const { query, idb, programmId, abortSignal, planTeile } = opts;
  const merged = new Map<string, AntragSearchHit>();
  const unavailable: HybridUnavailableSource[] = [];

  const caches = await getProgrammCaches(idb, programmId);
  if (abortSignal.aborted) throw new DOMException('Aborted', 'AbortError');

  // Quelle 1: Substring (sync). Mit Plan kommen die Suchteile aus ihm.
  const wortlautOptionen = planTeile ? { planTeile } : {};
  for (const [akz, treffer] of substringMatches(query, caches.textCorpus, wortlautOptionen).treffer) {
    mergeHit(merged, {
      aktenzeichen: akz,
      score: berechneRelevanz(treffer.felder, treffer.abdeckung),
      method: 'fulltext',
    });
  }

  // Zu kurz für die Index-Stufen → es bleibt beim Wortlaut.
  if (query.length < MIN_QUERY_LEN_FOR_INDEX) {
    return { hits: sortByScore(merged), unavailable };
  }

  // **Opt-in gilt NUR für die Ähnlichkeit.** Bis v4.64 hing die DMS-Stufe am
  // selben Schalter und war im Normalzustand mit aus — das Suchfeld versprach
  // im Platzhalter Dokumente, die es dann nicht geben konnte. Der Dokument-Index
  // braucht das Modell aber gar nicht: `hybridSearch(query, null)` läuft als
  // reiner Wortlaut-Lauf über Orama, ohne Ladezeit und ohne Arbeitsspeicher.
  // Was das Opt-in schützt, ist das Modell — nicht der Index.
  const semantisch = isSemanticSearchActive();

  // Embedding-Service initialisieren (lazy, idempotent). Ohne Opt-in bleibt
  // `queryVec` null — bewusst auch ohne `unavailable`-Eintrag (kein
  // irreführender „Embedding fehlt"-Hinweis, der User hat die
  // Ähnlichkeitssuche schlicht nicht eingeschaltet).
  let modelReady = false;
  let queryVec: number[] | null = null;
  if (semantisch) {
    try {
      await ensureEmbeddingReady(idb);
      modelReady = true;
    } catch (err) {
      console.warn('[antraege-search-service] embedding init failed:', err);
      unavailable.push('embedding');
    }
    if (abortSignal.aborted) throw new DOMException('Aborted', 'AbortError');

    if (modelReady) {
      try {
        queryVec = await embedText(query, 'query');
      } catch (err) {
        console.warn('[antraege-search-service] query embed failed:', err);
      }
    }
    if (abortSignal.aborted) throw new DOMException('Aborted', 'AbortError');
  }

  // Quelle 2: Embedding-Korpus
  if (semantisch && queryVec && modelReady) {
    try {
      const embeddings = await getEmbeddings(idb);
      if (embeddings.size === 0) {
        if (!unavailable.includes('embedding')) unavailable.push('embedding');
      } else if (cachedEmbeddingsDim !== null && cachedEmbeddingsDim !== queryVec.length) {
        console.warn(
          `[antraege-search-service] embedding dim mismatch: query=${queryVec.length} corpus=${cachedEmbeddingsDim}`,
        );
        if (!unavailable.includes('embedding')) unavailable.push('embedding');
      } else {
        const embHits = await topKEmbeddingMatches(
          queryVec, embeddings, EMBEDDING_TOP_K, abortSignal,
        );
        for (const h of embHits) {
          mergeHit(merged, { aktenzeichen: h.akz, score: h.score, method: 'vector' });
        }
      }
    } catch (err) {
      console.warn('[antraege-search-service] embedding search failed:', err);
      if (!unavailable.includes('embedding')) unavailable.push('embedding');
    }
  } else if (semantisch && modelReady) {
    if (!unavailable.includes('embedding')) unavailable.push('embedding');
  }
  if (abortSignal.aborted) throw new DOMException('Aborted', 'AbortError');

  // Quelle 3: DMS-Index (Orama). Läuft IMMER — mit `queryVec` als Hybrid-Lauf,
  // ohne ihn als Wortlaut-Lauf.
  if (getOramaDB() === null) {
    unavailable.push('dms');
  } else {
    try {
      const dmsHits = hybridSearch(query, queryVec, {
        type: 'dokument',
        limit: DMS_HIT_LIMIT,
      });
      for (const hit of dmsHits) {
        const akz = caches.filenameToAkz.get(hit.source);
        if (akz) {
          mergeHit(merged, { aktenzeichen: akz, score: hit.score, method: 'hybrid' });
        }
      }
    } catch (err) {
      console.warn('[antraege-search-service] DMS search failed:', err);
      unavailable.push('dms');
    }
  }

  return { hits: sortByScore(merged), unavailable };
}

function sortByScore(merged: Map<string, AntragSearchHit>): AntragSearchHit[] {
  return Array.from(merged.values()).sort((a, b) => b.score - a.score);
}

/** Test-only: liest die aktuell gecachte Embedding-Dimension. `null` wenn
 *  noch nichts geladen ist. */
export function _getCachedEmbeddingsDim(): number | null {
  return cachedEmbeddingsDim;
}

// ----- Streaming-API (Stage-by-Stage) ----------------------------------------
//
// Die drei Funktionen unten geben dem Caller eine progressive Pipeline:
// Substring-Hits sind sofort verfuegbar (sync, <20 ms bei warmem Korpus);
// Vector- und DMS-Hits kommen async hinterher. `useUnifiedSearch` orchestriert
// das in drei Render-Stages, damit der User schon Treffer sieht waehrend
// Embedding + Orama noch laufen.
//
// Die bestehende `searchAntraege` bleibt unveraendert (sie ist aequivalent zu
// Substring + Vector + DMS in einem Aufruf) und wird weiter von
// `useAntraegeHybridSearch` genutzt.

/**
 * Stage 1: Wortlaut-Match (sync). Je Aktenzeichen die getroffenen Felder und die
 * Wort-Abdeckung — die Belege, aus denen die Suchseite Relevanz, Trefferstellen-
 * Tags und die Facette „Trefferstelle" bildet.
 */
export function searchAntraegeWortlaut(
  query: string,
  textCorpus: Map<string, AntragTextEntry>,
  optionen: WortlautOptionen = {},
): WortlautErgebnis {
  return substringMatches(query, textCorpus, optionen);
}

/** Stage 1, schlanke Fassung: nur die Aktenzeichen. Für Konsumenten, die die
 *  Fundstellen nicht anzeigen (Förderanträge-Liste, Probeläufe der
 *  Kein-Treffer-Auswege). */
export function searchAntraegeSubstring(
  query: string,
  textCorpus: Map<string, AntragTextEntry>,
  optionen: WortlautOptionen = {},
): string[] {
  return Array.from(substringMatches(query, textCorpus, optionen).treffer.keys());
}

/** Stage 2: Embedding-Cosine-Match (async, mit Yield-Loop). Braucht einen
 *  bereits berechneten queryVec; ruft `topKEmbeddingMatches` intern auf. */
export async function searchAntraegeVector(
  queryVec: number[],
  embeddings: Map<string, number[]>,
  signal: AbortSignal,
): Promise<Array<{ akz: string; score: number }>> {
  if (embeddings.size === 0) return [];
  if (cachedEmbeddingsDim !== null && cachedEmbeddingsDim !== queryVec.length) {
    console.warn(
      `[antraege-search-service] embedding dim mismatch: query=${queryVec.length} corpus=${cachedEmbeddingsDim}`,
    );
    return [];
  }
  return topKEmbeddingMatches(queryVec, embeddings, EMBEDDING_TOP_K, signal);
}

/** Stage 3 (Antraege-Anteil): DMS-Index-Match → Antrag-Hits via filenameToAkz.
 *  Sync (Orama selbst ist sync). Liefert leere Liste wenn Index nicht da ist. */
export function searchAntraegeDms(
  query: string,
  queryVec: number[] | null,
  filenameToAkz: Map<string, string>,
  verknuepfung: SuchVerknuepfung = 'und',
): Array<{ akz: string; score: number }> {
  if (getOramaDB() === null) return [];
  try {
    const dmsHits = hybridSearch(query, queryVec, {
      type: 'dokument',
      limit: DMS_HIT_LIMIT,
      threshold: verknuepfungAlsThreshold(verknuepfung),
    });
    const out: Array<{ akz: string; score: number }> = [];
    for (const hit of dmsHits) {
      const akz = filenameToAkz.get(hit.source);
      if (akz) out.push({ akz, score: hit.score });
    }
    return out;
  } catch (err) {
    console.warn('[antraege-search-service] DMS search failed:', err);
    return [];
  }
}

/** Re-export der Streaming-Konstanten, damit Caller (z.B. useUnifiedSearch)
 *  konsistente Schwellen verwenden. Das frühere statische
 *  `SEMANTIC_SOURCES_ENABLED` ist hier raus — Caller nutzen das Laufzeit-Gate
 *  `isSemanticSearchActive()` (Build-Flag + Session-Opt-in, v2.62). */
export const STREAMING_CONSTS = {
  /** Schlüssel bleibt: die Suchseite gated damit ihre EMBEDDING-Stufe, und für
   *  die ist es dieselbe Untergrenze wie für die Index-Stufen hier. */
  MIN_QUERY_LEN_FOR_SEMANTIC: MIN_QUERY_LEN_FOR_INDEX,
} as const;
