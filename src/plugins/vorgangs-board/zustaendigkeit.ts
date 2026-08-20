/**
 * **Wer ist dran** — die Vierteilung des Arbeitsvorrats, rein und ohne React.
 *
 * Bis v4.95 waren drei dieser vier Teile eigene Reiter, und daneben standen
 * zwei weitere, die etwas ganz anderes zeigten: „Fristen" eine Teilmenge nach
 * Risiko, „Auswertung" dieselbe Gesamtmenge noch einmal. Fünf gleich aussehende
 * Reiter, von denen sich drei zu 100 % addierten und zwei nicht — man konnte
 * sie nicht gegeneinander lesen.
 *
 * Seit v4.96 trägt die Reiterleiste nur noch die **Frage** (Arbeit, Fristen,
 * Auswertung); die Vierteilung ist ein Filter mit vier Zahlen, die sich zur
 * Gesamtmenge addieren.
 *
 * **Warum vier statt drei.** „Kein To-do ermittelt" führte zwei völlig
 * verschiedene Sorten zusammen: 107 echte Regel-Lücken und 2.994 abgeschlossene
 * Verfahren (gemessen am 18.08.2026). Die zweite Sorte ist ein Ergebnis, keine
 * Lücke — und weil sie 96 % der Gruppe stellte, las sich der größte Zähler des
 * Boards als Rückstand. Getrennt ist beides eine Aussage; die abgeschlossenen
 * sind ab Werk abgewählt, bleiben aber mit einem Klick erreichbar.
 */
import type { Rolle, TodoErgebnis } from '@/core/status';

export type Zustaendigkeit = 'meine' | 'warten' | 'ohne' | 'fertig';

/** Anzeige-Reihenfolge: erst die eigene Arbeit, zuletzt das Erledigte. */
export const ZUSTAENDIGKEITEN: readonly Zustaendigkeit[] = ['meine', 'warten', 'ohne', 'fertig'];

export const ZUSTAENDIGKEIT_LABEL: Record<Zustaendigkeit, string> = {
  meine: 'Meine Aufgaben',
  warten: 'Wartet auf andere',
  ohne: 'Kein To-do',
  fertig: 'Abgeschlossen',
};

/**
 * **Ohne Rollenwahl heißt „meine" etwas anderes** — und muss deshalb anders
 * heißen (v4.132).
 *
 * `zustaendigkeitVon(e, 'alle')` fragt nicht „bin ich dran?", sondern „ist
 * überhaupt jemand benannt?". Der Chip las sich trotzdem als „Meine Aufgaben":
 * für einen FB standen darunter (gemessen am 20.08.2026, Kürzel THü) 17
 * Aufgaben, von denen **16 dem AB gehörten** und genau eine ihn nannte. Wer die
 * eigene Rolle wählt, bekommt die alte Beschriftung zurück — dann stimmt sie.
 */
export function zustaendigkeitLabel(z: Zustaendigkeit, rolle: Rolle | 'alle'): string {
  if (rolle !== 'alle') return ZUSTAENDIGKEIT_LABEL[z];
  if (z === 'meine') return 'Jemand ist zuständig';
  if (z === 'warten') return 'Wartet auf außerhalb';
  return ZUSTAENDIGKEIT_LABEL[z];
}

export const ZUSTAENDIGKEIT_TITEL: Record<Zustaendigkeit, string> = {
  meine: 'To-dos, für die die gewählte Rolle zuständig ist',
  warten: 'Dieselben Anträge aus der Fremdrollen-Sicht — was für den AB „RNE ergänzen" ist, '
    + 'erscheint dem FB als „wartet auf AB"',
  ohne: 'Keine Regel der Kaskade trifft zu — eine Lücke im Regelsatz, kein Ergebnis',
  fertig: 'Eine Sperre griff, weil Schlussvermerk oder Zuwendungsbescheid vorliegen — '
    + 'hier ist nichts mehr zu tun',
};

