/**
 * Die Lage der Kuration in Zahlen — gelesen, nicht hergeleitet.
 *
 * Jede Aussage hier hat genau eine Quelle, und die liegt bei dem Modul, das sie
 * verantwortet: die Index-Ampel in `indexAmpel`, der CSV-Stand in
 * `useCsvFreshness`/`csvFreshnessAussage`, die Pruef-Warteschlange im
 * Phase-2-Manifest. Sagte die Uebersicht etwas anderes als die Seite, auf die
 * sie zeigt, waere sie schlimmer als keine Uebersicht.
 */
import { useCallback, useEffect, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useSearch } from '@/core/hooks/useSearch';
import { indexAmpel, ladeIndexKennzahlen, type IndexAmpel, type IndexKennzahlen } from '@/core/services/search/indexAmpel';
import { listManifestEntries } from '@/phase2';
import { features } from '@/config/feature-flags';

export interface KurationLage {
  index: (IndexKennzahlen & { ampel: IndexAmpel }) | null;
  /**
   * Dokumente, die auf eine Entscheidung warten — dieselbe Regel wie die
   * Kachel „review" auf der Review-Seite (`requires_review` ODER
   * `triage_state === 'review'`). `null` = Modul nicht im Build.
   */
  offeneReviews: number | null;
  /** Klassifizierte Dokumente insgesamt (Nenner zur Zahl darueber). */
  reviewGesamt: number | null;
  laedt: boolean;
}

export function useKurationLage(): KurationLage {
  const storage = useStorage();
  // Der Index-Sprachstand steht erst, wenn der Such-Provider durch ist;
  // `documentCount` ist das Signal (siehe IndexManager).
  const { documentCount } = useSearch();

  const [index, setIndex] = useState<KurationLage['index']>(null);
  const [offeneReviews, setOffeneReviews] = useState<number | null>(null);
  const [reviewGesamt, setReviewGesamt] = useState<number | null>(null);
  const [laedt, setLaedt] = useState(true);

  const laden = useCallback(async (): Promise<void> => {
    const kennzahlen = await ladeIndexKennzahlen(storage.idb);
    setIndex({ ...kennzahlen, ampel: indexAmpel(kennzahlen) });

    if (features.dokumentenscan) {
      const eintraege = await listManifestEntries(storage.idb);
      setOffeneReviews(
        eintraege.filter(e => e.requires_review || e.triage_state === 'review').length,
      );
      setReviewGesamt(eintraege.length);
    }
    setLaedt(false);
  }, [storage.idb]);

  useEffect(() => {
    void laden();
    // `documentCount` zieht die Ampel nach, sobald der Index geladen ist.
  }, [laden, documentCount]);

  return { index, offeneReviews, reviewGesamt, laedt };
}
