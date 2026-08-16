/**
 * Welche Werte ein Feld im Bestand überhaupt führt — die Grundlage der
 * Vervollständigung im Suchfeld.
 *
 * Die Feldsuche (`ort:`, `nw:`, `deskriptor:`) setzt bisher voraus, dass man den
 * Wert schon kennt. Bei manchen Feldern ist das eine Zumutung: die Deskriptoren
 * sind ein festes Vokabular von 43 Werten, das nirgends in der App steht
 * („Dienstleistungen (Hardwareberatung, Softwareberatung, …)"), und ein
 * Netzwerk heißt im Export `"ProAnimalLife" 16KN062302_KR` — beides errät
 * niemand. Dieser Index macht aus dem Ratespiel eine Liste zum Durchblättern.
 *
 * **Nur Felder mit einem abzählbaren Wertevorrat** stehen hier. Titel,
 * Beschreibung und Notizen tragen Fließtext; eine Vorschlagsliste daraus wäre
 * eine Wortwolke, keine Hilfe. Kennzeichen (FKZ, Verbund) sind abzählbar, aber
 * sinnlos zu durchblättern — 7 535 undurchsichtige Codes.
 *
 * **Die Anzahl hier ordnet, sie beziffert nicht.** Am Bestand gemessen führen
 * 485 Anträge den Ort „Dresden", `ort:Dresden` findet aber 451 — die Suchstufe
 * vergleicht anders, als der Index zählt. Was im Dropdown als Zahl steht, kommt
 * deshalb aus einem echten Probelauf (siehe
 * [vervollstaendigung.ts](src/plugins/suche/vervollstaendigung.ts)); die Zahl
 * hier entscheidet nur, welcher Wert oben steht.
 *
 * Rein — kein React, kein IDB. Gefüllt wird im Cursor-Walk des Korpus
 * ([search-corpus.ts](src/plugins/antraege/services/search-corpus.ts)), damit
 * kein zweiter Lauf über 14 000 Anträge nötig ist.
 */
import type { Trefferfeld } from '@/core/services/search/trefferstelle';

/** Die Felder, deren Werte sich aufzählen lassen. */
export type WertFeld = Extract<
  Trefferfeld, 'standort' | 'organisation' | 'netzwerk' | 'wahlkreis' | 'deskriptoren'
>;

export const WERT_FELDER: readonly WertFeld[] = [
  'standort', 'organisation', 'netzwerk', 'wahlkreis', 'deskriptoren',
];

/** Ein Wert des Bestands mit seiner Häufigkeit. */
export interface WertEintrag {
  wert: string;
  /** In wie vielen Anträgen er vorkommt. Ordnet die Liste. */
  anzahl: number;
}

/** Der Index im Aufbau — Zählwerk, noch nicht sortiert. */
export type WertIndexRoh = Map<WertFeld, Map<string, number>>;

/** Der fertige Index: je Feld die Werte, häufigste zuerst. */
export type WertIndex = ReadonlyMap<WertFeld, readonly WertEintrag[]>;

/** Werte über dieser Länge sind kein Nachschlagewert mehr, sondern ein Satz. */
const MAX_WERT_LAENGE = 140;

export function leererWertIndexRoh(): WertIndexRoh {
  const m: WertIndexRoh = new Map();
  for (const f of WERT_FELDER) m.set(f, new Map());
  return m;
}

/**
 * Zählt die Werte EINES Antrags. Wiederholungen innerhalb des Antrags zählen
 * einmal: Antragsteller und ausführende Stelle sind in 97,5 % der Sätze
 * dieselbe Einrichtung, doppelt gezählt stünde sie doppelt so hoch wie sie ist.
 */
export function nimmWerte(
  index: WertIndexRoh, feld: WertFeld, werte: readonly (string | undefined)[],
): void {
  const ziel = index.get(feld);
  if (!ziel) return;
  const gesehen = new Set<string>();
  for (const roh of werte) {
    if (typeof roh !== 'string') continue;
    const w = roh.trim();
    if (w.length === 0 || w.length > MAX_WERT_LAENGE) continue;
    if (gesehen.has(w)) continue;
    gesehen.add(w);
    ziel.set(w, (ziel.get(w) ?? 0) + 1);
  }
}

