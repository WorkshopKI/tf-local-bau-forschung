/**
 * Was der Bestandslauf **bedeutet** — die Wertung, getrennt von der Anzeige.
 *
 * Der Lauf liefert rund 40 Zahlen. Gleichrangig untereinander gestellt sind sie
 * eine Wand: die eine Zeile, die eine Zusage bricht, steht dann neben einem
 * Median, der nur eine Verteilung beschreibt. Diese Datei sortiert sie in drei
 * Sorten, und jede Sorte hat eine andere Berechtigung:
 *
 * - **Zusage** — es gibt eine richtige Antwort, und ✓ oder ⚠ sagt, ob sie da ist.
 *   Bricht sie, ist das ein Fehler, kein Befund.
 * - **Auffälligkeit** — eine Zahl über null bedeutet, dass jemand hinsehen
 *   müsste. Sie trägt Belege, damit „hinsehen" auch geht.
 * - **Kennzahl** — beschreibt nur. **Kein Symbol**, weil kein Schwellwert
 *   erfunden wird: „58,5 % der Teilvorhaben haben einen Verlauf" ist weder gut
 *   noch schlecht, sondern der Stand.
 *
 * **Rein und ohne React**, damit die Wertung im Node-Test prüfbar ist — den
 * Bestand selbst erreicht kein Vitest (`useVerlaufErhebung`), die Regeln darüber
 * schon. Jede Zahl behält ihre Grundgesamtheit im Satz.
 */
import { anteil, histogrammSumme, type VerlaufsBefunde, type VerlaufsBeispiel } from '@/core/status/verlauf';
import { HALT_HERKUNFT } from '@/plugins/antraege/fristAnzeige';
import type { HaltedatumQuelle } from '@/core/status/haltedatum';
import { matrixDiagonal, type FristBefunde } from './fristErhebung';

export type BefundArt = 'zusage' | 'auffaellig' | 'kennzahl';

export interface Befund {
  /**
   * Stabiler Schlüssel — React-`key` und Testanker. Er hängt bewusst nicht am
   * Wortlaut: der darf sich ändern, ohne dass ein Test bricht.
   */
  id: string;
  art: BefundArt;
  /** Nur bei `zusage`: entscheidet ✓ gegen ⚠. */
  erfuellt?: boolean;
  text: string;
  hinweis?: string;
  beispiele?: readonly VerlaufsBeispiel[];
}

const zahl = (n: number): string => n.toLocaleString('de-DE');

const QUELLE_LABEL: Readonly<Record<HaltedatumQuelle, string>> = {
  ...HALT_HERKUNFT,
  unbekannt: 'kein Haltedatum bekannt',
};

/** Die beiden Zusagen des Haltedatum-Laufs — sie dürfen nicht brechen. */
function zusagen(f: FristBefunde): Befund[] {
  const diagonal = matrixDiagonal(f);
  return [
    {
      id: 'frist-zustand-unbewegt',
      art: 'zusage',
      erfuellt: diagonal,
      text: diagonal
        ? 'Kein Vorgang wechselt den Frist-Zustand — die Verlaufsquelle ist additiv.'
        : 'Ein Vorgang hat den Frist-Zustand gewechselt. Das darf nicht sein.',
    },
    {
      id: 'frist-umdatiert',
      art: 'zusage',
      erfuellt: f.umdatiert === 0,
      text: f.umdatiert === 0
        ? 'Kein Vorhaben umdatiert.'
        : `${zahl(f.umdatiert)} Vorhaben umdatiert — sie hatten bereits ein Haltedatum `
          + 'und bekommen ein anderes.',
    },
  ];
}

/**
 * Auffälligkeiten des Haltedatum-Laufs.
 *
 * Die eine Regel hier ist nicht „0 ist schlecht", sondern „0 **neben offenen
 * Fällen** ist einen Blick wert": greift Stufe 3 nirgends, während angehaltene
 * Vorgänge ohne Haltedatum dastehen, ist die Zusage darüber zwar wahr, aber
 * leer. Genau das war aus drei Nullzeilen nicht zu lesen.
 *
 * Gezählt wird `angehaltenOhneDatum`, nicht „Quelle unbekannt": Letzteres
 * enthält laufende und nicht berechenbare Vorgänge, die gar kein Haltedatum
 * brauchen — am Bestand 1 030 gegen 42. Die große Zahl behauptete eine Lücke,
 * die es nicht gibt.
 */
function auffaelligFrist(f: FristBefunde): Befund[] {
  if (f.neuDatiert > 0 || f.angehaltenOhneDatum === 0) return [];
  return [{
    id: 'frist-quelle-stumm',
    art: 'auffaellig',
    text: `Die Verlaufsquelle datiert nichts, obwohl ${zahl(f.angehaltenOhneDatum)} `
      + 'angehaltene Vorgänge kein Haltedatum haben.',
    hinweis: 'Stufe 3 der Kaskade greift dort nirgends — für diese Fälle erklärt die '
      + 'Ableitung den importierten Status nicht.',
  }];
}

