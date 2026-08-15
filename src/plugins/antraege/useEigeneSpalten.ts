/**
 * Die selbst angelegten Spalten als Zustand der Seite: laden, anlegen, ändern,
 * löschen — und der Hinweis, wann das einen Neuaufbau der Projektion kostet.
 *
 * **Der Neuaufbau ist die einzige teure Stelle.** Er wird fällig, sobald eine
 * Definition ein Feld referenziert, das bisher niemand las; Beschriftung, Text
 * und Farbe ändern nichts daran. Deshalb entscheidet der Vergleich der
 * Feld-Mengen (nicht der Definitionen), ob nach dem Speichern neu projiziert
 * wird — und der Aufrufer kann das VORHER anzeigen.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { isEigeneSpaltenEnabled } from '@/config/feature-flags';
import { alleFeldRefs, type EigeneSpalte } from '@/core/spalten';
import { ladePersoenlicheSpalten, speicherePersoenlicheSpalten } from '@/core/spalten/store';
import {
  rebuildAntraegeListView, stempleProjektionsStand,
} from '@/core/services/csv/list-view-migration';

export interface EigeneSpaltenSteuerung {
  spalten: EigeneSpalte[];
  /** Erst nach dem ersten Lesen `true` — vorher weiß niemand, ob es welche gibt. */
  geladen: boolean;
  /** Läuft gerade ein Neuaufbau der Projektion? */
  baut: boolean;
  /** Legt an oder ersetzt nach `id`. */
  speichere: (spalte: EigeneSpalte) => Promise<void>;
  entferne: (id: string) => Promise<void>;
  /** Würde diese Änderung einen Neuaufbau auslösen? Für den Hinweis im Dialog. */
  brauchtNeuaufbau: (spalte: EigeneSpalte) => boolean;
}

export function useEigeneSpalten(): EigeneSpaltenSteuerung {
  const storage = useStorage();
  const [spalten, setSpalten] = useState<EigeneSpalte[]>([]);
  const [geladen, setGeladen] = useState(false);
  const [baut, setBaut] = useState(false);

  useEffect(() => {
    if (!isEigeneSpaltenEnabled()) { setGeladen(true); return; }
    let abgebrochen = false;
    void (async () => {
      const geladeneSpalten = await ladePersoenlicheSpalten(storage.idb).catch(() => []);
      if (abgebrochen) return;
      setSpalten(geladeneSpalten);
      setGeladen(true);
    })();
    return () => { abgebrochen = true; };
  }, [storage.idb]);

  const bisherigeFelder = useMemo(() => new Set(alleFeldRefs(spalten)), [spalten]);

  const brauchtNeuaufbau = useCallback(
    (spalte: EigeneSpalte) => alleFeldRefs([spalte]).some(f => !bisherigeFelder.has(f)),
    [bisherigeFelder],
  );

  /**
   * Schreibt die Liste und baut die Projektion neu, WENN sich die Feldmenge
   * geändert hat. Der Vergleich läuft über die Menge, nicht über die Liste:
   * eine gelöschte Spalte, deren Felder eine andere weiterhin liest, kostet
   * nichts.
   */
  const uebernimm = useCallback(async (neu: EigeneSpalte[]): Promise<void> => {
    const vorher = alleFeldRefs(spalten).join('|');
    const nachher = alleFeldRefs(neu).join('|');
    await speicherePersoenlicheSpalten(storage.idb, neu);
    setSpalten(neu);
    if (vorher === nachher) return;
    setBaut(true);
    try {
      await rebuildAntraegeListView(storage.idb);
      // Stand stempeln, sonst sieht der Boot-Guard beim nächsten Start eine
      // veraltete Signatur und baut dieselbe Projektion ein zweites Mal.
      await stempleProjektionsStand(storage.idb);
    } finally {
      setBaut(false);
    }
  }, [spalten, storage.idb]);

  const speichere = useCallback(async (spalte: EigeneSpalte): Promise<void> => {
    const idx = spalten.findIndex(s => s.id === spalte.id);
    const neu = idx >= 0
      ? spalten.map(s => (s.id === spalte.id ? spalte : s))
      : [...spalten, spalte];
    await uebernimm(neu);
  }, [spalten, uebernimm]);

  const entferne = useCallback(async (id: string): Promise<void> => {
    await uebernimm(spalten.filter(s => s.id !== id));
  }, [spalten, uebernimm]);

  return { spalten, geladen, baut, speichere, entferne, brauchtNeuaufbau };
}
