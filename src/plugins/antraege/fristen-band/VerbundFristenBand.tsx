/**
 * Das {@link FristenBand} auf der **Verbund-Detailseite**.
 *
 * Eine schlanke Hülle über `useZeilenVerlauf` — dasselbe Bauteil und dieselbe
 * eine Rechnung wie im Ausklappbereich der Tabelle. Ohne Aktenzeichen (`null`)
 * gilt „das ganze Vorhaben": alle Teilvorhaben zählen, und die Frist hängt am
 * Verbund-Status.
 *
 * **Die Meilensteine bleiben beim Nachbarn.** `MeilensteinSection` zeigt den
 * vollen Plan; das Band nennt nur Prognose, Gerissenes und die nächsten
 * Schritte. Beides doppelt zu zeigen machte die Seite länger, nicht klarer —
 * deshalb bekommt das Band hier keine Bewertung hereingereicht.
 */
import { useZeilenVerlauf } from '../ausklapp/useZeilenVerlauf';
import { FristenBand } from './FristenBand';
import { useFristenBandModell } from './useFristenBand';

const leise = 'text-[11.5px] text-[var(--tf-text-tertiary)]';

export function VerbundFristenBand({ verbundId, statusRoh, stichtag }: {
  verbundId: string;
  statusRoh: unknown;
  /** ISO — einmal je Seitenaufruf gestempelt, nie hier drin geholt. */
  stichtag: string;
}): React.ReactElement | null {
  const daten = useZeilenVerlauf(verbundId, null, stichtag.slice(0, 10), true, statusRoh);
  const modell = useFristenBandModell({
    version: daten.quelle.version,
    frist: daten.frist,
    vorkommen: daten.vorkommen,
    statusRoh,
    stichtag: stichtag.slice(0, 10),
    journalAenderung: daten.journalAb,
    meilensteine: null,
  });
  if (daten.laden) return <p className={leise}>Lädt …</p>;
  if (modell === null) return null;
  return <FristenBand modell={modell} meilensteine={null} knoten={[]} />;
}
