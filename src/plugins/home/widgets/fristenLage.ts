/**
 * Die **Fristen-Lage** der eigenen Vorgänge — das Modell der Fristen-Karte und
 * des Tagesbrief-Themas „Jetzt eingreifen" (v6.67). Rein: kein React, keine IO,
 * keine Uhr.
 *
 * Bis v6.66 standen hier „Anlässe" zweier Systeme nebeneinander — Stillstand
 * gegen Zieltage, Meilenstein gegen Soll — und wurden über eine gemeinsame
 * „T über"-Zahl sortiert. An einem Vorgang standen so mehrere rote Tageszahlen,
 * und keine davon war die Frist. Entschieden am 13.09.2026:
 *
 * - **Eine Zeile je Verbund**, die die vier Fragen des Bearbeiters beantwortet:
 *   wie weit über der Frist (`fristTage`), welche Meilensteine gerissen (Zahl
 *   und Blocker, dieselbe Wahl wie die Kopfkarte), steht er still (`bewegung`),
 *   was ist zu tun (die Aufgabe der Kaskade — setzt die Fläche daneben).
 * - **Zwei Gruppen.** *Jetzt eingreifen*: keine Bewegung über die Zieltage
 *   hinaus, die Frist läuft und ist noch nicht überschritten — hier lässt sich
 *   ein Riss noch verhindern; zuerst, was als Nächstes reißt (nächster
 *   Meilenstein oder Frist, `drohtInTagen`). *Rückstand*: die Frist läuft und ist überschritten, oder ein
 *   Meilenstein ist gerissen; zuerst, was am weitesten über der Frist ist.
 * - **Nur laufende Fristen.** Angehaltene und nicht berechenbare stehen in
 *   keiner Gruppe, sie werden gezählt (`ohneLaufendeFrist`). Gemessen am
 *   13.09.2026 waren 1 128 der 1 658 Rückstands-Kandidaten des Bereichs
 *   angehalten — eine Liste, die zu zwei Dritteln aus Vorgängen in der
 *   Entscheidung besteht, nennt niemandem eine Handlung.
 */
import type { FristZustand } from '@/core/services/csv/frist-ergebnis';
import type { MeilensteinKnoten, VerbundMeilensteine } from '@/core/meilensteine';
import type { KuerzelIndex, WaechterErgebnis } from '@/core/status';
import { normKey } from '@/core/status/normalisierung';
import { tageZwischen } from '@/core/status/waechter';
import { faelligWort } from '@/core/utils/uhrWorte';
import { baueStufen, type MeilensteinLage } from '@/plugins/antraege/ausklapp/meilensteinLage';
import { findeBlocker } from '@/plugins/antraege/ausklapp/kopfkarte/blocker';

export type FristenGruppe = 'eingreifen' | 'rueckstand';

/** Die Reihenfolge der Gruppen auf der Karte. */
export const GRUPPEN: readonly FristenGruppe[] = ['eingreifen', 'rueckstand'];

/** Woraus „keine Bewegung" gelesen wurde — Kürzel-Paar oder Verbund-Status. */
export interface StillstandGrund {
  text: string;
  /** Die Felder hinter `text`; fehlt, wo der Katalog keines der Kürzel kennt. */
  quellFelder?: readonly string[];
}

/** Was der Hook je eigenem Verbund einsammelt. */
export interface VerbundQuelle {
  verbundId: string;
  akronym: string;
  /** Aus dem Dashboard-Aggregat — dieselbe Engine wie die Frist-Spalte. */
  fristZustand: FristZustand | null;
  /** Tage bis zur Frist; `null`, wo keine Uhr läuft. */
  fristTage: number | null;
  /** Laut Kürzeln erledigt — ein Befund für „Kürzel ↔ Status", keine Frist-Zeile. */
  erledigtLautKuerzeln: boolean;
  /** `null` = Stillstands-Wächter aus oder (noch) nicht bewertet. */
  waechter: WaechterErgebnis | null;
  stillstandGrund: StillstandGrund | null;
  /** `null` = kein freigegebener Plan, Flag aus oder Verbund nicht projiziert. */
  bewertung: VerbundMeilensteine | null;
}

