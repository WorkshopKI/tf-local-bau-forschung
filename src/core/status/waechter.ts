/**
 * Der **Stillstands-Wächter**: welcher Antrag hängt fest, und bei wem?
 *
 * Zwei Stufen, beide ohne jede Ketten-Pflege:
 *
 * - **Stufe 1 (generisch)**: letzte Aktivität = jüngstes Datum über die
 *   relevanten Kürzel-Spalten. Liegt sie länger zurück als die Zieltage des
 *   Status, hängt der Vorgang.
 * - **Stufe 2 (gezielt)**: wo ein halb offenes Kürzel-Paar existiert
 *   (fachlich fertig, administrativ offen) oder das To-do eine Rolle benennt,
 *   sagt der Wächter, auf **wessen Schreibtisch** es liegt.
 *
 * **`unbewertet` ist ein eigenes Urteil, nicht „ok".** Ein Status ohne
 * gepflegte Zieltage lässt sich nicht beurteilen; ihn als unauffällig zu zählen
 * hieße, eine Aussage zu treffen, für die die Grundlage fehlt. Genau daran
 * scheitern Ampeln, denen man später nicht mehr glaubt.
 *
 * Rein und deterministisch: kein IO, keine Uhr — `stichtag` reicht der Aufrufer
 * herein.
 */
import { parseGermanDate } from '@/core/services/csv/dateParse';
import { normKey } from './normalisierung';
import { rollenVonFeld } from './rollen';
import type { FeldVorkommen } from './feld-aufloesung';
import type { TodoErgebnis } from './todo-engine';
import type { MappingVersion, Rolle, StatusWertEintrag } from './typen';

const MS_TAG = 86_400_000;

export type WaechterUrteil = 'ok' | 'haengt' | 'unbewertet';

/** Ein halb offenes Kürzel-Paar — die präziseste Form von Stufe 2. */
export interface OffenesPaar {
  /** Das gesetzte Kürzel. */
  gesetzt: string;
  /** Das fehlende Gegenstück. */
  fehlt: string;
  /** Bezeichnung des fehlenden Gegenstücks aus der Zuarbeit. */
  fehltLabel: string;
  /** ISO-Tag, an dem die eine Seite gesetzt wurde. */
  seit: string;
  tage: number;
  /** Wessen Schreibtisch — aus den Rollen des fehlenden Kürzels. */
  rolle: Rolle | null;
}

export interface WaechterErgebnis {
  urteil: WaechterUrteil;
  /** Jüngste Aktivität über die betrachteten Kürzel; `null` = keine. */
  letzteAktivitaet: string | null;
  /** Tage seit der letzten Aktivität. `null`, wenn keine gefunden wurde. */
  tage: number | null;
  /** Zieltage des Status; `null` = für diesen Status keine gepflegt. */
  zieltage: number | null;
  /** Immer gefüllt — auch (und gerade) bei `unbewertet`. */
  grund: string;
  /** Wessen Schreibtisch, sofern ableitbar. `ast` = Antragsteller. */
  rolle: Rolle | 'ast' | null;
  /** Das halb offene Paar, das den Stau erklärt. */
  paar: OffenesPaar | null;
}

/**
 * Die administrativ/fachlich-Paare des Fachsystems.
 *
 * **Die Buchstaben-Konvention trägt nicht durchgehend.** Bei `AK4`/`AT4` steht
 * K für kaufmännisch und T für technisch — bei `ALT`/`ALU` aber steht ALT für
 * „Brief NF von BB" (administrativ) und ALU für „von TB" (fachlich). Deshalb
 * steht die Seite hier ausdrücklich dran und wird nicht aus dem Kürzel geraten.
 */
export const KUERZEL_PAARE: readonly { adm: string; fachl: string }[] = [
  { adm: 'AK4', fachl: 'AT4' },       // Gutachten
  { adm: 'ARK', fachl: 'ART' },       // Rücknahmeempfehlung
  { adm: 'ABLK', fachl: 'ABLT' },     // Ablehnung
  { adm: 'ALT', fachl: 'ALU' },       // Nachforderungs-Brief (BB / TB)
  { adm: 'AKTK', fachl: 'AKTT' },     // Aktennotiz
  { adm: 'ÄK', fachl: 'ÄT' },         // Änderung
  { adm: 'LK', fachl: 'LT' },         // Laufzeitänderung
  { adm: 'MVK', fachl: 'MVT' },       // Mittelverschiebung
  { adm: 'SK', fachl: 'ST' },         // Entsperrung
];

