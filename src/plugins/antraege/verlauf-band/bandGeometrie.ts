/**
 * Die Geometrie des **VerlaufsBands** — eine Zeitachse für alle Spuren.
 *
 * **Das Problem, das diese Datei löst.** Die Bahn will zwei Dinge gleichzeitig:
 * Segmentbreite = Verweildauer (sonst ist sie ein Ablaufdiagramm, kein Verlauf)
 * und eine gemeinsame Achse über Verbund und alle Teilvorhaben (sonst lässt sich
 * nichts vergleichen). Beides gegeneinander bricht an den Rändern: ein Wechsel,
 * der am Folgetag kam, wäre 0,2 px breit, und ein Abschnitt über sieben Jahre
 * frisst die restliche Achse.
 *
 * **Die Lösung ist eine stückweise gestauchte Achse, die für ALLE gilt.** Aus
 * den Segmentgrenzen sämtlicher Spuren entsteht eine Kantenliste; jedes
 * Intervall dazwischen bekommt seine Breite proportional zur Dauer, aber
 * mindestens den Boden aus {@link bodenFuer} — der mit der Bahn wächst, damit
 * gedrängte Abschnitte wieder ihren Namen tragen. Weil dieselbe Kantenliste
 * jede Spur abbildet, sitzt derselbe Tag überall an derselben x-Position — die
 * Vergleichbarkeit bleibt, obwohl die Achse nicht mehr linear ist.
 *
 * **Warum die Stauchung markiert wird.** Eine nicht-lineare Achse, die so tut
 * als wäre sie linear, lügt über Verhältnisse. Stark gestauchte Intervalle
 * tragen deshalb ein Bruchzeichen und ihre Dauer als Text — der Leser sieht,
 * wo die Achse gerissen ist.
 *
 * Rein und node-testbar: keine DOM-Messung, keine Uhr. Die Container-Breite
 * kommt von außen.
 */
import type { VerlaufsSegment, VerlaufsSpur } from '@/core/status/verlauf';
import { MS_TAG } from '@/core/utils/zeitEinheiten';

/** Kleinste Breite eines Achsen-Intervalls in px. Darunter ist nichts mehr klickbar. */
export const MIN_INTERVALL = 24;

/** Obergrenze des Bodens — darüber frisst er die Proportion, die die Bahn zeigt. */
const MAX_BODEN = 56;

/**
 * Der Boden **wächst mit der Bahn**: jedes Intervall bekommt mindestens einen
 * Anteil der verfügbaren Breite, gedeckelt nach beiden Seiten.
 *
 * Bis v3.37 stand hier die feste {@link MIN_INTERVALL} — eine Zahl aus der Zeit,
 * als die Bahn 620 px breit war. Sie klebte auch bei 1000 px, und die Folge war
 * im Bestand zu sehen: sechs Abschnitte drängten sich auf ~130 px, während ein
 * einziger ~700 px bekam. Wer nur den Boden anhebt, macht die Achse ungenauer;
 * wer ihn kleben lässt, schickt den Leser für die halbe Bahn in die Legende.
 * Der Anteil trifft die Mitte: bei sechs Grenzen auf 1000 px sind es 56 px (eine
 * Kurzform passt), bei 26 Grenzen fällt er auf 24 zurück — dort passt ohnehin
 * nichts, und ein hoher Boden schöbe die Bahn nur in den Scroll.
 */
export function bodenFuer(n: number, breite: number): number {
  if (n <= 0) return MIN_INTERVALL;
  return Math.min(MAX_BODEN, Math.max(MIN_INTERVALL, Math.floor(breite / (n * 2))));
}

/**
 * Ab welchem Anteil seiner proportionalen Breite ein Intervall als „gestaucht"
 * gilt. Ein Achtel: darunter ist der Zeitmaßstab so verzerrt, dass die Länge
 * nichts mehr aussagt.
 */
