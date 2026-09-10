/**
 * **Ein Durchgang, viele Mitfahrer** — die Roh-Arrays eines Programms, geteilt
 * unter allen Durchgängen, die gerade laufen.
 *
 * Der Bestand wird an dreizehn Stellen gelesen: zwölfmal über
 * [jederVorgang](./vorgangs-quelle.ts) und einmal im Bestandslauf der
 * Vorgangs-Regeln ([ladeBestand](../../plugins/status-cockpit/ladeBestand.ts)).
 * Jede dieser Stellen ist für sich richtig gebaut — nur las bisher jede die
 * Stores neu. Gemessen am 10.09.2026 gegen 14 225 Anträge kostet **ein**
 * Roh-Durchgang 3 100 ms, und zwar jedes Mal: vier Runden hintereinander im
 * Leerlauf ergaben 3 035 · 3 181 · 3 089 · 3 211 ms. **IndexedDB cacht die
 * Deserialisierung nicht**, es gibt also keine Ersparnis, auf die man warten
 * könnte.
 *
 * Schlimmer: gleichzeitige Durchgänge teilen sich nicht, sie behindern sich.
 * Zwei identische Läufe nebeneinander kosteten je das 1,6-fache (`io` 3 105 →
 * 4 975 ms, gesamt 6 447 → 10 268 ms) — nebeneinander teurer als nacheinander.
 *
 * **Warum das hier trotzdem kein Cache ist.** Die Roh-Records sind 284 MB (375
 * Felder je Antrag, 167 davon gesetzt); allein die gesetzten Werte sind 142 MB.
 * Ein Halter, der über den letzten Mitfahrer hinaus lebt, hielte den Bestand für
 * die Sitzung fest — genau das, was `jederVorgang` mit seinem Callback statt
 * einem Rückgabe-Array vermeidet. Deshalb zählt eine **Runde** ihre Nutzer: wer
 * eintritt, zählt hoch, wer fertig ist, zählt herunter, und bei null ist sie
 * weg. Der Speicherbedarf ist damit derselbe wie heute bei einem einzelnen Lauf
 * — heute halten zwei parallele Läufe zwei Kopien, künftig eine.
 *
 * **Warum die Generation der Schlüssel ist.** Ein Import bumpt
 * [bestandGeneration](../services/bestand-generation.ts); eine Runde mit alter
 * Generation nimmt keine neuen Mitfahrer mehr auf. Laufende Durchgänge fahren
 * ihre Runde zu Ende — ein Durchgang, der mitten im Bestand die Datenbasis
 * wechselt, wäre schlimmer als einer, der eine Sekunde alt ist.
 */
import {
  listProgramme, listVerbuendeByProgramm, listAntraegeByProgramm, listSchemasByProgramm,
} from '@/core/services/csv/idb-csv';
import type { Antrag, CsvSchema, Programm, Verbund } from '@/core/services/csv/types';
import type { IDBStore } from '@/core/services/storage/idb-store';
import { bestandGeneration } from '@/core/services/bestand-generation';

/** Die Roh-Arrays eines Programms, so wie sie aus der IDB kommen. */
export interface ProgrammRoh {
  programmId: string;
  verbuende: Verbund[];
  antraege: Antrag[];
  schemas: CsvSchema[];
}

/** Was ein Programm-Besuch gekostet hat und ob er selbst gelesen hat. */
export interface RohTakt {
  /** Zeit im Halter — für einen Mitfahrer die Wartezeit auf den Leser. */
  ioMs: number;
  /** `false` = mitgefahren, es floss kein zweiter `getAll`. */
  gelesen: boolean;
}

/**
 * Die Lesevorgänge, injiziert statt importiert.
 *
 * Aus demselben Grund wie der Stichtag im Bestandslauf: ein Test soll den
 * Durchgang fahren können, ohne eine IndexedDB zu stellen — und ein modulweiter
 * `vi.mock` zwänge die Testdatei in `ISOLATED_TESTS`.
 */
export interface RohLeser {
  programme: (idb: IDBStore) => Promise<Programm[]>;
  roh: (idb: IDBStore, programmId: string) => Promise<Omit<ProgrammRoh, 'programmId'>>;
}