/** Auffälligkeiten des Verlaufslaufs — jede nur, wenn sie überhaupt vorkommt. */
function auffaelligVerlauf(v: VerlaufsBefunde): Befund[] {
  const aus: Befund[] = [];
  if (v.zielCodeUnbekannt > 0) {
    aus.push({
      id: 'zielcode-unbekannt',
      art: 'auffaellig',
      text: `${zahl(v.zielCodeUnbekannt)} Termine zeigen auf einen Zielcode, den der `
        + 'Statuskatalog nicht beschriftet.',
      hinweis: 'im Reiter Statuswerte nachtragen',
      beispiele: v.beispiele.zielCodeUnbekannt,
    });
  }
  if (v.abweichungWiderspruch > 0) {
    aus.push({
      id: 'abweichung-widerspruch',
      art: 'auffaellig',
      text: `${zahl(v.abweichungWiderspruch)} Spuren enden woanders als der Export, `
        + 'obwohl es eine Regel dorthin gäbe.',
      // Die Lücken stehen daneben, nicht darunter: sie sind die viel größere Zahl
      // und der harmlose Fall. Ohne sie liest sich der Widerspruch als Ausreißer,
      // mit ihr als das, was er ist — der kleinere, aber echte Teil.
      hinweis: `bei ${zahl(v.abweichungNichtAbleitbar)} weiteren führt gar keine Regel `
        + 'dorthin — eine Lücke, kein Widerspruch',
      beispiele: v.beispiele.widerspruch,
    });
  }
  if (v.segmenteRueckwaerts > 0) {
    aus.push({
      id: 'dauer-negativ',
      art: 'auffaellig',
      text: `${zahl(v.segmenteRueckwaerts)} Abschnitte haben eine negative Dauer — ein `
        + 'Termin liegt nach dem Bezugszeitpunkt.',
      beispiele: v.beispiele.rueckwaerts,
    });
  }
  if (v.bezeichnungGeliehenUneindeutig > 0) {
    aus.push({
      id: 'geliehen-strittig',
      art: 'auffaellig',
      text: `Bei ${zahl(v.bezeichnungGeliehenUneindeutig)} Terminen widersprechen sich die `
        + 'geliehenen Bezeichnungen — die angezeigte Bedeutung gilt dort nicht sicher.',
      beispiele: v.beispiele.geliehenStrittig,
    });
  }
  return aus;
}

/** Die Deckung der Bahn — drei Anteile, jeder mit seiner eigenen Grundgesamtheit. */
function kennzahlBahn(v: VerlaufsBefunde): Befund {
  const messbar = histogrammSumme(v.dauerHistogramm);
  return {
    id: 'bahn-deckung',
    art: 'kennzahl',
    text: `Die Bahn trägt: ${anteil(v.zustaendeTv.verlauf, v.teilvorhaben)} der Teilvorhaben `
      + `haben einen Verlauf, ${anteil(v.verbuendeMitStatuswechsel, v.verbuende)} der Verbünde `
      + 'einen abgeleiteten Statuswechsel.',
    hinweis: `${anteil(messbar, v.segmente)} der Abschnitte haben zwei Grenzen und damit eine `
      + 'messbare Dauer',
  };
}

/** Woher die Haltedaten am Ende kamen — absteigend, damit die Hauptquelle vorn steht. */
function kennzahlHaltedatum(f: FristBefunde): Befund[] {
  const teile = [...f.jeQuelle.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([q, n]) => `${zahl(n)} ${QUELLE_LABEL[q]}`);
  if (teile.length === 0) return [];
  return [{
    id: 'haltedatum-quellen',
    art: 'kennzahl',
    text: `Haltedatum: ${teile.join(' · ')}.`,
  }];
}

/**
 * Die Befunde beider Läufe, in der Reihenfolge Zusage → Auffälligkeit → Kennzahl.
 *
 * `null` heißt „dieser Lauf fehlt" — dann entfallen **seine** Zeilen und die des
 * anderen bleiben. Ein halber Lauf soll etwas zeigen, nicht nichts.
 */
export function baueBefunde(
  v: VerlaufsBefunde | null, f: FristBefunde | null,
): Befund[] {
  return [
    ...(f ? zusagen(f) : []),
    ...(f ? auffaelligFrist(f) : []),
    ...(v ? auffaelligVerlauf(v) : []),
    ...(v ? [kennzahlBahn(v)] : []),
    ...(f ? kennzahlHaltedatum(f) : []),
  ];
}
