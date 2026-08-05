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
 * 3. **Mehrspurig seit v2.390.** Jede Regel gehört einem {@link Rolle}-Regelsatz
 *    (fehlend ⇒ `'ab'`); ausgewertet wird immer genau einer. Solange nur der
 *    AB-Satz gefüllt ist, ist das Ergebnis bitgenau das von vorher.
 *
 * Rein und deterministisch: der `stichtag` wird injiziert, ausgewertet wird über
 * den geteilten `pruefeBedingung` — kein zweiter Evaluator (Pitfall #41).
 */
import { pruefeBedingung, type BedingungsKontext } from './bedingung';
import { bedingungFeldRefs } from './bedingung';
import type { FeldVorkommen } from './feld-aufloesung';
import { regelsatzVon, sperrEintragTrifft, sperreGiltFuer, REGELSATZ_DEFAULT } from './regelsatz';
import { ROLLEN } from './rollen';
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
  /**
   * Woher das To-do kommt: aus einer eigenen Regel dieses Regelsatzes
   * (`'regel'`) oder abgeleitet aus dem `wartetAuf` einer fremden Regel
   * (`'abgeleitet'`). Ohne Treffer steht `'regel'` — es gibt dann nichts
   * abzuleiten.
   */
  quelle: 'regel' | 'abgeleitet';
  /** Bei `quelle: 'abgeleitet'`: die Regel, aus deren `wartetAuf` es stammt. */
  abgeleitetAus?: string;
}

