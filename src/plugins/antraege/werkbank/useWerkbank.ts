/**
 * State-/IO-Schicht der Artefakt-Werkbank: lädt die offenen Punkte + den
 * Textbaustein-Katalog, bietet Punkt-CRUD (rein-lokale IDB-Persistenz) und
 * orchestriert die Generierung über den **bestehenden** NF-Pfad
 * (`useNachforderungen.generiereWerkbank`) — kein zweiter Generierungspfad.
 */
import { useEffect, useMemo, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { loadTextbausteinKatalog, type TextbausteinRecord } from '@/core/services/skills';
import type { KurzfassungContext } from '../kurzfassung/types';
import { useNachforderungen, type NachforderungenController } from '../nachforderungen/useNachforderungen';
import type { BescheidTyp } from '../nachforderungen/artefakt-typ';
import { ladeWerkbank, speichereWerkbank } from './werkbank-store';
import { entfernePunkt, neuerPunkt, setzeErledigt, upsertPunkt } from './punkte';
import { baueAuftrag, type Auswahl } from './bausteinAuswahl';
import { ladeMapBewertung, type MapBewertung } from './map-bewertung';
import type { WerkbankPunkt } from './types';

export interface WerkbankController {
  nf: NachforderungenController;
  loading: boolean;
  punkte: WerkbankPunkt[];
  katalog: TextbausteinRecord[];
  /** MAP-Fachbewertung je Aspekt (für die RNE/ABL-Konsistenz-Checks). */
  mapBewertung: MapBewertung;
  addPunkt: (text: string, aspektId: string | null, fundstellen: string[]) => void;
  removePunkt: (key: string) => void;
  toggleErledigt: (key: string, erledigt: boolean) => void;
  /** Generiert aus den gewählten Punkten + der bestätigten Baustein-Auswahl. */
  generiere: (gewaehlteKeys: string[], auswahl: Auswahl, artefaktTyp: BescheidTyp) => void;
}

export function useWerkbank(ctx: KurzfassungContext): WerkbankController {
  const storage = useStorage();
  const nf = useNachforderungen(ctx);
  const [loading, setLoading] = useState(true);
  const [punkte, setPunkte] = useState<WerkbankPunkt[]>([]);
  const [katalog, setKatalog] = useState<TextbausteinRecord[]>([]);
  const [mapBewertung, setMapBewertung] = useState<MapBewertung>({ bewertung: {}, gefunden: false });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [rec, kat, map] = await Promise.all([
        ladeWerkbank(storage.idb, ctx.key),
        loadTextbausteinKatalog(storage),
        ladeMapBewertung(storage.idb, { key: ctx.key, knownIds: ctx.knownIds }),
      ]);
      if (cancelled) return;
      setPunkte(rec.punkte);
      setKatalog(kat.katalog.bausteine);
      setMapBewertung(map);
      setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur auf den Verbund-Key reagieren
  }, [ctx.key]);

  const persist = (next: WerkbankPunkt[]): void => {
    setPunkte(next);
    void speichereWerkbank(storage.idb, { verbundAz: ctx.key, punkte: next, schemaVersion: 1 });
  };

  const addPunkt = (text: string, aspektId: string | null, fundstellen: string[]): void => {
    if (!text.trim()) return;
    persist(upsertPunkt(punkte, neuerPunkt(text, aspektId, fundstellen, new Date().toISOString())));
  };
  const removePunkt = (key: string): void => persist(entfernePunkt(punkte, key));
  const toggleErledigt = (key: string, erledigt: boolean): void => persist(setzeErledigt(punkte, key, erledigt));

  const generiere = (gewaehlteKeys: string[], auswahl: Auswahl, artefaktTyp: BescheidTyp): void => {
    const gewaehlt = punkte.filter(p => gewaehlteKeys.includes(p.key));
    if (gewaehlt.length === 0) return;
    nf.generiereWerkbank(baueAuftrag(katalog, gewaehlt, auswahl, artefaktTyp));
  };

  return useMemo(
    () => ({ nf, loading, punkte, katalog, mapBewertung, addPunkt, removePunkt, toggleErledigt, generiere }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nf, loading, punkte, katalog, mapBewertung],
  );
}
