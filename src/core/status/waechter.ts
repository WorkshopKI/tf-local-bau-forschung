/**
 * Der **Stillstands-Wächter**: welcher Antrag hängt fest, und bei wem?
 *
 * Zwei Stufen, beide ohne jede Ketten-Pflege:
 *
 * - **Stufe 1 (generisch)**: letzte Aktivität = jüngstes Datum über die
 *   relevanten Kürzel-Spalten, **das nicht in der Zukunft liegt**. Liegt sie
 *   länger zurück als die Zieltage des Status, hängt der Vorgang.
 * - **Stufe 2 (gezielt)**: wo ein halb offenes Kürzel-Paar existiert
 *   (fachlich fertig, administrativ offen) oder das To-do eine Rolle benennt,
 *   sagt der Wächter, auf **wessen Schreibtisch** es liegt.
 *
 * **`unbewertet` ist ein eigenes Urteil, nicht „ok".** Ein Status ohne
 * gepflegte Zieltage lässt sich nicht beurteilen; ihn als unauffällig zu zählen
 * hieße, eine Aussage zu treffen, für die die Grundlage fehlt. Genau daran
 * scheitern Ampeln, denen man später nicht mehr glaubt.
 *
 * **Ein Termin ist keine Bearbeitung.** Die `D_`-Spalten führen auch Daten, die
 * in der Zukunft liegen (geplante Termine, Laufzeit- und Planungsdaten). Zählte
 * man sie als „letzte Aktivität", gewänne das späteste Datum, die Liegezeit
 * würde negativ und `tage > zieltage` nie wahr — der Stillstand wäre genau dort
 * unsichtbar, wo ein Termin gesetzt und danach nichts mehr getan wurde. Sie
 * werden deshalb ausgeschlossen und als {@link AnstehenderTermin} **gesondert
 * ausgewiesen**; sie wegzulassen wäre wieder Schweigen.
 *
 * Rein und deterministisch: kein IO, keine Uhr — `stichtag` reicht der Aufrufer
 * herein.
 */
import { parseGermanDate } from '@/core/services/csv/dateParse';
import { normKey } from './normalisierung';
import { rollenVonFeld } from './rollen';
import type { FeldVorkommen } from './feld-aufloesung';
import type { TodoErgebnis } from './todo-engine';
import type { MappingVersion, Rolle } from './typen';
import { versionIndex } from './version-index';
import { MS_TAG } from '@/core/utils/zeitEinheiten';


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

/** Ein Datum, das noch bevorsteht — Termin, kein Nachweis von Bearbeitung. */
export interface AnstehenderTermin {
  /** ISO-Tag, echt nach dem Stichtag. */
  tag: string;
  /** Kürzel des Fachsystems, falls das Feld eines trägt. */
  code?: string;
  /** Bezeichnung aus der Zuarbeit. */
  label: string;
}

