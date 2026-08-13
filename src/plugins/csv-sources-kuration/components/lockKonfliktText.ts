/**
 * Wortlaut des Lock-Konflikts im CSV-Auto-Refresh-Banner.
 *
 * Rein (kein React, kein IO) — der Banner rendert nur, was hier entschieden
 * wird. Grund fuer die eigene Datei: bis v3.46.1 setzte der Banner den Namen aus
 * dem Lock hart als FREMD-Blockierer („THü (PL) aktualisiert gerade"). Bei
 * einem eigenen Ueberbleibsel beschuldigte er damit den Nutzer mit dessen
 * eigenem Namen — und riet ihm, 2-3 Minuten auf sich selbst zu warten.
 *
 * Dateiname bewusst mit eigenem Wortstamm (nicht `LockKonflikt.ts` neben einer
 * `.tsx`) — siehe CLAUDE.md „File Naming".
 */

import {
  staleThresholdForStufe, type LockBesitz,
} from '@/core/services/infrastructure/build-lock';

export interface LockKonfliktAnzeige {
  /** Text VOR dem hervorgehobenen Namen ('' wenn keiner vorangeht). */
  vorText: string;
  /** Fett zu setzender Name, oder `null` wenn der Text keinen Namen nennt. */
  name: string | null;
  /** Text NACH dem Namen. */
  nachText: string;
  /** „Trotzdem aktualisieren" anbieten? */
  kannUebernehmen: boolean;
  /**
   * Rueckfrage vor dem Uebernehmen — `null` heisst: ohne Rueckfrage uebernehmen.
   * Nur beim eigenen Ueberbleibsel ist das gefahrlos; bei jedem fremden Halter
   * bleibt die Warnung.
   */
  bestaetigung: string | null;
}

/**
 * Wie lange dauert es, bis DIESER Lock von selbst verfällt?
 *
 * Die Schwelle hängt an der Stufe: der CSV-Import räumt sich nach 3 Minuten ab
 * (`CSV_IMPORT_STALE_HEARTBEAT_MS`), jeder andere Vorgang erst nach 2 Stunden —
 * der Embedding-Korpus-Build läuft bis zu ~47 Minuten und darf nicht für tot
 * erklärt werden. Die pauschale Zusage „in 2-3 Min erneut versuchen" war
 * deshalb genau dann falsch, wenn sie am meisten wehtat.
 */
function warteHinweis(stufe: string | undefined): string {
  const min = Math.round(staleThresholdForStufe(stufe ?? '') / 60_000);
  return min <= 5
    ? `Bitte in ${min} Min erneut versuchen.`
    : `Der Lock gehört zu einem lang laufenden Vorgang und verfällt erst nach ${Math.round(min / 60)} h von selbst.`;
}

function fremdBestaetigung(wer: string, min: number): string {
  return (
    `„${wer}" hält den Aktualisierungs-Lock (seit ${min} Min).\n\n` +
    'Falls dort nichts mehr läuft (z.B. nach einem abgestürzten Tab), kannst du den Lock übernehmen. ' +
    'Läuft dort jedoch ein echter Import parallel, drohen Daten-Konflikte.\n\nTrotzdem jetzt aktualisieren?'
  );
}

export function beschreibeLockKonflikt(input: {
  besitz: LockBesitz;
  blockingKurator: string;
  ageMinutes: number;
  /** Stufe des blockierenden Locks — bestimmt, wann er von selbst verfällt. */
  stufe?: string;
}): LockKonfliktAnzeige {
  const min = Math.round(input.ageMinutes);
  const warte = warteHinweis(input.stufe);

  if (input.besitz === 'eigener-tab') {
    // `acquireBuildLock` liefert 'eigener-tab' NUR, wenn ein zweiter Flow in
    // DIESEM Fenster den Lock JETZT hält — ein echtes Überbleibsel wird
    // kommentarlos übernommen und erzeugt gar keinen Konflikt. Der frühere
    // Wortlaut behauptete das Gegenteil („aus einem früheren Lauf … läuft in
    // 2-3 Min von selbst ab") und übernahm ohne Rückfrage. Erreichbar u.a.
    // während des Embedding-Korpus-Builds (bis ~47 Min, Banner voll bedienbar).
    return {
      vorText: `In diesem Fenster läuft seit ${min} Min bereits eine Aktualisierung.`,
      name: null,
      nachText: '',
      kannUebernehmen: true,
      bestaetigung:
        `In diesem Fenster läuft seit ${min} Min bereits eine Aktualisierung — etwa ein Import `
        + 'in einem offenen Dialog oder der Aufbau des Suchindex.\n\n'
        + 'Wird der Lock übernommen, laufen beide Vorgänge gleichzeitig weiter; der zuerst '
        + 'fertige gibt den Lock frei, und der andere schreibt danach ungeschützt gegen andere '
        + 'Rechner.\n\nTrotzdem jetzt aktualisieren?',
    };
  }

  if (input.besitz === 'gleicher-name') {
    return {
      vorText: 'Ein anderes Fenster unter deinem Namen (',
      name: input.blockingKurator,
      nachText: `) aktualisiert gerade (seit ${min} Min). ${warte}`,
      kannUebernehmen: true,
      bestaetigung:
        `Ein anderes Fenster unter deinem Namen („${input.blockingKurator}") hält den `
        + `Aktualisierungs-Lock (seit ${min} Min).\n\n`
        + 'Ist dort wirklich nichts mehr offen? Läuft dort ein echter Import, drohen '
        + 'Daten-Konflikte.\n\nTrotzdem jetzt aktualisieren?',
    };
  }

  return {
    vorText: '',
    name: input.blockingKurator,
    nachText: ` aktualisiert gerade (seit ${min} Min). ${warte}`,
    kannUebernehmen: true,
    bestaetigung: fremdBestaetigung(input.blockingKurator, min),
  };
}
