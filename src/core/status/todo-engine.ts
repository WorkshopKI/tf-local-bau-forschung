/**
 * Die **To-do-Engine**: welche Aufgabe steht an diesem Antrag an?
 *
 * Sie bildet nach, was die AB-Kolleginnen heute in ihrer XLSX-Mappe als
 * verschachtelte WENN-Formel rechnen — und zwar mit derselben Semantik:
 * **geordnete Liste, erste zutreffende Regel gewinnt**. Deshalb steht an einer
 * Regel eine `reihenfolge` und keine Priorität: bei einer Kaskade ist „Position"
 * das richtige Wort, „Priorität" das falsche.
 *
 * Zwei Eigenheiten, die aus der Mappe stammen und hier explizit sind:
 *
 * 1. **Sperren.** `S0`/`S0b` (Verfahren abgeschlossen bzw. ZuwB erstellt), `S1`
 *    (Antrag zurückgezogen) und `S2` (RNE/ABL begonnen) erzeugen kein To-do,
 *    sondern unterdrücken Stränge. In der Mappe sind sie äußere WENNs bzw.
 *    fixierte Slicer; hier eine Regel mit `sperrt`, damit sichtbar bleibt, WARUM
 *    ein Strang schweigt. `sperrt: ['*']` legt alles still, `sperrtNicht` nimmt
 *    einzelne Aufgaben davon aus.
 * 2. **Kein Treffer ist ein Ergebnis.** `todo: null` heißt „kein To-do
 *    ermittelt" — der Antrag verschwindet nicht, er steht in einer eigenen
 *    Gruppe. Ein leeres Board wäre die unehrlichste aller Antworten.
 *
 * Rein und deterministisch: der `stichtag` wird injiziert, ausgewertet wird über
 * den geteilten `pruefeBedingung` — kein zweiter Evaluator (Pitfall #41).
 */
import { pruefeBedingung, type BedingungsKontext } from './bedingung';
import { bedingungFeldRefs } from './bedingung';
import type { FeldVorkommen } from './feld-aufloesung';
import { ALLE_STRAENGE, type Rolle, type TodoRegel } from './typen';

/** Ein Feld, das die treffende Regel liest, mit seinem aktuellen Wert. */
export interface TodoBeleg {
  feldId: string;
  /** Alle beobachteten Werte (mehrere Teilvorhaben ⇒ mehrere). Leer = leer. */
  werte: string[];
}

export interface TodoErgebnis {
  /** Der To-do-Text, nach dem das Board gruppiert. `null` = keine Regel traf. */
  todo: string | null;
  regelId: string | null;
  /** Menschenlesbare Herkunft der Regel („R6 · Rücknahmeempfehlung"). */
  beschreibung: string | null;
  zustaendig: readonly Rolle[];
  wartetAuf: Rolle | 'ast' | null;
  /**
   * Die Felder, die die treffende Regel liest, mit ihren Werten.
   *
   * Bewusst KEIN Auswertungs-Protokoll je Blatt: das verlangte einen zweiten,
   * mitschreibenden Evaluator, und zwei Evaluatoren laufen auseinander. Die
   * Feldwerte beantworten dieselbe Frage — „woran liegt das?" — aus der einen
   * Quelle.
   */
  belege: TodoBeleg[];
  /** Ids der Sperren, die griffen. Erklärt, warum ein Strang schweigt. */
  gesperrtDurch: string[];
  /** Regeln, die ebenfalls zuträfen — für die gedämpfte Zweitanzeige. */
  weitereTreffer: { regelId: string; todo: string }[];
}

const LEER: TodoErgebnis = {
  todo: null, regelId: null, beschreibung: null,
  zustaendig: [], wartetAuf: null, belege: [], gesperrtDurch: [], weitereTreffer: [],
};

/** Sperre = Regel ohne To-do, die andere Regeln überspringt. */
function istSperre(r: TodoRegel): boolean {
  return (r.sperrt?.length ?? 0) > 0;
}

function belegeVon(regel: TodoRegel, ctx: BedingungsKontext): TodoBeleg[] {
  return bedingungFeldRefs(regel.bedingung).map(feldId => ({
    feldId,
    werte: (ctx.get(feldId) ?? []).filter(w => w.trim() !== ''),
  }));
}

