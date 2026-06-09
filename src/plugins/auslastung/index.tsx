/**
 * Plugin "auslastung" — automatische Kategorisierung + MA-Zuweisung.
 *
 * Sichtbar fuer alle User (category 'workflow'), aber die PL-Tabs
 * (Klassifizierung / Zuweisung / Kapazität / Admin) sind innerhalb der
 * View gegen `profile.is_kurator` gegated. Feature-Flag: features.auslastung.
 *
 * v2.13: onInit-Hook laedt die Sidecar-Files (`_intern/auslastung.json` +
 * `_intern/auslastung-kuerzel-map.json`) bereits beim App-Start parallel,
 * sodass der erste Aufruf der Auslastungs-Seite die Daten schon im Store
 * findet. Antraege-Cache wird gewarmupt sobald `activeProgrammId` durch
 * `ShellLayout.initActiveProgramm()` gesetzt ist.
 */
import type { TeamFlowPlugin } from '@/core/types/plugin';
import { useActiveProgramm } from '@/core/hooks/useActiveProgramm';
import { isAuslastungNurKorpusEnabled } from '@/config/feature-flags';
import { AuslastungView } from './views/AuslastungView';
import { useAuslastungData } from './hooks/useAuslastungData';
import { useKuerzelMap } from './hooks/useKuerzelMap';
import { warmupAntraegeCache } from './hooks/useAntraegeCache';

// v2.56: Im kurator-Korpus-Modus (auslastungNurKorpus) zeigt das Plugin nur die
// Themen-Vektoren-Pflege — der Sidebar-Eintrag heißt dann nicht irreführend
// „Auslastung", sondern „Themen-Vektoren".
const nurKorpus = isAuslastungNurKorpusEnabled();

export const auslastungPlugin: TeamFlowPlugin = {
  id: 'auslastung',
  route: '/auslastung',
  featureFlag: 'auslastung',
  name: nurKorpus ? 'Themen-Vektoren' : 'Auslastung',
  icon: nurKorpus ? 'Boxes' : 'Users',
  category: 'workflow',
  order: 25,
  component: AuslastungView,
  onInit: async ({ storage }) => {
    // SMB-Sidecars parallel laden — beide Stores haben Idempotenz-Guards,
    // ein zweiter load() im View-Mount ist no-op.
    await Promise.allSettled([
      useAuslastungData.getState().load(storage),
      useKuerzelMap.getState().load(storage),
    ]);
    // Antraege-Cache-Warmup: braucht activeProgrammId, das von ShellLayout
    // gesetzt wird. Wenn schon da → sofort triggern. Sonst Subscribe und
    // einmalig beim ersten non-null Wert ausloesen.
    const id = useActiveProgramm.getState().activeProgrammId;
    if (id) {
      void warmupAntraegeCache(storage, id);
      return;
    }
    const unsub = useActiveProgramm.subscribe((s) => {
      if (s.activeProgrammId) {
        unsub();
        void warmupAntraegeCache(storage, s.activeProgrammId);
      }
    });
  },
};