/** Sortiert einmal nach Häufigkeit — danach ist jede Abfrage ein Filter. */
export function verdichteWertIndex(roh: WertIndexRoh): WertIndex {
  const out = new Map<WertFeld, WertEintrag[]>();
  for (const [feld, zaehler] of roh) {
    const liste = Array.from(zaehler, ([wert, anzahl]) => ({ wert, anzahl }));
    liste.sort((a, b) => (b.anzahl - a.anzahl) || a.wert.localeCompare(b.wert, 'de'));
    out.set(feld, liste);
  }
  return out;
}

/** Trägt dieses Feld überhaupt aufzählbare Werte? */
export function istWertFeld(feld: Trefferfeld | undefined): feld is WertFeld {
  return feld !== undefined && (WERT_FELDER as readonly string[]).includes(feld);
}

/**
 * Der Name eines Netzwerks aus der Export-Schreibweise.
 *
 * Der Export führt Name UND Kennzeichen in einem Feld (`"ProAnimalLife"
 * 16KN062302_KR`). Vorgeschlagen wird der Name: er ist das, was das Team sagt,
 * und er ist ein Wort — das Kennzeichen findet man über `nw:` weiterhin, es
 * steht ja im Feld. Ohne Anführungszeichen kommt der Wert unverändert zurück.
 */
export function netzwerkName(roh: string): string {
  const m = /"([^"]+)"/.exec(roh);
  return m?.[1]?.trim() ?? roh.trim();
}

/**
 * Die Vorschläge zu einem angefangenen Wert.
 *
 * Drei Ränge, und die Reihenfolge ist der ganze Punkt: wer „dre" tippt, meint
 * Dresden — nicht „Meiningen-Dreißigacker", das den Buchstaben ebenfalls
 * enthält. Also erst der Anfang des Wertes, dann der Anfang eines Wortes darin
 * („main" findet „Frankfurt am Main"), dann irgendwo. Innerhalb eines Rangs
 * entscheidet die Häufigkeit, und die steht schon in der Reihenfolge der Liste.
 *
 * Ohne getippten Teil kommen die häufigsten Werte — die Liste ist dann ein
 * Katalog, und genau das braucht sie bei den Deskriptoren zu sein.
 */
export function vorschlaegeFuer(
  index: WertIndex, feld: WertFeld, teil: string, max: number,
): WertEintrag[] {
  return sammlePassende(index, feld, teil, max);
}

/**
 * Wie viele Werte es insgesamt gäbe.
 *
 * Die Liste zeigt nur die ersten paar; ohne diese Zahl sähe ein Deckel aus wie
 * Vollständigkeit — bei `nw:` stünden acht Netzwerke da, und die übrigen 1 262
 * blieben unerwähnt. Eigene Funktion statt eines zweiten Rückgabewerts, weil
 * `vorschlaegeFuer` beim Deckel abbricht und deshalb gar nicht zählen kann.
 */
export function anzahlPassend(index: WertIndex, feld: WertFeld, teil: string): number {
  const liste = index.get(feld);
  if (!liste) return 0;
  const q = teil.trim().toLowerCase();
  if (q.length === 0) return liste.length;
  let n = 0;
  for (const e of liste) if (e.wert.toLowerCase().includes(q)) n++;
  return n;
}

function sammlePassende(
  index: WertIndex, feld: WertFeld, teil: string, max: number,
): WertEintrag[] {
  const liste = index.get(feld);
  if (!liste || liste.length === 0) return [];
  const q = teil.trim().toLowerCase();
  if (q.length === 0) return liste.slice(0, max);

  const anfang: WertEintrag[] = [];
  const wortAnfang: WertEintrag[] = [];
  const irgendwo: WertEintrag[] = [];
  for (const e of liste) {
    const klein = e.wert.toLowerCase();
    const pos = klein.indexOf(q);
    if (pos < 0) continue;
    if (pos === 0) anfang.push(e);
    else if (!/[\p{L}\p{N}]/u.test(klein[pos - 1] as string)) wortAnfang.push(e);
    else irgendwo.push(e);
    // Genug für jeden denkbaren Rang — der Rest der Liste kann nichts mehr
    // gewinnen, und über 5 000 Einrichtungen soll die Schleife nicht laufen,
    // wenn oben schon alles beisammen ist.
    if (anfang.length >= max) break;
  }
  return [...anfang, ...wortAnfang, ...irgendwo].slice(0, max);
}
