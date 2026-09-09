/**
 * **Stillstand als Filter-Achse**: seit wann hat ein Antrag kein neues Kürzel
 * mehr bekommen?
 *
 * Der [Stillstands-Wächter](src/core/status/waechter.ts) beantwortet eine
 * benachbarte, aber andere Frage: er urteilt gegen die **Zieltage des Status**
 * („hängt / ok / unbewertet"). Gefragt ist hier eine **freie Schwelle** — „länger
 * als 2 Monate" —, und dafür braucht es nur die letzte Aktivität je Antrag, nicht
 * das ganze Urteil.
 *
 * Deshalb rechnet dieses Modul bewusst **weniger** als das Vorgangs-Board: kein
 * `ermittleTodosAlleRollen`, kein Wächter-Urteil, keine Fristprognose. Genau die
 * waren dort das Teure (der Bestandslauf kostete 5,3–18,2 s); übrig bleibt
 * `letzteAktivitaetVon` über dieselben Vorkommen.
 *
 * ## Drei Ausgänge, nicht zwei
 *
 * Ein Antrag ohne datierbare Aktivität **steht nicht still — er ist nicht
 * prüfbar**. Das ist dieselbe Regel, auf der der Wächter mit `unbewertet`
 * besteht: ihn zu den Unauffälligen zu schlagen hieße, eine Aussage zu treffen,
 * für die die Grundlage fehlt. Genau daran scheitern Ampeln, denen man später
 * nicht mehr glaubt. Die Oberfläche muss die Zahl der Unprüfbaren deshalb
 * nennen, statt sie stumm wegzulassen.
 *
 * ## Das Journal gewinnt, wo es etwas weiß
 *
 * `max(D_)` ist eine **Untergrenze**: der Nacht-Export überschreibt, mehrfach
 * gesetzte Kürzel tragen nur das letzte Datum. Wo das Import-Diff-Journal einen
 * Eintrag hat, ist er belegt und schlägt die Näherung — dieselbe Rangfolge wie in
 * `pruefeStillstand`. `belegt` reist mit, damit die Anzeige „seit mindestens"
 * sagen kann, wo genähert wurde.
 */
import type { IDBStore } from '@/core/services/storage/idb-store';
import type { AntragListItem } from '@/core/services/csv/types';
import { jederVorgang, letzteAktivitaetVon, tageZwischen, type MappingVersion } from '@/core/status';
import { letzteAenderungJeAntrag } from '@/core/status/journal/lesen';

/** Was über die letzte Aktivität EINES Antrags bekannt ist. */
export interface LetzteAktivitaet {
  /** ISO-Tag, nie in der Zukunft. */
  tag: string;
  /** `true` = aus dem Journal belegt, `false` = genähert aus `max(D_)`. */
  belegt: boolean;
}

/** Aktenzeichen → letzte Aktivität. **Fehlender Eintrag = nicht prüfbar.** */
export type AktivitaetsIndex = ReadonlyMap<string, LetzteAktivitaet>;

export interface IndexErgebnis {
  index: AktivitaetsIndex;
  /**
   * Wie viele Sätze aus IDB KAMEN — nicht wie viele einen Eintrag bekamen.
   *
   * Der Cache stellt daran scharf: null Einträge hat zwei sehr verschiedene
   * Ursachen (Cold Start vs. ein Bestand ohne datierte Kürzel), und nur die
   * gelesene Zahl unterscheidet sie (dieselbe Regel wie in `useBestandsAufgaben`).
   */
  gelesen: number;
}

/**
 * Baut den Index über den ganzen Bestand.
 *
 * **Ohne Betrachtungsbereich.** Das Board filtert vor der teuren Arbeit, weil
 * dort je Antrag To-dos und Wächter laufen; hier ist die Arbeit je Antrag billig,
 * und der teure Teil (`jederVorgang`: IDB-Lesen + `sammleVorkommen`) fällt
 * ohnehin an. Ein bereichsfreier Index ist dafür über Bereichswechsel hinweg
 * gültig — der Cache-Schlüssel braucht den Bereich damit gar nicht.
 */
