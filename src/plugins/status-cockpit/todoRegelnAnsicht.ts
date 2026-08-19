/**
 * Das **Ansichts-Modell** der To-do-Kaskade — ohne React, damit es prüfbar ist.
 *
 * Der Regeln-Tab zeigt dieselbe Regel in drei Gestalten (breite Karte, schlanke
 * Zeile, Detail-Spalte). Welche Zustände eine Regel hat und welche Regeln
 * überhaupt in einem Regelsatz stehen, darf deshalb nicht dreimal danebenstehen:
 * jede Kopie wäre eine Driftquelle, und die Auswahl der sichtbaren Regeln hängt
 * an Pitfall #47 (Sperren erscheinen in JEDEM Satz, gewöhnliche Regeln nur im
 * eigenen). Hier steht sie einmal — und ist damit node-testbar.
 */
import {
  regelsatzVon, sperreGiltFuer, strangAusEintrag, ALLE_STRAENGE, REGELSATZ_DEFAULT,
  type PlatzhalterGruppe, type RegelWirkung, type Rolle, type TodoRegel,
} from '@/core/status';
import { zaehlwort } from '@/core/utils/zaehlwort';

/**
 * Die Warnung, die an jedem Nicht-AB-Regelsatz steht.
 *
 * `status-katalog.json` ist für alle Build-Varianten gleichzeitig live. Eine
 * aktive FB-Regel würde von jeder Installation unter v2.391 in der AB-Kaskade
 * mitgewertet, weil deren Engine das Feld `regelsatz` nicht kennt — und dort
 * eine Aufgabe erzeugen, die es nicht gibt.
 */
export const ROLLOUT_HINWEIS = 'Regelsätze außer AB werden von Installationen unter v2.391 in der '
  + 'AB-Kaskade mitgewertet. Erst aktivieren, wenn alle Varianten aktualisiert sind.';

/** Der Ausschnitt der Cockpit-API, den der Regeln-Tab braucht. */
export interface TodoRegelnApi {
  setTodoRegel: (id: string, patch: Partial<TodoRegel>) => void;
  verschiebeTodoRegel: (id: string, richtung: -1 | 1) => void;
  todoRegelnNachziehen: () => void;
  /** Was die Auslieferung gegenüber der gepflegten Kaskade anders sagt. */
  todoDrift: { neu: string[]; geaendert: string[]; entfallen: string[] };
  /** Eine Regel aus einem Platzhalter erzeugen — stillgelegt, vorbefüllt. */
  todoRegelAusPlatzhalter: (g: PlatzhalterGruppe) => void;
}

/**
 * Die Regeln, die in einem Regelsatz sichtbar sind — in Kaskaden-Reihenfolge.
 *
 * Sperren erscheinen in jedem Satz, in dem sie greifen; eine unsichtbare Sperre
 * wäre genau die stille Leere, die das Board vermeidet.
 *
 * **Fremde Sperren stehen vorn, danach die eigene Kaskade** (v4.121). Vorher
 * mischte ein einziges `reihenfolge`-Sortieren zwei unabhängig nummerierte
 * Kaskaden: eine neue FB-Regel bekam `reihenfolge: 10` (die erste ihres Satzes)
 * und landete damit zwischen den AB-Sperren 10…40 — auf Platz 4 von 5, den
 * niemand gewählt hatte. Die Nummern zweier Sätze sind nicht vergleichbar, und
 * genau so liest die Engine sie auch: der Sperr-Pass ist ein Vollscan **ohne**
 * Ordnung und läuft vor dem Treffer-Pass, der nur einen Satz sieht.
 */
export function sichtbareRegeln(alle: readonly TodoRegel[], satz: Rolle): TodoRegel[] {
  return alle
    .filter(r => ((r.sperrt?.length ?? 0) > 0 ? sperreGiltFuer(r, satz) : regelsatzVon(r) === satz))
    .sort((a, b) => {
      const aEigen = regelsatzVon(a) === satz ? 1 : 0;
      const bEigen = regelsatzVon(b) === satz ? 1 : 0;
      return aEigen - bEigen || a.reihenfolge - b.reihenfolge;
    });
}

/** Die Stelle einer Regel in der Kaskade, die sie wirklich bewegt. */
export interface KaskadenPosition {
  /** 0-basiert innerhalb des EIGENEN Regelsatzes. */
  index: number;
  /** Wie viele Regeln dieser Satz führt — der Nenner der Positionsangabe. */
  anzahl: number;
}