const STANDARD_LESER: RohLeser = {
  programme: listProgramme,
  roh: async (idb, programmId) => {
    const [verbuende, antraege, schemas] = await Promise.all([
      listVerbuendeByProgramm(idb, programmId),
      listAntraegeByProgramm(idb, programmId),
      listSchemasByProgramm(idb, programmId),
    ]);
    return { verbuende, antraege, schemas };
  },
};

interface Runde {
  generation: number;
  programme: Promise<Programm[]>;
  roh: Map<string, Promise<Omit<ProgrammRoh, 'programmId'>>>;
  nutzer: number;
}

let laufendeRunde: Runde | null = null;

/**
 * Läuft über die Programme und liefert je Programm dessen Roh-Arrays.
 *
 * Läuft bereits ein Durchgang derselben Generation, wird dessen Lesevorgang
 * mitbenutzt — der zweite Aufrufer bekommt dieselben Arrays, ohne ein zweites
 * `getAll`.
 *
 * **Generator statt Callback, und das ist keine Geschmacksfrage.** Die erste
 * Fassung nahm ein `besuche`-Callback; damit wanderte der Rumpf der
 * Programm-Schleife aus dem Aufrufer in eine Closure, und seine Zähler
 * (`vf`, `ioMs`, `antraegeOhneProgramm` …) lagen fortan in einem
 * Heap-Kontextobjekt statt in Stack-Slots. Gemessen am 10.09.2026 kostete
 * allein das **~400 ms auf 3 200 ms Rechenzeit** — bei byte-identischem
 * Rumpf (6 460 → 7 095 ms je Lauf, je drei bzw. sechs Proben). Mit
 * `for await (… of …)` bleibt der Rumpf im Scope seines Aufrufers.
 *
 * Reihenfolge: Programme in Store-Ordnung, wie bisher. Bricht der Aufrufer ab,
 * schließt `for await` den Generator und das `finally` unten räumt die Runde
 * auf.
 */
export async function* jedesProgrammRoh(
  idb: IDBStore,
  leser: RohLeser = STANDARD_LESER,
): AsyncGenerator<{ roh: ProgrammRoh; takt: RohTakt }> {
  const generation = bestandGeneration();
  // Eine Runde fremder Generation ist keine Mitfahrgelegenheit mehr: ihre
  // Arrays beschreiben einen Bestand, den es so nicht mehr gibt.
  const meine: Runde = laufendeRunde !== null && laufendeRunde.generation === generation
    ? laufendeRunde
    : { generation, programme: leser.programme(idb), roh: new Map(), nutzer: 0 };
  laufendeRunde = meine;
  meine.nutzer += 1;
  try {
    for (const p of await meine.programme) {
      const t0 = performance.now();
      let offen = meine.roh.get(p.id);
      const gelesen = offen === undefined;
      if (offen === undefined) {
        offen = leser.roh(idb, p.id);
        meine.roh.set(p.id, offen);
      }
      const { verbuende, antraege, schemas } = await offen;
      yield {
        roh: { programmId: p.id, verbuende, antraege, schemas },
        takt: { ioMs: performance.now() - t0, gelesen },
      };
    }
  } catch (err) {
    // Ein halb gefüllter Halter überlebt nicht: der nächste Durchgang liest
    // frisch, statt auf einer abgelehnten Promise sitzenzubleiben.
    if (laufendeRunde === meine) laufendeRunde = null;
    throw err;
  } finally {
    meine.nutzer -= 1;
    // Nur die EIGENE Runde wegräumen — inzwischen kann eine neue Generation
    // die Ablage übernommen haben.
    if (meine.nutzer <= 0 && laufendeRunde === meine) laufendeRunde = null;
  }
}

/** Nur für Tests: was der Halter gerade festhält. */
export function halterZustand(): { runde: boolean; nutzer: number; programme: number } {
  return {
    runde: laufendeRunde !== null,
    nutzer: laufendeRunde?.nutzer ?? 0,
    programme: laufendeRunde?.roh.size ?? 0,
  };
}
