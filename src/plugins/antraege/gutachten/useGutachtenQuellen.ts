/**
 * Lädt und mutiert die Quellen des Gutachtens (VB-Wahl + Korpus-Mitgliedschaft).
 *
 * Eigener Hook statt weiterer Zeilen im Workflow-Orchestrator: „welche Dokumente
 * gehen ins Modell" ist eine abgeschlossene Verantwortung mit eigener Persistenz.
 * Der Orchestrator konsumiert nur `quellen.markdown` und `quellen.vb`.
 *
 * Mutations-Disziplin (Pitfall #16/#20): jede Aktion ist reine Funktion → EIN `put`
 * → EIN `setState` aus dem frisch aufgelösten Ergebnis. Kein optimistisches Teil-
 * Update, weil die Auflösung ohnehin über IDB muss (Volltexte für den Korpus).
 */
import { useCallback, useEffect, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useSearch } from '@/core/hooks/useSearch';
import { useDokumenteStore } from '@/plugins/dokumente/store';
import { ziehePickUm, zieheAuswahlUm } from '@/core/components/dokumentDubletten';
import { setVbAuswahl, getVbAuswahl } from '../kurzfassung/vbDokument';
import type { KurzfassungContext } from '../kurzfassung/types';
import { resolveGutachtenKorpus, type GutachtenKorpus } from './korpusQuelle';
import { putKorpusAuswahl } from './korpus-store';
import { schalteAufnahme, nimmAlleAuf } from './korpusAuswahl';

export interface GutachtenQuellen {
  quellen: GutachtenKorpus | null;
  loading: boolean;
  refresh: () => Promise<void>;
  vbWaehlen: (docId: string) => Promise<void>;
  toggleAufnahme: (docId: string, aufnehmen: boolean) => Promise<void>;
  alleAufnehmen: () => Promise<void>;
  hinweisAblehnen: () => Promise<void>;
  /** Löscht die älteren Fassungen gleichnamiger Dokumente (Bestand vor der Ersetzung). */
  dublettenAufraeumen: () => Promise<void>;
}

export function useGutachtenQuellen(ctx: Pick<KurzfassungContext, 'key' | 'knownIds'>): GutachtenQuellen {
  const storage = useStorage();
  const { removeDocument } = useSearch();
  const removeDoc = useDokumenteStore(s => s.remove);
  const [quellen, setQuellen] = useState<GutachtenKorpus | null>(null);
  const [loading, setLoading] = useState(true);
  const { key } = ctx;

  const refresh = useCallback(async (): Promise<void> => {
    const next = await resolveGutachtenKorpus(storage.idb, ctx);
    setQuellen(next);
  }, [storage.idb, key]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const next = await resolveGutachtenKorpus(storage.idb, ctx);
      if (cancelled) return;
      setQuellen(next);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [key, storage.idb]);

  const vbWaehlen = useCallback(async (docId: string): Promise<void> => {
    await setVbAuswahl(storage.idb, key, docId);
    await refresh();
  }, [storage.idb, key, refresh]);

  const toggleAufnahme = useCallback(async (docId: string, aufnehmen: boolean): Promise<void> => {
    if (!quellen) return;
    await putKorpusAuswahl(storage.idb, {
      ...quellen.auswahl,
      aufgenommen: schalteAufnahme(quellen.auswahl.aufgenommen, docId, aufnehmen),
      // Wer einzeln zuschaltet, hat die Frage beantwortet — der Sammel-Hinweis
      // darf danach nicht wieder auftauchen, wenn alles wieder abgewählt wird.
      hinweisErledigt: true,
    });
    await refresh();
  }, [storage.idb, quellen, refresh]);

  const alleAufnehmen = useCallback(async (): Promise<void> => {
    if (!quellen) return;
    await putKorpusAuswahl(storage.idb, {
      ...quellen.auswahl,
      aufgenommen: nimmAlleAuf(quellen.inventar, quellen.vbDocId),
      hinweisErledigt: true,
    });
    await refresh();
  }, [storage.idb, quellen, refresh]);

  const hinweisAblehnen = useCallback(async (): Promise<void> => {
    if (!quellen) return;
    await putKorpusAuswahl(storage.idb, { ...quellen.auswahl, hinweisErledigt: true });
    await refresh();
  }, [storage.idb, quellen, refresh]);

  /**
   * Altfassungen entfernen. Löscht bewusst NICHT stillschweigend beim Laden — es sind
   * Nutzerdaten; wer sie los wird, klickt das.
   *
   * Reihenfolge: erst die Verweise umziehen, dann löschen. Andersherum stünde zwischen
   * beiden Schritten eine Auswahl im Nichts, und ein Fehler beim Löschen hinterließe
   * eine Auswahl, die auf ein Dokument zeigt, das der Bearbeiter nicht mehr sieht.
   */
  const dublettenAufraeumen = useCallback(async (): Promise<void> => {
    if (!quellen || quellen.dubletten.length === 0) return;
    const { dubletten } = quellen;

    const bisher = await getVbAuswahl(storage.idb, key);
    const umgezogen = ziehePickUm(bisher?.docId ?? null, dubletten);
    if (umgezogen && umgezogen !== bisher?.docId) await setVbAuswahl(storage.idb, key, umgezogen);

    await putKorpusAuswahl(storage.idb, {
      ...quellen.auswahl,
      aufgenommen: zieheAuswahlUm(quellen.auswahl.aufgenommen, dubletten),
    });

    for (const docId of dubletten.flatMap(g => g.entfernen)) {
      removeDocument(docId);          // Such-Index (Orama) — sonst blieben Treffer auf Geister
      await removeDoc(docId, storage); // IDB + Dokumente-Store
    }
    await refresh();
  }, [storage, key, quellen, refresh, removeDoc, removeDocument]);

  return {
    quellen, loading, refresh, vbWaehlen, toggleAufnahme, alleAufnehmen,
    hinweisAblehnen, dublettenAufraeumen,
  };
}