/**
 * Wo jede **eigene** Regel in ihrer Kaskade steht — der Maßstab für Pfeile,
 * Positionsangabe und die Nummer an der Karte.
 *
 * Bis v4.120 kamen alle drei aus dem Index der ANGEZEIGTEN Liste, verschoben
 * wurde aber in der Kaskade des eigenen Satzes (`verschiebeTodoRegel`). Am Bild
 * gemessen: die einzige FB-Regel stand als Nummer 4 zwischen vier AB-Sperren,
 * beide Pfeile aktiv und beschriftet („eine Position nach oben"), und ein Klick
 * änderte nichts — sie war in ihrem Satz längst die erste und letzte.
 *
 * Fremde Sperren stehen in KEINER Position dieses Satzes; sie tauchen hier
 * bewusst nicht auf, statt eine Nummer zu bekommen, die nichts bedeutet.
 */
export function kaskadenPositionen(
  sichtbar: readonly TodoRegel[], satz: Rolle,
): ReadonlyMap<string, KaskadenPosition> {
  const eigene = sichtbar.filter(r => regelsatzVon(r) === satz);
  return new Map(eigene.map((r, i) => [r.id, { index: i, anzahl: eigene.length }]));
}

/**
 * Die Id, die eine aus einem Platzhalter erzeugte Regel bekommt.
 *
 * Steht hier statt im Hook, weil zwei Stellen sie brauchen: die eine legt die
 * Regel an, die andere muss sehen, dass es sie schon gibt — sonst lädt ein
 * zweiter Klick auf „Regel erzeugen" zu einer Aktion ein, die wortlos nichts
 * tut (`fuegeTodoRegelHinzu` steigt bei bekannter Id aus).
 */
export function todoRegelIdAusPlatzhalter(g: Pick<PlatzhalterGruppe, 'rolle' | 'quellRegelId'>): string {
  return `${g.rolle}-${g.quellRegelId}`;
}

/** Die gewählte Regel samt Position — oder `null`, wenn sie (nicht mehr) dasteht. */
export interface RegelAuswahl {
  regel: TodoRegel;
  /** 0-basiert, wie der Listen-Index. */
  index: number;
  anzahl: number;
}

/**
 * Die Auswahl **ableiten** statt synchronisieren: verschwindet die Regel (Satz
 * gewechselt, Entwurf verworfen, Fassung neu geladen), liefert das hier `null`
 * und die Detail-Spalte schließt sich von selbst — ohne `useEffect`, der dem
 * Render hinterherräumt.
 */
export function waehleRegel(regeln: readonly TodoRegel[], gewaehlt: string | null): RegelAuswahl | null {
  if (gewaehlt === null) return null;
  const index = regeln.findIndex(r => r.id === gewaehlt);
  const regel = regeln[index];
  if (regel === undefined) return null;
  return { regel, index, anzahl: regeln.length };
}

/** Die vier Zustände, die Karte, Zeile und Detail gleichermaßen anzeigen. */
export interface Zustandsmarker {
  istSperre: boolean;
  /** Gehört die Regel dem gezeigten Satz? Nur dann ist sie verschiebbar. */
  eigen: boolean;
  stillgelegt: boolean;
  /** Sperre ohne `giltFuer` — sie wirkt in jedem Regelsatz. */
  giltFuerAlle: boolean;
  /** Feld-Referenzen, die der Katalog nicht kennt (die Regel träfe nie zu). */
  unbekannte: readonly string[];
}

export function zustandsMarker(
  r: TodoRegel, satz: Rolle, unbekannte: readonly string[],
): Zustandsmarker {
  const istSperre = (r.sperrt?.length ?? 0) > 0;
  // Eine vorgangsweite Sperre erscheint in JEDEM Satz — verschieben lässt sie
  // sich aber nur dort, wo sie zu Hause ist: sonst bewegte ein Klick im FB-Tab
  // eine Regel, die im AB-Tab an anderer Stelle steht.
  const eigen = regelsatzVon(r) === satz;
  return { istSperre, eigen, stillgelegt: !r.aktiv, giltFuerAlle: istSperre && !eigen, unbekannte };
}

