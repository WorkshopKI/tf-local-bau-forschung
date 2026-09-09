/**
 * Relative, ampel-gefärbte Frist-Anzeige für die Förderanträge-Tabelle.
 *
 * **Drei Zustände, drei Aussagen** (seit v3.6). Vorher war die Zelle entweder
 * eine Zahl oder leer — und leer hieß gleichzeitig „keine Basis", „keine Frist
 * nötig" und „terminal". Jetzt:
 *
 * - `laeuft` → „in 26 T" / „seit 12 T" / „heute", mit Ampelpunkt
 * - `angehalten` → „34 T bis Entscheidung" bzw. nur „angehalten", grau, **ohne**
 *   Punkt — es gibt nichts zu ampeln, wo nichts läuft
 * - `nicht_berechenbar` → „—" mit dem Grund im Tooltip
 *
 * **Die Rechnung steht nicht hier.** `berechneFrist` (csv-Layer) liefert den
 * Zustand, dieses Modul übersetzt ihn in Text und Farbe. Ein Renderer, der
 * nachrechnet, ist die zweite Ableitung, die irgendwann auseinanderläuft.
 */

import type { AntragListItem } from '@/core/services/csv/types';
import {
  berechneFrist, FRIST_GRUND, type FristErgebnis, type FristZustand,
} from '@/core/services/csv/frist-ergebnis';
import type { ZahPhase } from '@/core/status/typen';
import type { HaltedatumHerkunft } from '@/core/status/haltedatum';
import type { EingangAmpel } from './eingangAmpel';
import { MS_TAG } from '@/core/utils/zeitEinheiten';

export interface FristAnzeige {
  /** Relative Anzeige: `in {n} T`, `seit {n} T`, `heute`, `angehalten`, `—`. */
  text: string;
  /** Ampel-Stufe für den farbigen Punkt — `null` heißt: keinen Punkt zeichnen. */
  ampel: EingangAmpel | null;
  /** Zustand für die Formatierung (grau bei angehalten/unberechenbar). */
  zustand: FristZustand;
  /** Was im Tooltip zusätzlich stehen soll; `undefined` = nichts zu sagen. */
  hinweis?: string;
}

/** Relative Tages-Anzeige aus vorzeichenbehafteten „Tagen bis zur Frist".
 *  Positiv = Frist in der Zukunft (`in n T`), 0 = `heute`, negativ =
 *  überfällig (`seit n T`). Kein Roh-`-2807d` mehr. */
export function fristTextFromDays(d: number): string {
  if (d === 0) return 'heute';
  if (d > 0) return `in ${d} T`;
  return `seit ${-d} T`;
}

/**
 * Die Ampel-Stufen als **Tabelle**, damit die Erklärung im aufgeklappten Bereich
 * nicht eine zweite daneben aufschreibt.
 *
 * Schwellen bewusst frist-relativ (nicht eingangs-relativ), damit sie für
 * Antrags- wie VN-Frist gleich lesen. `bis` ist die Obergrenze der Stufe.
 */
export const FRIST_AMPEL_STUFEN: readonly {
  bis: number; ampel: EingangAmpel; text: string;
}[] = [
  { bis: -1, ampel: 'rot', text: 'überfällig' },
  { bis: 14, ampel: 'orange', text: 'noch ≤ 14 T' },
  { bis: 30, ampel: 'gelb', text: 'noch ≤ 30 T' },
  { bis: Number.POSITIVE_INFINITY, ampel: 'gruen', text: 'mehr als 30 T' },
];

/** Ampel-Stufe aus „Tagen bis zur Frist" — überfällig → rot, sonst je näher
 *  die Frist rückt, desto wärmer. Liest {@link FRIST_AMPEL_STUFEN}, statt die
 *  Schwellen ein zweites Mal hinzuschreiben. */
export function fristAmpelFromDays(d: number): EingangAmpel {
  return (FRIST_AMPEL_STUFEN.find(s => d <= s.bis) ?? FRIST_AMPEL_STUFEN[3]!).ampel;
}

/**
 * Woher das Haltedatum kam, in einem Halbsatz — **eine Quelle für Reiter und
 * Band**. Belastbar (Journal, bestätigte Kante) und hergeleitet (Datumsfeld,
 * bedingte Kante) müssen sich lesen lassen, ohne die Herkunft zu kennen.
 */
export const HALT_HERKUNFT: Readonly<Record<HaltedatumHerkunft, string>> = {
  journal: 'aus dem Journal belegt',
  datumsfeld: 'aus einem Datumsfeld genähert',
  verlauf_bestaetigt: 'aus dem Verlauf, Regel bestätigt',
  verlauf_bedingt: 'aus dem Verlauf, Regel bedingt — hergeleitet',
};

/** Ist die Herkunft belastbar oder hergeleitet? Entscheidet die Darstellung. */
export function haltBelastbar(h: HaltedatumHerkunft): boolean {
  return h === 'journal' || h === 'verlauf_bestaetigt';
}

export const HALT_OHNE = 'weder Journal noch Datumsfeld noch Verlauf — nicht geraten';

/**
 * Anzeige aus vorberechneten „Tagen bis zur Frist" — für Aggregate, die schon
 * eine Zahl haben (die kritischste Verbund-Frist via `criticalFristAware`).
 * `null` → keine laufende Uhr.
 *
 * Der engere Rückgabetyp ist Absicht: wer eine Zahl hereingibt, hat per
 * Definition eine laufende Uhr und bekommt garantiert eine Ampelstufe — sonst
 * müsste jeder Aufrufer einen Fall behandeln, den es hier nicht gibt.
 */