export interface WaechterEingabe {
  version: MappingVersion;
  /** Gesetzte Statuseinträge (`sammleVorkommen`). */
  vorkommen: readonly FeldVorkommen[];
  /** Aktueller Status-Code; `null`, wenn der Text nicht im Katalog steht. */
  statusCode: number | null;
  /** Ergebnis der To-do-Engine — speist Stufe 2, wenn kein Paar greift. */
  todo?: TodoErgebnis | null;
  /** ISO — injiziert, nie `new Date()` hier drin. */
  stichtag: string;
}

/** ISO-Tag eines Vorkommens; `null`, wenn der Wert kein Datum ist. */
function tagVon(v: FeldVorkommen): string | null {
  if (v.feld.typ !== 'datum') return null;
  return parseGermanDate(v.wert) ?? (/^\d{4}-\d{2}-\d{2}/.test(v.wert) ? v.wert.slice(0, 10) : null);
}

function tageZwischen(tag: string, stichtag: string): number | null {
  const a = new Date(tag).getTime();
  const b = new Date(stichtag).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.floor((b - a) / MS_TAG);
}

/** Zieltage des Status aus dem Katalog; `null` = keine gepflegt. */
export function zieltageFuer(version: MappingVersion, statusCode: number | null): number | null {
  if (statusCode === null) return null;
  const treffer: StatusWertEintrag | undefined = version.werte.find(
    w => w.code === statusCode && typeof w.zieltage === 'number',
  );
  return treffer?.zieltage ?? null;
}

/**
 * Sucht ein halb offenes Paar: eine Seite gesetzt, die andere leer.
 *
 * Betrachtet werden nur Paare, deren **beide** Kürzel der Katalog kennt — sonst
 * hieße „die Gegenseite ist leer" nur „wir können sie nicht lesen".
 */
function findePaar(e: WaechterEingabe): OffenesPaar | null {
  const felderNachCode = new Map<string, FeldVorkommen['feld']>();
  for (const f of e.version.felder) {
    if (f.code) felderNachCode.set(normKey(f.code), f);
  }
  const gesetztAm = new Map<string, string>();
  for (const v of e.vorkommen) {
    const tag = v.feld.code ? tagVon(v) : null;
    if (tag) gesetztAm.set(normKey(v.feld.code!), tag);
  }

  let bester: OffenesPaar | null = null;
  for (const paar of KUERZEL_PAARE) {
    const seiten = [
      { gesetzt: paar.adm, fehlt: paar.fachl },
      { gesetzt: paar.fachl, fehlt: paar.adm },
    ];
    for (const s of seiten) {
      const gk = normKey(s.gesetzt);
      const fk = normKey(s.fehlt);
      if (!felderNachCode.has(gk) || !felderNachCode.has(fk)) continue;
      const seit = gesetztAm.get(gk);
      if (!seit || gesetztAm.has(fk)) continue;
      const tage = tageZwischen(seit, e.stichtag);
      if (tage === null) continue;
      // Das ÄLTESTE offene Paar erklärt den Stau am besten — es liegt am
      // längsten quer.
      if (bester && bester.tage >= tage) continue;
      const feld = felderNachCode.get(fk)!;
      const rollen = rollenVonFeld(feld);
      bester = {
        gesetzt: s.gesetzt,
        fehlt: s.fehlt,
        fehltLabel: feld.label,
        seit,
        tage,
        rolle: rollen[0] ?? null,
      };
    }
  }
  return bester;
}

/**
 * Beurteilt den Stillstand. Rein.
 *
 * Berücksichtigt nur **relevante** Kürzel, sobald die Fassung welche markiert —
 * sonst hielte ein beliebiger Nebenvermerk den Vorgang „aktiv" (dieselbe Regel
 * wie in `baueHerleitung`).
 */