const STAUCH_SCHWELLE = 0.125;


function tagMs(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getTime();
}

/** Ein Segment, fertig platziert. */
export interface BandSegment {
  segment: VerlaufsSegment;
  /** px vom linken Rand der Bahn. */
  links: number;
  breite: number;
  /** Anfang unbekannt — die linke Kante wird angeschnitten gezeichnet. */
  offenLinks: boolean;
  /** Ende offen (Abweichung) — rechte Kante angeschnitten. */
  offenRechts: boolean;
  /** Der Zeitmaßstab ist hier stark gestaucht; braucht Bruchzeichen + Dauertext. */
  gestaucht: boolean;
}

/** Eine Bahn, fertig platziert — samt der Spuren, die mit ihr zusammenfallen. */
export interface BandSpur {
  spur: VerlaufsSpur;
  segmente: BandSegment[];
  /**
   * Weitere Spuren mit **identischem** Verlauf, die diese hier mit vertritt.
   * Leer, solange nicht gebündelt wird.
   */
  gleiche: VerlaufsSpur[];
}

/** Eine Beschriftung an der Achse (Jahres- bzw. Monatswechsel). */
export interface AchsenMarke {
  x: number;
  label: string;
}

/**
 * Die x-Skala der Achse, nach außen gereicht.
 *
 * **Wozu.** Die Bahn ist nicht die einzige Schicht auf dieser Achse — die
 * Meilenstein-Ebene setzt Punkte und Verzugsbalken auf DIESELBE Zeit. Sie darf
 * die Zeit dafür nicht ein zweites Mal auf Pixel abbilden: die Achse ist
 * stückweise gestaucht, und eine nachgebaute lineare Abbildung setzte den
 * 17.09.2025 an eine andere Stelle als der Balken, der dort endet.
 *
 * Absichtlich schmaler als die interne Achse: Stauchung und Gesamtbreite gehen
 * niemanden von außen etwas an, die Position schon.
 */
export interface ZeitAchse {
  readonly kanten: readonly number[];
  readonly x: readonly number[];
}

export interface BandGeometrieOptionen {
  /**
   * Welche Bahnen gezeichnet werden — Schlüssel `art-id` (`verbund-ZKN…`,
   * `tv-16KN…`). Fehlt die Menge, sind es alle.
   *
   * **Die Achse entsteht unabhängig davon**, über sämtliche Spuren: der Filter
   * sagt, was zu sehen ist, nicht, was gilt.
   */
  nurBahnen?: ReadonlySet<string>;
}

export interface BandGeometrie {
  /** Gesamtbreite der Bahn in px — kann die Containerbreite übersteigen (Scroll). */
  breite: number;
  spuren: BandSpur[];
  marken: AchsenMarke[];
  /** Frühester belegter Tag; `null`, wenn keine Spur eine Grenze trägt. */
  von: string | null;
  /** Rechtes Ende der Achse — der Bezugszeitpunkt. */
  bis: string;
  /** Die x-Skala für weitere Schichten auf derselben Achse. */
  achse: ZeitAchse;
}

// --- Die Achse ------------------------------------------------------------

/**
 * Verteilt die Breite auf die Intervalle: proportional zur Dauer, aber jedes
 * mindestens `boden` (siehe {@link bodenFuer}).
 *
 * Der Überschuss wird den Intervallen abgezogen, die über dem Mindestmaß
 * liegen — **anteilig an ihrem Überhang**, nicht an ihrer Gesamtbreite. Zöge man
 * anteilig an der Gesamtbreite ab, rutschten knapp über dem Mindestmaß liegende
 * Intervalle darunter und die nächste Runde müsste sie wieder anheben. Wenige
 * Durchläufe genügen; danach bleibt ein Rest, den die Gesamtbreite aufnimmt.
 */