export interface WaechterErgebnis {
  urteil: WaechterUrteil;
  /** Jüngste Aktivität über die betrachteten Kürzel; `null` = keine.
   *  Zukunftsdaten sind ausgeschlossen (siehe Modulkopf). */
  letzteAktivitaet: string | null;
  /**
   * Ist `letzteAktivitaet` **belegt** oder genähert?
   *
   * Genähert (`false`) heißt: sie kommt aus dem jüngsten `D_`-Datum. Das ist
   * eine Untergrenze — mehrfach gesetzte Kürzel tragen im Export nur das letzte
   * Datum (V9), und eine zurückgenommene Setzung ist gar nicht sichtbar. Belegt
   * (`true`) heißt: das Import-Diff-Journal führt für diesen Antrag eine
   * Änderung ab seinem Nullpunkt. Der Unterschied gehört an jede Anzeige, sonst
   * liest man eine Schätzung als Messung.
   */
  belegt: boolean;
  /** Das nächste Datum NACH dem Stichtag; `null` = keins gesetzt. Es geht nicht
   *  in das Urteil ein, gehört aber in die Anzeige („anstehend am …"). */
  anstehend: AnstehenderTermin | null;
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
  /**
   * Die Vorkommen **je Teilvorhaben**, wenn die beurteilte Zeile mehrere
   * bündelt (verdichtete Verbund-Zeile).
   *
   * Die Kürzel stehen in TV-Spalten, also wird je TV geurteilt — genau das, was
   * {@link offenePaareJeTeilvorhaben} tut und wozu der Kommentar dort seit je
   * warnt: „Hat TV-A AK4 und TV-B AT4, gilt beides als da". Bis v4.122 bekam
   * der Wächter einer Verbund-Zeile alle Vorkommen in EINEM Topf und übersah
   * dadurch jedes Paar, das je Teilvorhaben halb offen, über den Topf gesehen
   * aber geschlossen ist. Fehlt das Feld, bleibt die Rechnung wie bisher.
   */
  jeTeilvorhaben?: readonly { aktenzeichen: string; vorkommen: readonly FeldVorkommen[] }[];
  /** Aktueller Status-Code; `null`, wenn der Text nicht im Katalog steht. */
  statusCode: number | null;
  /** Ergebnis der To-do-Engine — speist Stufe 2, wenn kein Paar greift. */
  todo?: TodoErgebnis | null;
  /**
   * Die belegte letzte Änderung aus dem Import-Diff-Journal (ISO-Tag).
   *
   * Optional, damit `pruefeStillstand` rein bleibt und ohne Journal exakt
   * weiterrechnet wie bisher. Ist sie gesetzt, gewinnt sie gegen die Näherung
   * aus `max(D_)`: sie kennt auch Änderungen, die der Export überschrieben hat.
   *
   * **Nicht der Nullpunkt `journalAb`.** Der ist für jeden Antrag derselbe Tag;
   * hier übergeben ersetzt er jede Liegezeit durch das Alter des Journals und
   * dreht das Urteil auf „ok" — gemessen bei 1 056 von 1 057 hängenden
   * Vorgängen (v3.31–v3.43.1, Guard `kein-nullpunkt-als-letzte-aenderung`).
   * Wer nichts Belegtes hat, übergibt `null`: die Näherung ist ehrlich und wird
   * als solche beschriftet.
   */
  journalAenderung?: string | null;
  /** ISO — injiziert, nie `new Date()` hier drin. */
  stichtag: string;
}

/** ISO-Tag eines Vorkommens; `null`, wenn der Wert kein Datum ist. */
function tagVon(v: FeldVorkommen): string | null {
  if (v.feld.typ !== 'datum') return null;
  return parseGermanDate(v.wert) ?? (/^\d{4}-\d{2}-\d{2}/.test(v.wert) ? v.wert.slice(0, 10) : null);
}

/** Ganze Tage zwischen zwei ISO-Tagen; `null`, wenn eines nicht lesbar ist.
 *  Exportiert, damit die FB-Erhebung dieselbe Arithmetik nutzt statt einer zweiten. */
export function tageZwischen(tag: string, stichtag: string): number | null {
  const a = new Date(tag).getTime();
  const b = new Date(stichtag).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.floor((b - a) / MS_TAG);
}

/** Zieltage des Status aus dem Katalog; `null` = keine gepflegt. */
export function zieltageFuer(version: MappingVersion, statusCode: number | null): number | null {
  if (statusCode === null) return null;
  return versionIndex(version).zieltageNachCode.get(statusCode) ?? null;
}

/**
 * **Alle** halb offenen Paare: eine Seite gesetzt, die andere leer.
 *
 * Betrachtet werden nur Paare, deren **beide** Kürzel der Katalog kennt — sonst
 * hieße „die Gegenseite ist leer" nur „wir können sie nicht lesen".
 *
 * Absteigend nach Standzeit, das älteste zuerst: der Wächter nimmt daraus das
 * erste (es erklärt den Stau am besten), die FB-Erhebung braucht alle — dort ist
 * jedes einseitig offene Paar eine eigene Situation.
 */
export function findeOffenePaare(
  version: MappingVersion, vorkommen: readonly FeldVorkommen[], stichtag: string,
): OffenesPaar[] {
  // Einmal je Fassung statt einmal je Vorgang: über den Bestand gerechnet waren
  // das ~12 000 Neuaufbauten desselben Index (gemessen ~2,5 s).
  const felderNachCode = versionIndex(version).felderNachCode;
  const gesetztAm = new Map<string, string>();
  for (const v of vorkommen) {
    const tag = v.feld.code ? tagVon(v) : null;
    if (tag) gesetztAm.set(normKey(v.feld.code!), tag);
  }

  const offen: OffenesPaar[] = [];
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
      const tage = tageZwischen(seit, stichtag);
      if (tage === null) continue;
      const feld = felderNachCode.get(fk)!;
      offen.push({
        gesetzt: s.gesetzt,
        fehlt: s.fehlt,
        fehltLabel: feld.label,
        seit,
        tage,
        rolle: rollenVonFeld(feld)[0] ?? null,
      });
    }
  }
  // Stabil: bei gleicher Standzeit gewinnt das in `KUERZEL_PAARE` frühere —
  // dieselbe Auswahl wie vor der Aufteilung.
  return offen.sort((a, b) => b.tage - a.tage);
}

