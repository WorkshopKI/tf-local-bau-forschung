/**
 * Die Kategorie-Referenzen aus den EIGENEN Klassifizierungen nachziehen.
 *
 * **Warum es das ueberhaupt gibt.** Die Referenzen (`referenzEmbedding` je
 * Ueberkategorie) sind Mittelwerte ueber die Verbund-Vektoren der bereits
 * klassifizierten Verbuende. Sie liegen NICHT im Embedding-Korpus, sondern in
 * `_intern/auslastung.json` — und zwei Umgebungen mit getrennten Daten-Shares
 * (Entwicklung hier, Citrix dort) teilen diese Datei nicht. Gerechnet wurden
 * sie bis v6.24 ausschliesslich als letzte Phase eines Korpus-BAUS. Wer den
 * Korpus holte statt ihn zu bauen — der Normalfall auf jedem zweiten Rechner —
 * bekam sie deshalb nie, und die Themen-Erkennung blieb stumm. Die Karte in
 * „Suche & Index" sagte trotzdem „synchron", weil die Vektoren ja da waren.
 *
 * Die Rechnung selbst braucht **kein Modell und keine Grafikkarte**: sie
 * mittelt vorhandene Vektoren. Auf einer Citrix-Sitzung ohne GPU ist das der
 * Unterschied zwischen Sekunden und einem halben Tag.
 *
 * Drei Aufrufer, ein Weg: der Korpus-Bau (er hat die Vektoren gerade erzeugt),
 * das Laden vom Datenspeicher, und der Knopf im Hinweis „Kategorie-Referenzen
 * fehlen" in der Klassifizierung.
 */
import { useCallback } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useActiveProgramm } from '@/core/hooks/useActiveProgramm';
import { listAntraegeByProgramm } from '@/core/services/csv/idb-csv';
import type { Antrag } from '@/core/services/csv/types';
import { useAuslastungData } from './useAuslastungData';
import { loadAllVerbundEmbeddings } from '../services/matching';
import {
  computeKategorieCentroidsFromVerbund,
  uebernimmKategorieReferenzen,
  type ReferenzErgebnis,
} from '../services/klassifizierung';
import type { AuslastungConfig } from '../types';

export type { ReferenzErgebnis };

/**
 * Liefert die Nachzieh-Funktion.
 *
 * `antraege` darf `null` sein — dann laedt sie die Records selbst; der
 * Korpus-Bau reicht seine bereits geladene Liste durch, statt 14.000 Records
 * ein zweites Mal in den Speicher zu holen.
 *
 * `zusatz` erlaubt es dem Bau, seinen Zeitstempel im SELBEN `setState` +
 * `persist` mitzuschreiben (Pitfall #16/#20).
 */
export function useKategorieReferenzen(): (
  antraege: Antrag[] | null,
  zusatz?: Partial<AuslastungConfig>,
) => Promise<ReferenzErgebnis> {
  const storage = useStorage();
  const programmId = useActiveProgramm(s => s.activeProgrammId);
  const klassifizierungen = useAuslastungData(s => s.data.klassifizierungen);
  const kategorien = useAuslastungData(s => s.data.config.ueberKategorien);
  const persist = useAuslastungData(s => s.persist);

  return useCallback(async (antraege, zusatz): Promise<ReferenzErgebnis> => {
    const records = antraege
      ?? (programmId ? await listAntraegeByProgramm(storage.idb, programmId) : []);
    const verbundEmbs = await loadAllVerbundEmbeddings(storage.idb);
    const zentren = computeKategorieCentroidsFromVerbund(
      klassifizierungen, verbundEmbs, kategorien, records,
    );

    let uebernahme = uebernimmKategorieReferenzen(kategorien, zentren);
    // Nichts zu uebernehmen UND nichts mitzuschreiben → gar nicht erst
    // schreiben. Ein leerer Lauf darf den Stand des Teams nicht anfassen.
    if (uebernahme.unveraendert && !zusatz) {
      return { art: 'leer', vorhanden: uebernahme.uebernommen };
    }

    // Ein setState, ein persist (Pitfall #16/#20). Die Uebernahme rechnet im
    // Updater noch einmal auf dem FRISCHEN Stand statt auf dem vom Rendern.
    useAuslastungData.setState(state => {
      uebernahme = uebernimmKategorieReferenzen(state.data.config.ueberKategorien, zentren);
      return {
        data: {
          ...state.data,
          config: { ...state.data.config, ueberKategorien: uebernahme.kategorien, ...zusatz },
        },
      };
    });

    try {
      await persist(storage);
    } catch (err) {
      return {
        art: 'nicht-gespeichert',
        uebernommen: uebernahme.uebernommen,
        grund: err instanceof Error ? err.message : String(err),
      };
    }
    return uebernahme.unveraendert
      ? { art: 'leer', vorhanden: uebernahme.uebernommen }
      : { art: 'geschrieben', uebernommen: uebernahme.uebernommen, gesamt: uebernahme.kategorien.length };
  }, [storage, programmId, klassifizierungen, kategorien, persist]);
}
