/**
 * Der **Betrachtungsbereich**: welche Förder-Richtlinien zählen zum Arbeitsvorrat?
 *
 * Maßstab ist die **Richtlinien-Generation** — die aktuelle ZIM-Richtlinie und
 * die beiden davor. Gemessen am Bestand (14 221 Anträge, August 2026) sind das
 * die Generationen 2015, 2020 und 2025 mit zusammen 12 Programmen und 12 355
 * Anträgen; außerhalb bleibt die Generation 2012 (Programme 34, 35, 36, 37) mit
 * 1 866 Anträgen. Sie verzerrt jede Arbeitsliste, jeden Tab-Zähler und jede
 * Kapazitätsrechnung — und zwar unsichtbar.
 *
 * **Nicht zu verwechseln mit der Trigger-Abdeckung.** Die Trigger-Zuarbeit führt
 * heute nur für die Generationen 2020 und 2025 etwas (neun Programme). Das ist
 * eine andere, kleinere Menge; wo sie fehlt, sagt der Vorgang das ausdrücklich
 * („für Programm N keine Trigger importiert", Pitfall #44). Den Bereich daran zu
 * bemessen hieße, den Arbeitsvorrat nach Datenverfügbarkeit zu schneiden — genau
 * daran ist der erste Anlauf gescheitert.
 *
 * **Leitprinzip: Arbeitsvorrat folgt dem Bereich, Evidenz nicht.** Der Bereich
 * ist ein expliziter Parameter jedes Konsumenten, nie ein stiller Filter im
 * Daten-Layer. Die globale Suche bleibt am Vollbestand, ein Deep-Link öffnet
 * jeden Antrag, und kein Zustand gilt ohne sichtbaren Chip (Pitfall #46).
 *
 * **Zwei Quellen, eine Reihenfolge** — dasselbe Muster wie die Kategorie-Fassade
 * (Pitfall #45): der Seed steht flag-unabhängig im Code, eine geladene
 * Katalog-Fassung überschreibt ihn. Damit gilt der Bereich auch in prod/as, wo
 * `initStatusKatalog` hinter `statusCockpit` nie läuft — dort eben mit dem
 * ausgelieferten Stand. Weicht eine gepflegte Fassung davon ab, sagt der
 * Status-Katalog das ausdrücklich („wirkt in prod erst mit dem nächsten
 * Release"), statt zwei stille Wahrheiten nebeneinander laufen zu lassen.
 *
 * Rein: keine IO, kein React.
 */
import { normKey } from './normalisierung';
import type { MappingVersion } from './typen';

/** Eine Richtlinien-Generation: das Jahr und die Programme, die dazu gehören. */
export interface RichtlinienGeneration {
  jahr: number;
  programme: readonly string[];
}

/**
 * Alle bekannten Generationen, **aufsteigend nach Jahr**.
 *
 * Die Reihenfolge trägt Logik: `slice(-N)` unten liest „die N jüngsten", und
 * `generationenVon` entscheidet daran, ob eine Liste die *aktuellen* Richtlinien
 * meint. Eine neue Richtlinie wird deshalb **unten angehängt**, nie oben
 * eingefügt — sonst zeigt der Bereich still auf die ältesten Generationen.
 *
 * Ein Richtlinien-Wechsel ist damit ein Listeneintrag: die älteste Generation
 * rollt von selbst aus dem Bereich, Chip-Zahl und Panel-Gruppen folgen ohne
 * Zweitpflege. Erhoben aus dem Jahr der Unterprogramm-Kuration (Spalte
 * „Geplanter Zeitraum"), Stand August 2026.
 */
export const RICHTLINIEN_GENERATIONEN: readonly RichtlinienGeneration[] = [
  { jahr: 2012, programme: ['34', '35', '36', '37'] },
  { jahr: 2015, programme: ['46', '47', '48'] },
  { jahr: 2020, programme: ['76', '77', '78', '79', '131'] },
  { jahr: 2025, programme: ['136', '137', '138', '139'] },
];

/** Wie viele Generationen der Standard-Bereich umfasst — die „3" im Chip. */
export const BEREICH_GENERATIONEN = 3;

/**
 * Der ausgelieferte Standard-Bereich: die drei jüngsten Generationen.
 *
 * Abgeleitet, nicht abgeschrieben — die Liste kann der Beschriftung nicht
 * widersprechen. Nur der Startzustand: die Katalog-Fassung überschreibt ihn.
 */