function verteile(dauern: readonly number[], breite: number, boden: number): number[] {
  const n = dauern.length;
  if (n === 0) return [];
  const gesamt = dauern.reduce((s, d) => s + d, 0);
  if (gesamt <= 0) return dauern.map(() => breite / n);

  const px = dauern.map(d => (d / gesamt) * breite);
  for (let runde = 0; runde < 4; runde++) {
    const fehlend = px.reduce((s, w) => s + Math.max(0, boden - w), 0);
    if (fehlend <= 0.01) break;
    const ueberhang = px.reduce((s, w) => s + Math.max(0, w - boden), 0);
    if (ueberhang <= 0) break;
    const faktor = Math.min(1, fehlend / ueberhang);
    for (let i = 0; i < n; i++) {
      const w = px[i]!;
      px[i] = w < boden ? boden : w - (w - boden) * faktor;
    }
  }
  return px.map(w => Math.max(boden, w));
}

/** Die Achse: Kanten in ms, ihre x-Positionen und die Stauchung je Intervall. */
interface Achse {
  kanten: number[];
  x: number[];
  gestaucht: boolean[];
  breite: number;
}

function baueAchse(grenzen: readonly number[], vorgabeBreite: number): Achse {
  let kanten = [...new Set(grenzen)].sort((a, b) => a - b);
  if (kanten.length < 2) {
    // Keine einzige datierte Grenze — der Vorgang trägt einen Status, aber
    // nichts sagt, seit wann. Die Achse bekommt trotzdem eine Ausdehnung:
    // sonst fiele das Segment auf einen 1-px-Strich zusammen, und ein Strich
    // ist die schlechteste aller Aussagen. Über die volle Breite mit zwei
    // angeschnittenen Kanten sagt die Bahn, was stimmt — Status bekannt,
    // Zeitraum nicht.
    const bis = kanten[0] ?? 0;
    kanten = [bis - MS_TAG, bis];
  }
  const dauern = kanten.slice(1).map((k, i) => Math.max(1, k - kanten[i]!));
  // Der Boden folgt der VERFÜGBAREN Breite, nicht der am Ende gescrollten:
  // sonst hübe er sich selbst hoch (breitere Bahn → höherer Boden → breitere
  // Bahn). Ein Ringschluss, den `vorgabeBreite` als feste Bezugsgröße bricht.
  const boden = bodenFuer(dauern.length, vorgabeBreite);
  // Die Bahn darf breiter werden als ihr Container: lieber scrollen als
  // Abschnitte unter die Klickgrenze drücken.
  const breite = Math.max(vorgabeBreite, dauern.length * boden);
  const px = verteile(dauern, breite, boden);

  const gesamt = dauern.reduce((s, d) => s + d, 0);
  const gestaucht = dauern.map((d, i) => {
    const proportional = (d / gesamt) * breite;
    // Gemessen wird gegen den GELTENDEN Boden: ein höherer Boden nimmt den
    // langen Intervallen mehr weg, die Achse ist also stärker gerissen — genau
    // das soll das Bruchzeichen sagen.
    return proportional > boden && px[i]! / proportional < STAUCH_SCHWELLE;
  });

  const x = [0];
  for (const w of px) x.push(x[x.length - 1]! + w);
  return { kanten, x, gestaucht, breite: x[x.length - 1]! };
}

/** Stückweise lineare Abbildung Zeit → px. Außerhalb wird geklemmt. */
function xOf(achse: ZeitAchse, ms: number): number {
  const { kanten, x } = achse;
  if (kanten.length === 0) return 0;
  if (ms <= kanten[0]!) return 0;
  if (ms >= kanten[kanten.length - 1]!) return x[x.length - 1]!;
  let i = 0;
  while (i < kanten.length - 1 && kanten[i + 1]! <= ms) i++;
  const von = kanten[i]!;
  const bis = kanten[i + 1]!;
  const anteil = bis > von ? (ms - von) / (bis - von) : 0;
  return x[i]! + (x[i + 1]! - x[i]!) * anteil;
}

