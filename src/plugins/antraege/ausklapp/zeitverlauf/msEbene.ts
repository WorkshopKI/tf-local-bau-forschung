/**
 * Die **Meilenstein-Ebene** auf der Achse des Verlaufsbands — rein, ohne React.
 *
 * Zwei Formen, zwei Aussagen: eine erreichte Stufe ist ein Punkt an ihrem
 * Ist-Datum, eine gerissene ein schraffierter Balken vom Soll-Termin bis zum
 * Achsenende, beschriftet mit Nummer und Verzugstagen. Ein Punkt sagt „am
 * Tag X passiert", ein Balken „seit Tag X offen" — dieselbe Farbe für beides
 * wäre eine Form für zwei verschiedene Sätze.
 *
 * **Die x-Skala kommt vom Band, nicht von hier.** Die Achse ist stückweise
 * gestaucht; eine eigene Abbildung setzte den 17.09. neben den Balken, der dort
 * endet. Deshalb `xFuerTag` aus [bandGeometrie](../../verlauf-band/bandGeometrie.ts).
 *
 * **Was nicht ins Fenster passt, wird gezählt statt geklemmt.** Ein Datum vor
 * dem Achsenanfang säße sonst auf x = 0 und behauptete dort einen Termin.
 *
 * **Nur Blätter.** Die Sammel-Stufen darüber stehen in der Kopfkarte; auf der
 * Achse verdoppelten sie jeden Balken ihres spätesten Kindes.
 */
import { formatDatum } from '@/plugins/meilensteine/labels';
import { tageZwischen } from '@/core/status/waechter';
import { imFenster, xFuerTag, type ZeitAchse } from '../../verlauf-band/bandGeometrie';
import type { Stufe } from '../meilensteinLage';

/** Höhe einer Marken-Bahn in px. */
export const MS_BAHN_H = 13;
/** Mindestabstand zweier Marken derselben Bahn in px. */
export const MS_ABSTAND = 6;
/**
 * Platz rechts neben einem Verzugsbalken, wenn nicht gemessen wird.
 *
 * Der Entwurf nennt 60 px — das reicht für seine Beispieldaten und für
 * „3 · 299 T", nicht aber für „1.4.3 · 327 T" (71 px in Mono). Wer messen kann,
 * misst: die Reserve entscheidet über die Bahnbelegung UND über die Breite, in
 * die der Scroll-Container das Label noch hineinlässt.
 */
export const MS_LABEL_RESERVE = 60;
/** Abstand zwischen Balkenende und seinem Label. */
export const MS_LABEL_ABSTAND = 6;
/** Durchmesser des Punktes einer erreichten Stufe. */
export const MS_PUNKT = 9;
/** Höhe eines Verzugsbalkens. */
export const MS_BALKEN_H = 9;

export type MsArt = 'erreicht' | 'gerissen';

export interface MsMarke {
  knotenId: string;
  nummer: string;
  label: string;
  art: MsArt;
  /** px vom linken Rand der Bahn. */
  links: number;
  breite: number;
  /** Beschriftung rechts vom Balken; `null` beim Punkt. */
  text: string | null;
  titel: string;
  /** Bahn-Index von oben. */
  bahn: number;
}

export interface MsEbeneModell {
  marken: MsMarke[];
  bahnen: number;
  /** Gesamthöhe der Ebene in px. */
  hoehe: number;
  /** Marken, deren Datum außerhalb der Achse liegt — nicht gezeichnet. */
  ausserhalb: number;
  /**
   * Erreichte Stufen ohne Ist-Datum — nicht zeichenbar, weil die erfüllende
   * Spalte kein Datum trägt (`status ist …`, `tib_kuerz gefüllt`).
   *
   * Bis v4.122 fielen sie still heraus: die Bahn zeigte weniger erreichte
   * Stufen, als die Gliederung darunter auflistet, ohne einen Satz dazu. Die
   * Gliederung kennt den Fall längst und erklärt ihn im Tooltip („erreicht; die
   * erfüllende Spalte trägt kein Datum") — hier fehlte er.
   */
  ohneIstDatum: number;
  /** Warum die Ebene etwas anders zeigt, als die Zahlen daneben sagen. */
  hinweis: string | null;
}

interface Kandidat {
  links: number;
  breite: number;
  reserve: number;
}

/**
 * First fit: jede Marke in die erste Bahn, deren bisheriges rechtes Ende samt
 * Abstand links von ihr liegt; sonst eine neue Bahn.
 *
 * Die Eingabe darf unsortiert sein — intern wird nach `links` durchlaufen und
 * das Ergebnis auf den **Eingabe-Index** zurückgeschrieben. Wer das vergisst,
 * verteilt die Bahnen an die falschen Marken, und der Fehler fällt erst auf,
 * wenn zwei Marken einander überlagern.
 */
