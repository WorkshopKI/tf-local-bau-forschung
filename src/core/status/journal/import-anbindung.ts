/**
 * Die Brücke zwischen CSV-Import und Journal.
 *
 * Sie entscheidet drei Dinge, und zwar sichtbar an einer Stelle:
 *
 * 1. **Nur der Master-Export.** Die `D_`-Spalten stehen im Nacht-Export; eine
 *    Nebenquelle mit denselben Spaltennamen würde denselben Antrag ein zweites
 *    Mal beschreiben.
 * 2. **Der Bereich kommt aus der TEAM-Kuration** (`bereichsProgramme` der
 *    aktiven Katalog-Fassung), nie aus der persönlichen Auswahl. Sonst
 *    entschiede die Einstellung eines Rechners über den Inhalt einer geteilten
 *    Datei — und zwei Rechner schrieben abwechselnd verschiedene Stände.
 * 3. **Der Stempel wird VOR dem Import geprüft.** Ein unveränderter Export
 *    kostet dann einen Hash und nichts weiter.
 */
import type { IDBStore } from '@/core/services/storage/idb-store';
import type { CsvSchema } from '@/core/services/csv/types';
import { findJoinColumn } from '@/core/services/csv/merger/helpers';
import { bereichsProgramme, bereichsMenge, istImBereich } from '../betrachtungsbereich';
import { getAktiveVersion } from '../snapshot';
import { baueJournalFelder } from './felder';
import { projiziereExport } from './projektion';
import { berechneStempel } from './stempel';
import { leseStand } from './stand';
import { laufeJournal, type LaufErgebnis } from './lauf';
import type { Stempel } from './typen';

/** Die Spalte, aus der die Programm-Nummer kommt (`FM_NUMMER` → Bereich). */
const PROGRAMM_SPALTEN = ['FM_NUMMER', 'FM_NR', 'UNTERPROGRAMM'];

function findeProgrammSpalte(headers: readonly string[]): string | null {
  for (const h of headers) {
    if (PROGRAMM_SPALTEN.includes(h.trim().toUpperCase())) return h;
  }
  return null;
}

/**
 * Ist dieser Stempel schon verarbeitet? Ohne den vollen Lauf.
 *
 * Erlaubt dem Aufrufer, den Parse-Durchgang gar nicht erst zu bezahlen, wenn
 * der Export unverändert ist (Wochenende, zweiter Rechner, erneuter Lauf).
 */
export async function stempelBekannt(idb: IDBStore, stempel: Stempel): Promise<boolean> {
  const stand = await leseStand(idb);
  return stand !== null && stand.verarbeitet.includes(stempel.id);
}

export interface AnbindungsErgebnis extends LaufErgebnis {
  stempel: Stempel;
}

/**
 * Der Journal-Schritt für einen importierten Export.
 *
 * @param datei  Die Export-Datei (für den Stempel).
 * @param schema Das Schema der Quelle — nur `is_master` wird journalisiert.
 * @param zeilen Die rohen, geparsten Zeilen.
 * @param headers Der Spaltenkopf.
 * @returns `null`, wenn die Quelle nicht journalisiert wird.
 */
export async function journalisiereImport(
  idb: IDBStore,
  datei: Blob & { lastModified?: number },
  schema: CsvSchema,
  zeilen: readonly Record<string, string>[],
  headers: readonly string[],
): Promise<AnbindungsErgebnis | null> {
  if (!schema.is_master) return null;
  const joinSpalte = findJoinColumn(schema);
  if (!joinSpalte) return null;

  const felder = baueJournalFelder(headers);
  if (felder.length === 0) return null;

  // Team-Kuration, nicht die persönliche Auswahl (siehe Modulkopf).
  const programme = bereichsProgramme(getAktiveVersion());
  const menge = bereichsMenge(programme);
  const programmSpalte = findeProgrammSpalte(headers);

  const werte = projiziereExport(zeilen, felder, joinSpalte, zeile => (
    // Ohne Programm-Spalte kann nicht gefiltert werden — dann zählt alles.
    // Stillschweigend die Hälfte wegzulassen wäre schlimmer als eine große Datei.
    programmSpalte === null || istImBereich(zeile[programmSpalte], menge)
  ));

  const stempel = await berechneStempel(datei);
  const ergebnis = await laufeJournal(idb, { stempel, werte, bereich: [...programme] });
  return { ...ergebnis, stempel };
}