export const BETRACHTUNGSBEREICH_SEED: readonly string[] =
  RICHTLINIEN_GENERATIONEN.slice(-BEREICH_GENERATIONEN).flatMap(g => g.programme);

/**
 * Die Programme der **jüngsten** Generation — die Kurzwahl „Aktuelle Richtlinie".
 *
 * Abgeleitet wie der Seed, nur mit `slice(-1)`: wer nur die laufende Richtlinie
 * ansehen will, klickt einmal statt acht Häkchen zu entfernen — und bekommt
 * beim nächsten Richtlinien-Wechsel automatisch die neue.
 *
 * Bewusst aus der **Code-Liste**, nicht aus der Katalog-Fassung: *welche*
 * Programme zum Arbeitsvorrat zählen, kuriert das Team; *welche Richtlinie die
 * jüngste ist*, ist eine Tatsache der Förderlandschaft. Dieselbe Trennung wie
 * bei `aktuelleProgramme()` in [ruhende-kuerzel.ts](./ruhende-kuerzel.ts).
 */
export const AKTUELLE_RICHTLINIE: readonly string[] =
  RICHTLINIEN_GENERATIONEN.slice(-1).flatMap(g => g.programme);

/**
 * Wie viele Generationen der **Bestandslauf** rechnet — die aktuelle Richtlinie
 * und die davor.
 *
 * Kleiner als der Bereich, und das mit Absicht (Spec Assistent-Fragevorschläge
 * 3.6): C16-Trigger gibt es ohnehin nur für die beiden jüngsten Generationen, der
 * Verlauf älterer Vorgänge ist nicht ableitbar, und jeder gerechnete Altvorgang
 * kostet Zeit auf jeder Seite, die den Lauf braucht. Listen, Zähler und Chip
 * bleiben beim Bereich; eine Zeile außerhalb sagt, warum ihr die Kaskade fehlt.
 */
export const BESTANDSLAUF_GENERATIONEN = 2;

/** Die Generationen des Bestandslaufs — abgeleitet wie Seed und „Aktuelle Richtlinie". */
export const BESTANDSLAUF_RICHTLINIEN: readonly RichtlinienGeneration[] =
  RICHTLINIEN_GENERATIONEN.slice(-BESTANDSLAUF_GENERATIONEN);

/**
 * Die Programme, die der Bestandslauf rechnet: der gewählte Bereich, geschnitten
 * mit den zwei jüngsten Generationen. Auch die Stufe „Alle" (`null`) rechnet nur
 * diese zwei. Rein.
 */
export function bestandslaufMenge(bereich: ReadonlySet<string> | null): ReadonlySet<string> {
  const lauf = bereichsMenge(BESTANDSLAUF_RICHTLINIEN.flatMap(g => g.programme));
  if (bereich === null) return lauf;
  return new Set([...lauf].filter(p => bereich.has(p)));
}

/**
 * Die Stufen der persönlichen Auswahl (reiner Domänen-Typ).
 *
 * Drei davon sind **listenlos und abgeleitet** (`standard`, `aktuell`, `alle`) —
 * sie folgen einem Richtlinien-Wechsel von selbst. Nur `auswahl` trägt eine
 * gespeicherte Liste und ist deshalb die einzige Stufe, die veralten kann.
 */
export type BereichModus = 'standard' | 'aktuell' | 'alle' | 'auswahl';

/** Die gepflegte Programm-Liste, sonst die ausgelieferte. */
export function bereichsProgramme(version?: MappingVersion | null): readonly string[] {
  const gepflegt = version?.betrachtungsbereich?.programme;
  return gepflegt && gepflegt.length > 0 ? gepflegt : BETRACHTUNGSBEREICH_SEED;
}

/**
 * Weicht die gepflegte Liste vom ausgelieferten Stand ab?
 *
 * Der Preis von „Seed im Code": eine PL-Änderung wirkt dort, wo der Katalog
 * geladen wird (dev/pl/kurator), aber nicht in prod/as. Sichtbar gemacht, statt
 * nur dokumentiert — sonst fällt die Divergenz erst auf, wenn zwei Rechner
 * verschiedene Zahlen zeigen.
 */
