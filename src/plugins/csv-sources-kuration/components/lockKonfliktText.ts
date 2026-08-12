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

import type { LockBesitz } from '@/core/services/infrastructure/build-lock';

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

const WARTE_HINWEIS = 'Bitte in 2-3 Min erneut versuchen.';

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
}): LockKonfliktAnzeige {
  const min = Math.round(input.ageMinutes);

  if (input.besitz === 'eigener-tab') {
    // Nach dem Umbau auf EINEN Lock je Lauf sollte das nicht mehr vorkommen —
    // wenn doch, ist es ein Befund und keine fremde Blockade.
    return {
      vorText:
        `Dieses Fenster hält noch einen Aktualisierungs-Lock aus einem früheren Lauf (seit ${min} Min). `
        + 'Er läuft in 2-3 Min von selbst ab.',
      name: null,
      nachText: '',
      kannUebernehmen: true,
      bestaetigung: null,
    };
  }

  if (input.besitz === 'gleicher-name') {
    return {
      vorText: 'Ein anderes Fenster unter deinem Namen (',
      name: input.blockingKurator,
      nachText: `) aktualisiert gerade (seit ${min} Min). ${WARTE_HINWEIS}`,
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
    nachText: ` aktualisiert gerade (seit ${min} Min). ${WARTE_HINWEIS}`,
    kannUebernehmen: true,
    bestaetigung: fremdBestaetigung(input.blockingKurator, min),
  };
}
