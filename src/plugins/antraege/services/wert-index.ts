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
 * **Sortiert wird alphabetisch** (v4.88). Bis dahin stand der häufigste Wert
 * oben — das war die Antwort auf eine Frage, die es nicht mehr gibt: WELCHE 50
 * von 1 270 Netzwerken die Liste zeigt. Sie zeigt jetzt alle, und dann ist die
 * Häufigkeit keine Ordnung mehr, sondern nur noch eine Zahl. Alphabetisch
 * findet man einen Namen, den man halb kennt; nach Häufigkeit findet man ihn
 * nur, wenn er häufig ist.
 *
 * **Die Anzahl beziffert, sie ordnet nicht.** Am Bestand gemessen führen 485
 * Anträge den Ort „Dresden", `ort:Dresden` findet aber 451 — die Suchstufe
 * vergleicht anders, als der Index zählt. Was im Dropdown als Zahl steht, kommt
 * deshalb aus einem echten Probelauf (siehe
 * [vervollstaendigung.ts](src/plugins/suche/vervollstaendigung.ts)); `anzahl`
 * dient nur noch dem Reiter „Stöbern" als Größenangabe.
 *
 * Rein — kein React, kein IDB. Gefüllt wird im Cursor-Walk des Korpus
 * ([search-corpus.ts](src/plugins/antraege/services/search-corpus.ts)), damit
 * kein zweiter Lauf über 14 000 Anträge nötig ist.
 */
import type { Trefferfeld } from '@/core/services/search/trefferstelle';

/** Die Felder, deren Werte sich aufzählen lassen. */
export type WertFeld = Extract<
  Trefferfeld,
  'standort' | 'bundesland' | 'organisation' | 'netzwerk' | 'wahlkreis' | 'deskriptoren'
>;