/** `Position 5 von 27` — 1-basiert angezeigt über 0-basiertem Index. */
export function positionsText(index: number, anzahl: number): string {
  return `Position ${index + 1} von ${anzahl}`;
}

/** Was an einer Regel über ihre Wirkung am Bestand steht. */
export interface WirkungsAnzeige {
  /** Die knappe Fassung für das rechte Zeilenende („trifft 153 · gewinnt 43"). */
  kurz: string;
  /** Der erklärende Satz für Karte und Detail. */
  lang: string;
  /** Trifft nie zu — ruhiger Hinweis, die Regel ist überholt oder falsch. */
  nullbefund: boolean;
}

const zahl = (n: number): string => n.toLocaleString('de-DE');

/**
 * Die Wirkung einer Regel in Worte fassen. Rein — deshalb hier und nicht in der
 * Komponente (node-only Testumgebung).
 *
 * Drei Fälle, drei Formulierungen:
 * - **Sperre**: sie erzeugt kein To-do, also ist „gewinnt" keine sinnvolle
 *   Frage. Gezählt wird, wie oft sie greift.
 * - **gewinnt === trifftZu**: nur EINE Zahl. Zwei gleiche Zahlen nebeneinander
 *   lesen sich wie ein Problem, wo keines ist — und der Regelfall ist, dass eine
 *   Regel überall gewinnt, wo sie zutrifft.
 * - **gewinnt < trifftZu**: beide, und der Satz erklärt den Unterschied. Das ist
 *   die Kaskade, sichtbar gemacht.
 *
 * Ohne Lauf gibt es KEINE Anzeige (`null`) — kein Platzhalterstrich, der wie
 * eine gemessene Null aussähe.
 */
export function wirkungsAnzeige(w: RegelWirkung | undefined, istSperre: boolean): WirkungsAnzeige | null {
  if (!w) return null;

  if (istSperre) {
    return {
      kurz: `greift ${zahl(w.greift)}`,
      lang: w.greift === 0
        ? 'Diese Sperre greift im gemessenen Bestand bei keinem Vorgang.'
        : `Diese Sperre greift bei ${zahl(w.greift)} Vorgängen und legt dort ihre Stränge still.`,
      nullbefund: w.greift === 0,
    };
  }

  if (w.trifftZu === 0) {
    return {
      kurz: 'trifft 0',
      lang: 'Diese Regel trifft im gemessenen Bestand auf keinen Vorgang zu — '
        + 'entweder ist sie überholt, oder ihre Bedingung beschreibt etwas anderes als gemeint.',
      nullbefund: true,
    };
  }

  // „trifft 21 · gewinnt 0" las sich bis v4.93 wie eine gewöhnliche Verdeckung.
  // Eine Regel, die NIE gewinnt, steht aber in der Kaskade, ohne je etwas zu
  // bestimmen — das ist ein Befund und kein Zahlenpaar.
  if (w.gewinnt === 0) {
    return {
      kurz: `trifft ${zahl(w.trifftZu)} · gewinnt 0`,
      lang: `Die Bedingung trifft auf ${zahl(w.trifftZu)} Vorgänge zu, aber diese Regel bestimmt `
        + 'bei keinem das To-do — eine Regel weiter vorn in der Kaskade verdeckt sie überall.',
      nullbefund: true,
    };
  }

  if (w.gewinnt === w.trifftZu) {
    return {
      kurz: `${zahl(w.gewinnt)} Vorgänge`,
      lang: `Diese Regel bestimmt das To-do bei ${zahl(w.gewinnt)} Vorgängen — überall, `
        + 'wo ihre Bedingung zutrifft. Keine frühere Regel verdeckt sie.',
      nullbefund: false,
    };
  }

  // „bei den übrigen 1" stand nach dem ersten Messlauf am Bestand da — die
  // Differenz ist regelmäßig genau eins, und ein Zahlwort im Plural-Satz fällt
  // im Termin sofort auf.
  const rest = w.trifftZu - w.gewinnt;
  const restSatz = rest === 1
    ? 'bei einem davon greift eine Regel weiter vorn in der Kaskade'
    : `bei den übrigen ${zahl(rest)} greift eine Regel weiter vorn in der Kaskade`;
  return {
    kurz: `trifft ${zahl(w.trifftZu)} · gewinnt ${zahl(w.gewinnt)}`,
    lang: `Die Bedingung trifft auf ${zahl(w.trifftZu)} Vorgänge zu, aber nur bei `
      + `${zahl(w.gewinnt)} bestimmt diese Regel das To-do — ${restSatz}.`,
    nullbefund: false,
  };
}