export function pruefeStillstand(e: WaechterEingabe): WaechterErgebnis {
  const relevante = new Set(
    e.version.felder.filter(f => f.relevant === true).map(f => f.feldId),
  );
  const betrachtet = relevante.size > 0
    ? e.vorkommen.filter(v => relevante.has(v.feld.feldId))
    : e.vorkommen;

  let letzteAktivitaet: string | null = null;
  for (const v of betrachtet) {
    const tag = tagVon(v);
    if (tag && (letzteAktivitaet === null || tag > letzteAktivitaet)) letzteAktivitaet = tag;
  }
  const tage = letzteAktivitaet ? tageZwischen(letzteAktivitaet, e.stichtag) : null;
  const zieltage = zieltageFuer(e.version, e.statusCode);
  const paar = findePaar(e);

  // Stufe 2 zuerst befragen — sie liefert die Rolle, unabhängig vom Urteil.
  const rolle: Rolle | 'ast' | null = paar?.rolle
    ?? e.todo?.wartetAuf
    ?? e.todo?.zustaendig[0]
    ?? null;

  if (zieltage === null) {
    return {
      urteil: 'unbewertet',
      letzteAktivitaet,
      tage,
      zieltage: null,
      grund: e.statusCode === null
        ? 'Status nicht im Katalog — kein Ziel bestimmbar.'
        : `Für Status ${e.statusCode} sind keine Zieltage definiert.`,
      rolle,
      paar,
    };
  }
  if (letzteAktivitaet === null || tage === null) {
    return {
      urteil: 'unbewertet',
      letzteAktivitaet: null,
      tage: null,
      zieltage,
      grund: 'Keine datierte Aktivität gefunden — Liegezeit nicht bestimmbar.',
      rolle,
      paar,
    };
  }

  if (tage > zieltage) {
    const paarGrund = paar
      ? ` ${paar.gesetzt} gesetzt, ${paar.fehlt} („${paar.fehltLabel}") fehlt seit ${paar.tage} Tagen.`
      : '';
    return {
      urteil: 'haengt',
      letzteAktivitaet,
      tage,
      zieltage,
      grund: `Keine Vorgangs-Aktivität seit ${tage} Tagen, Ziel ${zieltage}.${paarGrund}`,
      rolle,
      paar,
    };
  }

  return {
    urteil: 'ok',
    letzteAktivitaet,
    tage,
    zieltage,
    grund: `Zuletzt vor ${tage} Tagen aktiv, Ziel ${zieltage}.`,
    rolle,
    paar,
  };
}

/**
 * Median-Liegezeit je Status-Code aus dem Bestand — der Vorschlag für die
 * Zieltage-Pflege.
 *
 * **Eine Näherung, ausdrücklich.** Gemessen wird die Zeit seit der jüngsten
 * Aktivität, nicht die tatsächliche Verweildauer im Status — die kennt der
 * Export nicht. Der Vorschlag beschreibt also, wie lange Vorgänge in diesem
 * Status typischerweise unangetastet liegen; übernommen wird er pro Zeile
 * einzeln, nie im Block.
 */
export interface Liegeverteilung {
  median: number;
  /** 90. Perzentil — der lange Schwanz, den der Median verschweigt. */
  p90: number;
  /** Stichprobengröße. Gehört ÜBERALL dazu, wo die Zahl angezeigt wird. */
  n: number;
}

export function medianLiegezeit(
  proben: readonly { statusCode: number | null; tage: number | null }[],
): Map<number, Liegeverteilung> {
  const proCode = new Map<number, number[]>();
  for (const p of proben) {
    if (p.statusCode === null || p.tage === null || p.tage < 0) continue;
    const list = proCode.get(p.statusCode);
    if (list) list.push(p.tage); else proCode.set(p.statusCode, [p.tage]);
  }
  const out = new Map<number, Liegeverteilung>();
  for (const [code, werte] of proCode) {
    werte.sort((a, b) => a - b);
    const median = werte.length % 2 === 1
      ? werte[(werte.length - 1) / 2]!
      : Math.round((werte[werte.length / 2 - 1]! + werte[werte.length / 2]!) / 2);
    // Nächstgelegener Rang: bei kleinem n ist jede Interpolation eine
    // Genauigkeit, die die Stichprobe nicht hergibt.
    const p90 = werte[Math.min(werte.length - 1, Math.ceil(werte.length * 0.9) - 1)]!;
    out.set(code, { median, p90, n: werte.length });
  }
  return out;
}
