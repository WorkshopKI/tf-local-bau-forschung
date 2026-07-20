/**
 * Zustand und IO der Förderfähigkeits-Prüfung.
 *
 * Hält Checklisten-Fassung, Prüfstand und das ausgewertete Ergebnis. Alle
 * Entscheidungen (Punkte, Gates, Abschlussfähigkeit) kommen aus den reinen
 * Funktionen in `checkliste/` — hier steht nur Laden, Speichern und die
 * Verdrahtung.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMeinKuerzel } from '@/core/hooks/useMeinKuerzel';
import { useStorage } from '@/core/hooks/useStorage';
import { bewerte, type MapBewertungsErgebnis } from './checkliste/bewertung';
import {
  aendereItem, ergaenzeItem, setzeItemAktiv,
  type ItemAenderung, type NeuesItem,
} from './checkliste/editor';
import type { MapChecklistenDefinition, MapPruefung } from './checkliste/typen';
import {
  migrierePruefung, neuePruefung, setzeBedingung, wendeBewertungAn,
  type BewertungsAenderung,
} from './checkliste/verlauf';
import {
  getPruefung, ladeCheckliste, putPruefung, setzeChecklisteZurueck, speichereCheckliste,
} from './store';
import type { MapEinreichung, RechenBefund } from './types';

export interface UseMapPruefungResult {
  definition: MapChecklistenDefinition | null;
  pruefung: MapPruefung | null;
  ergebnis: MapBewertungsErgebnis | null;
  laedt: boolean;
  /** Die Prüfung läuft auf einer älteren Checklisten-Fassung als der aktuellen. */
  versionVeraltet: boolean;
  bewerteItem: (aenderung: BewertungsAenderung) => Promise<void>;
  beantworteBedingung: (itemId: string, wert: boolean) => Promise<void>;
  ziehePruefungNach: () => Promise<void>;
  bearbeiteItem: (itemId: string, aenderung: ItemAenderung) => Promise<void>;
  ergaenzeKriterium: (neu: NeuesItem) => Promise<void>;
  aktiviereItem: (itemId: string, aktiv: boolean) => Promise<void>;
  setzeChecklisteZurueck: () => Promise<void>;
}

export function useMapPruefung(
  einreichung: MapEinreichung | null, befunde: readonly RechenBefund[],
): UseMapPruefungResult {
  const storage = useStorage();
  const kuerzel = useMeinKuerzel();
  const [definition, setDefinition] = useState<MapChecklistenDefinition | null>(null);
  const [pruefung, setPruefung] = useState<MapPruefung | null>(null);
  const [laedt, setLaedt] = useState(true);

  const einreichungId = einreichung?.id ?? null;

  useEffect(() => {
    let abgebrochen = false;
    void (async () => {
      setLaedt(true);
      const def = await ladeCheckliste(storage.idb);
      if (abgebrochen) return;
      setDefinition(def);

      if (einreichungId === null) {
        setPruefung(null);
        setLaedt(false);
        return;
      }

      // Der Prüfstand stempelt die Checklisten-Fassung beim Start. Eine
      // laufende Prüfung wandert NICHT automatisch auf eine neuere Fassung —
      // sonst änderte sich die Grundlage einer halb fertigen Bewertung.
      const vorhanden = await getPruefung(storage.idb, einreichungId);
      const stand = vorhanden ?? neuePruefung(einreichungId, def.version, new Date().toISOString());
      if (vorhanden === null) await putPruefung(storage.idb, stand);
      if (abgebrochen) return;
      setPruefung(stand);
      setLaedt(false);
    })();
    return () => { abgebrochen = true; };
  }, [storage.idb, einreichungId]);

  const ergebnis = useMemo(() => {
    if (definition === null || pruefung === null) return null;
    return bewerte(definition, pruefung, einreichung, befunde);
  }, [definition, pruefung, einreichung, befunde]);

  const schreibePruefung = useCallback(async (naechste: MapPruefung): Promise<void> => {
    setPruefung(naechste);
    await putPruefung(storage.idb, naechste);
  }, [storage.idb]);

  const schreibeDefinition = useCallback(async (naechste: MapChecklistenDefinition): Promise<void> => {
    setDefinition(naechste);
    await speichereCheckliste(storage.idb, naechste);
  }, [storage.idb]);

  const bewerteItem = useCallback(async (aenderung: BewertungsAenderung): Promise<void> => {
    if (pruefung === null) return;
    await schreibePruefung(
      wendeBewertungAn(pruefung, aenderung, kuerzel ?? null, new Date().toISOString()),
    );
  }, [pruefung, kuerzel, schreibePruefung]);

  const beantworteBedingung = useCallback(async (itemId: string, wert: boolean): Promise<void> => {
    if (pruefung === null) return;
    await schreibePruefung(setzeBedingung(pruefung, itemId, wert, new Date().toISOString()));
  }, [pruefung, schreibePruefung]);

  const ziehePruefungNach = useCallback(async (): Promise<void> => {
    if (pruefung === null || definition === null) return;
    await schreibePruefung(migrierePruefung(pruefung, definition));
  }, [pruefung, definition, schreibePruefung]);

  const stempel = useMemo(
    () => ({ autor: kuerzel ?? null, zeitpunkt: new Date().toISOString() }),
    [kuerzel],
  );

  const bearbeiteItem = useCallback(async (itemId: string, aenderung: ItemAenderung): Promise<void> => {
    if (definition === null) return;
    await schreibeDefinition(aendereItem(definition, itemId, aenderung, {
      ...stempel, zeitpunkt: new Date().toISOString(),
    }));
  }, [definition, stempel, schreibeDefinition]);

  const ergaenzeKriterium = useCallback(async (neu: NeuesItem): Promise<void> => {
    if (definition === null) return;
    await schreibeDefinition(ergaenzeItem(definition, neu, {
      ...stempel, zeitpunkt: new Date().toISOString(),
    }));
  }, [definition, stempel, schreibeDefinition]);

  const aktiviereItem = useCallback(async (itemId: string, aktiv: boolean): Promise<void> => {
    if (definition === null) return;
    await schreibeDefinition(setzeItemAktiv(definition, itemId, aktiv, {
      ...stempel, zeitpunkt: new Date().toISOString(),
    }));
  }, [definition, stempel, schreibeDefinition]);

  const zuruecksetzen = useCallback(async (): Promise<void> => {
    setDefinition(await setzeChecklisteZurueck(storage.idb));
  }, [storage.idb]);

  return {
    definition,
    pruefung,
    ergebnis,
    laedt,
    versionVeraltet: definition !== null && pruefung !== null
      && pruefung.checklisteVersion !== definition.version,
    bewerteItem,
    beantworteBedingung,
    ziehePruefungNach,
    bearbeiteItem,
    ergaenzeKriterium,
    aktiviereItem,
    setzeChecklisteZurueck: zuruecksetzen,
  };
}