export const WERT_FELDER: readonly WertFeld[] = [
  'standort', 'bundesland', 'organisation', 'netzwerk', 'wahlkreis', 'deskriptoren',
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

/**
 * Faltet Schreibweisen und sortiert alphabetisch — danach ist jede Abfrage ein
 * Filter.
 *
 * **Groß- und Kleinschreibung falten ist Pflicht, nicht Kosmetik** (v4.88). Am
 * echten Bestand stehen 80 Netzwerke in zwei Schreibweisen im Export
 * (`3D-Fab`/`3D-FAB`, `agrASpace`/`AgrASpace`). Solange die Liste die 50
 * häufigsten zeigte, trafen sich die beiden fast nie; alphabetisch sortiert
 * stehen sie **direkt untereinander** und sehen aus wie ein Anzeigefehler. Die
 * Suche unterscheidet sie ohnehin nicht (sie vergleicht kleingeschrieben) —
 * zwei Zeilen für dieselbe Sache wären also eine Unterscheidung ohne Unterschied.
 * Nebenbei war die Dublette ein echter Defekt: React vergab zweimal denselben
 * Schlüssel (gemessen 688 Warnungen).
 *
 * Angezeigt wird die **häufigere** Schreibweise, bei Gleichstand die
 * alphabetisch erste — beides hängt an den Daten, nicht an der Reihenfolge des
 * Cursor-Laufs. `NFC` wegen der Umlaute (Pitfall #22).
 */
export function verdichteWertIndex(roh: WertIndexRoh): WertIndex {
  const out = new Map<WertFeld, WertEintrag[]>();
  for (const [feld, zaehler] of roh) {
    const gefaltet = new Map<string, { wert: string; anzahl: number; beste: number }>();
    for (const [wert, anzahl] of zaehler) {
      const k = wert.normalize('NFC').toLowerCase();
      const da = gefaltet.get(k);
      if (!da) { gefaltet.set(k, { wert, anzahl, beste: anzahl }); continue; }
      da.anzahl += anzahl;
      if (anzahl > da.beste || (anzahl === da.beste && wert.localeCompare(da.wert, 'de') < 0)) {
        da.wert = wert;
        da.beste = anzahl;
      }
    }
    const liste = Array.from(gefaltet.values(), ({ wert, anzahl }) => ({ wert, anzahl }));
    liste.sort((a, b) => a.wert.localeCompare(b.wert, 'de'));
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
 *
 * **Ein Anführungszeichen fehlt manchmal** — mal das schließende
 * (`"3DLiveVis2 16KN045423_LT`), mal das öffnende
 * (`CANNABIS-NET" 16KN089602_KR`). Am echten Bestand betrifft das 25 von 1 243
 * Werten. Bis v4.88 fiel es nicht auf, weil die Liste die 50 häufigsten zeigte
 * und diese Einzelfälle unten standen; alphabetisch sortiert ein führendes `"`
 * ganz nach vorn, und die ersten Zeilen des Katalogs waren Bruchstücke.
 *
 * **Das PAAR bleibt die erste Regel.** Es steht nicht immer vorn: `16KN054101
 * "IWiT" _PSc` führt das Kennzeichen zuerst. Wer nur „Anführungszeichen weg,
 * Kennzeichen hinten ab" rechnete, verlöre genau diese Fälle — hier stünde dann
 * die ganze Zeile als Netzwerkname im Katalog.
 *
 * Erst wenn kein Paar da ist, wird aufgeräumt: Anführungszeichen weg, dann das
 * Kennzeichen am Ende ab. Bleibt nichts übrig, war der Wert nur ein Kennzeichen
 * — dann ist es der Name (68 Netzwerke führen im Export keinen).
 *
 * Was am Ende kein Zeichen mit Bedeutung trägt (`"`, `"" _`), gibt einen
 * Leerstring zurück — `nimmWerte` lässt ihn fallen. Ein Katalogeintrag, der nur
 * aus Satzzeichen besteht, ist kein Wert, sondern ein Rest.
 */
export function netzwerkName(roh: string): string {
  const paar = /"([^"]+)"/.exec(roh);
  const ohneAnfuehrung = roh.replace(/"/g, ' ').trim();
  const ohneKennzeichen = ohneAnfuehrung.replace(/\s*\d{2}[A-Z]{2}\d{4,}\S*\s*$/u, '').trim();
  const name = paar
    ? (paar[1] as string).trim()
    : ohneKennzeichen.length > 0 ? ohneKennzeichen : ohneAnfuehrung;
  return /[\p{L}\p{N}]/u.test(name) ? name : '';
}

/**
 * Die Vorschläge zu einem angefangenen Wert.
 *
 * Drei Ränge, und die Reihenfolge ist der ganze Punkt: wer „dre" tippt, meint
 * Dresden — nicht „Meiningen-Dreißigacker", das den Buchstaben ebenfalls
 * enthält. Also erst der Anfang des Wertes, dann der Anfang eines Wortes darin
 * („main" findet „Frankfurt am Main"), dann irgendwo. Innerhalb eines Rangs
 * gilt die alphabetische Ordnung, und die steht schon in der Liste.
 *
 * `max` ist optional: **ohne Deckel kommt alles**, und das ist der Normalfall
 * seit v4.88 — das Dropdown zeigt den ganzen Wertevorrat zum Durchblättern. Der
 * Reiter „Stöbern" setzt weiter einen Deckel, weil er eine Vorschau je Feld ist
 * und keine Liste.
 */
export function vorschlaegeFuer(
  index: WertIndex, feld: WertFeld, teil: string, max?: number,
): WertEintrag[] {
  return sammlePassende(index, feld, teil, max);
}

/**
 * Wie viele Werte ein Feld führt.
 *
 * Seit v4.88 nicht mehr für das Dropdown (das zeigt alle und muss nichts mehr
 * beziffern), sondern für den Reiter „Stöbern": dort steht je Feld eine Vorschau
 * mit ein paar Werten, und die Zahl daneben sagt, wie groß der Vorrat ist.
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
  index: WertIndex, feld: WertFeld, teil: string, max?: number,
): WertEintrag[] {
  const liste = index.get(feld);
  if (!liste || liste.length === 0) return [];
  const q = teil.trim().toLowerCase();
  if (q.length === 0) return max === undefined ? [...liste] : liste.slice(0, max);

  // Ohne Deckel wird IMMER die ganze Liste durchlaufen. Der frühere Abbruch bei
  // vollem ersten Rang ging nur, solange oben abgeschnitten wurde; jetzt trüge
  // er die Ränge 2 und 3 nicht mehr vollständig zusammen — „main" fände
  // „Frankfurt am Main" nicht mehr, sobald genug Werte mit „main" ANFANGEN.
  // Gemessen über 5 461 Einrichtungen: ein Durchlauf kostet unter 1 ms.
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
  }
  const alle = [...anfang, ...wortAnfang, ...irgendwo];
  return max === undefined ? alle : alle.slice(0, max);
}
