/**
 * Zustand und IO der Einreichungsliste.
 *
 * Hält Liste, Auswahl und den Report der ausgewählten Einreichung. Die eigentliche
 * Umwandlung passiert in der reinen `importiereEinreichung` — hier kommen nur
 * Datei-Lesen, Persistenz und Auswahl dazu.
 */
import { useCallback, useEffect, useState } from 'react';
import { useMeinKuerzel } from '@/core/hooks/useMeinKuerzel';
import { useStorage } from '@/core/hooks/useStorage';
import { importiereEinreichung } from './import/adapter';
import {
  deleteEinreichung, findeNachQuellHash, getReport, listeEinreichungen, putEinreichung,
} from './store';
import type { MapEinreichung, MapImportReport } from './types';

export interface UseMapEinreichungenResult {
  einreichungen: MapEinreichung[];
  ausgewaehlt: MapEinreichung | null;
  report: MapImportReport | null;
  laedt: boolean;
  /** Meldung des letzten Imports — auch im Erfolgsfall (z. B. „ersetzt"). */
  importMeldung: string | null;
  waehle: (id: string | null) => void;
  importiere: (datei: File) => Promise<void>;
  entferne: (id: string) => Promise<void>;
}

export function useMapEinreichungen(): UseMapEinreichungenResult {
  const storage = useStorage();
  const kuerzel = useMeinKuerzel();
  const [einreichungen, setEinreichungen] = useState<MapEinreichung[]>([]);
  const [ausgewaehltId, setAusgewaehltId] = useState<string | null>(null);
  const [report, setReport] = useState<MapImportReport | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [importMeldung, setImportMeldung] = useState<string | null>(null);

  useEffect(() => {
    let abgebrochen = false;
    void (async () => {
      const liste = await listeEinreichungen(storage.idb);
      if (abgebrochen) return;
      setEinreichungen(liste);
      setLaedt(false);
    })();
    return () => { abgebrochen = true; };
  }, [storage.idb]);

  // Report folgt der Auswahl — er ist gross und wird nicht auf Vorrat geladen.
  useEffect(() => {
    let abgebrochen = false;
    if (ausgewaehltId === null) { setReport(null); return; }
    void (async () => {
      const r = await getReport(storage.idb, ausgewaehltId);
      if (!abgebrochen) setReport(r);
    })();
    return () => { abgebrochen = true; };
  }, [storage.idb, ausgewaehltId]);

  const importiere = useCallback(async (datei: File): Promise<void> => {
    const rohText = await datei.text();
    const antwort = importiereEinreichung(rohText, {
      dateiname: datei.name,
      importiertVon: kuerzel ?? null,
      importiertAm: new Date().toISOString(),
    });

    if (!antwort.ok) throw new Error(antwort.fehler);

    // Idempotenz: dieselbe Datei erneut abgelegt aktualisiert den Bestand,
    // statt eine zweite Einreichung anzulegen.
    const bekannt = await findeNachQuellHash(storage.idb, antwort.einreichung.quellHash);

    await putEinreichung(storage.idb, antwort.einreichung, antwort.report);
    setEinreichungen(await listeEinreichungen(storage.idb));
    setAusgewaehltId(antwort.einreichung.id);
    setImportMeldung(
      bekannt !== null
        ? `„${datei.name}" war bereits importiert — der Stand wurde ersetzt.`
        : null,
    );
  }, [storage.idb, kuerzel]);

  const entferne = useCallback(async (id: string): Promise<void> => {
    await deleteEinreichung(storage.idb, id);
    setEinreichungen(await listeEinreichungen(storage.idb));
    setAusgewaehltId(vorher => (vorher === id ? null : vorher));
  }, [storage.idb]);

  const waehle = useCallback((id: string | null): void => {
    setAusgewaehltId(id);
    setImportMeldung(null);
  }, []);

  return {
    einreichungen,
    ausgewaehlt: einreichungen.find(e => e.id === ausgewaehltId) ?? null,
    report,
    laedt,
    importMeldung,
    waehle,
    importiere,
    entferne,
  };
}
