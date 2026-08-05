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
 *
 * v2.352: dazu ein ZWEITER Anlauf nach der Start-Datenaktualisierung
 * (`nachStartDatenupdateVorwaermen`) — der erste laeuft noch vor dem
 * Daten-Share-Grant und bleibt am Cold-Start meist wirkungslos.
 */
import type { TeamFlowPlugin } from '@/core/types/plugin';
import type { StorageService } from '@/core/services/storage';
import { useActiveProgramm } from '@/core/hooks/useActiveProgramm';
import { useStartupDataStatus } from '@/core/services/csv/startup-data-status';
import { scheduleIdle } from '@/core/utils/scheduleIdle';
import { istModulFrei } from '@/core/modul-freischaltung';
import { AuslastungView } from './views/AuslastungView';
import { useAuslastungData } from './hooks/useAuslastungData';
import { useKuerzelMap } from './hooks/useKuerzelMap';
import { refreshAntraegeCacheIfStale, warmupAntraegeCache } from './hooks/useAntraegeCache';

export const auslastungPlugin: TeamFlowPlugin = {
  id: 'auslastung',
  route: '/auslastung',
  featureFlag: 'auslastung',
  // v3.0: einkompiliert bleibt es immer (sonst koennte kein Passwort es zeigen);
  // sichtbar wird es erst nach der Freischaltung.
  modulSchloss: 'auslastung',
  name: 'Auslastung',
  icon: 'Users',
  category: 'workflow',
  // Direkt nach Förderanträge (order 2), vor E-Mail Anfragen (order 6).
  order: 4,
  component: AuslastungView,
  onInit: async ({ storage }) => {
    // Gesperrtes Modul waermt nichts vor: der Antraege-Cache deserialisiert ~13k
    // volle Records (~450 MB). Unkritisch, weil `useAntraegeCache` beim Mount
    // ohnehin selbst laedt — der Warmup ist nur Vorarbeit.
    if (!istModulFrei('auslastung')) return;
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
    if (id) scheduleWarmup(id);
    else {
      const unsub = useActiveProgramm.subscribe((s) => {
        if (s.activeProgrammId) {
          unsub();
          scheduleWarmup(s.activeProgrammId);
        }
      });
    }

    nachStartDatenupdateVorwaermen(storage);
  },
};

/**
 * Zweiter Vorwaerm-Anlauf, nachdem die Start-Datenaktualisierung durch ist (v2.352).
 *
 * Warum noetig: `onInit` laeuft in [App.tsx] VOR dem Daten-Share-Grant. `load()`
 * setzt `loaded` bewusst nur bei lesbarem Share (v2.19.2) — der erste Anlauf oben
 * bleibt am Cold-Start also meist wirkungslos, und der teure SMB-Roundtrip auf
 * `_intern/auslastung.json` (~0,5–2 s) fiel bis v2.351 dem User beim ERSTEN Klick
 * auf „Auslastung" zur Last. Zusaetzlich kann `runDataUpdate` die Snapshot-Version
 * bumpen und damit den Antraege-Warmup von oben entwerten.
 *
 * Deshalb: einmalig bei `phase === 'done'` (Pass fertig ODER kein Share vorhanden)
 * dieselben Loads nochmal anstossen — alle idempotent, alle im Idle-Fenster. Reine
 * Vorarbeit: kommt der User schneller, laden die Mount-Effekte der View wie bisher.
 */
function nachStartDatenupdateVorwaermen(storage: StorageService): void {
  const vorwaermen = (): void => {
    scheduleIdle(() => {
      void (async () => {
        await Promise.allSettled([
          useAuslastungData.getState().load(storage),
          useKuerzelMap.getState().load(storage),
        ]);
        const programmId = useActiveProgramm.getState().activeProgrammId;
        if (programmId) await refreshAntraegeCacheIfStale(storage, programmId);
      })().catch(err => {
        console.warn('[auslastung] Vorwaermen nach Start-Datenupdate fehlgeschlagen:', err);
      });
    });
  };

  if (useStartupDataStatus.getState().phase === 'done') {
    vorwaermen();
    return;
  }
  const unsub = useStartupDataStatus.subscribe((s) => {
    if (s.phase !== 'done') return;
    unsub();
    vorwaermen();
  });
}