export interface MeilensteinKurzlage {
  /** Gerissene Blatt-Stufen — dieselbe Zählung wie der Kopfkarten-Fakt. */
  gerissen: number;
  relevant: number;
  /** Die früheste gerissene Blatt-Stufe (`findeBlocker`); `null` ohne Riss. */
  blocker: { knoten: MeilensteinKnoten; offenTage: number | null } | null;
  /** Das früheste Soll unter den offenen und fälligen Blatt-Stufen. */
  naechster: { knoten: MeilensteinKnoten; tageBis: number } | null;
}

export interface Bewegung {
  liegeTage: number | null;
  zieltage: number | null;
  belegt: boolean;
  grund: StillstandGrund | null;
}

export interface FristenZeile {
  verbundId: string;
  akronym: string;
  gruppe: FristenGruppe;
  /** Tage bis zur Bearbeitungsfrist, negativ = darüber. Beide Gruppen setzen eine laufende Frist voraus. */
  fristTage: number;
  meilensteine: MeilensteinKurzlage | null;
  /** Nur gesetzt, wenn der Wächter „keine Bewegung" sagt. */
  bewegung: Bewegung | null;
}

/**
 * Blocker, Riss-Zahl und nächster Meilenstein eines Verbunds.
 *
 * Der Blocker kommt aus `findeBlocker` und nicht aus einer zweiten Regel: die
 * Karte und die Kopfkarte im Ausklapp nennen sonst beim ersten Gleichstand zwei
 * verschiedene Stufen für denselben Vorgang.
 */
export function meilensteinKurzlage(
  bewertung: VerbundMeilensteine, knoten: readonly MeilensteinKnoten[], stichtag: string,
): MeilensteinKurzlage {
  const lage: MeilensteinLage = { art: 'da', knoten, bewertung };
  const befund = findeBlocker(lage, stichtag);
  const blockerKnoten = befund.blocker
    ? knoten.find(k => k.id === befund.blocker?.knotenId) ?? null
    : null;
  // Tag gegen Tag: der Stichtag trägt eine Uhrzeit, das Soll nicht — sonst hieße
  // „morgen fällig" am Nachmittag „heute fällig".
  const tag = stichtag.slice(0, 10);
  let naechster: MeilensteinKurzlage['naechster'] = null;
  for (const s of baueStufen(lage)) {
    if (!s.blatt || (s.zustand !== 'offen' && s.zustand !== 'faellig')) continue;
    if (s.ergebnis.sollDatum === null) continue;
    const tageBis = tageZwischen(tag, s.ergebnis.sollDatum);
    if (tageBis === null) continue;
    if (naechster === null || tageBis < naechster.tageBis) naechster = { knoten: s.knoten, tageBis };
  }
  return {
    gerissen: befund.gerissen,
    relevant: befund.relevant,
    blocker: blockerKnoten && befund.blocker
      ? { knoten: blockerKnoten, offenTage: befund.blocker.offenTage }
      : null,
    naechster,
  };
}

/** Eine Quelle wird eine Zeile — oder keine, wenn sie in keine Gruppe gehört. */
export function ordneEin(
  q: VerbundQuelle, knoten: readonly MeilensteinKnoten[], stichtag: string,
): FristenZeile | null {
  if (q.erledigtLautKuerzeln) return null;
  if (q.fristZustand !== 'laeuft' || q.fristTage === null) return null;
  const meilensteine = q.bewertung ? meilensteinKurzlage(q.bewertung, knoten, stichtag) : null;
  const w = q.waechter;
  const bewegung: Bewegung | null = w?.urteil === 'haengt'
    ? { liegeTage: w.tage, zieltage: w.zieltage, belegt: w.belegt, grund: q.stillstandGrund }
    : null;
  let gruppe: FristenGruppe | null = null;
  if (bewegung !== null && q.fristTage >= 0) gruppe = 'eingreifen';
  else if (q.fristTage < 0 || (meilensteine?.gerissen ?? 0) > 0) gruppe = 'rueckstand';
  if (gruppe === null) return null;
  return { verbundId: q.verbundId, akronym: q.akronym, gruppe, fristTage: q.fristTage, meilensteine, bewegung };
}

