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
  baueHerleitung, ladeTrigger, statusKurz, normalisiereWert,
  type Herleitung, type StatusKurz,
} from '@/core/status';
import { programmNummer } from './programmNummer';

/** Auf welcher Ebene ein Statuswert geführt wird. */
export type StatusEbene = 'verbund' | 'tv';

/** Ein abweichender Status der jeweils anderen Ebene. */
export interface AbweichendeEbene {
  ebene: StatusEbene;
  kurz: StatusKurz;
  /** Wie viele Teilvorhaben diesen Status tragen (bei `verbund` immer 1). */
  anzahl: number;
}

/** Höchstens so viele abweichende TV-Status einzeln zeigen; der Rest wird gezählt. */
const MAX_ABWEICHUNGEN = 3;

export interface HerleitungStand {
  laden: boolean;
  herleitung: Herleitung | null;
  /**
   * Die andere Ebene (Code, Text, ZAH-Phase) — nur die Werte, die vom erklärten
   * Status **abweichen**. Sie kommen aus `statusKurz` und kosten keinen zweiten
   * Lauf über die Vorkommen. Leer heißt „beide Ebenen sagen dasselbe".
   */
  abweichend: AbweichendeEbene[];
  /** Distinkte abweichende Werte, die `abweichend` nicht mehr zeigt. */
  weitere: number;
  fehler: string | null;
}

const LEER: HerleitungStand = {
  laden: false, herleitung: null, abweichend: [], weitere: 0, fehler: null,
};

/**
 * @param verbundId Verbund, dessen Status erklärt werden soll.
 * @param statusRoh Der angezeigte Statuswert (Rohtext aus dem Export).
 * @param aktiv     Erst `true` setzen, wenn die Erklärung sichtbar wird.
 * @param ebene     Welche Ebene `statusRoh` ist. Die andere liest der Hook aus
 *                  den ohnehin geladenen Records — die Listen-Projektion führt
 *                  den Verbund-Status nicht, und sie dafür zu erweitern hieße,
 *                  13 000 Zeilen für eine Popover-Zeile zu verbreitern.
 */
export function useHerleitung(
  verbundId: string | null, statusRoh: unknown, aktiv: boolean,
  ebene: StatusEbene = 'verbund',
): HerleitungStand {
  const storage = useStorage();
  const idb = storage.idb;
  const [stand, setStand] = useState<HerleitungStand>(LEER);
  // Merkt sich, wofür schon geladen wurde — ein erneutes Öffnen desselben
  // Popovers soll nicht wieder auf die IndexedDB gehen.
  const geladenFuer = useRef<string | null>(null);

  useEffect(() => {
    if (!aktiv || !verbundId) return;
    const schluessel = `${verbundId}|${String(statusRoh)}|${ebene}`;
    if (geladenFuer.current === schluessel) return;
    geladenFuer.current = schluessel;

    let abgebrochen = false;
    setStand({ ...LEER, laden: true });
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
        // Die andere Ebene. Verglichen wird der NORMALISIERTE Rohwert, nicht der
        // Code: zwei Schreibweisen desselben Codes sind derselbe Status und
        // sollen keine zweite Zeile erzeugen — ein Wert OHNE Code aber sehr wohl,
        // sonst fielen genau die unkuratierten Fälle unter den Tisch.
        const eigen = normalisiereWert(herleitung.statusRoh);
        const andereEbene: StatusEbene = ebene === 'verbund' ? 'tv' : 'verbund';
        const andereRohwerte = ebene === 'verbund'
          ? antraege.map(a => (typeof a.status === 'string' ? a.status : ''))
          : [typeof verbund?.status === 'string' ? verbund.status : ''];

        const proWert = new Map<string, { roh: string; anzahl: number }>();
        for (const roh of andereRohwerte) {
          const t = roh.trim();
          if (!t) continue;
          const k = normalisiereWert(t);
          if (k === eigen) continue;
          const vorhanden = proWert.get(k);
          if (vorhanden) vorhanden.anzahl++;
          else proWert.set(k, { roh: t, anzahl: 1 });
        }
        // Häufigster zuerst — bei einem Verbund mit vielen TVs ist der der
        // aussagekräftigste; bei Gleichstand alphabetisch, damit es reproduzierbar ist.
        const sortiert = [...proWert.values()]
          .sort((a, b) => b.anzahl - a.anzahl || a.roh.localeCompare(b.roh, 'de'));
        const abweichend: AbweichendeEbene[] = sortiert
          .slice(0, MAX_ABWEICHUNGEN)
          .map(x => ({ ebene: andereEbene, kurz: statusKurz(version, x.roh), anzahl: x.anzahl }));

        if (!abgebrochen) {
          setStand({
            laden: false, herleitung, abweichend,
            weitere: Math.max(0, sortiert.length - MAX_ABWEICHUNGEN),
            fehler: null,
          });
        }
      } catch (err) {
        if (abgebrochen) return;
        // Beim Fehlschlag darf nicht der alte Stand stehenbleiben — sonst
        // erklärte das Popover einen anderen Antrag als den geöffneten.
        geladenFuer.current = null;
        setStand({
          ...LEER,
          fehler: (err as Error).message ?? 'Erklärung konnte nicht geladen werden.',
        });
      }
    })();
    return () => { abgebrochen = true; };
  }, [idb, verbundId, statusRoh, aktiv, ebene]);

  return stand;
}