/**
 * px-Position eines ISO-Tags auf der Achse — der öffentliche Mantel um `xOf`,
 * damit weitere Schichten dieselbe Rechnung nutzen statt einer zweiten.
 * Außerhalb des Fensters wird geklemmt; wer das nicht will, fragt vorher
 * {@link imFenster}.
 */
export function xFuerTag(achse: ZeitAchse, isoTag: string): number {
  return xOf(achse, tagMs(isoTag.slice(0, 10)));
}

/**
 * Liegt der Tag im Achsenfenster?
 *
 * Ohne diese Frage rutschte ein Datum vor dem Achsenanfang stillschweigend auf
 * x = 0 und behauptete dort einen Termin, den es nicht gibt. Wer klemmt, muss
 * wissen, dass er klemmt.
 */
export function imFenster(achse: ZeitAchse, isoTag: string): boolean {
  const { kanten } = achse;
  if (kanten.length === 0) return false;
  const ms = tagMs(isoTag.slice(0, 10));
  if (Number.isNaN(ms)) return false;
  return ms >= kanten[0]! && ms <= kanten[kanten.length - 1]!;
}

/** Trägt das Segment über ein Intervall, das stark gestaucht ist? */
function ueberGestauchtem(achse: Achse, vonMs: number, bisMs: number): boolean {
  for (let i = 0; i < achse.gestaucht.length; i++) {
    if (!achse.gestaucht[i]) continue;
    if (achse.kanten[i]! < bisMs && achse.kanten[i + 1]! > vonMs) return true;
  }
  return false;
}

// --- Bündelung ------------------------------------------------------------

/** Ab wie vielen Teilvorhaben identische Spuren zusammengefasst werden. */
export const BUENDEL_AB = 6;

/** Der Verlauf einer Spur als Zeichenkette — Grundlage der Bündelung. */
export function spurSignatur(spur: VerlaufsSpur): string {
  return `${spur.zustand}|` + spur.segmente
    .map(s => `${s.statusRef?.code ?? s.statusRef?.roh ?? '-'}@${s.vonDatum ?? '?'}`)
    .join('>');
}

/**
 * Fasst Teilvorhaben-Spuren mit identischem Verlauf zusammen.
 *
 * Erst ab {@link BUENDEL_AB} Teilvorhaben: darunter ist die Liste kurz genug,
 * dass Bündeln mehr verbirgt als es ordnet. Die Verbundspur wird **nie**
 * gebündelt — sie ist die Bezugsgröße und muss immer einzeln dastehen.
 */
export function buendle(spuren: readonly VerlaufsSpur[]): BandSpur[] {
  const tv = spuren.filter(s => s.art === 'tv');
  const rest = spuren.filter(s => s.art !== 'tv');
  const roh = (s: VerlaufsSpur): BandSpur => ({ spur: s, segmente: [], gleiche: [] });
  if (tv.length < BUENDEL_AB) return [...rest, ...tv].map(roh);

  const gruppen = new Map<string, VerlaufsSpur[]>();
  for (const s of tv) {
    const k = spurSignatur(s);
    const g = gruppen.get(k);
    if (g) g.push(s); else gruppen.set(k, [s]);
  }
  const gebuendelt = [...gruppen.values()].map(g => ({
    spur: g[0]!, segmente: [], gleiche: g.slice(1),
  }));
  return [...rest.map(roh), ...gebuendelt];
}

// --- Achsenbeschriftung ---------------------------------------------------

const MONATS_KURZ = [
  'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez',
];

