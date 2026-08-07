/**
 * **Was an einem Segment des VerlaufsBands steht** — und wo.
 *
 * Schwester von `bandGeometrie.ts`, nicht Teil davon. Die Geometrie beantwortet
 * „wo sitzt ein Tag" und ist im ersten Rahmen fertig; diese Datei beantwortet
 * „was steht dran" und braucht dafür ein Textmaß, das frühestens vorliegt, wenn
 * die Webschriften stehen. Zwei Fragen, zwei Rechnungen, zwei Memo-Signaturen.
 *
 * **Das Problem.** Die Achse gibt jedem Intervall mindestens
 * `MIN_INTERVALL` px — ein Ein-Tages-Abschnitt sitzt auf diesem Boden und bleibt
 * dort, egal wie breit die Bahn wird. Breite allein macht solche Segmente also
 * nie beschriftbar. Wer nur im Balken beschriftet, schickt den Leser für genau
 * die Abschnitte in die Legende, die er nachschlagen will.
 *
 * **Die Lösung ist eine zweite Etage.** Passt der Text nicht IN den Balken,
 * steht er DARUNTER, ab dem linken Rand des Abschnitts. Dort darf er unter den
 * Balken seiner breiten Nachbarn hinweglaufen, ohne etwas zu verdecken — die
 * liegen eine Etage höher. Nur Unter-Beschriftungen untereinander konkurrieren,
 * und die prüfen wir.
 *
 * **Gemessen, nicht geraten.** Die Textbreite kommt als Funktion herein
 * ({@link BeschriftungsOptionen.messeText}); die Datei bleibt rein und
 * node-testbar. `null` heißt „keine Messung möglich" und fällt exakt auf das
 * Schwellen-Verhalten bis v3.31 zurück — nie unter den heutigen Stand.
 *
 * **Keine eigene Kürzung.** `lang` und `kurz` werden genommen, wie `statusRef`
 * sie liefert (Pitfall #50: die Kurzform hat GENAU EINE Quelle). Passt keins von
 * beidem, tritt die Legendennummer an ihre Stelle — nie ein selbst
 * abgeschnittener Text.
 */
import type { BandSpur } from './bandGeometrie';

/** Waagerechtes Polster im Balken (`px-1` links + rechts). */
const POLSTER_BALKEN = 8;
/** Führungsstrich plus Abstand vor einer Unter-Beschriftung. */
const POLSTER_UNTER = 3;
/**
 * Zuschlag gegen die Untertreibung des Messmodells. `measureText` liefert die
 * Glyphenbreite; Rundung und Sub-Pixel-Anstrich kosten im Bestand bis zu ~1 px
 * (im Kopf-Profil der Tabelle nachgemessen). Ohne den Zuschlag liefe ein
 * gerade-so-passender Text über seinen Balken hinaus.
 */
const SICHERHEIT = 2;
/**
 * Platz für das Bruchzeichen `⁄⁄`, das ein gestauchtes Segment mittig im Balken
 * trägt. Ein ganzes Wort liefe hindurch — deshalb wird der Platz beim TEXT
 * reserviert. Bei der Legendennummer nicht: sie steht am linken Rand, und ihr
 * den Platz abzuziehen nähme einem schmalen gestauchten Abschnitt die letzte
 * Auskunft, die er heute schon trägt.
 */
const BRUCH_BREITE = 12;
/** Mindestlücke zwischen zwei Unter-Beschriftungen. */
const UNTER_ABSTAND = 6;
/**
 * Rückfall-Schwellen ohne Messung — die Konstanten bis v3.31. `LABEL_AB` war
 * gegen `text-[10px] px-1` geraten; sie gilt nur noch, wenn gar nicht gemessen
 * werden kann.
 */
const LABEL_AB_RUECKFALL = 46;
const NUMMER_AB_RUECKFALL = 16;

/** Wo die Beschriftung eines Segments landet. */
export type LabelLage = 'im-balken' | 'unter-balken' | 'nummer' | 'keine';

export interface SegmentBeschriftung {
  lage: LabelLage;
  /** Der anzuzeigende Text; `''` bei `'keine'`, die Ziffer bei `'nummer'`. */
  text: string;
  /** Nur bei `'unter-balken'`: px ab dem linken Bahnrand. */
  x: number;
  /** Nur bei `'unter-balken'`: belegte Breite — macht die Kollision testbar. */
  breite: number;
  /**
   * Nur bei `'unter-balken'`: die Beschriftung musste nach links rücken, um ins
   * Bild zu passen. Ihr Führungsstrich gehört dann an die RECHTE Seite — links
   * zeigte er in einen fremden Abschnitt.
   */
  rechtsBuendig: boolean;
}

export interface BandBeschriftung {
  /** `[spurIndex][segmentIndex]`, deckungsgleich mit `geo.spuren[i].segmente`. */
  segmente: SegmentBeschriftung[][];
  /** Je Bahn: trägt sie mindestens eine Unter-Beschriftung? Steuert ihre Höhe. */
  unterzeile: boolean[];
  /**
   * Wurde mindestens eine Legendennummer vergeben? Nur dann nummeriert die
   * Legende. Eine Nummer ist eine Brücke — ohne Segment, das sie braucht, führt
   * sie nirgendwohin.
   */
  nummernGenutzt: boolean;
}

