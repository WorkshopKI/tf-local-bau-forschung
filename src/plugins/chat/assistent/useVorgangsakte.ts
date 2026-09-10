/**
 * Die Vorgangsakte der Entität, die das Dock gerade sieht — die unreine Hülle
 * um den reinen `baueVorgangsakte`.
 *
 * Lädt nur, was die Detailseite für denselben Verbund ohnehin lädt
 * (`useStatusVerlauf`, `useVerbundMeilensteine`), und nur bei offenem Dock: das
 * Panel ist auf jeder Route gemountet, und ein geschlossener Streifen braucht
 * keine Akte.
 *
 * Ein Antrag bekommt die Akte seines Verbunds, geschnitten auf sein
 * Teilvorhaben. Ohne Verbund (Solo-Antrag) bleibt es bei der Projektion.
 */
import { useMemo } from 'react';
import { useAntraegeStore } from '@/plugins/antraege/store';
import { useStatusVerlauf } from '@/plugins/antraege/status/useStatusVerlauf';
import { useVerbundMeilensteine } from '@/plugins/antraege/meilensteine/useVerbundMeilensteine';
import { isMeilensteinMonitoringEnabled, isVorgangssystemEnabled } from '@/config/feature-flags';
import type { KontextEntitaet, VorgangsAkte } from '@/core/services/assistent/kontext';
import { baueVorgangsakte } from './vorgangsakte';

export function useVorgangsakte(
  entitaet: KontextEntitaet | null, aktiv: boolean, stichtag: string,
): VorgangsAkte | null {
  const antraege = useAntraegeStore(s => s.antraege);
  const verbundById = useAntraegeStore(s => s.verbundById);
  const art = aktiv ? entitaet?.art ?? null : null;
  const id = aktiv ? entitaet?.id ?? null : null;

  const verbundId = useMemo(() => {
    if (art === null || id === null) return null;
    if (art === 'verbund') return id;
    return antraege.find(a => a.aktenzeichen === id)?.verbund_id ?? null;
  }, [art, id, antraege]);

  const verlauf = useStatusVerlauf(verbundId);
  // Der Hook nimmt keinen „aus"-Wert; ein leerer Schlüssel findet keinen Verbund
  // und liefert keine Bewertung.
  const ms = useVerbundMeilensteine(
    isMeilensteinMonitoringEnabled() && verbundId !== null ? verbundId : '', stichtag,
  );

  return useMemo(() => {
    if (art === null || id === null) return null;
    const tvs = verbundId !== null
      ? antraege.filter(a => a.verbund_id === verbundId)
      : antraege.filter(a => a.aktenzeichen === id);
    return baueVorgangsakte({
      entitaet: { art, id },
      antraege: tvs,
      verbundStatus: verbundId !== null ? verbundById.get(verbundId)?.status ?? null : null,
      verlauf: verbundId !== null && !verlauf.laden ? verlauf : null,
      meilensteine: ms.plan && ms.bewertung ? { plan: ms.plan, bewertung: ms.bewertung } : null,
      vorgangssystem: isVorgangssystemEnabled(),
      stichtag,
    });
  }, [art, id, verbundId, antraege, verbundById, verlauf, ms.plan, ms.bewertung, stichtag]);
}