/**
 * Die Achsenbeschriftung — Jahreswechsel, und wo keiner in den Ausschnitt
 * fällt, Monatswechsel.
 *
 * Bis v4.122 gab es nur Jahresmarken. Reichte die Achse nicht über einen
 * 1. Januar — bei angehaltener Uhr der Regelfall, weil sie am Haltedatum endet,
 * und ebenso bei jungen Vorgängen —, blieb der reservierte Streifen über der
 * Bahn leer und das Gitter zeichnete keine Linie: die Bahn setzte Bruchzeichen
 * für gestauchte Intervalle, aber es gab keinen Zeitanker, um zu lesen WO.
 */
function achsenMarken(achse: Achse): AchsenMarke[] {
  if (achse.kanten.length < 2) return [];
  const vonMs = achse.kanten[0]!;
  const bisMs = achse.kanten[achse.kanten.length - 1]!;
  const von = new Date(vonMs);
  const bis = new Date(bisMs);

  const marken: AchsenMarke[] = [];
  for (let j = von.getUTCFullYear(); j <= bis.getUTCFullYear(); j++) {
    const ms = Date.UTC(j, 0, 1);
    if (ms < vonMs || ms > bisMs) continue;
    marken.push({ x: xOf(achse, ms), label: String(j) });
  }
  if (marken.length > 0) return marken;

  // Kein Jahreswechsel im Ausschnitt → Monatswechsel. Der erste trägt die
  // Jahreszahl mit, damit die Achse nicht ohne Jahr dasteht.
  let jahr = von.getUTCFullYear();
  let monat = von.getUTCMonth();
  for (let i = 0; i < 24; i++) {
    monat += 1;
    if (monat > 11) { monat = 0; jahr += 1; }
    const ms = Date.UTC(jahr, monat, 1);
    if (ms > bisMs) break;
    if (ms < vonMs) continue;
    marken.push({
      x: xOf(achse, ms),
      label: marken.length === 0 ? `${MONATS_KURZ[monat]} ${jahr}` : MONATS_KURZ[monat]!,
    });
  }
  return marken;
}

// --- Der Zusammenbau ------------------------------------------------------