/** Kleiner zuerst; `null` ans Ende. */
function aufsteigend(a: number | null, b: number | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

/**
 * In wie vielen Tagen der nächste Riss droht — der nächste offene Meilenstein
 * oder die Frist, was zuerst kommt.
 *
 * Nur der Meilenstein reichte nicht: gemessen am 13.09.2026 (alle Bearbeiter)
 * stand ein Vorgang mit „noch 46 T" und nächstem Meilenstein in 12 Tagen über
 * fünf Vorgängen, deren Meilensteine alle schon gerissen waren und deren Frist
 * heute oder in zwei Tagen endete — ohne offenen Meilenstein sanken sie ans Ende.
 */
export function drohtInTagen(z: Pick<FristenZeile, 'fristTage' | 'meilensteine'>): number {
  const naechster = z.meilensteine?.naechster?.tageBis;
  return naechster === undefined ? z.fristTage : Math.min(naechster, z.fristTage);
}

/**
 * Eingreifen vor Rückstand. Innerhalb von *Eingreifen* entscheidet, was zuerst
 * reißt (`drohtInTagen`), dann die längere Liegezeit; innerhalb von *Rückstand*
 * die Überschreitung, dann die Zahl der Risse. Zuletzt das Akronym, damit die
 * Liste zwischen zwei Renderings nicht springt.
 */
export function sortiereLage(zeilen: readonly FristenZeile[]): FristenZeile[] {
  return [...zeilen].sort((a, b) => {
    if (a.gruppe !== b.gruppe) return GRUPPEN.indexOf(a.gruppe) - GRUPPEN.indexOf(b.gruppe);
    if (a.gruppe === 'eingreifen') {
      const n = drohtInTagen(a) - drohtInTagen(b);
      if (n !== 0) return n;
      const l = aufsteigend(b.bewegung?.liegeTage ?? null, a.bewegung?.liegeTage ?? null);
      if (l !== 0) return l;
    } else {
      if (a.fristTage !== b.fristTage) return a.fristTage - b.fristTage;
      const g = (b.meilensteine?.gerissen ?? 0) - (a.meilensteine?.gerissen ?? 0);
      if (g !== 0) return g;
    }
    return a.akronym.localeCompare(b.akronym, 'de');
  });
}

export function baueFristenLage(
  quellen: readonly VerbundQuelle[], knoten: readonly MeilensteinKnoten[], stichtag: string,
): FristenZeile[] {
  return sortiereLage(quellen.flatMap(q => {
    const z = ordneEin(q, knoten, stichtag);
    return z ? [z] : [];
  }));
}

/** Eigene, offene Vorgänge, deren Frist nicht läuft — sie stehen in keiner Gruppe, aber gezählt. */
export function zaehleOhneLaufendeFrist(quellen: readonly VerbundQuelle[]): number {
  return quellen.filter(q => !q.erledigtLautKuerzeln && (q.fristZustand !== 'laeuft' || q.fristTage === null)).length;
}

/**
 * Der sichtbare Ausschnitt — **beide Gruppen kommen vor**, wenn beide etwas haben.
 *
 * Dieselbe Lehre wie v4.134 an den zwei Quellen: eine Gruppe, die in der
 * Kappung verschwindet, während die Kopfzeile sie zählt, ist kein Zugang zu der
 * Sache, die sie zählt. Jede Gruppe bekommt mindestens `mindestens` Plätze; die
 * Reihenfolge der Eingabe bleibt — es wird ausgewählt, nicht umsortiert.
 */
export function sichtbareZeilen(
  zeilen: readonly FristenZeile[], hoechstens: number, mindestens: number,
): FristenZeile[] {
  if (zeilen.length <= hoechstens) return [...zeilen];
  const gewaehlt = new Set<string>();
  for (const gruppe of GRUPPEN) {
    let n = 0;
    for (const z of zeilen) {
      if (n >= mindestens || gewaehlt.size >= hoechstens) break;
      if (z.gruppe !== gruppe) continue;
      gewaehlt.add(z.verbundId);
      n += 1;
    }
  }
  for (const z of zeilen) {
    if (gewaehlt.size >= hoechstens) break;
    gewaehlt.add(z.verbundId);
  }
  return zeilen.filter(z => gewaehlt.has(z.verbundId));
}

export function lageBilanz(zeilen: readonly FristenZeile[]): Record<FristenGruppe, number> {
  let eingreifen = 0;
  for (const z of zeilen) if (z.gruppe === 'eingreifen') eingreifen += 1;
  return { eingreifen, rueckstand: zeilen.length - eingreifen };
}

/** Die Kopfzeile: „2 eingreifen · 5 Rückstand" — leere Gruppen fallen weg. */
export function bilanzText(zeilen: readonly FristenZeile[]): string {
  const { eingreifen, rueckstand } = lageBilanz(zeilen);
  const teile: string[] = [];
  if (eingreifen > 0) teile.push(`${eingreifen.toLocaleString('de-DE')} eingreifen`);
  if (rueckstand > 0) teile.push(`${rueckstand.toLocaleString('de-DE')} Rückstand`);
  return teile.join(' · ');
}

/** „3 gerissen · 4 Ersteinschätzung positiv" — `null` ohne Riss. */
export function meilensteinText(m: MeilensteinKurzlage): string | null {
  if (m.gerissen === 0) return null;
  return m.blocker
    ? `${m.gerissen} gerissen · ${m.blocker.knoten.nummer} ${m.blocker.knoten.label}`
    : `${m.gerissen} gerissen`;
}

/** „nächster Meilenstein fällig in 5 T" — `null`, wenn keiner offen ist. */
export function naechsterText(m: MeilensteinKurzlage): string | null {
  return m.naechster ? `nächster Meilenstein ${faelligWort(m.naechster.tageBis)}` : null;
}

/**
 * Woraus der Stillstand gelesen wurde.
 *
 * Die Felder eines Kürzel-Paars werden nachgeschlagen, nie zusammengesetzt:
 * `D_` + Kürzel träfe meist, aber nicht immer (Pitfall #44) — und ein Tooltip
 * mit falscher Spalte verdeckte genau den Fehler, den er finden helfen soll.
 *
 * @param statusRoh Der Status der Zeile (`STATUS_TV`) — derselbe, den „Meine
 *   Anträge" und der aufgeklappte Bereich lesen.
 * @param kuerzel `kuerzelIndex` der aktiven Fassung — einmal je Lauf gebaut.
 */
export function stillstandGrund(w: WaechterErgebnis, statusRoh: string, kuerzel: KuerzelIndex): StillstandGrund {
  if (!w.paar) return { text: statusRoh, quellFelder: ['STATUS_TV'] };
  const felder: string[] = [];
  for (const k of [w.paar.gesetzt, w.paar.fehlt]) {
    // Die Index-Schlüssel stehen in `normKey`-Form, der Suchbegriff muss mit.
    const feld = kuerzel.get(normKey(k));
    if (feld) felder.push(feld.feldId);
  }
  return {
    text: `${w.paar.gesetzt} gesetzt, ${w.paar.fehlt} fehlt`,
    ...(felder.length > 0 ? { quellFelder: felder } : {}),
  };
}
