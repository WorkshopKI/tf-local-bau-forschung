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
 * mindestens {@link MIN_INTERVALL}. Weil dieselbe Kantenliste jede Spur
 * abbildet, sitzt derselbe Tag überall an derselben x-Position — die
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

/** Kleinste Breite eines Achsen-Intervalls in px. Darunter ist nichts mehr klickbar. */
export const MIN_INTERVALL = 24;

/**
 * Ab welchem Anteil seiner proportionalen Breite ein Intervall als „gestaucht"
 * gilt. Ein Achtel: darunter ist der Zeitmaßstab so verzerrt, dass die Länge
 * nichts mehr aussagt.
 */
const STAUCH_SCHWELLE = 0.125;

const MS_TAG = 86_400_000;

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

export interface BandGeometrie {
  /** Gesamtbreite der Bahn in px — kann die Containerbreite übersteigen (Scroll). */
  breite: number;
  spuren: BandSpur[];
  marken: AchsenMarke[];
  /** Frühester belegter Tag; `null`, wenn keine Spur eine Grenze trägt. */
  von: string | null;
  /** Rechtes Ende der Achse — der Bezugszeitpunkt. */
  bis: string;
}

// --- Die Achse ------------------------------------------------------------

/**
 * Verteilt die Breite auf die Intervalle: proportional zur Dauer, aber jedes
 * mindestens {@link MIN_INTERVALL}.
 *
 * Der Überschuss wird den Intervallen abgezogen, die über dem Mindestmaß
 * liegen — **anteilig an ihrem Überhang**, nicht an ihrer Gesamtbreite. Zöge man
 * anteilig an der Gesamtbreite ab, rutschten knapp über dem Mindestmaß liegende
 * Intervalle darunter und die nächste Runde müsste sie wieder anheben. Wenige
 * Durchläufe genügen; danach bleibt ein Rest, den die Gesamtbreite aufnimmt.
 */
function verteile(dauern: readonly number[], breite: number): number[] {
  const n = dauern.length;
  if (n === 0) return [];
  const gesamt = dauern.reduce((s, d) => s + d, 0);
  if (gesamt <= 0) return dauern.map(() => breite / n);

  const px = dauern.map(d => (d / gesamt) * breite);
  for (let runde = 0; runde < 4; runde++) {
    const fehlend = px.reduce((s, w) => s + Math.max(0, MIN_INTERVALL - w), 0);
    if (fehlend <= 0.01) break;
    const ueberhang = px.reduce((s, w) => s + Math.max(0, w - MIN_INTERVALL), 0);
    if (ueberhang <= 0) break;
    const faktor = Math.min(1, fehlend / ueberhang);
    for (let i = 0; i < n; i++) {
      const w = px[i]!;
      px[i] = w < MIN_INTERVALL ? MIN_INTERVALL : w - (w - MIN_INTERVALL) * faktor;
    }
  }
  return px.map(w => Math.max(MIN_INTERVALL, w));
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
  // Die Bahn darf breiter werden als ihr Container: lieber scrollen als
  // Abschnitte unter die Klickgrenze drücken (Muster von `StatusTimeline`).
  const breite = Math.max(vorgabeBreite, dauern.length * MIN_INTERVALL);
  const px = verteile(dauern, breite);

  const gesamt = dauern.reduce((s, d) => s + d, 0);
  const gestaucht = dauern.map((d, i) => {
    const proportional = (d / gesamt) * breite;
    return proportional > MIN_INTERVALL && px[i]! / proportional < STAUCH_SCHWELLE;
  });

  const x = [0];
  for (const w of px) x.push(x[x.length - 1]! + w);
  return { kanten, x, gestaucht, breite: x[x.length - 1]! };
}

/** Stückweise lineare Abbildung Zeit → px. Außerhalb wird geklemmt. */
function xOf(achse: Achse, ms: number): number {
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

function jahresMarken(achse: Achse): AchsenMarke[] {
  if (achse.kanten.length < 2) return [];
  const von = new Date(achse.kanten[0]!);
  const bis = new Date(achse.kanten[achse.kanten.length - 1]!);
  const marken: AchsenMarke[] = [];
  for (let j = von.getUTCFullYear(); j <= bis.getUTCFullYear(); j++) {
    const ms = Date.UTC(j, 0, 1);
    if (ms < achse.kanten[0]! || ms > achse.kanten[achse.kanten.length - 1]!) continue;
    marken.push({ x: xOf(achse, ms), label: String(j) });
  }
  return marken;
}

// --- Der Zusammenbau ------------------------------------------------------

export function baueBandGeometrie(
  spuren: readonly VerlaufsSpur[], bezugsZeitpunkt: string, vorgabeBreite: number,
): BandGeometrie {
  const grenzen: number[] = [tagMs(bezugsZeitpunkt)];
  let frueheste: string | null = null;
  for (const s of spuren) {
    for (const seg of s.segmente) {
      if (seg.vonDatum !== null) {
        grenzen.push(tagMs(seg.vonDatum));
        if (frueheste === null || seg.vonDatum < frueheste) frueheste = seg.vonDatum;
      }
      if (seg.bisDatum !== null) grenzen.push(tagMs(seg.bisDatum));
    }
  }

  const achse = baueAchse(grenzen, vorgabeBreite);
  const links = achse.kanten[0] ?? 0;
  const rechts = achse.kanten[achse.kanten.length - 1] ?? 0;

  const gebuendelt = buendle(spuren);
  for (const b of gebuendelt) {
    b.segmente = b.spur.segmente.map(seg => {
      // Eine fehlende Grenze bekommt KEINE Ersatzbreite: das Segment läuft bis
      // zum Achsenrand und wird dort angeschnitten gezeichnet. Eine erfundene
      // Breite wäre eine Aussage über eine Dauer, die niemand kennt.
      const vonMs = seg.vonDatum !== null ? tagMs(seg.vonDatum) : links;
      const bisMs = seg.bisDatum !== null ? tagMs(seg.bisDatum) : rechts;
      const x1 = xOf(achse, vonMs);
      const x2 = xOf(achse, bisMs);
      return {
        segment: seg,
        links: x1,
        breite: Math.max(1, x2 - x1),
        offenLinks: seg.vonDatum === null,
        offenRechts: seg.bisDatum === null,
        gestaucht: ueberGestauchtem(achse, vonMs, bisMs),
      };
    });
  }

  return {
    breite: achse.breite,
    spuren: gebuendelt,
    marken: jahresMarken(achse),
    von: frueheste,
    bis: bezugsZeitpunkt,
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