export function baueBandGeometrie(
  spuren: readonly VerlaufsSpur[], bezugsZeitpunkt: string, vorgabeBreite: number,
  opt: BandGeometrieOptionen = {},
): BandGeometrie {
  const grenzen: number[] = [tagMs(bezugsZeitpunkt)];
  let frueheste: string | null = null;
  let fruehesterTermin: string | null = null;
  for (const s of spuren) {
    for (const seg of s.segmente) {
      if (seg.vonDatum !== null) {
        grenzen.push(tagMs(seg.vonDatum));
        if (frueheste === null || seg.vonDatum < frueheste) frueheste = seg.vonDatum;
      }
      if (seg.bisDatum !== null) grenzen.push(tagMs(seg.bisDatum));
    }
    for (const u of s.uebergaenge) {
      if (fruehesterTermin === null || u.datum < fruehesterTermin) fruehesterTermin = u.datum;
    }
  }
  // GENAU EINE zusätzliche Kante, und nur links: ein Termin vor dem ersten
  // Statuswechsel (`FOY` vor `AAE`) fiele sonst auf x = 0 und behauptete dort ein
  // Datum. Jeden Termin zur Kante zu machen verböte sich — `bodenFuer` gibt jedem
  // Intervall ein Mindestmaß, und neunzig weitere Kanten blähten die Bahn auf
  // über 2000 px Scrollbreite. Rechts wird NICHT erweitert: die Achse endet am
  // Bezugszeitpunkt, und ein Termin dahinter braucht eine `heute`-Linie, keine
  // längere Achse.
  if (fruehesterTermin !== null) {
    const ms = tagMs(fruehesterTermin);
    if (ms < Math.min(...grenzen)) grenzen.push(ms);
  }

  const achse = baueAchse(grenzen, vorgabeBreite);
  const links = achse.kanten[0] ?? 0;
  const rechts = achse.kanten[achse.kanten.length - 1] ?? 0;

  // Die Achse steht über ALLEN Spuren, gebündelt und gezeichnet wird nur die
  // Auswahl: „nur TV 3" darf den Maßstab nicht ändern, sonst zeigte dieselbe
  // Bahn zwei verschiedene Bilder und der geteilte Fokus wäre wertlos. Und der
  // Schnitt sitzt VOR `buendle`, sonst verträte eine Bündel-Bahn Teilvorhaben,
  // die gerade abgewählt sind.
  const sichtbar = opt.nurBahnen === undefined
    ? spuren
    : spuren.filter(s => opt.nurBahnen?.has(`${s.art}-${s.id}`) === true);
  const gebuendelt = buendle(sichtbar);
  for (const b of gebuendelt) {
    b.segmente = b.spur.segmente.map((seg, i, alle) => {
      // Eine fehlende Grenze bekommt KEINE Ersatzbreite: das Segment läuft bis
      // zum Achsenrand und wird dort angeschnitten gezeichnet. Eine erfundene
      // Breite wäre eine Aussage über eine Dauer, die niemand kennt.
      //
      // **Aber nur das ERSTE Segment darf bis zum Achsenanfang laufen** (v4.124).
      // `baueSegmente` hängt im Abweichungsfall (Ableitung endet nicht beim
      // importierten Status — gemessen 2 903 Segmente im C16-Stand) ein zweites
      // Segment ohne `vonDatum` ganz ans ENDE. Das bekam `links` und die volle
      // Bahnbreite und legte sich als deckende Fläche über den gesamten Verlauf:
      // alle früheren Abschnitte samt Innen-Beschriftung verdeckt, und der
      // Kasten fing über die volle Breite den Zeiger ab, sodass jeder Tooltip
      // den letzten Status meldete. Ein späteres Segment ohne Anfang beginnt
      // deshalb dort, wo sein Vorgänger endet.
      const vorgaenger = i > 0 ? alle[i - 1] : null;
      const anfangsRueckfall = vorgaenger?.bisDatum != null
        ? tagMs(vorgaenger.bisDatum)
        : vorgaenger?.vonDatum != null
          ? tagMs(vorgaenger.vonDatum)
          : links;
      const vonMs = seg.vonDatum !== null ? tagMs(seg.vonDatum) : anfangsRueckfall;
      const bisMs = seg.bisDatum !== null ? tagMs(seg.bisDatum) : rechts;
      const x1 = xOf(achse, vonMs);
      const x2 = xOf(achse, bisMs);
      return {
        segment: seg,
        links: x1,
        breite: Math.max(1, x2 - x1),
        // „Anfang unbekannt" nur, wo er es wirklich ist: beim ersten Segment.
        // Ein angehängtes Schluss-Segment kennt seinen Anfang über den Vorgänger.
        offenLinks: seg.vonDatum === null && i === 0,
        offenRechts: seg.bisDatum === null,
        gestaucht: ueberGestauchtem(achse, vonMs, bisMs),
      };
    });
  }

  return {
    breite: achse.breite,
    spuren: gebuendelt,
    marken: achsenMarken(achse),
    von: frueheste,
    bis: bezugsZeitpunkt,
    achse: { kanten: achse.kanten, x: achse.x },
  };
}

/** Menschenlesbare Dauer für Beschriftung und Tooltip. */
export function dauerText(tage: number | null): string {
  if (tage === null) return 'Dauer unbekannt';
  if (tage < 31) return `${tage} T`;
  if (tage < 365) return `${Math.round(tage / 30.4)} Mon`;
  const jahre = tage / 365.25;
  return jahre < 10 ? `${jahre.toFixed(1)} J` : `${Math.round(jahre)} J`;
}

/** Tage zwischen zwei ISO-Tagen; `null`, wenn eine Grenze fehlt. */
export function tageZwischen(von: string | null, bis: string | null): number | null {
  if (von === null || bis === null) return null;
  return Math.round((tagMs(bis) - tagMs(von)) / MS_TAG);
}
