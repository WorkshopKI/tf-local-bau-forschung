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
import { scheduleIdle } from '@/core/utils/scheduleIdle';
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
  // Direkt nach Förderanträge (order 2), vor E-Mail Anfragen (order 6).
  order: 4,
  component: AuslastungView,
  onInit: async ({ storage }) => {
    // SMB-Sidecars parallel laden — beide Stores haben Idempotenz-Guards,
    // ein zweiter load() im View-Mount ist no-op.
    await Promise.allSettled([
      useAuslastungData.getState().load(storage),
      useKuerzelMap.getState().load(storage),
    ]);
    // Antraege-Cache-Warmup: braucht activeProgrammId, das von ShellLayout
    // gesetzt wird. Wenn schon da → triggern. Sonst Subscribe und einmalig
    // beim ersten non-null Wert ausloesen.
    //
    // v2.62.5: Warmup NICHT mehr sofort, sondern im Idle-Window nach dem
    // First-Paint (scheduleIdle, Muster v2.61.5 Korpus-Autoload). Der Warmup
    // deserialisiert ~13k volle Antrag-Records (~450 MB) und konkurrierte
    // beim App-Start mit dem Homepage-List-View-Load um Main-Thread + IDB —
    // messbar als „~4 s bis Antraege sichtbar" auf Citrix. Konsumenten sind
    // unkritisch: useAntraegeCache triggert den Load beim Mount ohnehin
    // selbst (idempotent, refresh()-Hit-Check), der Warmup ist nur Vorarbeit.
    const scheduleWarmup = (programmId: string): void => {
      scheduleIdle(() => { void warmupAntraegeCache(storage, programmId); });
    };
    const id = useActiveProgramm.getState().activeProgrammId;
    if (id) {
      scheduleWarmup(id);
      return;
    }
    const unsub = useActiveProgramm.subscribe((s) => {
      if (s.activeProgrammId) {
        unsub();
        scheduleWarmup(s.activeProgrammId);
      }
    });
  },
};