const LEER: TodoErgebnis = {
  todo: null, regelId: null, beschreibung: null,
  zustaendig: [], wartetAuf: null, belege: [], gesperrtDurch: [], weitereTreffer: [],
  quelle: 'regel',
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

/** Welche Regeln in diesem Regelsatz schweigen und warum. */
interface SperrLage {
  /** Ids der greifenden Sperren — erklärt, warum ein Strang stumm bleibt. */
  gesperrtDurch: string[];
  /**
   * Nimmt die **Regel**, nicht ihre Id: seit v2.412 sperrt ein Eintrag auch nach
   * {@link TodoRegel.strang}, und der steht an der Regel.
   */
  istGesperrt: (r: Pick<TodoRegel, 'id' | 'strang'>) => boolean;
}

/**
 * Der Sperr-Pass für EINEN Regelsatz.
 *
 * Läuft bewusst über **alle** aktiven Regeln und filtert erst über `giltFuer`:
 * eine Sperre gehört keinem Regelsatz, sie gilt vorgangsweit, solange sie nichts
 * anderes sagt. Vorgefiltert nach `regelsatz` fielen S0/S1/S2 aus jeder fremden
 * Rollen-Sicht heraus — der abgeschlossene Vorgang stünde dem FB als offene
 * Aufgabe im Board.
 */
function sperrLage(
  aktive: readonly TodoRegel[], ctx: BedingungsKontext, stichtag: string, rolle: Rolle,
): SperrLage {
  // Die Einträge werden GESAMMELT, nicht sofort aufgelöst: ein `strang:`-Eintrag
  // meint eine Menge, die erst gegen die jeweilige Regel entschieden wird — und
  // genau das ist der Punkt der Umstellung (eine später ergänzte Regel gehört
  // automatisch dazu, statt still durch die Sperre zu fallen).
  const eintraege: string[] = [];
  const ausnahmen = new Set<string>();
  let alleGesperrt = false;
  const gesperrtDurch: string[] = [];
  for (const s of aktive) {
    if (!istSperre(s) || !sperreGiltFuer(s, rolle)) continue;
    if (!pruefeBedingung(s.bedingung, ctx, stichtag)) continue;
    gesperrtDurch.push(s.id);
    for (const e of s.sperrt ?? []) {
      if (e === ALLE_STRAENGE) alleGesperrt = true; else eintraege.push(e);
    }
    for (const id of s.sperrtNicht ?? []) ausnahmen.add(id);
  }
  // Die Ausnahme gewinnt: S0b legt das ganze Feld still, „ZuwB erstellen" muss
  // trotzdem feuern können. Eine Ausnahme wirkt gegen JEDE greifende Sperre —
  // wer eine Regel ausnimmt, meint „diese Aufgabe bleibt", nicht „nur gegen S0b".
  // Sie steht weiterhin als Regel-Id da: eine Ausnahme meint genau eine Aufgabe,
  // nie einen ganzen Strang.
  return {
    gesperrtDurch,
    istGesperrt: (r: Pick<TodoRegel, 'id' | 'strang'>) => !ausnahmen.has(r.id)
      && (alleGesperrt || eintraege.some(e => sperrEintragTrifft(e, r))),
  };
}

/** Der Treffer-Pass für EINEN Regelsatz: erste zutreffende Regel gewinnt. */
function trefferLauf(
  aktive: readonly TodoRegel[], ctx: BedingungsKontext, stichtag: string,
  rolle: Rolle, lage: SperrLage,
): TodoErgebnis {
  let treffer: TodoRegel | null = null;
  const weitereTreffer: { regelId: string; todo: string }[] = [];
  for (const r of aktive) {
    if (istSperre(r) || regelsatzVon(r) !== rolle || lage.istGesperrt(r)) continue;
    if (!pruefeBedingung(r.bedingung, ctx, stichtag)) continue;
    if (!treffer) treffer = r;
    else weitereTreffer.push({ regelId: r.id, todo: r.todo });
  }

  if (!treffer) return { ...LEER, gesperrtDurch: lage.gesperrtDurch };
  return {
    todo: treffer.todo,
    regelId: treffer.id,
    beschreibung: treffer.beschreibung,
    zustaendig: treffer.zustaendig,
    wartetAuf: treffer.wartetAuf ?? null,
    belege: belegeVon(treffer, ctx),
    gesperrtDurch: lage.gesperrtDurch,
    weitereTreffer,
    quelle: 'regel',
  };
}

/** Optionen der Auswertung. */
export interface TodoOptionen {
  /**
   * Welcher Regelsatz ausgewertet wird. Default `'ab'` — und damit exakt die
   * Menge, die vor v2.390 die einzige war (Regeln ohne `regelsatz` sind
   * AB-Regeln).
   */
  rolle?: Rolle;
}

/**
 * Ermittelt das To-do eines Antrags/Verbunds für EINEN Regelsatz. Rein.
 *
 * Die Regelsatz-Auswahl liegt hier drin und nicht beim Aufrufer: der Sperr-Pass
 * braucht die ungefilterte Liste (siehe {@link sperrLage}), eine vorgefilterte
 * Menge nähme ihm still die vorgangsweiten Sperren.
 *
 * @param regeln  Die Kaskade; wird nach `reihenfolge` sortiert, Inaktive fallen raus.
 * @param ctx     Feldwerte (`baueTodoKontext`).
 * @param stichtag ISO — injiziert, nie eine Uhr in der Engine.
 * @param opts    Regelsatz; ohne Angabe der des AB.
 */
export function ermittleTodo(
  regeln: readonly TodoRegel[], ctx: BedingungsKontext, stichtag: string,
  opts: TodoOptionen = {},
): TodoErgebnis {
  const rolle = opts.rolle ?? REGELSATZ_DEFAULT;
  const aktive = regeln.filter(r => r.aktiv).sort((a, b) => a.reihenfolge - b.reihenfolge);
  return trefferLauf(aktive, ctx, stichtag, rolle, sperrLage(aktive, ctx, stichtag, rolle));
}

/**
 * Das To-do **jeder** Rolle in einem Durchgang, samt abgeleiteter Platzhalter.
 *
 * Der Platzhalter ist das Kernstück der Mehrspurigkeit: solange der Regelsatz
 * einer Rolle die Situation nicht selbst beschreibt, leiht sie sich die Aussage
 * der fremden Regel, die auf sie wartet. So steht die FB-Sicht vom ersten Tag an
 * da — nicht leer, sondern erkennbar geliehen — und jede geschriebene FB-Regel
 * ersetzt genau einen Platzhalter. Kein Umschaltpunkt, kein Big Bang.
 *
 * Drei Regeln, die den Platzhalter ehrlich halten:
 * 1. Ein echter Regeltreffer schlägt ihn immer.
 * 2. Er läuft durch den Sperr-Filter der EIGENEN Rolle. Wäre die Herkunftsregel
 *    für sie gesperrt, entstünde sonst aus einem für sie geschlossenen Fall eine
 *    neue Aufgabe.
 * 3. Er trägt `regelId: null` — die Rolle hat keine eigene Regel, und das soll
 *    man ihm ansehen. Die Herkunft steht in `abgeleitetAus`.
 */
export function ermittleTodosAlleRollen(
  regeln: readonly TodoRegel[], ctx: BedingungsKontext, stichtag: string,
): Record<Rolle, TodoErgebnis> {
  const aktive = regeln.filter(r => r.aktiv).sort((a, b) => a.reihenfolge - b.reihenfolge);

  // Zwei Abkürzungen, damit die Mehrspurigkeit nicht das Fünffache kostet. Sie
  // ändern das Ergebnis nicht, sie sparen Läufe, die nachweislich dasselbe
  // liefern:
  //  - Trägt KEINE Sperre ein `giltFuer`, ist die Sperr-Lage für jede Rolle
  //    dieselbe — einmal rechnen genügt.
  //  - Ein Regelsatz ohne eigene Regeln kann keinen Treffer haben; der
  //    Treffer-Pass liefe nur, um alles zu überspringen.
  const rollenSperre = aktive.some(r => istSperre(r) && (r.giltFuer?.length ?? 0) > 0);
  const mitRegeln = new Set<Rolle>();
  for (const r of aktive) if (!istSperre(r)) mitRegeln.add(regelsatzVon(r));
  const gemeinsameLage = rollenSperre
    ? null
    : sperrLage(aktive, ctx, stichtag, REGELSATZ_DEFAULT);

  const lagen = {} as Record<Rolle, SperrLage>;
  const pro = {} as Record<Rolle, TodoErgebnis>;
  for (const rolle of ROLLEN) {
    lagen[rolle] = gemeinsameLage ?? sperrLage(aktive, ctx, stichtag, rolle);
    pro[rolle] = mitRegeln.has(rolle)
      ? trefferLauf(aktive, ctx, stichtag, rolle, lagen[rolle])
      : { ...LEER, gesperrtDurch: lagen[rolle].gesperrtDurch };
  }

  // Die Herkunftsregel wird für den Sperr-Filter gebraucht — seit v2.412 nicht
  // mehr nur ihre Id, sondern ihr `strang`. Einmal aufgebaut statt je Paar
  // gesucht: die Schleife darunter läuft über ROLLEN².
  const nachId = new Map(aktive.map(r => [r.id, r]));

  for (const rolle of ROLLEN) {
    if (pro[rolle].todo !== null) continue;
    for (const quelle of ROLLEN) {
      const q = pro[quelle];
      if (quelle === rolle || q.todo === null || q.wartetAuf !== rolle) continue;
      const herkunft = q.regelId === null ? undefined : nachId.get(q.regelId);
      if (herkunft === undefined || lagen[rolle].istGesperrt(herkunft)) continue;
      pro[rolle] = {
        todo: q.todo,
        regelId: null,
        beschreibung: q.beschreibung,
        zustaendig: [rolle],
        wartetAuf: null,
        belege: q.belege,
        gesperrtDurch: pro[rolle].gesperrtDurch,
        weitereTreffer: [],
        quelle: 'abgeleitet',
        abgeleitetAus: herkunft.id,
      };
      break;
    }
  }
  return pro;
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

/**
 * Alle To-do-Werte einer Regelmenge, in Kaskaden-Reihenfolge, ohne Doppelte —
 * die Gruppen-Reihenfolge des Boards.
 *
 * @param rolle Auf diesen Regelsatz einschränken. Ohne Angabe zählen alle mit;
 *   das Board reicht seine Rollenwahl herein, damit die Gruppen der einen Sicht
 *   nicht in der anderen auftauchen.
 */
export function todoWerte(regeln: readonly TodoRegel[], rolle?: Rolle): string[] {
  const out: string[] = [];
  for (const r of [...regeln].sort((a, b) => a.reihenfolge - b.reihenfolge)) {
    if (rolle !== undefined && regelsatzVon(r) !== rolle) continue;
    if (!r.todo || out.includes(r.todo)) continue;
    out.push(r.todo);
  }
  return out;
}
