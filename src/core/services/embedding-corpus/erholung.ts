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
  /**
   * Stand das Modell danach wieder?
   *
   * Ein gescheiterter Versuch bleibt im Protokoll, damit die Oberflaeche ihn
   * nennen kann. Fehlte er, waere „es wurde nichts versucht" von „der Versuch
   * misslang" nicht zu unterscheiden — und genau daran ist die Ferndiagnose
   * eines gemeldeten Abbruchs gescheitert.
   */
  erfolg: boolean;
  /** Warum das Neuladen selbst misslang (nur bei `erfolg: false`). */
  ladeFehler?: string;
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
      opts.onLadenBeginnt?.(plan.geraet, nummer);
      console.warn(
        `[embedding-erholung] ${nummer}. Erholung: ${GERAET_LABEL[geraet]} nach ${seitErholung} `
        + `Vektoren verloren — lade Modell neu auf ${GERAET_LABEL[plan.geraet]}.`,
      );

      // Scheitert das Neuladen auf der Grafikkarte, ist der HAUPTPROZESSOR die
      // letzte Rettung — nicht das Ende. ONNX haelt seine WebGPU-Umgebung
      // global; ist sie einmal zerlegt, kann auch eine frische Session dort
      // nicht mehr entstehen, und ohne diesen zweiten Anlauf waere die Erholung
      // in genau dem Fall wirkungslos, fuer den sie gebaut wurde.
      const wege: EmbeddingGeraet[] = plan.geraet === 'webgpu' ? ['webgpu', 'wasm'] : ['wasm'];
      let geladenAuf: EmbeddingGeraet | null = null;
      let ladeFehler: string | undefined;
      for (const weg of wege) {
        try {
          if (weg !== plan.geraet) opts.onLadenBeginnt?.(weg, nummer);
          await ladeEmbeddingNeu(idb, weg);
          geladenAuf = weg;
          break;
        } catch (err2) {
          ladeFehler = err2 instanceof Error ? err2.message : String(err2);
          console.error(
            `[embedding-erholung] Neuladen auf ${GERAET_LABEL[weg]} fehlgeschlagen:`, err2,
          );
        }
      }

      if (!geladenAuf) {
        // Auch ein GESCHEITERTER Rettungsversuch gehoert ins Protokoll. Ohne ihn
        // sieht die Karte hinterher aus wie eine Fassung ganz ohne Erholung —
        // und niemand kann unterscheiden, ob es versucht wurde oder ob der
        // Build von gestern ist (genau daran ist die Diagnose 08/2026 gescheitert).
        meldungen.push({
          nummer, geraet, gewechselt: false, ertrag: seitErholung, grund,
          erfolg: false, ladeFehler,
        });
        return false;
      }

      // Der Wechsel ueberlebt den Lauf: der naechste Bau soll nicht wieder fuenf
      // Minuten in dieselbe tote Grafikkarte rechnen. Ein blosses Neuladen auf
      // demselben Rechenwerk hat nichts zu merken.
      const gewechselt = geladenAuf !== geraet;
      if (gewechselt) {
        await merkeGeraetPraeferenz(idb, {
          geraet: geladenAuf,
          grund,
          am: new Date().toISOString(),
        }).catch(() => { /* eine Notiz darf den Lauf nicht kippen */ });
      }

      const meldung: ErholungsMeldung = {
        nummer, geraet: geladenAuf, gewechselt, ertrag: seitErholung, grund, erfolg: true,
      };
      meldungen.push(meldung);
      erholungen = nummer;
      geraet = geladenAuf;
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