export interface BeschriftungsOptionen {
  /** Breite der Bahn (ohne die Spur-Beschriftung links). */
  bahnBreite: number;
  /** Breite eines Textes in px. `null` = keine Messung → Schwellen-Rückfall. */
  messeText: ((text: string) => number) | null;
  /** Kurzform → Legendennummer; `undefined`, wo keine vergeben ist. */
  nummerVon: (kurz: string) => number | undefined;
}

const LEER: SegmentBeschriftung = {
  lage: 'keine', text: '', x: 0, breite: 0, rechtsBuendig: false,
};

function imBalken(text: string): SegmentBeschriftung {
  return { lage: 'im-balken', text, x: 0, breite: 0, rechtsBuendig: false };
}

/**
 * Verteilt die Beschriftungen einer ganzen Bahn. Von links nach rechts, also
 * chronologisch: bei knappem Platz gewinnt der frühere Abschnitt die Unterzeile.
 * Eine Reihenfolge nach Wichtigkeit gäbe es nicht — alle Abschnitte sind gleich
 * wahr, nur der letzte ist als aktueller Stand hervorgehoben (siehe unten).
 */
function beschrifteBahn(
  bahn: BandSpur, o: BeschriftungsOptionen,
): { segmente: SegmentBeschriftung[]; unterzeile: boolean } {
  const out: SegmentBeschriftung[] = [];
  let unterEnde = Number.NEGATIVE_INFINITY;
  let unterzeile = false;

  bahn.segmente.forEach((b, i) => {
    const ref = b.segment.statusRef;
    // Ohne Statusbezug bleibt „—" — dieselbe Auskunft wie bis v3.31: es gibt
    // einen Abschnitt, aber keinen Namen dafür.
    const lang = ref?.lang ?? '—';
    const kurz = ref?.kurz ?? '—';
    const nummer = ref ? o.nummerVon(ref.kurz) : undefined;

    const platzNummer = b.breite - POLSTER_BALKEN - SICHERHEIT;
    const platzText = platzNummer - (b.gestaucht ? BRUCH_BREITE : 0);

    const nummerOderNichts = (): SegmentBeschriftung => {
      if (nummer === undefined) return LEER;
      const passt = o.messeText === null
        ? b.breite >= NUMMER_AB_RUECKFALL
        : o.messeText(String(nummer)) <= platzNummer;
      return passt
        ? { lage: 'nummer', text: String(nummer), x: 0, breite: 0, rechtsBuendig: false }
        : LEER;
    };

    if (o.messeText === null) {
      // Kein Textmaß: genau das Verhalten bis v3.31 — Kurzform ab der geratenen
      // Schwelle, sonst die Nummer. Keine Unterzeile, denn ohne Maß ließe sich
      // ihre Kollision nicht prüfen.
      out.push(b.breite >= LABEL_AB_RUECKFALL ? imBalken(kurz) : nummerOderNichts());
      return;
    }
    const messe = o.messeText;

    if (messe(lang) <= platzText) { out.push(imBalken(lang)); return; }
    if (messe(kurz) <= platzText) { out.push(imBalken(kurz)); return; }

    // Zweite Etage. Erst der volle Bezeichner — er ist der Grund, warum es sie
    // gibt; passt er nicht, die Kurzform.
    const letztes = i === bahn.segmente.length - 1;
    for (const text of [lang, kurz]) {
      const w = messe(text) + POLSTER_UNTER + SICHERHEIT;
      const frei = (x: number): boolean => x >= unterEnde + UNTER_ABSTAND;
      const passtLinks = b.links + w <= o.bahnBreite;
      if (passtLinks && frei(b.links)) {
        unterEnde = b.links + w;
        unterzeile = true;
        out.push({ lage: 'unter-balken', text, x: b.links, breite: w, rechtsBuendig: false });
        return;
      }
      // Nach innen rücken hilft nur gegen den RECHTEN RAND, nicht gegen eine
      // Kollision: wer wegen des Nachbarn ausweicht, landete weit rechts von
      // seinem eigenen Abschnitt, und der Führungsstrich zeigte ins Leere. Und
      // nur das LETZTE Segment darf es — es ist der aktuelle Stand, das Label,
      // nach dem am häufigsten gesucht wird.
      const rechts = o.bahnBreite - w;
      if (!passtLinks && letztes && rechts >= 0 && frei(rechts)) {
        unterEnde = o.bahnBreite;
        unterzeile = true;
        out.push({ lage: 'unter-balken', text, x: rechts, breite: w, rechtsBuendig: true });
        return;
      }
    }

    out.push(nummerOderNichts());
  });

  return { segmente: out, unterzeile };
}

export function verteileBeschriftung(
  spuren: readonly BandSpur[], o: BeschriftungsOptionen,
): BandBeschriftung {
  const segmente: SegmentBeschriftung[][] = [];
  const unterzeile: boolean[] = [];
  let nummernGenutzt = false;

  for (const bahn of spuren) {
    const r = beschrifteBahn(bahn, o);
    segmente.push(r.segmente);
    unterzeile.push(r.unterzeile);
    if (r.segmente.some(s => s.lage === 'nummer')) nummernGenutzt = true;
  }

  return { segmente, unterzeile, nummernGenutzt };
}
