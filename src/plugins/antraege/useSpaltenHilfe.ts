/**
 * Lädt die Grundlage für die Spalten-Herkunft: die Schemas des aktiven
 * Programms und die daraus aufgelösten Ordner-Spalten des Statuskatalogs.
 *
 * Der Lade-Effekt ist hier die Hausform — dieselbe wie in `useHerleitung` und
 * `useStatusVerlauf`: die Schemas liegen in IndexedDB, nicht im Speicher, und
 * sie wechseln mit dem Programm. Gelesen wird EINMAL je Programmwechsel; die
 * fertige Karte reicht `AntraegeMain` an Picker und Tabelle weiter, statt sie
 * an beiden Stellen erneut zu bauen.
 *
 * Ohne geladenes Programm bleibt die Karte nicht leer, sondern trägt die Sätze
 * ohne Feldlisten — eine Erklärung ohne Belege ist besser als keine.
 */
import { useEffect, useMemo, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useActiveProgramm } from '@/core/hooks/useActiveProgramm';
import { listSchemasByProgramm } from '@/core/services/csv/idb-csv';
import type { CsvSchema } from '@/core/services/csv/types';
import type { ResolvedKategorieSpalten } from '@/core/services/csv/status-datum-gruppen';
import { isStatusCockpitEnabled } from '@/config/feature-flags';
import { getAktiveVersion, kategorienMitDatumsfeldern } from '@/core/status';
import { loeseKategorieSpalten } from '@/core/status/kategorie-projektion';
import type { SpaltenHilfe } from '@/components/data-table/types';
import { baueSpaltenHilfe } from './spaltenHilfe';

interface Quellen {
  schemas: CsvSchema[];
  kategorieSpalten: ResolvedKategorieSpalten[];
  katalogOrdner: { kategorieId: string; label: string }[];
}

const LEER: Quellen = { schemas: [], kategorieSpalten: [], katalogOrdner: [] };

export function useSpaltenHilfe(): Map<string, SpaltenHilfe> {
  const storage = useStorage();
  const activeProgrammId = useActiveProgramm(s => s.activeProgrammId);
  const [quellen, setQuellen] = useState<Quellen>(LEER);

  useEffect(() => {
    if (!activeProgrammId) {
      setQuellen(LEER);
      return;
    }
    let abgebrochen = false;
    void (async () => {
      const schemas = await listSchemasByProgramm(storage.idb, activeProgrammId).catch(() => []);
      // Ohne den Katalog-Flag gibt es keine Ordner-Spalten — dann auch keine
      // Herkunft für welche, statt einer leeren Aufzählung.
      const version = isStatusCockpitEnabled() ? getAktiveVersion() : null;
      // Beide Listen: der Katalog nennt jeden Ordner, den der Picker anbietet;
      // die Auflösung nur die, die dieses Programm auch mappt. Die Differenz
      // sind die Spalten, die leer bleiben — und genau die sollen es sagen.
      const kategorieSpalten = version ? loeseKategorieSpalten(version, schemas) : [];
      const katalogOrdner = version ? kategorienMitDatumsfeldern(version) : [];
      if (!abgebrochen) setQuellen({ schemas, kategorieSpalten, katalogOrdner });
    })();
    return () => { abgebrochen = true; };
  }, [storage.idb, activeProgrammId]);

  return useMemo(() => baueSpaltenHilfe(quellen), [quellen]);
}