/** Ein halb offenes Paar samt dem Teilvorhaben, dem die Lücke gehört. */
export interface OffenesPaarJeTv extends OffenesPaar {
  /** Aktenzeichen des Teilvorhabens. */
  tvId: string;
}

/**
 * Die halb offenen Paare **je Teilvorhaben** statt über den ganzen Verbund.
 *
 * **Warum das nicht dasselbe ist.** Wer die Vorkommen aller Teilvorhaben
 * zusammenwirft — was für Chronik und Ordner-Ansicht richtig ist, weil es dort
 * um den Verbund geht —, sieht ein Kürzel als gesetzt, sobald **irgendein**
 * Teilvorhaben es trägt. Hat TV-A `AK4` und TV-B `AT4`, gilt beides als da und
 * die Suche meldet **nichts**, obwohl jedes der beiden für sich eine offene
 * Seite hat. Dieselbe Grenze, an der schon `OffeneAufgaben` und die FB-Erhebung
 * haltmachen: die Kürzel stehen in TV-Spalten, also wird je TV geurteilt.
 *
 * Sortiert wie {@link findeOffenePaare}, nur über alle Teilvorhaben hinweg: das
 * längst offene zuerst. `Array.sort` ist stabil, bei gleicher Standzeit bleibt
 * es deshalb bei der Eingabereihenfolge (Teilvorhaben, dann `KUERZEL_PAARE`).
 *
 * Rein — `stichtag` kommt vom Aufrufer, hier tickt keine Uhr.
 */
export function offenePaareJeTeilvorhaben(
  version: MappingVersion,
  jeTeilvorhaben: readonly { aktenzeichen: string; vorkommen: readonly FeldVorkommen[] }[],
  stichtag: string,
): OffenesPaarJeTv[] {
  return jeTeilvorhaben
    .flatMap(tv => findeOffenePaare(version, tv.vorkommen, stichtag)
      .map(p => ({ ...p, tvId: tv.aktenzeichen })))
    .sort((a, b) => b.tage - a.tage);
}

/**
 * Das älteste halb offene Paar — es liegt am längsten quer.
 *
 * Bündelt die Zeile mehrere Teilvorhaben, wird je Teilvorhaben gesucht
 * (siehe {@link WaechterEingabe.jeTeilvorhaben}); über einen gemeinsamen Topf
 * schlösse die Gegenseite eines fremden TVs das Paar.
 */
function findePaar(e: WaechterEingabe): OffenesPaar | null {
  if (e.jeTeilvorhaben && e.jeTeilvorhaben.length > 1) {
    return offenePaareJeTeilvorhaben(e.version, e.jeTeilvorhaben, e.stichtag)[0] ?? null;
  }
  return findeOffenePaare(e.version, e.vorkommen, e.stichtag)[0] ?? null;
}

/** Was die Datumsspalten eines Vorgangs über seine Zeitachse hergeben. */
export interface Zeitachse {
  /** Jüngstes Datum bis einschließlich Stichtag; `null` = keins. */
  letzteAktivitaet: string | null;
  /** Frühestes Datum NACH dem Stichtag; `null` = keins. */
  anstehend: AnstehenderTermin | null;
}

/**
 * Die Zeitachse eines Vorgangs aus seinen Datumsspalten. Rein.
 *
 * **Einzelquelle** — der Wächter und der Zieltage-Vorschlag im Cockpit rechnen
 * dieselbe Zahl; zwei Implementierungen liefen beim ersten Sonderfall
 * auseinander (der Vorschlag kannte weder Relevanz- noch Zukunftsfilter).
 *
 * Berücksichtigt nur **relevante** Kürzel, sobald die Fassung welche markiert —
 * sonst hielte ein beliebiger Nebenvermerk den Vorgang „aktiv" (dieselbe Regel
 * wie in `baueHerleitung`).
 */
