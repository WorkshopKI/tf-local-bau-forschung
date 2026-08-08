/**
 * Das VerlaufsBand auf der **Verbund-Detailseite** — dieselbe Bahn wie im
 * aufgeklappten Tabellenbereich, nur ohne „diese Zeile".
 *
 * Eine eigene Datei, weil die Detailseite den Hook anders füttert: dort gibt es
 * keine geklickte Zeile, also läuft `useZeilenVerlauf` mit `aktenzeichen: null`
 * über das ganze Vorhaben. Die Ableitung bleibt dieselbe — hier entsteht keine
 * zweite.
 *
 * **Keine eigene Breite mehr** (v3.32): die Bahn misst ihren Container selbst.
 * Eine zweite feste Zahl neben dem Rückfallwert des Bands erklärte nur noch,
 * wie breit der erste Rahmen ist — und der ist nach einem Wimpernschlag vorbei.
 */
import { useZeilenVerlauf } from '../ausklapp/useZeilenVerlauf';
import { useZeilenWaechter } from '../ausklapp/useZeilenWaechter';
import { leise } from '../ausklapp/SpurListe';
import { VerlaufsBand } from './VerlaufsBand';

export function VerbundBand({ verbundId, statusRoh, stichtag }: {
  verbundId: string;
  statusRoh?: string | null;
  /** ISO-Tag. */
  stichtag: string;
}): React.ReactElement {
  const daten = useZeilenVerlauf(verbundId, null, stichtag, true, statusRoh);
  // Dieselbe Rechnung, die das Fristen-Band der Seite anstellt (`VerbundFristenBand`):
  // hier gibt es keine gemeinsame Hülle, an der sie einmal hinge — beide Bauteile
  // ziehen ihren Zeilen-Zustand selbst. Sie bleibt deterministisch und rein, es
  // entsteht also keine zweite Wahrheit, nur eine zweite Auswertung.
  const waechter = useZeilenWaechter({
    version: daten.quelle.version,
    vorkommen: daten.vorkommen,
    statusRoh,
    stichtag,
    journalAenderung: daten.journalAb,
  });

  if (daten.laden) return <p className={leise}>Lädt …</p>;
  if (daten.spuren.length === 0) {
    return <p className={leise}>Kein Statuskatalog geladen — ohne ihn gibt es keine Bahn.</p>;
  }
  return (
    <VerlaufsBand
      spuren={daten.spuren}
      eigenes={verbundId}
      bezugsZeitpunkt={daten.bezugsZeitpunkt}
      fassung={daten.quelle.version === null ? null : `Fassung ${daten.quelle.version.version}`}
      journalAb={daten.journalAb}
      journalGenutzt={daten.journalGenutzt}
      // Die Seite zeigt IMMER das ganze Vorhaben — die Marke gehört deshalb an
      // die Verbundbahn, nie an eine der Teilvorhaben-Bahnen.
      haengtFest={waechter?.urteil === 'haengt' ? { art: 'verbund', id: verbundId } : null}
    />
  );
}