export function packeBahnen(eintraege: readonly Kandidat[], abstand: number): number[] {
  const reihenfolge = eintraege
    .map((e, i) => ({ e, i }))
    .sort((a, b) => a.e.links - b.e.links || a.i - b.i);
  const enden: number[] = [];
  const out = new Array<number>(eintraege.length).fill(0);
  for (const { e, i } of reihenfolge) {
    let bahn = enden.findIndex(ende => ende + abstand <= e.links);
    if (bahn < 0) {
      bahn = enden.length;
      enden.push(0);
    }
    enden[bahn] = e.links + e.breite + e.reserve;
    out[i] = bahn;
  }
  return out;
}

export interface MsEbeneEingabe {
  stufen: readonly Stufe[];
  achse: ZeitAchse;
  /** Rechtes Ende der Achse (ISO-Tag) — dort enden die Verzugsbalken. */
  bis: string;
  /** ISO-Tag, gegen den die Verzugstage gezählt werden. */
  stichtag: string;
  /** Breite eines Labels in px. Ohne Messung gilt {@link MS_LABEL_RESERVE}. */
  messeText?: (t: string) => number;
}

function verzugsText(nummer: string, tage: number | null): string {
  return tage === null ? nummer : `${nummer} · ${tage} T`;
}

/**
 * Die Beschriftungen der Verzugsbalken — **ohne Achse**, nur aus Stufen und
 * Stichtag.
 *
 * Damit kann der Aufrufer die rechte Reserve messen, bevor die Geometrie
 * gerechnet ist: die Reserve geht in die Bahnbreite ein, die Bahnbreite in die
 * Achse — mit der Achse als Eingabe wäre es ein Ringschluss.
 */
export function verzugsTexte(stufen: readonly Stufe[], stichtag: string): string[] {
  return stufen
    .filter(s => s.blatt && s.zustand === 'gerissen' && s.ergebnis.sollDatum !== null)
    .map(s => verzugsText(s.knoten.nummer, tageZwischen(s.ergebnis.sollDatum!, stichtag)));
}

export function baueMsEbene(e: MsEbeneEingabe): MsEbeneModell {
  const rohe: (Omit<MsMarke, 'bahn'> & { kandidat: Kandidat })[] = [];
  let ausserhalb = 0;
  let ohneIstDatum = 0;
  const bisX = xFuerTag(e.achse, e.bis);

  for (const s of e.stufen) {
    if (!s.blatt) continue;
    const nummer = s.knoten.nummer;
    if (s.zustand === 'erreicht') {
      const ist = s.ergebnis.istDatum;
      // Erreicht, aber die erfüllende Spalte trägt kein Datum — zählen statt
      // still weglassen (siehe `MsEbeneModell.ohneIstDatum`).
      if (ist === null) { ohneIstDatum++; continue; }
      if (!imFenster(e.achse, ist)) { ausserhalb++; continue; }
      const x = xFuerTag(e.achse, ist);
      const links = x - MS_PUNKT / 2;
      rohe.push({
        knotenId: s.knoten.id, nummer, label: s.knoten.label, art: 'erreicht',
        links, breite: MS_PUNKT, text: null,
        titel: `${nummer} ${s.knoten.label} — erreicht ${formatDatum(ist)}`,
        kandidat: { links, breite: MS_PUNKT, reserve: 0 },
      });
      continue;
    }
    if (s.zustand !== 'gerissen') continue;
    const soll = s.ergebnis.sollDatum;
    if (soll === null) continue;
    if (!imFenster(e.achse, soll)) { ausserhalb++; continue; }
    const links = xFuerTag(e.achse, soll);
    const breite = Math.max(2, bisX - links);
    const tage = tageZwischen(soll, e.stichtag);
    const text = verzugsText(nummer, tage);
    const reserve = e.messeText === undefined
      ? MS_LABEL_RESERVE
      : Math.ceil(e.messeText(text)) + MS_LABEL_ABSTAND;
    rohe.push({
      knotenId: s.knoten.id, nummer, label: s.knoten.label, art: 'gerissen',
      links, breite, text,
      titel: `${nummer} ${s.knoten.label} — Soll ${formatDatum(soll)}, seither offen`,
      kandidat: { links, breite, reserve },
    });
  }

  const bahnen = packeBahnen(rohe.map(r => r.kandidat), MS_ABSTAND);
  const marken = rohe.map(({ kandidat: _kandidat, ...rest }, i) => ({ ...rest, bahn: bahnen[i]! }));
  const anzahl = Math.max(1, marken.length === 0 ? 0 : Math.max(...bahnen) + 1);

  return {
    marken,
    bahnen: anzahl,
    hoehe: marken.length === 0 ? 0 : anzahl * MS_BAHN_H + 2,
    ausserhalb,
    ohneIstDatum,
    hinweis: e.bis.slice(0, 10) === e.stichtag.slice(0, 10)
      ? null
      : `Die Achse endet am ${formatDatum(e.bis)} (angehaltene Uhr); die Verzugstage zählen bis ${formatDatum(e.stichtag)}.`,
  };
}
