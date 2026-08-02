/**
 * Lädt die Status-Erklärung eines Verbunds — **erst wenn sie gebraucht wird**.
 *
 * Das Info-Icon sitzt an jeder Status-Anzeige, auch in einer Liste mit 13 000
 * Zeilen. Würde jede Zeile beim Rendern ihren Verbund, seine Teilvorhaben und
 * die Programm-Schemas nachladen, stünde die Tabelle. Deshalb: der Hook tut
 * nichts, solange `aktiv` false ist, und lädt genau einmal, wenn das Popover
 * aufgeht.
 *
 * Der Stichtag wird beim Laden EINMAL gestempelt und in die reine
 * `baueHerleitung` injiziert — nie eine Uhr in der Berechnung.
 */
import { useEffect, useRef, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import {
  getVerbund, listAntraegeByVerbund, listSchemasByProgramm,
} from '@/core/services/csv/idb-csv';
import {
  getAktiveVersion, ladeAktiveVersion, baueFeldAufloesung, sammleVorkommen,
  baueHerleitung, ladeTrigger,
  type Herleitung,
} from '@/core/status';
import { programmNummer } from './programmNummer';

export interface HerleitungStand {
  laden: boolean;
  herleitung: Herleitung | null;
  fehler: string | null;
}

const LEER: HerleitungStand = { laden: false, herleitung: null, fehler: null };

/**
 * @param verbundId Verbund, dessen Status erklärt werden soll.
 * @param statusRoh Der angezeigte Statuswert (Rohtext aus dem Export).
 * @param aktiv     Erst `true` setzen, wenn die Erklärung sichtbar wird.
 */
export function useHerleitung(
  verbundId: string | null, statusRoh: unknown, aktiv: boolean,
): HerleitungStand {
  const storage = useStorage();
  const idb = storage.idb;
  const [stand, setStand] = useState<HerleitungStand>(LEER);
  // Merkt sich, wofür schon geladen wurde — ein erneutes Öffnen desselben
  // Popovers soll nicht wieder auf die IndexedDB gehen.
  const geladenFuer = useRef<string | null>(null);

  useEffect(() => {
    if (!aktiv || !verbundId) return;
    const schluessel = `${verbundId}|${String(statusRoh)}`;
    if (geladenFuer.current === schluessel) return;
    geladenFuer.current = schluessel;

    let abgebrochen = false;
    setStand({ laden: true, herleitung: null, fehler: null });
    void (async () => {
      try {
        const version = getAktiveVersion() ?? await ladeAktiveVersion(idb);
        const [verbund, antraege, triggerStand] = await Promise.all([
          getVerbund(idb, verbundId),
          listAntraegeByVerbund(idb, verbundId),
          ladeTrigger(idb),
        ]);
        if (abgebrochen) return;

        // Die Code-Felder tragen den rohen Spaltennamen; wo die Spalte im Record
        // liegt, weiß erst das Programm-Schema (recurring-bug-classes Klasse 5).
        const programmId = verbund?.programm_id ?? antraege[0]?.programm_id ?? null;
        const schemas = programmId ? await listSchemasByProgramm(idb, programmId) : [];
        if (abgebrochen) return;

        const aufloesung = baueFeldAufloesung(schemas, version.felder);
        const vbRecord = (verbund ?? {}) as unknown as Record<string, unknown>;
        const tvs = antraege.map(a => ({
          aktenzeichen: a.aktenzeichen, record: a as unknown as Record<string, unknown>,
        }));

        // Der jüngste Import über alle beteiligten Schemas — das ist der
        // Datenstand, auf den sich die Erklärung beruft.
        const importiertAm = schemas
          .map(s => s.last_imported_at)
          .filter((d): d is string => typeof d === 'string' && d.length > 0)
          .sort()
          .pop() ?? null;

        const herleitung = baueHerleitung({
          version,
          vorkommen: sammleVorkommen(version.felder, vbRecord, tvs, aufloesung),
          statusRoh,
          trigger: triggerStand.datei?.trigger ?? [],
          programm: programmNummer(antraege),
          stichtag: new Date().toISOString(),
          datenstand: {
            importiertAm,
            katalogVersion: version.version,
            triggerVersion: triggerStand.datei?.version ?? null,
            triggerHerkunft: triggerStand.herkunft,
          },
        });
        if (!abgebrochen) setStand({ laden: false, herleitung, fehler: null });
      } catch (err) {
        if (abgebrochen) return;
        // Beim Fehlschlag darf nicht der alte Stand stehenbleiben — sonst
        // erklärte das Popover einen anderen Antrag als den geöffneten.
        geladenFuer.current = null;
        setStand({
          laden: false, herleitung: null,
          fehler: (err as Error).message ?? 'Erklärung konnte nicht geladen werden.',
        });
      }
    })();
    return () => { abgebrochen = true; };
  }, [idb, verbundId, statusRoh, aktiv]);

  return stand;
}