export function letzteAktivitaetVon(
  vorkommen: readonly FeldVorkommen[], version: MappingVersion, stichtag: string,
): Zeitachse {
  const relevante = versionIndex(version).relevanteFeldIds;
  const betrachtet = relevante.size > 0
    ? vorkommen.filter(v => relevante.has(v.feld.feldId))
    : vorkommen;

  // Der Stichtag kommt als ISO-Zeitpunkt, die Feldwerte als ISO-Tag — auf
  // Tagesgranularität vergleichen, sonst gälte „heute" schon als Zukunft.
  const heute = stichtag.slice(0, 10);
  let letzteAktivitaet: string | null = null;
  let anstehend: AnstehenderTermin | null = null;
  for (const v of betrachtet) {
    const tag = tagVon(v);
    if (!tag) continue;
    if (tag > heute) {
      if (anstehend === null || tag < anstehend.tag) {
        anstehend = {
          tag,
          ...(v.feld.code ? { code: v.feld.code } : {}),
          label: v.feld.label,
        };
      }
      continue;
    }
    if (letzteAktivitaet === null || tag > letzteAktivitaet) letzteAktivitaet = tag;
  }
  return { letzteAktivitaet, anstehend };
}

/**
 * Beurteilt den Stillstand. Rein.
 */
export function pruefeStillstand(e: WaechterEingabe): WaechterErgebnis {
  const { letzteAktivitaet: genaehert, anstehend } = letzteAktivitaetVon(
    e.vorkommen, e.version, e.stichtag,
  );
  // Das Journal gewinnt, wo es etwas weiss: es kennt auch die Setzungen, die
  // der Export inzwischen ueberschrieben hat (V9). Wo es schweigt, bleibt die
  // Naeherung aus `max(D_)` — und sie wird als solche ausgewiesen.
  const belegt = typeof e.journalAenderung === 'string' && e.journalAenderung !== '';
  const letzteAktivitaet = belegt ? e.journalAenderung! : genaehert;
  const tage = letzteAktivitaet ? tageZwischen(letzteAktivitaet, e.stichtag) : null;
  const zieltage = zieltageFuer(e.version, e.statusCode);
  const paar = findePaar(e);

  // Stufe 2 zuerst befragen — sie liefert die Rolle, unabhängig vom Urteil.
  const rolle: Rolle | 'ast' | null = paar?.rolle
    ?? e.todo?.wartetAuf
    ?? e.todo?.zustaendig[0]
    ?? null;

  // Ein anstehender Termin erklärt einen Teil der Stille, ohne sie aufzuheben —
  // er gehört deshalb an jede Begründung, nie in die Liegezeit.
  const terminGrund = anstehend
    ? ` Anstehend am ${anstehend.tag}${anstehend.code ? ` (${anstehend.code})` : ''}: „${anstehend.label}".`
    : '';
  // „mindestens", wo genähert wird: das jüngste `D_`-Datum ist eine Untergrenze,
  // weil mehrfach gesetzte Kürzel nur das letzte Datum tragen (V9). Ohne dieses
  // Wort liest sich eine Schätzung wie eine Messung.
  const seit = belegt ? 'seit' : 'seit mindestens';

  if (zieltage === null) {
    return {
      urteil: 'unbewertet',
      letzteAktivitaet,
      belegt,
      anstehend,
      tage,
      zieltage: null,
      grund: (e.statusCode === null
        ? 'Status nicht im Katalog — kein Ziel bestimmbar.'
        : `Für Status ${e.statusCode} sind keine Zieltage definiert.`) + terminGrund,
      rolle,
      paar,
    };
  }
  if (letzteAktivitaet === null || tage === null) {
    return {
      urteil: 'unbewertet',
      letzteAktivitaet: null,
      belegt,
      anstehend,
      tage: null,
      zieltage,
      grund: 'Keine datierte Aktivität gefunden — Liegezeit nicht bestimmbar.' + terminGrund,
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
      belegt,
      anstehend,
      tage,
      zieltage,
      grund: `Keine Vorgangs-Aktivität ${seit} ${tage} Tagen, Ziel ${zieltage}.${paarGrund}${terminGrund}`,
      rolle,
      paar,
    };
  }

  return {
    urteil: 'ok',
    letzteAktivitaet,
    belegt,
    anstehend,
    tage,
    zieltage,
    grund: `Zuletzt vor ${belegt ? '' : 'mindestens '}${tage} Tagen aktiv, Ziel ${zieltage}.${terminGrund}`,
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
