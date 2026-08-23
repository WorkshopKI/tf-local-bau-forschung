/**
 * Ein Lauf, der einen Geraeteverlust ueberlebt.
 *
 * Vorher endete ein Vollbau dort, wo die Grafikkarte aufgab: nach ~810 von
 * 14.221 Vektoren warf jeder weitere Aufruf sofort, und der Lauf brach nach
 * zwanzig Fehlschlaegen in Folge ab ([geraet.ts](./geraet.ts) erklaert den
 * Befund). Jetzt laedt er das Modell nach und rechnet weiter — beim ersten Mal
 * wieder auf der Grafikkarte, und sobald die nichts mehr einbringt, auf dem
 * Hauptprozessor.
 *
 * Zwei Leitplanken, beide gegen dieselbe Gefahr — dass die Erholung teurer wird
 * als der Schaden:
 *  - **Hoechstens ein Neuladen je Datensatz.** Ein Datensatz, der das Modell
 *    reproduzierbar zerlegt, soll nicht vierzig Ladelaeufe ausloesen.
 *  - **Nur bei Geraeteverlust.** Was nach kaputtem Text aussieht, wird gezaehlt
 *    und nicht behandelt.
 */
import type { IDBStore } from '@/core/services/storage/idb-store';
import {
  istGeraeteverlust,
  planeErholung,
  merkeGeraetPraeferenz,
  GERAET_LABEL,
  type EmbeddingGeraet,
} from './geraet';
import { embedText, ladeEmbeddingNeu, aktivesEmbeddingGeraet } from './wrapper';

export interface ErholungsMeldung {
  /** Die wievielte Erholung dieses Laufs. */
  nummer: number;
  /** Worauf ab jetzt gerechnet wird. */
  geraet: EmbeddingGeraet;
  /** Hat sich das Rechenwerk dabei geaendert — oder wurde nur neu geladen? */
  gewechselt: boolean;
  /** Wie viele Vektoren seit der vorigen Erholung gelungen sind. */
  ertrag: number;
  /** Wortlaut des Fehlers, der sie ausgeloest hat. */
  grund: string;
}

export interface Erholer {
  /** Ein Vektor ist gelungen — Ertragszaehler fuer die naechste Entscheidung. */
  gelungen(): void;
  /**
   * Versucht, den Lauf zu retten. `true` = das Modell steht wieder, der
   * Aufrufer darf denselben Datensatz erneut versuchen.
   */
  erhole(err: unknown): Promise<boolean>;
  /** Worauf gerade gerechnet wird. */
  readonly geraet: EmbeddingGeraet;
  /** Alle Erholungen dieses Laufs, in der Reihenfolge ihres Auftretens. */
  readonly meldungen: readonly ErholungsMeldung[];
}

export interface ErholerOptionen {
  /** Wird gerufen, BEVOR nachgeladen wird — die Oberflaeche friert sonst wortlos ein. */
  onLadenBeginnt?: (geraet: EmbeddingGeraet, nummer: number) => void;
  /** Wird gerufen, wenn das Modell wieder steht. */
  onErholt?: (m: ErholungsMeldung) => void;
}

export function erzeugeErholer(idb: IDBStore, opts: ErholerOptionen = {}): Erholer {
  // Ohne geladenes Modell gibt es nichts zu erholen; 'wasm' ist dann die
  // konservative Annahme (der Plan gibt darauf sofort auf).
  let geraet: EmbeddingGeraet = aktivesEmbeddingGeraet() ?? 'wasm';
  let seitErholung = 0;
  let erholungen = 0;
  const meldungen: ErholungsMeldung[] = [];

  return {
    get geraet() { return geraet; },
    get meldungen() { return meldungen; },

    gelungen() { seitErholung++; },

    async erhole(err: unknown): Promise<boolean> {
      if (!istGeraeteverlust(err)) return false;
      const grund = err instanceof Error ? err.message : String(err);
      const plan = planeErholung({ geraet, seitErholung, erholungen });
      if (plan.art === 'aufgeben') {
        console.error(
          `[embedding-erholung] aufgegeben (${plan.grund}) nach ${erholungen} Erholungen `
          + `auf ${GERAET_LABEL[geraet]}. Letzter Fehler: ${grund}`,
        );
        return false;
      }

      const nummer = erholungen + 1;
      const gewechselt = plan.geraet !== geraet;
      opts.onLadenBeginnt?.(plan.geraet, nummer);
      console.warn(
        `[embedding-erholung] ${nummer}. Erholung: ${GERAET_LABEL[geraet]} nach ${seitErholung} `
        + `Vektoren verloren — lade Modell neu auf ${GERAET_LABEL[plan.geraet]}.`,
      );
      try {
        await ladeEmbeddingNeu(idb, plan.geraet);
      } catch (ladeFehler) {
        console.error('[embedding-erholung] Neuladen fehlgeschlagen:', ladeFehler);
        return false;
      }

      // Der Wechsel ueberlebt den Lauf: der naechste Bau soll nicht wieder fuenf
      // Minuten in dieselbe tote Grafikkarte rechnen. Ein blosses Neuladen auf
      // demselben Rechenwerk hat nichts zu merken.
      if (gewechselt) {
        await merkeGeraetPraeferenz(idb, {
          geraet: plan.geraet,
          grund,
          am: new Date().toISOString(),
        }).catch(() => { /* eine Notiz darf den Lauf nicht kippen */ });
      }

      const meldung: ErholungsMeldung = {
        nummer, geraet: plan.geraet, gewechselt, ertrag: seitErholung, grund,
      };
      meldungen.push(meldung);
      erholungen = nummer;
      geraet = plan.geraet;
      seitErholung = 0;
      opts.onErholt?.(meldung);
      return true;
    },
  };
}

/**
 * `embedText` mit genau einem zweiten Anlauf, falls das Rechenwerk dazwischen
 * weggebrochen ist.
 *
 * Bewusst kein `while` — siehe Dateikopf: hoechstens ein Neuladen je Datensatz.
 * Scheitert auch der zweite Anlauf, faellt der Fehler durch und der Aufrufer
 * zaehlt ihn wie bisher.
 */
export async function embedMitErholung(
  text: string,
  mode: 'query' | 'document',
  erholer: Erholer,
): Promise<number[]> {
  try {
    const vec = await embedText(text, mode);
    erholer.gelungen();
    return vec;
  } catch (err) {
    if (!(await erholer.erhole(err))) throw err;
    const vec = await embedText(text, mode);
    erholer.gelungen();
    return vec;
  }
}
