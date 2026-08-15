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
import { useMemo } from 'react';
import type { Rolle } from '@/core/status';
import type { OffenesPaarJeTv } from '@/core/status';
import { useZeilenVerlauf } from '../ausklapp/useZeilenVerlauf';
import { useZeilenWaechter } from '../ausklapp/useZeilenWaechter';
import { leise } from '../ausklapp/SpurListe';
import type { BandLuecke } from './bandBeschriftung';
import { VerlaufsBand } from './VerlaufsBand';

export function VerbundBand({
  verbundId, statusRoh, stichtag, rollenWahl, bereichWahl, fokus, onFokus, offenePaare,
}: {
  verbundId: string;
  statusRoh?: string | null;
  /** ISO-Tag. */
  stichtag: string;
  /** Der geteilte Verlaufs-Filter der Detailseite — dieselbe Auswahl wie die Chronik. */
  rollenWahl?: ReadonlySet<Rolle>;
  bereichWahl?: ReadonlySet<string>;
  fokus?: string | null;
  onFokus?: (feldId: string | null) => void;
  /** Die halb offenen Kürzel-Paare, bereits nach Rolle und Träger gefiltert. */
  offenePaare?: readonly OffenesPaarJeTv[];
}): React.ReactElement {
  const daten = useZeilenVerlauf(verbundId, null, stichtag, true, statusRoh);
  // Der Zeilen-Zustand wird hier selbst gezogen: es gibt keine gemeinsame Hülle,
  // an der er einmal hinge. Die Rechnung bleibt deterministisch und rein, es
  // entsteht also keine zweite Wahrheit, nur eine zweite Auswertung.
  const waechter = useZeilenWaechter({
    version: daten.quelle.version,
    vorkommen: daten.vorkommen,
    statusRoh,
    stichtag,
    journalAenderung: daten.journalAenderung,
  });

  // Die Lücken je Teilvorhaben, wie die Bahn sie braucht: „… fehlt" an dem Tag,
  // seit dem die andere Seite gesetzt ist. Mehrere je Teilvorhaben sind der
  // Normalfall — verbunden werden sie erst, wenn sie auf denselben Tag fallen
  // (`bandBeschriftung.ts`).
  const luecken = useMemo(() => {
    const out = new Map<string, BandLuecke[]>();
    for (const p of offenePaare ?? []) {
      const liste = out.get(p.tvId) ?? [];
      liste.push({ seit: p.seit, text: `${p.fehltLabel} fehlt` });
      out.set(p.tvId, liste);
    }
    return out;
  }, [offenePaare]);

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
      {...(rollenWahl ? { rollenWahl } : {})}
      {...(bereichWahl ? { bereichWahl } : {})}
      fokus={fokus ?? null}
      {...(onFokus ? { onFokus } : {})}
      luecken={luecken}
      zeigeBilanz
    />
  );
}
