/**
 * Die Löschregel des Bestands, an EINER Stelle.
 *
 * Fachliche Regel (Team-Entscheidung 2026-08-13): ein Antrag wird erst
 * gelöscht, wenn er in ALLEN Quellen verschwunden ist. Die Quellen reichen
 * unterschiedlich weit zurück — Master und Begleitung führen den Bestand bis
 * 2015, die Projektbeschreibung bis 2012. „Fehlt in diesem Export" ist deshalb
 * keine Aussage über die Existenz des Antrags, sondern über den Horizont der
 * Quelle.
 *
 * Geprüft wird gegen die **Row-Hashes** der anderen Quellen, nicht gegen deren
 * Dateien: die Hashes spiegeln exakt, was die Quelle bei ihrem letzten Import
 * getragen hat, und werden am Ende jedes Imports mitgezogen. Dadurch löst sich
 * der Rückhalt von selbst auf, sobald die letzte Quelle die Zeile fallen lässt
 * — auch innerhalb desselben Auto-Refresh-Laufs und unabhängig davon, in
 * welcher Reihenfolge die Quellen dran waren.
 *
 * Nur Quellen mit `join_key === 'aktenzeichen'` zählen: die Join-Werte der
 * verbund_id-/akronym-Quellen sind Verbund-Nummern und Akronyme, keine
 * Aktenzeichen — ihre Übereinstimmung wäre reiner Zufall.
 *
 * Bekannte Grenze: eine stillgelegte Quelle, die nie wieder importiert wird,
 * hält ihre Row-Hashes und damit ihre Anträge dauerhaft fest. Wer eine Quelle
 * ausser Betrieb nimmt, muss sie entfernen (`removeSchema`) — sonst altert der
 * Bestand nicht mehr.
 */

import type { IDBStore } from '../storage/idb-store';
import { getJoinValuesForSchema } from './idb-csv';
import type { CsvSchema } from './types';

export interface Loeschentscheidung {
  /** Von keiner anderen Quelle mehr getragen → darf weg. */
  zuLoeschen: string[];
  /** Eine andere Quelle führt die Zeile noch → bleibt (ggf. neu zusammengebaut). */
  gehalten: string[];
}

/**
 * Teilt Löschkandidaten danach, ob eine der `andereQuellen` sie noch trägt.
 *
 * `andereQuellen` sind die Quellen, die NACH dem auslösenden Vorgang übrig
 * bleiben — beim Import alle ausser der importierten, beim Umwandeln der
 * Demo-Quellen alle verbliebenen. Quellen ohne `aktenzeichen`-Join werden
 * ignoriert.
 */
export async function teileNachAbdeckung(
  idb: IDBStore,
  andereQuellen: readonly CsvSchema[],
  kandidaten: readonly string[],
): Promise<Loeschentscheidung> {
  const relevant = andereQuellen.filter(s => s.join_key === 'aktenzeichen');
  if (kandidaten.length === 0 || relevant.length === 0) {
    return { zuLoeschen: [...kandidaten], gehalten: [] };
  }

  const zuLoeschen: string[] = [];
  const gehalten: string[] = [];
  const offen = new Set(kandidaten);
  for (const s of relevant) {
    if (offen.size === 0) break;
    for (const jv of await getJoinValuesForSchema(idb, s.id)) {
      if (offen.delete(jv)) gehalten.push(jv);
    }
  }
  for (const jv of kandidaten) {
    if (offen.has(jv)) zuLoeschen.push(jv);
  }
  return { zuLoeschen, gehalten };
}
