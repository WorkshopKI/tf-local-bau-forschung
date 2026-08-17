/**
 * Was die App über eine ganze Treffermenge WEISS — bevor ein Modell etwas dazu
 * sagt.
 *
 * Der Befund entstand aus einer Beobachtung am fertigen Ablauf: eine Frage
 * lieferte 663 Treffer, und die Antwort daneben stand auf **40** davon („die
 * übrigen 623 liegen NICHT vor", [assistentKontext.ts](./assistentKontext.ts)).
 * Das war ehrlich, aber es beantwortete die Frage nicht — „drehen sich
 * *hauptsächlich* um Normung und Standards" ist eine Aussage über die Menge,
 * nicht über ihre ersten vierzig Zeilen.
 *
 * Dabei weiß die App über alle 663 längst genug, exakt und kostenlos: wie viele
 * beide gefragten Sachen tragen, wie sich die Relevanz verteilt, aus welchen
 * Jahren sie stammen, wo sie liegen. Keine dieser Zahlen erreichte je das
 * Modell. Dieses Modul sammelt sie ein — **rein arithmetisch, kein LLM, kein
 * React, kein IDB**, damit die Antwort auf gemessenen Zahlen steht und nicht auf
 * einer Stichprobe, die sich als Ganzes ausgibt.
 *
 * **Gezählt wird über ALLE Treffer, formuliert wird über die Belege.** Die
 * beiden Zahlenwelten dürfen nie auseinanderlaufen: was hier steht, muss der
 * Trefferliste darunter standhalten, sonst widerspricht die Karte der Tabelle
 * (dieselbe Regel wie bei der Facetten-Zahl, suche-relevanz.md §9.3).
 */
import type { UnifiedSearchResult } from '@/core/types/search-result';
import { RELEVANZ_LABEL, TREFFERFELD_LABEL, type RelevanzStufe } from '@/core/services/search/trefferstelle';
import type { Frageplan } from '@/core/services/search/frageplan';

/** Wie viele Werte je Verteilung genannt werden. Mehr liest niemand, und im
 *  Prompt kostet jede Zeile Kontext, der den Belegen fehlt. */
const TOP_N = 6;

/** Eine Verteilung: welcher Wert wie oft, absteigend. */
export interface BefundVerteilung {
  /** Wie die Achse heißt („Jahr", „Ort"). */
  achse: string;
  werte: readonly { wert: string; anzahl: number }[];
  /** Wie viele Treffer diese Achse gar nicht führen. */
  ohne: number;
}

export interface Befund {
  /** Alle Treffer der Anfrage — die Zahl, die auch über der Liste steht. */
  gesamt: number;
  /** Je Relevanzstufe, in der Reihenfolge hoch → gering. */
  relevanz: readonly { stufe: RelevanzStufe; anzahl: number }[];
  /**
   * Wie viele Treffer ALLE gefragten Sachen tragen (`abdeckung === 1`).
   * `null`, wenn die Anfrage nur eine Sache nennt — dann ist die Zahl gleich
   * `gesamt` und sagt nichts.
   */
  alleThemen: number | null;
  /** Die gefragten Sachen, in der Reihenfolge des Plans. */
  themen: readonly string[];
  verteilungen: readonly BefundVerteilung[];
  /** Wo die Treffer gefunden wurden — die Fundstellen, absteigend. */
  fundstellen: readonly { wert: string; anzahl: number }[];
}

function zaehle(werte: Iterable<string | undefined>): { top: { wert: string; anzahl: number }[]; ohne: number } {
  const map = new Map<string, number>();
  let ohne = 0;
  for (const w of werte) {
    const t = (w ?? '').trim();
    if (t.length === 0) { ohne++; continue; }
    map.set(t, (map.get(t) ?? 0) + 1);
  }
  const top = Array.from(map, ([wert, anzahl]) => ({ wert, anzahl }))
    .sort((a, b) => (b.anzahl - a.anzahl) || a.wert.localeCompare(b.wert, 'de'))
    .slice(0, TOP_N);
  return { top, ohne };
}

