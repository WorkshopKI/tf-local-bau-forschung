/**
 * Wie lange der Korpus-Bau auf DIESEM Rechner je Vektor braucht — gemessen,
 * nicht geraten.
 *
 * Vorher stand am Knopf `Neu aufbauen (~48 min)`, gerechnet aus dem Literal
 * `0.2` Sekunden je Vorhaben, das an zwei Stellen in der Karte eingestreut war
 * und nie an einem Lauf geprueft wurde. Die Zahl haengt aber an Dingen, die der
 * Code nicht kennt: WebGPU oder WASM, Citrix oder Laptop, Textlaenge des
 * Bestands. Eine Zusage ueber 48 Minuten, die aus einer erfundenen Konstante
 * kommt, ist schlechter als gar keine.
 *
 * Deshalb: nach jedem **vollstaendigen, fehlerfreien** Lauf die tatsaechliche
 * Rate merken, und bis dahin gar keine Minutenzahl behaupten (die Karte zeigt
 * dann die Anzahl der Vektoren).
 *
 * **Maschine-lokal** — wie der Nachlauf-Schalter ([korpus-nachlauf.ts](./korpus-nachlauf.ts)):
 * die Rate beschreibt diesen Rechner, nicht das Team, und hat auf dem Share
 * nichts zu suchen.
 */
import type { IDBStore } from '@/core/services/storage/idb-store';
import type { EmbeddingGeraet } from '@/core/services/embedding-corpus';

/** Maschine-lokal, nie auf dem Share (siehe Dateikopf). */
export const BAU_RATE_KEY = 'emb-korpus-bau-rate';

export interface BauRate {
  /** Sekunden je tatsaechlich eingebettetem Vektor. */
  sekProItem: number;
  /** Wie viele Vektoren die Messung getragen haben (Vorhaben + Verbuende). */
  items: number;
  /** Davon Vorhaben-Vektoren. */
  vorhabenItems: number;
  /** Davon Verbund-Vektoren — die zweite Phase, die keine Vorschau kennt. */
  verbundItems: number;
  /** ISO-Zeitstempel der Messung. */
  gemessenAm: string;
  /**
   * Worauf gerechnet wurde — fehlt bei Messungen vor v6.18.
   *
   * Eine Rate ohne ihr Rechenwerk ist eine Zahl ohne Einheit: der
   * Hauptprozessor braucht ein Vielfaches der Grafikkarte, und wer beides in
   * denselben Wert mittelt, sagt fuer keinen von beiden die Wahrheit.
   */
  geraet?: EmbeddingGeraet;
}

/**
 * Wie lange ein Vollbau ueber `embedbar` Vorhaben auf diesem Rechner dauern
 * wird — in Sekunden, oder `null` ohne Messung.
 *
 * Die Zahl der Verbuende kommt aus der letzten Messung: sie aendert sich von
 * Lauf zu Lauf kaum, und sie im Voraus zu ermitteln hiesse, den Bestand ein
 * zweites Mal durchzustreamen, nur um eine Minutenangabe zu schmuecken.
 */
export function schaetzeVollbauSekunden(
  rate: BauRate | null,
  embedbar: number,
  geraet?: EmbeddingGeraet | null,
): number | null {
  if (!rate || embedbar <= 0) return null;
  // Eine Rate von der Grafikkarte sagt ueber einen Lauf auf dem Hauptprozessor
  // nichts — dann lieber keine Minutenzahl als eine falsche. `null` auf einer
  // der beiden Seiten heisst „nicht bekannt": kein Grund, die Messung zu
  // verwerfen (Messungen vor v6.18 tragen kein Rechenwerk).
  if (geraet && rate.geraet && rate.geraet !== geraet) return null;
  return rate.sekProItem * (embedbar + rate.verbundItems);
}

/**
 * Eine Messung ist nur dann eine, wenn sie auf genug Vektoren steht.
 *
 * Ein Nachzieh-Lauf ueber drei Antraege misst hauptsaechlich den Warmlauf der
 * Kernel und wuerde eine Vollbau-Schaetzung um ein Vielfaches verfehlen.
 */
export const MESSUNG_MINDEST_ITEMS = 50;

export async function ladeBauRate(idb: IDBStore): Promise<BauRate | null> {
  const roh = await idb.get<BauRate>(BAU_RATE_KEY);
  if (!roh || typeof roh.sekProItem !== 'number' || !(roh.sekProItem > 0)) return null;
  return {
    ...roh,
    vorhabenItems: typeof roh.vorhabenItems === 'number' ? roh.vorhabenItems : roh.items,
    verbundItems: typeof roh.verbundItems === 'number' ? roh.verbundItems : 0,
  };
}

/**
 * Rate aus einem gelaufenen Bau ableiten — oder `null`, wenn dieser Lauf nichts
 * zu sagen hat.
 *
 * `items` sind die **eingebetteten** Vektoren, nicht die Durchlaeufe: Antraege
 * ohne Text und gescheiterte kosten Millisekunden und wuerden die Rate
 * schoenrechnen. Genau daran ist die alte Schaetzung zerbrochen — ein Lauf, der
 * 13.418 Datensaetze in einer Minute „erledigte", sah schneller aus als er war.
 */
export function berechneBauRate(
  dauerMs: number,
  vorhabenItems: number,
  verbundItems: number,
  jetztIso: string,
  geraet?: EmbeddingGeraet | null,
): BauRate | null {
  const items = vorhabenItems + verbundItems;
  if (items < MESSUNG_MINDEST_ITEMS || dauerMs <= 0) return null;
  return {
    sekProItem: dauerMs / 1000 / items,
    items,
    vorhabenItems,
    verbundItems,
    gemessenAm: jetztIso,
    ...(geraet ? { geraet } : {}),
  };
}

export async function merkeBauRate(idb: IDBStore, rate: BauRate): Promise<void> {
  await idb.set(BAU_RATE_KEY, rate);
}
