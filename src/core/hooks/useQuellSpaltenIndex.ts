/**
 * Der Quellspalten-Index über die Schemas ALLER Programme — für Tooltips, die
 * erklären, aus welchen CSV-Spalten ein Wert kommt.
 *
 * Alle Programme, nicht nur das aktive: Meilenstein-Plan und To-do-Regeln
 * gelten programmübergreifend, und genau die Lücke „Programm X mappt das Feld
 * nicht" ist eine der Aussagen des Tooltips.
 *
 * Geladen wird beim Einhängen — dieselbe Hausform wie `useSpaltenKontext`. Die
 * Tooltip-Inhalte hängen sich erst beim Überfahren ein; eine Liste mit tausend
 * Zeilen liest deshalb nichts, bis jemand hinsieht.
 *
 * Ein Lesefehler wird gemeldet, nicht zu „keine Quellspalte" geglättet: das
 * wäre eine falsche Aussage über das Mapping.
 */
import { useEffect, useState } from 'react';
import { useStorage } from './useStorage';
import { listProgramme, listSchemasByProgramm } from '@/core/services/csv/idb-csv';
import {
  baueQuellSpaltenIndex, type QuellSpaltenIndex,
} from '@/core/services/csv/spalten-inventar';

export interface QuellSpaltenLage {
  index: QuellSpaltenIndex | null;
  fehler: string | null;
}

export function useQuellSpaltenIndex(): QuellSpaltenLage {
  const idb = useStorage().idb;
  const [lage, setLage] = useState<QuellSpaltenLage>({ index: null, fehler: null });

  useEffect(() => {
    let abgebrochen = false;
    void (async () => {
      try {
        const programme = await listProgramme(idb);
        const schemas = (await Promise.all(programme.map(p => listSchemasByProgramm(idb, p.id)))).flat();
        if (!abgebrochen) setLage({ index: baueQuellSpaltenIndex(schemas), fehler: null });
      } catch (err) {
        if (!abgebrochen) setLage({ index: null, fehler: err instanceof Error ? err.message : String(err) });
      }
    })();
    return () => { abgebrochen = true; };
  }, [idb]);

  return lage;
}
