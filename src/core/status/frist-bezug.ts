/**
 * Der **Bezugszeitpunkt** eines Vorgangs — bis wann seine Uhr gelaufen ist.
 *
 * **Warum das eine eigene Datei ist.** `baueVerlauf` verlangt ihn seit v3.17
 * ausdrücklich („bei entschiedenen Vorgängen das Entscheidungsdatum aus Phase 0,
 * nicht heute", [verlauf/index.ts](verlauf/index.ts)), und alle drei Aufrufer
 * reichten stattdessen den nackten Tagesstichtag durch. Solange der Verlauf eine
 * Liste war, fiel das kaum auf; als Bahn ist es der Unterschied zwischen einem
 * Altfall von 2018, dessen Schlusssegment am Entscheidungstag endet, und einem,
 * dessen letzter Status sich über acht Jahre streckt und die ganze Achse
 * verschluckt.
 *
 * Die Rechnung selbst ist **nicht neu** — sie stand wortgleich im Frist-Reiter.
 * Sie steht jetzt einmal da, damit Bahn, Liste und Bestandslauf denselben
 * Ausdruck lesen und nicht drei Fassungen desselben Gedankens.
 *
 * Importe an den Nachbarmodulen statt am Barrel `@/core/status` (Selbstbezug,
 * und `npm run cycles` hat eine leere Allowlist).
 */
import { berechneFrist, type FristErgebnis } from '@/core/services/csv/frist-ergebnis';
import { parseGermanDate } from '@/core/services/csv/dateParse';
import { ermittleHaltedatum, type Haltedatum } from './haltedatum';
import { statusHerleitungKopf } from './herleitung';
import type { FeldVorkommen } from './feld-aufloesung';
import type { MappingVersion } from './typen';

/** Jüngstes ISO-Datum dieses Codes über die gegebenen Vorkommen. */
function spaetestes(vorkommen: readonly FeldVorkommen[], code: string): string | null {
  let out: string | null = null;
  for (const v of vorkommen) {
    if (v.feld.typ !== 'datum' || v.feld.code !== code) continue;
    const iso = parseGermanDate(v.wert);
    if (iso !== null && (out === null || iso > out)) out = iso;
  }
  return out;
}

/**
 * Das Fristergebnis **samt seiner Eingaben**.
 *
 * Die Zwischenwerte stehen mit in der Ausgabe, weil der Frist-Reiter genau sie
 * anzeigt: „gerechnet ab D_AAE, weil D_XTE fehlt" ist die Auskunft, die eine
 * Fristangabe überhaupt nachprüfbar macht. Sie im Helfer zu verstecken hieße,
 * sie beim Aufrufer ein zweites Mal zu ermitteln.
 */
export interface FristBezug {
  ergebnis: FristErgebnis;
  /** `D_AAE` — Antragseingang. */
  antragsdatum: string | null;
  /** `D_XTE` — alle Anträge da. */
  alleAntraegeDa: string | null;
  /** `D_VBE` — Eingang Verwendungsnachweis. */
  vnEingangDatum: string | null;
  halt: Haltedatum | null;
  /** Bis wann die Achse läuft. Siehe {@link bezugsZeitpunktVon}. */
  bezugsZeitpunkt: string;
}

/**
 * Fristrechnung eines Vorgangs aus seinen Statusvorkommen.
 *
 * Die Eingangsdaten kommen über den **Code am Feld** (`feld.code`), nie als
 * `D_<code>`-Literal — die vier kanonischen Datumsfelder tragen ihren Code mit
 * (Pitfall #44).
 */
export function fristFuerVorkommen(
  version: MappingVersion,
  vorkommen: readonly FeldVorkommen[],
  statusRoh: unknown,
  stichtag: string,
): FristBezug {
  const kopf = statusHerleitungKopf(version, statusRoh);
  const halt = ermittleHaltedatum({ version, zahPhase: kopf.zahPhase, vorkommen });
  const antragsdatum = spaetestes(vorkommen, 'AAE');
  const alleAntraegeDa = spaetestes(vorkommen, 'XTE');
  const vnEingangDatum = spaetestes(vorkommen, 'VBE');
  const ergebnis = berechneFrist({
    status: statusRoh,
    antragsdatum,
    alleAntraegeDa,
    vnEingangDatum,
    haltedatum: halt?.tag ?? null,
    stichtag,
    ...(version.zahPhasen ? { phasen: version.zahPhasen } : {}),
  });
  return {
    ergebnis, antragsdatum, alleAntraegeDa, vnEingangDatum, halt,
    bezugsZeitpunkt: bezugsZeitpunktVon(ergebnis, stichtag),
  };
}

/**
 * Bis wann die Achse läuft: das Haltedatum bei angehaltener Uhr, sonst der
 * Stichtag.
 *
 * **Ein fehlendes Haltedatum fällt auf den Stichtag zurück, nicht auf „unklar".**
 * Der Zustand `angehalten` ohne Datum heißt „wir wissen nicht, wann sie stehen
 * blieb" — die Achse dort abzuschneiden erfände einen Zeitpunkt; sie bis heute
 * laufen zu lassen ist die schwächere, aber belegbare Aussage.
 */
export function bezugsZeitpunktVon(ergebnis: FristErgebnis, stichtag: string): string {
  return ergebnis.bezugsZeitpunkt ?? stichtag;
}

/** Nur der Bezugszeitpunkt — für Aufrufer, die die Frist selbst nicht zeigen. */
export function bezugsZeitpunktFuerVorkommen(
  version: MappingVersion,
  vorkommen: readonly FeldVorkommen[],
  statusRoh: unknown,
  stichtag: string,
): string {
  return fristFuerVorkommen(version, vorkommen, statusRoh, stichtag).bezugsZeitpunkt;
}
