/**
 * Die Filter-Achsen des Vorgangs-Boards — rein, ohne React, ohne Uhr.
 *
 * **Ein Prädikat je Achse**, und das ist der Punkt: die Trefferzahlen im Menü
 * einer Achse rechnen unter den *jeweils anderen* Filtern und lassen die eigene
 * Achse aus (Facetten-Semantik, wie in der Förderanträge-Sidebar). Ein
 * zusammengeschriebenes Gesamt-Prädikat könnte das nicht — dann zeigte „2023:
 * 0", sobald 2023 gerade nicht angehakt ist.
 *
 * **Leere Auswahl heißt „kein Filter"**, nicht „nichts". Herausgelöst aus
 * `useVorgangsBoard`, damit die eine neue Rechnung (die Zähler) prüfbar ist
 * statt behauptet.
 */
import type { AntragListItem } from '@/core/services/csv/types';
import type { WaechterUrteil, ZahPhase, ZahPhaseId } from '@/core/status';
import { fristLaeuftVon } from '@/core/status/zah-phasen';
import { isBegleitungStatus, isTerminalStatus } from '@/core/utils/status-canonical';
import { antragMatchesBearbeiter, type BearbeiterFilterMode } from '@/plugins/antraege/bearbeiterFilter';

/**
 * Was der Filter von einer Board-Zeile liest — bewusst schmaler als
 * `BoardZeile`. Das hält dieses Modul frei von einer Rück-Abhängigkeit auf den
 * Hook (kein Zyklus) und sagt zugleich, welche Felder überhaupt gefiltert
 * werden.
 */
export interface FilterbareZeile {
  /** Jahr des Antragseingangs; `''`, wenn kein Datum vorliegt. */
  jahr: string;
  /** Fördervariante als Klartext; `''`, wenn unbekannt. */
  variante: string;
  zahPhase: ZahPhaseId | null;
  waechter: { urteil: WaechterUrteil };
  filterRecord: AntragListItem;
}

/**
 * Die Kürzel-Spalten, die der Bearbeiter-Filter überhaupt anfasst
 * (`bearbeiterFilter.ts`: `BEARBEITER_FIELDS_LOWER` + `BEGLEITUNG_FIELDS_LOWER`
 * + die Rollen-Zuschnitte). Absichtlich hier dupliziert statt importiert: das
 * hielte dieses Modul sonst an einer Konstante fest, die dort privat ist — und
 * ein zusätzliches Kürzel hier zu viel kostet nichts, eines zu wenig würde vom
 * Convention-Test `board-filtersatz-deckt-kuerzel-spalten` gemeldet.
 */
const FILTER_SPALTEN: readonly string[] = [
  'status', 'tib_kuerz', 'bib_kuerz', 'bfm_kuerz', 'pfm_kuerz', 'ztp_kuerz',
];
const FILTER_SPALTEN_SET: ReadonlySet<string> = new Set(FILTER_SPALTEN);

/**
 * Der Antrags-Record, **auf die Filter-Spalten eingedampft**.
 *
 * Warum überhaupt: `BoardZeile.filterRecord` trug bis v4.103 den vollen
 * 461-Feld-Record (~36 KB). Über 12 000 Zeilen hielt das Board damit den ganzen
 * Bestand für seine Lebensdauer im Speicher fest — genau das, was `jederVorgang`
 * mit seinem Callback vermeiden wollte, und der Grund, warum ein Ergebnis-Cache
 * über Seitenwechsel hinweg vorher unbezahlbar war.
 *
 * **Gemischte Schreibweisen müssen mit.** `forEachKuerzelValue` durchsucht nicht
 * nur die Kleinbuchstaben-Keys, sondern läuft zusätzlich über ALLE Record-Keys
 * und prüft deren Kleinform — ein Mapping kann `ZTP_KUERZ` genauso ablegen wie
 * `ztp_kuerz`. Würde die Projektion nur die Kleinform kopieren, verschwänden
 * gemischt geschriebene Spalten still aus dem Filter. Der Preis dafür ist EIN
 * Durchlauf über die Record-Keys beim Bau — statt einem je Filter-Interaktion.
 */
export function schmalerFilterSatz(rec: Record<string, unknown>): AntragListItem {
  const out: Record<string, unknown> = {};
  for (const k of FILTER_SPALTEN) {
    const v = rec[k];
    if (typeof v === 'string') out[k] = v;
  }
  for (const key in rec) {
    if (FILTER_SPALTEN_SET.has(key)) continue;
    const lk = key.toLowerCase();
    if (lk === key || !FILTER_SPALTEN_SET.has(lk)) continue;
    const v = rec[key];
    if (typeof v === 'string') out[key] = v;
  }
  return out as unknown as AntragListItem;
}