/**
 * Braucht das Aktivieren eine Rückfrage? Nur das AKTIVIEREN einer Regel außerhalb
 * des AB-Satzes ist die Aktion mit Fernwirkung (siehe `ROLLOUT_HINWEIS`);
 * Stilllegen ist immer harmlos.
 *
 * Rein, damit die Bedingung ohne `window`-Mock prüfbar bleibt — das `confirm`
 * selbst steht in der Komponente.
 */
export function brauchtRolloutRueckfrage(r: TodoRegel, an: boolean): boolean {
  return an && regelsatzVon(r) !== REGELSATZ_DEFAULT;
}

/**
 * Vorschläge für {@link TodoRegel.strang} — eine **Liste**, kein Enum.
 *
 * Die Kaskade wird von der Fachseite gepflegt; ein neuer Strang darf kein
 * Release brauchen. Was hier steht, sind die Ketten des ausgelieferten Satzes.
 */
export const STRANG_VORSCHLAEGE: readonly string[] = [
  'precheck', 'nachforderung', 'rne', 'ablehnung', 'gutachten', 'zuwb', 'schluss',
];

/**
 * Alle Stränge, die in dieser Fassung vorkommen — aus den Vorschlägen UND dem,
 * was Regeln und Sperren tatsächlich führen.
 *
 * Ein selbst vergebener Strang muss in der Auswahl wieder auftauchen, sonst
 * bietet der Editor beim nächsten Öffnen etwas anderes an, als dasteht.
 */
export function bekannteStraenge(regeln: readonly TodoRegel[]): string[] {
  const alle = new Set<string>(STRANG_VORSCHLAEGE);
  for (const r of regeln) {
    if (r.strang) alle.add(r.strang.trim());
    for (const e of r.sperrt ?? []) {
      const s = strangAusEintrag(e);
      if (s) alle.add(s);
    }
  }
  return [...alle].sort((a, b) => a.localeCompare(b, 'de'));
}

/**
 * Fällt diese Regel durch jede Strang-Sperre, weil sie keinen Strang trägt?
 *
 * Genau das Problem, das der Umbau beseitigt: eine neu angelegte Regel ohne
 * `strang` bleibt für S1/S2 unsichtbar und feuert auch am zurückgezogenen
 * Antrag. Der Hinweis steht deshalb NUR da, wo im gezeigten Regelsatz
 * tatsächlich eine Sperre nach Strängen greift — sonst wäre er Lärm.
 *
 * Sperren selbst sind ausgenommen: sie werden nie von einer anderen erfasst.
 */
export function fehltStrangTrotzSperre(r: TodoRegel, alle: readonly TodoRegel[], satz: Rolle): boolean {
  if ((r.sperrt?.length ?? 0) > 0) return false;
  if (r.strang !== undefined && r.strang.trim() !== '') return false;
  return alle.some(s => (s.sperrt ?? []).some(e => strangAusEintrag(e) !== null)
    && s.aktiv && sperreGiltFuer(s, satz));
}

/**
 * Anzeigeform eines Strangs. Die gepflegten Ketten tragen Schreibweisen, die
 * keine Regel errät (`zuwb` → `ZuwB`, `rne` → `RNE`); alles andere bekommt einen
 * Großbuchstaben und bleibt sonst, wie es eingegeben wurde.
 */
const STRANG_LABEL: Record<string, string> = {
  precheck: 'PreCheck', nachforderung: 'Nachforderung', rne: 'RNE',
  ablehnung: 'Ablehnung', gutachten: 'Gutachten', zuwb: 'ZuwB', schluss: 'Schlussvermerk',
};

export function strangLabel(s: string): string {
  const k = s.trim();
  return STRANG_LABEL[k.toLowerCase()] ?? (k.charAt(0).toUpperCase() + k.slice(1));
}

/** Aufzählung mit „und" vor dem letzten Glied. */
function undListe(teile: readonly string[]): string {
  if (teile.length <= 1) return teile[0] ?? '';
  return `${teile.slice(0, -1).join(', ')} und ${teile[teile.length - 1]}`;
}