export function fristAnzeigeFromDays(
  d: number | null,
): (FristAnzeige & { ampel: EingangAmpel }) | null {
  if (d === null) return null;
  return { text: fristTextFromDays(d), ampel: fristAmpelFromDays(d), zustand: 'laeuft' };
}

/** Wie lange steht die Uhr schon still? Nur wenn das Haltedatum belegt ist. */
function stillstandText(ergebnis: FristErgebnis, nowMs: number): string {
  const halt = ergebnis.bezugsZeitpunkt;
  if (halt === undefined) return 'angehalten';
  const ms = new Date(halt).getTime();
  if (Number.isNaN(ms)) return 'angehalten';
  const tage = Math.floor((nowMs - ms) / MS_TAG);
  if (tage < 0) return 'angehalten';
  return `${tage} T angehalten`;
}

/**
 * Übersetzt ein {@link FristErgebnis} in Text, Ampel und Tooltip-Hinweis.
 *
 * Die eine Stelle, an der aus dem Zustand eine Anzeige wird — Tabelle,
 * Kompaktliste, Kachel und Band nehmen alle diese.
 */
export function fristAnzeigeVon(
  ergebnis: FristErgebnis, nowMs: number = Date.now(),
): FristAnzeige {
  if (ergebnis.zustand === 'laeuft') {
    const rest = ergebnis.tageRest;
    if (rest === undefined) {
      return { text: '—', ampel: null, zustand: 'nicht_berechenbar', hinweis: FRIST_GRUND.ohneEingang };
    }
    return { text: fristTextFromDays(rest), ampel: fristAmpelFromDays(rest), zustand: 'laeuft' };
  }
  if (ergebnis.zustand === 'angehalten') {
    return {
      text: stillstandText(ergebnis, nowMs),
      ampel: null,
      zustand: 'angehalten',
      hinweis: ergebnis.grund ?? 'in diesem Verfahrensschritt läuft keine Frist',
    };
  }
  return {
    text: '—',
    ampel: null,
    zustand: 'nicht_berechenbar',
    hinweis: ergebnis.grund ?? FRIST_GRUND.ohneEingang,
  };
}

/** Was die Listen-Projektion für eine Frist hergibt. */
export type FristQuelle = Pick<
  AntragListItem, 'status' | 'antragsdatum' | 'vn_eingang_datum' | 'alle_antraege_da'
>;

/**
 * Der Frist-Zustand eines Antrags aus der Listen-Projektion — die Brücke
 * zwischen `AntragListItem` und der reinen Engine.
 *
 * Genau EINE Stelle kennt die Feldnamen der Projektion. Wer sie umgeht und
 * `berechneFrist` selbst füttert, baut die zweite Ableitung.
 *
 * **`D_XTE` steht seit v4.126 zur Verfügung.** Die Spalte („alle Anträge da")
 * ist custom gemappt und hat kein kanonisches Feld; die Projektion holt sie
 * über eine explizite Rückfall-Liste (`alle_antraege_da`), nicht über einen
 * geratenen Record-Key (recurring-bug-classes Klasse 5). Damit rechnet die
 * Liste denselben wirksamen Eingang wie Vorgangs-Board und aufgeklappter
 * Bereich — eine Engine, eine Eingabe.
 */
export function fristErgebnisVon(
  antrag: FristQuelle,
  nowMs: number = Date.now(),
  phasen?: readonly ZahPhase[],
): FristErgebnis {
  return berechneFrist({
    status: antrag.status,
    antragsdatum: typeof antrag.antragsdatum === 'string' ? antrag.antragsdatum : null,
    alleAntraegeDa: typeof antrag.alle_antraege_da === 'string' ? antrag.alle_antraege_da : null,
    vnEingangDatum: typeof antrag.vn_eingang_datum === 'string' ? antrag.vn_eingang_datum : null,
    stichtag: new Date(nowMs).toISOString(),
    ...(phasen ? { phasen } : {}),
  });
}

/**
 * Relative Frist-Anzeige eines einzelnen Antrags aus der Listen-Projektion.
 *
 * `nowMs` injizierbar für deterministische Tests (statt `Date.now()`). Das
 * Haltedatum wird hier NICHT ermittelt — dafür bräuchte es Fassung und
 * Vorkommen aus der IndexedDB, und die hat eine Tabellenzeile nicht. Angehaltene
 * Vorgänge stehen deshalb in der Liste als „angehalten" ohne Dauer; die Dauer
 * steht im aufgeklappten Bereich.
 */
export function fristAnzeige(
  antrag: FristQuelle, nowMs: number = Date.now(), phasen?: readonly ZahPhase[],
): FristAnzeige {
  return fristAnzeigeVon(fristErgebnisVon(antrag, nowMs, phasen), nowMs);
}

/**
 * Tage bis zur Frist für **Sortierung und Aggregate**. `null`, wo keine Uhr
 * läuft — angehaltene und unberechenbare Vorgänge haben keine Restzeit, und
 * eine erfundene sortierte sie mitten unter die dringenden.
 */
export function fristTageVon(
  antrag: FristQuelle, nowMs: number = Date.now(), phasen?: readonly ZahPhase[],
): number | null {
  const e = fristErgebnisVon(antrag, nowMs, phasen);
  return e.zustand === 'laeuft' ? (e.tageRest ?? null) : null;
}
