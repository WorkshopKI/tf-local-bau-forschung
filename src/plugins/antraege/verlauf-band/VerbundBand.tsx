/**
 * Das VerlaufsBand auf der **Verbund-Detailseite** — dieselbe Bahn wie im
 * aufgeklappten Tabellenbereich, nur ohne „diese Zeile".
 *
 * Eine eigene Datei, weil die Detailseite den Hook anders füttert: dort gibt es
 * keine geklickte Zeile, also läuft `useZeilenVerlauf` mit `aktenzeichen: null`
 * über das ganze Vorhaben. Die Ableitung bleibt dieselbe — hier entsteht keine
 * zweite.
 */
import { useZeilenVerlauf } from '../ausklapp/useZeilenVerlauf';
import { JournalFuss, leise } from '../ausklapp/SpurListe';
import { VerlaufsBand } from './VerlaufsBand';

export function VerbundBand({ verbundId, statusRoh, stichtag }: {
  verbundId: string;
  statusRoh?: string | null;
  /** ISO-Tag. */
  stichtag: string;
}): React.ReactElement {
  const daten = useZeilenVerlauf(verbundId, null, stichtag, true, statusRoh);

  if (daten.laden) return <p className={leise}>Lädt …</p>;
  if (daten.spuren.length === 0) {
    return <p className={leise}>Kein Statuskatalog geladen — ohne ihn gibt es keine Bahn.</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      <VerlaufsBand
        spuren={daten.spuren}
        eigenes={verbundId}
        bezugsZeitpunkt={daten.bezugsZeitpunkt}
        breite={760}
        fassung={daten.quelle.version === null ? null : `Fassung ${daten.quelle.version.version}`}
        journalAb={daten.journalAb}
      />
      <JournalFuss journalAb={daten.journalAb} journalGenutzt={daten.journalGenutzt} />
    </div>
  );
}