/**
 * Was eine Sperre stilllegt — und was sie bewusst durchlässt.
 *
 * Seit v2.412 nennt sie **Stränge** statt sieben Regel-Ids: „ruhen die Stränge
 * PreCheck und Nachforderung" ist ein Satz, den ein Fachvertreter prüfen kann;
 * „7 Regeln überspringen (r1, r2, r22, r23a, r23b, r24, r25)" war eine Liste,
 * die man erst auflösen musste. Gemischte Listen nennen beides — sie sind
 * vorgesehen, kein Übergangszustand.
 *
 * Steht hier und nicht in der Komponente, damit die Grammatik prüfbar ist: die
 * erste Fassung schrieb „7 die Regeln r1, …", und das sah man erst im Browser.
 */
export function sperrSatz(r: TodoRegel): string {
  const eintraege = r.sperrt ?? [];
  const ausnahmen = (r.sperrtNicht ?? []).join(', ');
  const rest = ausnahmen ? ` — außer ${ausnahmen}` : '';
  if (eintraege.includes(ALLE_STRAENGE)) return `kein To-do mehr${rest}`;

  const straenge = eintraege.map(strangAusEintrag).filter((x): x is string => x !== null);
  const ids = eintraege.filter(e => strangAusEintrag(e) === null);
  if (straenge.length === 0 && ids.length === 0) return `nichts wird gesperrt${rest}`;

  const teile: string[] = [];
  if (straenge.length > 0) {
    teile.push(`${straenge.length === 1 ? 'der Strang' : 'die Stränge'} `
      + undListe(straenge.map(strangLabel)));
  }
  if (ids.length > 0) {
    teile.push(`${ids.length === 1 ? 'die Regel' : 'die Regeln'} ${ids.join(', ')}`);
  }
  // Ein einzelnes Glied ruht, mehrere ruhen — und zwei Teile sind immer mehrere.
  const einzahl = teile.length === 1 && straenge.length + ids.length === 1;
  return `${undListe(teile)} ${einzahl ? 'ruht' : 'ruhen'}${rest}`;
}

/**
 * Eine Regel, die im gemessenen Bestand nichts bewirkt — und warum.
 *
 * Die drei Gründe sind drei verschiedene Fehler, und sie zusammenzuwerfen
 * verschenkt die Auskunft: „trifft nie" heißt, die Bedingung beschreibt etwas
 * anderes als gemeint; „immer verdeckt" heißt, die Bedingung stimmt, aber die
 * Kaskaden-Position ist falsch; „greift nie" ist dasselbe für eine Sperre.
 */
export interface WirkungsBefund {
  regel: TodoRegel;
  grund: 'trifft nie' | 'immer verdeckt' | 'greift nie';
}

/**
 * Der Kurzname, unter dem eine Regel im Fachgespräch läuft — „R23b" aus
 * „R23b · PreCheck Verbund offen (nur FuE/DS)".
 *
 * Ohne den Trenner bleibt die ganze Beschreibung stehen: lieber eine lange
 * Bilanzzeile als eine Regel, die niemand wiederfindet.
 */
export function regelKurzname(r: TodoRegel): string {
  const kopf = r.beschreibung.split(' · ')[0]?.trim();
  return kopf !== undefined && kopf.length > 0 ? kopf : r.beschreibung;
}

/**
 * Welche Regeln des Satzes im gemessenen Bestand nichts bewirken.
 *
 * **Stillgelegte bleiben draußen.** Eine ausgeschaltete Regel tut
 * erwartungsgemäß nichts; sie mitzuzählen machte die Bilanz zur Anzeige des
 * eigenen `aktiv`-Hakens. Gezählt wird nur, was tatsächlich ausgewertet wird —
 * dieselbe Regel wie bei den Datumsfeldern je Verfahrensschritt (v4.92).
 *
 * Ohne Messlauf gibt es KEINE Befunde (leere Liste), nicht „alle wirkungslos".
 */