/**
 * Ermittelt das To-do eines Antrags/Verbunds. Rein.
 *
 * @param regeln  Die Kaskade; wird nach `reihenfolge` sortiert, Inaktive fallen raus.
 * @param ctx     Feldwerte (`baueTodoKontext`).
 * @param stichtag ISO — injiziert, nie eine Uhr in der Engine.
 */
export function ermittleTodo(
  regeln: readonly TodoRegel[], ctx: BedingungsKontext, stichtag: string,
): TodoErgebnis {
  const aktive = regeln.filter(r => r.aktiv).sort((a, b) => a.reihenfolge - b.reihenfolge);

  // Erst die Sperren — sie stehen in der Mappe als äußere WENNs um ganze
  // Stränge und müssen deshalb vor jeder Regel feststehen, nicht erst wenn die
  // Kaskade an ihnen vorbeikommt.
  const gesperrt = new Set<string>();
  const ausnahmen = new Set<string>();
  let alleGesperrt = false;
  const gesperrtDurch: string[] = [];
  for (const s of aktive) {
    if (!istSperre(s)) continue;
    if (!pruefeBedingung(s.bedingung, ctx, stichtag)) continue;
    gesperrtDurch.push(s.id);
    for (const id of s.sperrt ?? []) {
      if (id === ALLE_STRAENGE) alleGesperrt = true; else gesperrt.add(id);
    }
    for (const id of s.sperrtNicht ?? []) ausnahmen.add(id);
  }
  // Die Ausnahme gewinnt: S0b legt das ganze Feld still, „ZuwB erstellen" muss
  // trotzdem feuern können. Eine Ausnahme wirkt gegen JEDE greifende Sperre —
  // wer eine Regel ausnimmt, meint „diese Aufgabe bleibt", nicht „nur gegen S0b".
  const istGesperrt = (id: string): boolean =>
    !ausnahmen.has(id) && (alleGesperrt || gesperrt.has(id));

  let treffer: TodoRegel | null = null;
  const weitereTreffer: { regelId: string; todo: string }[] = [];
  for (const r of aktive) {
    if (istSperre(r) || istGesperrt(r.id)) continue;
    if (!pruefeBedingung(r.bedingung, ctx, stichtag)) continue;
    if (!treffer) treffer = r;
    else weitereTreffer.push({ regelId: r.id, todo: r.todo });
  }

  if (!treffer) return { ...LEER, gesperrtDurch };
  return {
    todo: treffer.todo,
    regelId: treffer.id,
    beschreibung: treffer.beschreibung,
    zustaendig: treffer.zustaendig,
    wartetAuf: treffer.wartetAuf ?? null,
    belege: belegeVon(treffer, ctx),
    gesperrtDurch,
    weitereTreffer,
  };
}

/**
 * Baut den Auswertungs-Kontext aus den gesetzten Statuseinträgen.
 *
 * Anders als `baueVerbundFelder` nimmt er die **Textspalten mit**: die Mappe
 * fragt `T_XPC+` ab (PreCheck-Vermerk), und das ist ein anderer Wert als das
 * Datum in `D_XPC+`. Ein eigener Bauer statt einer Erweiterung des bestehenden,
 * weil dessen Ausgabe in die alte Statusableitung fließt — dort wären zusätzliche
 * Schlüssel eine stille Verhaltensänderung.
 *
 * Verbund- und TV-Werte landen im selben Topf; die Blatt-Prädikate arbeiten
 * ohnehin über `some`/`every` (siehe `bedingung.ts`).
 */
export function baueTodoKontext(vorkommen: readonly FeldVorkommen[]): BedingungsKontext {
  const ctx: BedingungsKontext = new Map();
  const add = (feldId: string, wert: string): void => {
    const list = ctx.get(feldId);
    if (list) list.push(wert); else ctx.set(feldId, [wert]);
  };
  for (const v of vorkommen) {
    add(v.feld.feldId, v.wert);
    if (v.text && v.feld.textSpalte) add(v.feld.textSpalte, v.text);
  }
  return ctx;
}

/** Alle To-do-Werte einer Regelmenge, in Kaskaden-Reihenfolge, ohne Doppelte. */
export function todoWerte(regeln: readonly TodoRegel[]): string[] {
  const out: string[] = [];
  for (const r of [...regeln].sort((a, b) => a.reihenfolge - b.reihenfolge)) {
    if (!r.todo || out.includes(r.todo)) continue;
    out.push(r.todo);
  }
  return out;
}
