/**
 * useReconcileZuweisungen — räumt beim Öffnen des Auslastungs-Moduls einmalig
 * Altdaten-Dubletten in `auslastung.json` auf (eine Einheit, ein Bearbeiter).
 *
 * Hintergrund: Vor dem Verbund-atomaren `assignVerbund` (+ Verbund-bewusstem
 * Übernahme-Merge) konnten mehrere ACTIVE Zuweisungen (freigegeben/selbst) für
 * denselben Verbund nebeneinander entstehen — z.B. ein Selbst-Wunsch neben einer
 * PL-Freigabe an einen anderen MA. Solche Phantome heilen sich beim täglichen
 * CSV-Refresh NICHT (Zuweisungen sind eigener PL-Stand, nicht CSV-abgeleitet),
 * und ein Phantom auf einem anderen MA als dem CSV-Kürzel wird auch vom
 * fest/pending-Dedup in `computeQuartalsAuslastung` nicht erfasst → bleibt als
 * Stunden-Doppelbuchung hängen.
 *
 * Dieser Hook collapst pro (Verbund, Quartal) auf die höchstrangige Zuweisung
 * (Store-Action `reconcileZuweisungen`). Läuft genau einmal pro App-Session,
 * sobald BEIDE Quellen geladen sind (`useAuslastungReady`) — die antraege werden
 * gebraucht, um `antragId → verbund_id` aufzulösen. Best-effort: in nicht
 * schreibbaren Varianten (kein `datenShareSchreibrecht`) wirft der persist —
 * wird geschluckt; die Anzeige-Gruppierung im Export deckt den Fall ohnehin ab.
 */
import { useEffect } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useAuslastungData } from './useAuslastungData';
import { useAntraegeCache } from './useAntraegeCache';
import { useAuslastungReady } from './useAuslastungReady';
import { verbundKeyOf, hatBearbeiterKuerzel } from '../services/verbund-aggregation';

/** Einmal pro App-Session (überlebt Plugin-/Tab-Wechsel-Remounts). */
let reconcileDone = false;

/** Nur für Tests — setzt das Session-Flag zurück. */
export function resetReconcileForTests(): void {
  reconcileDone = false;
}

export function useReconcileZuweisungen(): void {
  const storage = useStorage();
  const { ready } = useAuslastungReady();
  const cache = useAntraegeCache();
  const setupDone = useAuslastungData(s => s.data.config.setupAbgeschlossen);
  const reconcileZuweisungen = useAuslastungData(s => s.reconcileZuweisungen);

  useEffect(() => {
    if (!ready) return;
    // Cold-Start-Clobber-Schutz (analog useAutoCollectTeamProfiles): bei einem
    // transienten Leer-Read ist `ready` zwar true, aber das Modul nicht
    // eingerichtet — dann keine Auto-Mutation auf die leere Basis. Flag NICHT
    // setzen → laeuft nach, sobald echte Daten geladen sind.
    if (!setupDone) return;
    // Ohne antraege keine Verbund-Auflösung — warten (Flag NICHT setzen).
    if (cache.antraege.length === 0) return;
    if (reconcileDone) return;
    reconcileDone = true;

    const verbundKeyByAntrag = new Map(cache.antraege.map(a => [a.aktenzeichen, verbundKeyOf(a)]));
    // Extern (in der CSV) zugewiesene Anträge → ihr App-seitiger Arbeitsstand ist
    // obsolet und wird mit-geräumt (siehe reconcileZuweisungen Schritt 2).
    const kuerzeltSet = new Set(
      cache.antraege.filter(hatBearbeiterKuerzel).map(a => a.aktenzeichen),
    );
    void reconcileZuweisungen(
      storage,
      (id) => verbundKeyByAntrag.get(id) ?? id,
      (id) => kuerzeltSet.has(id),
    ).catch(() => {
      // Best-effort — nicht schreibbare Variante / Race: still überspringen.
    });
  }, [ready, setupDone, cache.antraege, reconcileZuweisungen, storage]);
}