/** Die Erklärung zum Chip — ohne Rollenwahl eine andere, siehe {@link zustaendigkeitLabel}. */
export function zustaendigkeitTitel(z: Zustaendigkeit, rolle: Rolle | 'alle'): string {
  if (rolle !== 'alle') return ZUSTAENDIGKEIT_TITEL[z];
  if (z === 'meine') {
    return 'Eine Regel benennt eine Rolle im Haus — welche, sagt sie erst, wenn Sie oben '
      + 'Ihre Rolle wählen. Ohne Rollenwahl gilt der AB-Regelsatz.';
  }
  if (z === 'warten') {
    return 'Die Regel wartet auf den Antragsteller oder auf eine Rolle, die sie nicht '
      + 'als zuständig benennt — im Haus ist gerade niemand am Zug.';
  }
  return ZUSTAENDIGKEIT_TITEL[z];
}

/**
 * Die Vorbelegung: **was Arbeit ist**.
 *
 * Die abgeschlossenen Verfahren bleiben draußen, weil sie sonst jede Zählung
 * dominieren; die Regel-Lücke bleibt draußen, weil sie eine Frage an den
 * Regelsatz ist und nicht an den Bearbeiter. Beide stehen als Chip mit ihrer
 * Zahl daneben — abgewählt ist nicht versteckt.
 */
export const ZUSTAENDIGKEIT_DEFAULT: readonly Zustaendigkeit[] = ['meine', 'warten'];

/** Gruppen-Überschriften der beiden To-do-losen Sorten. */
export const GRUPPE_OHNE = 'Kein To-do ermittelt';
export const GRUPPE_FERTIG = 'Keine Aufgabe mehr (Verfahren abgeschlossen)';

/**
 * Wer an diesem Vorgang dran ist — aus dem Ergebnis der Kaskade.
 *
 * Ohne Rollenwahl heißt „meine": alles mit **irgendeiner** Zuständigkeit. Sonst
 * wäre der Arbeitsvorrat für einen Nutzer ohne gesetzte Rolle leer.
 *
 * Ein abgeleiteter Platzhalter trägt `zustaendig: [rolle]` und landet damit
 * unter „meine" — das ist die Aussage: die Regel wartet auf DICH, auch wenn
 * dein Regelsatz sie noch nicht selbst beschreibt.
 */
export function zustaendigkeitVon(e: TodoErgebnis, rolle: Rolle | 'alle'): Zustaendigkeit {
  if (!e.todo) return e.gesperrtDurch.length > 0 ? 'fertig' : 'ohne';
  if (rolle === 'alle') return e.zustaendig.length > 0 ? 'meine' : 'warten';
  return e.zustaendig.includes(rolle) ? 'meine' : 'warten';
}

/**
 * Ist die Auswahl noch die Vorbelegung? Dann braucht sie keinen Rückweg-Hinweis.
 *
 * Reihenfolge-unabhängig, weil die Chips in beliebiger Folge geklickt werden.
 */
export function istArbeitsvorrat(gewaehlt: readonly Zustaendigkeit[]): boolean {
  return gewaehlt.length === ZUSTAENDIGKEIT_DEFAULT.length
    && ZUSTAENDIGKEIT_DEFAULT.every(z => gewaehlt.includes(z));
}

/**
 * Einen Chip umschalten — **der letzte lässt sich nicht abwählen**.
 *
 * Eine leere Auswahl zeigte eine leere Liste, und die läse sich als „nichts zu
 * tun" statt als „nichts ausgewählt". Lieber ein Klick, der nichts tut, als ein
 * Zustand, der lügt.
 */
export function schalteZustaendigkeit(
  gewaehlt: readonly Zustaendigkeit[], z: Zustaendigkeit,
): Zustaendigkeit[] {
  if (!gewaehlt.includes(z)) return ZUSTAENDIGKEITEN.filter(x => x === z || gewaehlt.includes(x));
  const rest = gewaehlt.filter(x => x !== z);
  return rest.length > 0 ? [...rest] : [...gewaehlt];
}