function verteilung(
  achse: string, treffer: readonly UnifiedSearchResult[], lies: (r: UnifiedSearchResult) => string | undefined,
): BefundVerteilung | null {
  const { top, ohne } = zaehle(treffer.map(lies));
  // Eine Achse, die kein einziger Treffer führt, ist keine Auskunft — sie
  // stünde als „(keine Angabe): 663" da und verbrauchte Kontext.
  if (top.length === 0) return null;
  return { achse, werte: top, ohne };
}

/** Hoch → gering. Die Zahlen kommen aus `RelevanzStufe` (3 = hoch), die
 *  Beschriftung immer aus `RELEVANZ_LABEL` — nie abgeschrieben. */
const STUFEN: readonly RelevanzStufe[] = [3, 2, 1];

/**
 * Der Befund zu einer Treffermenge.
 *
 * `plan` ist optional: ohne Frageplan gibt es keine „gefragten Sachen", und
 * `alleThemen` bleibt `null`. Alles andere gilt für jede Suche.
 */
export function baueBefund(
  treffer: readonly UnifiedSearchResult[],
  plan?: Frageplan | null,
): Befund {
  const themen = (plan?.leitbegriffe ?? []).filter(b => !b.pflicht).map(b => b.begriff);
  const relevanz = STUFEN
    .map(stufe => ({ stufe, anzahl: treffer.filter(r => r.relevanzStufe === stufe).length }))
    .filter(x => x.anzahl > 0);

  // `>= 0.999` statt `=== 1`: die Abdeckung ist ein Quotient (2/2, 3/3), und ein
  // Gleitkomma-Vergleich auf exakte 1 ist die Sorte Zusage, die irgendwann still
  // danebenliegt.
  const alleThemen = themen.length > 1
    ? treffer.filter(r => (r.abdeckung ?? 0) >= 0.999).length
    : null;

  const verteilungen = [
    verteilung('Jahr', treffer, r => r.bewilligungsdatum?.slice(0, 4)),
    verteilung('Bundesland', treffer, r => r.bundesland),
    verteilung('Ort', treffer, r => r.standort?.split('·')[0]?.trim()),
    verteilung('Antragsteller', treffer, r => r.antragsteller),
  ].filter((v): v is BefundVerteilung => v !== null);

  const fundstellen = zaehle(
    treffer.flatMap(r => (r.trefferfelder ?? []).map(f => TREFFERFELD_LABEL[f])),
  ).top;

  return { gesamt: treffer.length, relevanz, alleThemen, themen, verteilungen, fundstellen };
}

/**
 * Der Befund als Text für den Prompt.
 *
 * Klartext statt JSON: das Modell soll die Zahlen LESEN und übernehmen, nicht
 * eine Struktur nachbauen. Jede Zeile nennt ihre Bezugsgröße mit, damit keine
 * Zahl ohne Nenner dasteht — „158" ist keine Aussage, „158 von 663" schon.
 */
export function befundAlsText(b: Befund): string {
  const zeilen: string[] = [`Treffer insgesamt: ${b.gesamt}`];

  if (b.relevanz.length > 0) {
    zeilen.push(`Relevanz: ${b.relevanz.map(r => `${RELEVANZ_LABEL[r.stufe]} ${r.anzahl}`).join(' · ')}`);
  }
  if (b.themen.length > 0) {
    zeilen.push(`Gefragt wurde nach: ${b.themen.join(' · ')}`);
  }
  if (b.alleThemen !== null) {
    zeilen.push(
      `Davon tragen ALLE gefragten Themen: ${b.alleThemen} von ${b.gesamt}`
      + ' (das sind die Vorhaben, um die es „hauptsächlich" geht).',
    );
  }
  if (b.fundstellen.length > 0) {
    zeilen.push(`Gefunden in: ${b.fundstellen.map(f => `${f.wert} ${f.anzahl}`).join(' · ')}`);
  }
  for (const v of b.verteilungen) {
    const werte = v.werte.map(w => `${w.wert} ${w.anzahl}`).join(' · ');
    zeilen.push(`${v.achse}: ${werte}${v.ohne > 0 ? ` · ohne Angabe ${v.ohne}` : ''}`);
  }
  return zeilen.join('\n');
}