export function wirkungsloseRegeln(
  alle: readonly TodoRegel[],
  wirkung: ReadonlyMap<string, RegelWirkung> | null,
  satz: Rolle,
): WirkungsBefund[] {
  if (wirkung === null) return [];
  const befunde: WirkungsBefund[] = [];
  for (const r of sichtbareRegeln(alle, satz)) {
    if (!r.aktiv) continue;
    const w = wirkung.get(r.id);
    if (w === undefined) continue;
    const { istSperre } = zustandsMarker(r, satz, []);
    if (istSperre) {
      if (w.greift === 0) befunde.push({ regel: r, grund: 'greift nie' });
    } else if (w.trifftZu === 0) {
      befunde.push({ regel: r, grund: 'trifft nie' });
    } else if (w.gewinnt === 0) {
      befunde.push({ regel: r, grund: 'immer verdeckt' });
    }
  }
  return befunde;
}

/**
 * Die Bilanzzeile über der Kaskade: **die wirkungslosen Regeln namentlich**.
 *
 * Sie zu zählen genügte nicht — „2 Regeln ohne Wirkung" schickt jemanden durch
 * dreißig Zeilen. Der Name steht deshalb da, wie bei den Schritten ohne Datum.
 * Und wenn nichts fehlt, sagt die Zeile das ausdrücklich: Schweigen läse sich
 * als „noch nicht geprüft".
 */
export function wirkungsBilanzText(
  alle: readonly TodoRegel[],
  wirkung: ReadonlyMap<string, RegelWirkung> | null,
  satz: Rolle,
): string | null {
  if (wirkung === null) return null;
  // Ein Satz ohne eigene aktive Regel bekommt kein Gütesiegel. „jede ausgewertete
  // Regel wirkt" stand am Bild über einem FB-Satz, der keine einzige Regel führt
  // — wahr im Wortsinn (es gab nichts, was nicht wirkte) und deshalb umso
  // irreführender.
  const eigeneAktiv = sichtbareRegeln(alle, satz)
    .filter(r => r.aktiv && (r.sperrt?.length ?? 0) === 0 && regelsatzVon(r) === satz).length;
  if (eigeneAktiv === 0) return 'dieser Regelsatz führt keine eigene aktive Regel';
  const befunde = wirkungsloseRegeln(alle, wirkung, satz);
  if (befunde.length === 0) return 'jede ausgewertete Regel wirkt';
  const liste = befunde.map(b => `${regelKurzname(b.regel)} (${b.grund})`).join(' · ');
  return `${befunde.length === 1 ? 'eine Regel bleibt' : `${befunde.length} Regeln bleiben`} `
    + `ohne Wirkung: ${liste}`;
}

/** Was die Auslieferung anders sagt als die gepflegte Kaskade. */
export interface DriftZahlen {
  neu: readonly string[];
  geaendert: readonly string[];
  entfallen: readonly string[];
}

/**
 * Der Drift-Satz in Worten — `null`, wenn nichts driftet.
 *
 * Steht hier und nicht in der Komponente, weil die Grammatik genau das gebraucht
 * hat: die erste Fassung schrieb bei einer einzigen Regel „1 neue Regeln (r7)".
 */
export function driftSatz(d: DriftZahlen): string | null {
  const teile = [
    d.neu.length > 0 ? `${zaehlwort(d.neu.length, 'neue Regel', 'neue Regeln')} (${d.neu.join(', ')})` : null,
    d.geaendert.length > 0 ? `${zaehlwort(d.geaendert.length, 'Regel geändert', 'Regeln geändert')} (${d.geaendert.join(', ')})` : null,
    d.entfallen.length > 0 ? `${zaehlwort(d.entfallen.length, 'Regel entfallen', 'Regeln entfallen')} (${d.entfallen.join(', ')})` : null,
  ].filter((x): x is string => x !== null);
  return teile.length === 0 ? null : teile.join(' · ');
}

/**
 * Woraus der ausgelieferte Regelsatz besteht — **gezählt**, nicht abgeschrieben.
 *
 * Bis v4.120 stand „26 Regeln + 4 Sperren" als Zahlenpaar im Leerzustands-Text.
 * Es stimmte, aber es wäre beim ersten Nachtrag zur Mappe still falsch geworden,
 * und ausgerechnet dieser Satz steht vor einem Knopf, der genau diese Regeln
 * anlegt.
 */
export function seedBilanz(seed: readonly TodoRegel[]): string {
  const sperren = seed.filter(r => (r.sperrt?.length ?? 0) > 0).length;
  return `${zaehlwort(seed.length - sperren, 'Regel', 'Regeln')} + ${zaehlwort(sperren, 'Sperre', 'Sperren')}`;
}