export function bereichWeichtVomSeedAb(version?: MappingVersion | null): boolean {
  const gepflegt = version?.betrachtungsbereich?.programme;
  if (!gepflegt || gepflegt.length === 0) return false;
  const a = [...gepflegt].map(x => x.trim()).sort();
  const b = [...BETRACHTUNGSBEREICH_SEED].sort();
  return a.length !== b.length || a.some((x, i) => x !== b[i]);
}

/** Nachschlage-Menge aus einer Programm-Liste (normalisiert wie jeder Join). */
export function bereichsMenge(programme: readonly string[]): ReadonlySet<string> {
  const out = new Set<string>();
  for (const p of programme) {
    const k = normKey(p);
    if (k) out.add(k);
  }
  return out;
}

/**
 * Liegt dieser Antrag im Bereich?
 *
 * `programme === null` heißt **kein Filter** (Stufe „Alle"). Ein Antrag ohne
 * Programm-Nummer fällt heraus, sobald ein Bereich gilt — geraten wird nicht;
 * im Bestand kommt der Fall nicht vor (gemessen: 0).
 */
export function istImBereich(
  unterprogrammId: unknown, programme: ReadonlySet<string> | null,
): boolean {
  if (programme === null) return true;
  if (typeof unterprogrammId !== 'string') return false;
  const k = normKey(unterprogrammId);
  return k !== '' && programme.has(k);
}

/** Zu welcher Generation gehört dieses Programm? `null` = keiner bekannten. */
export function generationVon(programm: string): number | null {
  const k = normKey(programm);
  if (!k) return null;
  for (const g of RICHTLINIEN_GENERATIONEN) {
    if (g.programme.some(p => normKey(p) === k)) return g.jahr;
  }
  return null;
}

/** Was eine Programm-Liste an Richtlinien-Generationen abdeckt. */
export interface Generationsabdeckung {
  /** **Vollständig** abgedeckte Generationen, aufsteigend nach Jahr. */
  jahre: readonly number[];
  /** Die Liste ist genau die Vereinigung von `jahre` — nichts fehlt, nichts extra. */
  exakt: boolean;
  /** `jahre` sind die N jüngsten Generationen (nur dann gilt „letzte N"). */
  juengste: boolean;
}

/**
 * Welche Generationen deckt diese Programm-Liste ab?
 *
 * `exakt: false` heißt: über Generationen ist hier **nichts** zu behaupten. Das
 * trifft zwei Fälle, und der zweite ist der gefährlichere:
 *
 * 1. ein Code, der zu keiner bekannten Generation gehört;
 * 2. eine nur **teilweise** enthaltene Generation. `['46','76','136']` besteht
 *    aus lauter bekannten Codes und berührt drei Generationen — „letzte 3
 *    Richtlinien (3 Programme)" wäre daraus die schlimmere Falschaussage, weil
 *    der Leser den vollen Bestand dieser Richtlinien vor sich zu haben glaubt.
 *
 * Eine Generation zählt deshalb nur mit, wenn sie **ganz** enthalten ist, und
 * `exakt` nur, wenn die Liste darüber hinaus nichts enthält. `juengste` trennt
 * zusätzlich „die aktuellen Richtlinien" von „drei alte Generationen".
 */
export function generationenVon(programme: readonly string[]): Generationsabdeckung {
  const menge = bereichsMenge(programme);
  const jahre: number[] = [];
  let abgedeckt = 0;
  for (const g of RICHTLINIEN_GENERATIONEN) {
    const drin = g.programme.filter(p => menge.has(normKey(p))).length;
    if (drin > 0 && drin === g.programme.length) {
      jahre.push(g.jahr);
      abgedeckt += drin;
    }
  }
  const exakt = jahre.length > 0 && abgedeckt === menge.size;
  const schwanz = RICHTLINIEN_GENERATIONEN.slice(-jahre.length).map(g => g.jahr);
  const juengste = exakt && jahre.every((j, i) => j === schwanz[i]);
  return { jahre, exakt, juengste };
}

/** Eine Gruppe der Auswahl-Liste: Überschrift plus die Codes darunter. */
export interface Programmgruppe {
  /** `null` für Programme außerhalb jeder bekannten Generation. */
  jahr: number | null;
  titel: string;
  programme: readonly string[];
}

