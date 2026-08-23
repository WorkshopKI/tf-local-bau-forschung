/**
 * Ein Vollbau, der einen Seiten-Neustart überlebt.
 *
 * **Warum das nötig ist.** Auf manchen Rechnern stirbt das ONNX-Modul nach
 * einigen hundert Einbettungen (`[Device] is lost`), und **innerhalb derselben
 * Seite ist es danach nicht zu heilen**: WebGPU- und CPU-Provider liegen in
 * EINEM WASM-Modul, ORT hält es global, und ein zweiter Ladeversuch bekommt
 * kein frisches — er endet in einem rohen Emscripten-Abbruch (gemeldet als
 * nackte Zahl, z.B. `12851960`). Nur ein neuer JavaScript-Kontext hilft, also
 * ein Neuladen der Seite.
 *
 * Deshalb merkt sich der Bau, was noch offen ist, lädt die Seite neu und macht
 * weiter. Die bereits erzeugten Vektoren liegen in der IndexedDB und bleiben.
 *
 * **Die offenen Aktenzeichen stehen explizit im Merker** — nicht „ab Position
 * N". Ein abgebrochener Vollbau im GLEICHEN Vektorraum hinterlässt sonst einen
 * Zustand, in dem „nichts offen" ist: die alten Vektoren liegen ja noch da und
 * ihre Text-Hashes stimmen. Nur die Liste weiß, was dieser Lauf noch vorhat.
 *
 * **Maschine-lokal** — wie die Bau-Rate: der Merker beschreibt einen Lauf auf
 * diesem Rechner und hat auf dem Share nichts zu suchen.
 */
import type { IDBStore } from '@/core/services/storage/idb-store';

export const FORTSETZUNG_KEY = 'emb-bau-fortsetzung';

/**
 * Nach so vielen Neustarts wird aufgegeben.
 *
 * Ein Vollbau über 14.221 Vorhaben braucht bei ~810 Vektoren je Geräteleben
 * rund achtzehn. Dreißig lassen Luft und verhindern trotzdem, dass ein Rechner
 * sich in einer Neustart-Schleife festfährt.
 */
export const NEUSTART_MAX = 30;

export interface BauFortsetzung {
  programmId: string | null;
  /** War der unterbrochene Lauf ein Vollbau? Trägt die Beschriftung. */
  voll: boolean;
  /** Was dieser Lauf noch vorhat — explizit, siehe Dateikopf. */
  offeneAz: string[];
  /**
   * Auch die Verbund-Phase ist noch offen.
   *
   * Sie kommt NACH den Vorhaben und kann selbst am Geraeteverlust scheitern.
   * Ohne dieses Feld waere ein Bau, dem erst dort die Luft ausgeht, mit leerer
   * Vorhaben-Restliste „fertig" — und bliebe unfertig stehen. Die Phase selbst
   * braucht keine Restliste: sie ist von Haus aus inkrementell.
   */
  verbundOffen?: boolean;
  /** Wie viele Vektoren der Lauf insgesamt schon erzeugt hat (über alle Runden). */
  erledigt: number;
  /** Die wievielte Runde nach einem Neustart als Nächstes läuft. */
  neustarts: number;
  /** ISO-Zeitstempel des ersten Starts. */
  gestartet: string;
  /** Wortlaut des Fehlers, der zum Neustart geführt hat. */
  grund: string;
}

export type FortsetzungsUrteil =
  | { art: 'fortsetzen'; stand: BauFortsetzung }
  | { art: 'fertig' }
  | { art: 'aufgeben'; grund: 'obergrenze' | 'kein-fortschritt' };

/**
 * Darf und soll fortgesetzt werden?
 *
 * Rein — hier steht der ganze Beweis, dass ein Rechner sich nicht in einer
 * Neustart-Schleife festfährt.
 */
export function beurteileFortsetzung(
  stand: BauFortsetzung | null,
  erledigtVorRunde: number,
): FortsetzungsUrteil {
  if (!stand) return { art: 'fertig' };
  if (stand.offeneAz.length === 0 && !stand.verbundOffen) return { art: 'fertig' };
  if (stand.neustarts >= NEUSTART_MAX) return { art: 'aufgeben', grund: 'obergrenze' };
  // Eine Runde, die keinen einzigen Vektor zustande gebracht hat, wird die
  // naechste auch nicht: dann liegt es nicht am Geraet, sondern am Lauf.
  if (stand.neustarts > 0 && stand.erledigt <= erledigtVorRunde) {
    return { art: 'aufgeben', grund: 'kein-fortschritt' };
  }
  return { art: 'fortsetzen', stand };
}

export async function ladeFortsetzung(idb: IDBStore): Promise<BauFortsetzung | null> {
  const roh = await idb.get<BauFortsetzung>(FORTSETZUNG_KEY).catch(() => null);
  if (!roh || !Array.isArray(roh.offeneAz)) return null;
  return roh;
}

export async function merkeFortsetzung(idb: IDBStore, stand: BauFortsetzung): Promise<void> {
  await idb.set(FORTSETZUNG_KEY, stand);
}

export async function vergissFortsetzung(idb: IDBStore): Promise<void> {
  await idb.delete(FORTSETZUNG_KEY);
}
