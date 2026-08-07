/**
 * **Wann kam der Vorgang in den Status, in dem er heute steht?**
 *
 * Die Verlaufsableitung weiß es, seit sie Übergänge datiert — und für einen
 * angehaltenen Vorgang ist genau das sein Haltedatum. Bis dahin waren nur zwei
 * Quellen da: das Journal (erst ab seinem Nullpunkt, im Bestand Tage alt) und
 * ein Datumsfeld derselben ZAH-Phase (an der Phase eines Endstatus hängt keines).
 * Die Anzeige sagte deshalb ehrlich „Haltedatum unbekannt — nicht geraten".
 *
 * **Nur die letzte Kante, kein zweiter Verlauf.** `baueUebergaenge` nimmt den
 * `bezugsZeitpunkt` gar nicht entgegen — nur `baueSegmente` tut das. Die
 * Übergänge sind also berechenbar, BEVOR die Frist gerechnet ist, und ein
 * Verlauf, der mit dem Stichtag statt dem Haltedatum lief, trägt dieselben
 * Übergänge wie der endgültige. Damit gibt es weder einen Zyklus noch einen
 * Wegwerf-Zwischenstand, den jemand versehentlich anzeigt.
 *
 * **Der Endstatus muss zusammenpassen.** Erklärt die Ableitung den importierten
 * Status nicht (`VerlaufsAbweichung`), kommt `null` — ein Datum von der letzten
 * Kante wäre dann eine Aussage über einen ANDEREN Status. Pitfall #44: die App
 * leitet keinen Status ab, sie datiert nur den importierten.
 *
 * Rein und deterministisch: keine IO, keine Uhr.
 */
import type { VerlaufHalt } from '../haltedatum';
import type { SpurArt, VerlaufsSpur, VerlaufsUebergang } from './typen';

/**
 * Der Zeitpunkt, zu dem der Vorgang seinen heutigen Status angenommen hat.
 *
 * Von hinten gelesen: die letzte Kante muss den geltenden Status setzen, sonst
 * `null`. Trifft sie ihn, wird die zusammenhängende Schlussfolge derselben
 * Zielcodes zurückverfolgt und deren **erster** Tag genommen — wer dreimal
 * hintereinander in denselben Status gesetzt wird, steht seit dem ersten Mal
 * darin, nicht seit dem letzten.
 *
 * Die Konfidenz ist die der **datierenden** Kante: sie trägt das Datum.
 */
export function haltedatumAusUebergaengen(
  uebergaenge: readonly VerlaufsUebergang[], statusCode: number | null,
): VerlaufHalt | null {
  if (statusCode === null) return null;
  const setzend = uebergaenge.filter(u => u.setztStatus !== undefined);
  if (setzend.length === 0) return null;

  const letzter = setzend[setzend.length - 1]!;
  if (letzter.setztStatus?.code !== statusCode) return null;

  let i = setzend.length - 1;
  while (i > 0 && setzend[i - 1]!.setztStatus?.code === statusCode) i--;
  const eintritt = setzend[i]!;
  if (eintritt.datum === '') return null;

  // `zeitliche_naehe` und `kein_kuerzel` können hier nicht stehen: beide setzen
  // keinen Status, sind also schon oben herausgefallen.
  const konfidenz = eintritt.konfidenz === 'trigger_bestaetigt'
    ? 'trigger_bestaetigt' as const
    : 'trigger_bedingt' as const;

  return {
    tag: eintritt.datum,
    konfidenz,
    kuerzel: eintritt.kuerzel,
    code: statusCode,
  };
}

/**
 * Dasselbe aus fertigen Spuren — **aus der Spur, deren Status die Frist trägt**.
 *
 * Die Ebene ist Pflicht und wird nicht geraten: eine Verbundzeile rechnet ihre
 * Frist aus dem Verbundstatus, eine Teilvorhaben-Zeile aus ihrem eigenen. Die
 * Spur des Nachbarn zu nehmen datierte den Status eines anderen Vorgangs.
 */
export function haltedatumAusSpuren(
  spuren: readonly VerlaufsSpur[], art: SpurArt, id: string, statusCode: number | null,
): VerlaufHalt | null {
  const spur = spuren.find(s => s.art === art && s.id === id);
  return spur ? haltedatumAusUebergaengen(spur.uebergaenge, statusCode) : null;
}