/**
 * Die Codes der Auswahl-Liste, nach Generation gruppiert — **jüngste zuerst**,
 * Unbekanntes zuletzt.
 *
 * Jüngste oben, weil die Liste zur Leserichtung von „letzte 3 Richtlinien"
 * passen und die aktuelle Arbeit vorn stehen soll; der Seed bleibt aufsteigend,
 * weil er sich als Historie liest. Beides geht, weil die Reihenfolge nirgends
 * Logik trägt (`bereichWeichtVomSeedAb` sortiert, `bereichsMenge` baut ein Set).
 *
 * Was zu keiner bekannten Generation gehört, bekommt eine eigene Gruppe statt
 * stillschweigend zu fehlen — sonst wäre eine Liste kürzer als ihre Eingabe.
 */
export function gruppiereNachGeneration(
  programme: readonly string[],
): readonly Programmgruppe[] {
  const gruppen: Programmgruppe[] = [];
  const menge = bereichsMenge(programme);
  for (const g of [...RICHTLINIEN_GENERATIONEN].reverse()) {
    const drin = g.programme.filter(p => menge.has(normKey(p)));
    if (drin.length > 0) {
      gruppen.push({ jahr: g.jahr, titel: `Richtlinie ${g.jahr}`, programme: drin });
    }
  }
  const rest = programme.filter(p => normKey(p) && generationVon(p) === null);
  if (rest.length > 0) {
    gruppen.push({ jahr: null, titel: 'Andere Programme', programme: [...new Set(rest)] });
  }
  return gruppen;
}

/**
 * Der Text des Bereichs-Chips — **eine** Quelle für Zahl und Wort.
 *
 * Die „3" stand einmal als Literal neben einem gerechneten „(N Programme)".
 * Zwei Quellen für dieselbe Aussage laufen auseinander, und genau das ist
 * passiert: der Standard-Bereich deckte zwei Generationen ab, der Chip
 * versprach drei. Alles, was der Chip sagt, wird deshalb hier abgeleitet.
 *
 * **Wo der Chip die Richtlinien beim Namen nennt, nennt er keine Programm-Zahl**
 * (v4.70): `exakt` verbürgt, dass die Generationen die Menge vollständig
 * beschreiben — „(12 Programme)" wiederholte das nur und kostete im Kopf Platz,
 * den die Zeile für Wichtigeres braucht. Die Zahl bleibt, wo sie etwas trägt:
 * bei einer eigenen Auswahl (dort markiert sie die Abweichung) und dort, wo sich
 * keine Generation belegen lässt (dort ist sie die einzige belegbare Aussage).
 * Die Programme selbst stehen im Tooltip und im Auswahl-Panel.
 *
 * Der **Präfix** benennt, WORAUF die Auswahl wirkt: „Anzeige" am Arbeitsvorrat,
 * „Treffer" an der Suche. Er ist ein Parameter und kein zweiter Textbaustein,
 * damit die Zustandsnamen dahinter in beiden Chips wortgleich bleiben — und
 * damit „Treffer: alle Richtlinien" nicht neben der Zeilenmarke „außerhalb des
 * Anzeigebereichs" steht und ihr zu widersprechen scheint.
 */
export function bereichsLabel(
  modus: BereichModus, programme: readonly string[], praefix = 'Anzeige',
): string {
  if (modus === 'alle') return `${praefix}: alle Richtlinien`;

  const n = programme.length;
  const zahl = n === 1 ? '1 Programm' : `${n} Programme`;
  // Eine eigene Auswahl nennt bewusst keine Generation: die Information, auf die
  // es ankommt, ist „das ist nicht der Team-Standard".
  if (modus === 'auswahl') return `${praefix}: eigene Auswahl (${zahl})`;

  const { jahre, exakt, juengste } = generationenVon(programme);
  if (!exakt) return `${praefix}: ${zahl}`;
  // „letzte N" nur im Plural. Bei EINER Generation ist ihr Jahr die bessere
  // Auskunft — „letzte Richtlinie" liest sich außerdem als „die endgültige",
  // und der Knopf, der diesen Zustand herstellt, heißt „Aktuelle Richtlinie".
  if (juengste && jahre.length > 1) return `${praefix}: letzte ${jahre.length} Richtlinien`;
  const liste = jahre.join(' + ');
  return jahre.length === 1
    ? `${praefix}: Richtlinie ${liste}`
    : `${praefix}: Richtlinien ${liste}`;
}