/**
 * Läuft für diese Zeile die Antragsfrist?
 *
 * **Die Antwort steht im Katalog, nicht hier.** Bis v4.3 führte das Board eine
 * eigene Menge von vier Phasen-Ids — eine zweite Wahrheit neben
 * `fristLaeuft` an der Phase. Sobald die PL den Schnitt umhängt (Phase
 * umbenannt, geteilt, neu angelegt), traf die feste Menge daneben, ohne dass
 * irgendwo etwas fehlschlug.
 *
 * Die beiden Sonderfälle davor bleiben, weil sie am **Status** hängen und nicht
 * am Verfahrensschritt: terminal heißt fertig, und die Begleitphase hat ihre
 * eigene, echte VN-Frist (`computeFristDatum` liefert sie dort).
 *
 * Unbekannte oder verwaiste Phase → `true`, dieselbe Richtung wie
 * `fristLaeuftVon`: eine laufende Uhr ist sichtbar und korrigierbar, eine
 * stillschweigend angehaltene nimmt Arbeit aus jeder Liste.
 */
export function fristLaeuftFuer(
  zahPhase: ZahPhaseId | null, statusRoh: unknown, phasen?: readonly ZahPhase[],
): boolean {
  if (isTerminalStatus(statusRoh)) return false;
  if (isBegleitungStatus(statusRoh)) return true;
  return fristLaeuftVon(zahPhase, phasen);
}

/** Wie viele Jahrgänge die Vorbelegung umfasst (laufendes Jahr + die zwei davor). */
export const JAHRGAENGE = 3;

/**
 * Die konkreten Jahre der Vorbelegung, absteigend — aus dem übergebenen
 * Stichtag, nie aus einer Uhr im Modul.
 *
 * Konkrete Jahre statt einer Untergrenze: so stehen sie im Menü angekreuzt da
 * und der Nutzer sieht, *welche* drei gemeint sind. Fachlich gleichwertig zum
 * früheren `jahr >= grenzJahr` — Zeilen ohne Antragsdatum (`jahr === ''`)
 * fallen in beiden Fassungen raus.
 */
export function letzteDreiJahrgaenge(stichtagIso: string): string[] {
  const jetzt = new Date(stichtagIso).getUTCFullYear();
  return Array.from({ length: JAHRGAENGE }, (_, i) => String(jetzt - i));
}

/** Enthält die Auswahl einen Jahrgang vor der Vorbelegungs-Grenze? */
export function reichtInAltbestand(jahre: readonly string[], stichtagIso: string): boolean {
  // Leere Auswahl = alle Jahrgänge, also auch der Altbestand.
  if (jahre.length === 0) return true;
  const vorbelegung = letzteDreiJahrgaenge(stichtagIso);
  const grenze = vorbelegung[vorbelegung.length - 1] ?? '';
  return jahre.some(j => j < grenze);
}

export function passtJahr(z: FilterbareZeile, jahre: readonly string[]): boolean {
  return jahre.length === 0 || jahre.includes(z.jahr);
}

export function passtVariante(z: FilterbareZeile, varianten: readonly string[]): boolean {
  return varianten.length === 0 || varianten.includes(z.variante);
}

export function passtPhase(z: FilterbareZeile, phasen: readonly string[]): boolean {
  return phasen.length === 0 || phasen.includes(z.zahPhase ?? '');
}

/**
 * Die Achsen ohne eigenes Menü: „hängt fest" und der Kürzel-Filter. Sie stehen
 * in JEDER Facetten-Rechnung mit drin — auch ihre eigene Zahl wäre sonst eine
 * andere Grundmenge als die Liste darunter.
 */
export function passtRest(
  z: FilterbareZeile,
  nurHaengt: boolean,
  kuerzelModus: BearbeiterFilterMode,
): boolean {
  if (nurHaengt && z.waechter.urteil !== 'haengt') return false;
  return antragMatchesBearbeiter(z.filterRecord, kuerzelModus);
}

/**
 * Trefferzahlen je Wert über die übergebene Menge.
 *
 * Der Aufrufer reicht die Zeilen **ohne** den Filter der eigenen Achse herein —
 * darin liegt die Facetten-Semantik, nicht in dieser Funktion. Der leere
 * Schlüssel (`''`, kein Datum / keine Phase) zählt bewusst nicht mit: er hat
 * keinen Menü-Eintrag, an dem die Zahl stehen könnte.
 */
export function zaehleNach<T>(zeilen: readonly T[], schluessel: (z: T) => string): Map<string, number> {
  const zaehler = new Map<string, number>();
  for (const z of zeilen) {
    const k = schluessel(z);
    if (k === '') continue;
    zaehler.set(k, (zaehler.get(k) ?? 0) + 1);
  }
  return zaehler;
}