export async function baueAktivitaetsIndex(
  idb: IDBStore,
  version: MappingVersion,
  stichtag: string,
): Promise<IndexErgebnis> {
  // Einmal fuer den ganzen Bestand statt einmal je Antrag: das Journal liegt in
  // Monatsdateien, und ein Lesevorgang je Antrag waere die teuerste Art,
  // dieselben Dateien zu lesen. `null` = kein Journal, dann bleibt es bei der
  // Naeherung aus `max(D_)`.
  const journal = await letzteAenderungJeAntrag(idb, stichtag.slice(0, 10));

  const index = new Map<string, LetzteAktivitaet>();
  let gelesen = 0;
  await jederVorgang(idb, version, ({ aktenzeichen, vorkommen }) => {
    gelesen += 1;
    const belegtTag = journal?.get(aktenzeichen);
    if (typeof belegtTag === 'string' && belegtTag !== '') {
      index.set(aktenzeichen, { tag: belegtTag, belegt: true });
      return;
    }
    const { letzteAktivitaet } = letzteAktivitaetVon(vorkommen, version, stichtag);
    // Kein Eintrag statt eines Eintrags mit `null`: „nicht prüfbar" ist die
    // Abwesenheit einer Auskunft, und ein Platzhalter dafür lädt dazu ein, ihn
    // irgendwo als 0 Tage zu lesen.
    if (letzteAktivitaet !== null) {
      index.set(aktenzeichen, { tag: letzteAktivitaet, belegt: false });
    }
  });

  return { index, gelesen };
}

/** Das Urteil über einen Antrag. `unpruefbar` ist ein eigenes, kein halbes „läuft". */
export type StillstandUrteil = 'steht' | 'laeuft' | 'unpruefbar';

/**
 * Beurteilt EINEN Antrag gegen die Schwelle. Rein — `stichtag` kommt von außen.
 *
 * `> schwelleTage`, nicht `>=`: „länger als 2 Monate" heißt am 60. Tag noch
 * nicht. Dieselbe Grenze zieht `pruefeStillstand` mit `tage > zieltage`.
 */
export function beurteileStillstand(
  eintrag: LetzteAktivitaet | undefined,
  schwelleTage: number,
  stichtag: string,
): StillstandUrteil {
  if (!eintrag) return 'unpruefbar';
  const tage = tageZwischen(eintrag.tag, stichtag);
  if (tage === null) return 'unpruefbar';
  return tage > schwelleTage ? 'steht' : 'laeuft';
}

export interface StillstandErgebnis {
  /** Die Anträge, die die Schwelle reißen. */
  treffer: AntragListItem[];
  /**
   * Wie viele der geprüften Anträge sich NICHT beurteilen ließen.
   *
   * Muss angezeigt werden. Eine Liste, die sie stumm weglässt, behauptet
   * implizit, sie liefen — und das ist genau die Aussage, für die die Grundlage
   * fehlt.
   */
  unpruefbar: number;
}

/**
 * Der Filterschritt für die Antrags-Pipeline. Rein.
 *
 * Ohne Index (noch nicht gerechnet) bleibt die Liste **unverändert** und alles
 * gilt als unprüfbar: eine leere Liste zu zeigen, während der Index noch lädt,
 * sähe aus wie „nichts gefunden".
 */
export function filtereStillstand(
  list: AntragListItem[],
  index: AktivitaetsIndex | null,
  schwelleTage: number,
  stichtag: string,
): StillstandErgebnis {
  if (index === null) return { treffer: list, unpruefbar: list.length };
  const treffer: AntragListItem[] = [];
  let unpruefbar = 0;
  for (const a of list) {
    const urteil = beurteileStillstand(index.get(a.aktenzeichen), schwelleTage, stichtag);
    if (urteil === 'steht') treffer.push(a);
    else if (urteil === 'unpruefbar') unpruefbar += 1;
  }
  return { treffer, unpruefbar };
}
