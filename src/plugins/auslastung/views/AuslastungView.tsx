/**
 * AuslastungView — Top-Level-Layout des Auslastungs-Plugins (1.17).
 *
 * Reduziert von 5 auf 3 Tabs:
 *  - Klassifizierung  — pro Verbund, mit LLM-Batch-Button (1.17)
 *  - Zuweisung        — PL-Cockpit mit Top-3 Vorschlaegen
 *  - Uebersicht       — fusioniert Admin + Kapazitaet
 *
 * Die ehemalige Selbsteintragung wandert auf die Homepage
 * (NeueAntraegeFuerDich-Sektion). Sichtbarkeit "PL-only" ist bereits ueber
 * Build-Varianten geregelt (`features.auslastung` nur in pl/dev configs).
 *
 * Auto-Switch: Setup nicht abgeschlossen → 'uebersicht' (zeigt Setup-Wizard).
 *
 * v2.8 — Tab-Persistenz (lazy + sticky): einmal besuchte Tabs bleiben im
 * DOM (display:none wenn nicht aktiv). Tab-Wechsel ist nur noch ein CSS-
 * Toggle, schwergewichtige Memos (`buildVerbundClassificationViews`,
 * `computeQuartalsAuslastung`) und IDB-Reads (`loadAllVerbundEmbeddings`)
 * laufen genau einmal pro Tab pro App-Session statt bei jedem Wechsel.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Tabs } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
import { useActiveProgramm } from '@/core/hooks/useActiveProgramm';
import { useAuslastungData } from '../hooks/useAuslastungData';
import { AuslastungIndexProvider } from '../hooks/useAuslastungIndex';
import { ModulLoadingBanner } from '../components/ModulLoadingBanner';
import { KlassifizierungsReview } from './KlassifizierungsReview';
import { ZuweisungsCockpit } from './ZuweisungsCockpit';
import { UebersichtView } from './UebersichtView';

type TabId = 'klassifizierung' | 'zuweisung' | 'uebersicht';
const ALL_TABS: ReadonlySet<TabId> = new Set(['klassifizierung', 'zuweisung', 'uebersicht']);

export function AuslastungView(): React.ReactElement {
  const storage = useStorage();
  const activeProgrammId = useActiveProgramm(s => s.activeProgrammId);
  const data = useAuslastungData(s => s.data);
  const load = useAuslastungData(s => s.load);
  const loaded = useAuslastungData(s => s.loaded);

  const setupDone = data.config.setupAbgeschlossen;

  // Default-Tab: 'klassifizierung'. Wenn Setup nicht abgeschlossen, springt
  // ein useEffect (siehe unten) auf 'uebersicht' (zeigt Setup-Wizard).
  const [tab, setTab] = useState<TabId>('klassifizierung');
  const [tabAutoSet, setTabAutoSet] = useState(false);
  // v2.9: Eager Mount aller Tabs (statt Lazy+Sticky aus v2.8).
  // Alle drei Tabs werden beim Modul-Open parallel gemountet — der
  // gemeinsame AuslastungIndexProvider berechnet `auslastungByAnon` 1×
  // statt 3×. Initial-Mount des Moduls dauert dadurch nicht laenger
  // (Skeleton fängt das ab), aber JEDER Tab-Wechsel ist von Anfang an
  // <100 ms (reiner CSS-Toggle, kein Mount mehr).
  const switchTab = useCallback((next: TabId): void => {
    setTab(next);
  }, []);

  useEffect(() => {
    void load(storage);
  }, [load, storage]);

  // Einmalig nach erstem Load: Setup nicht abgeschlossen → Uebersicht-Tab.
  useEffect(() => {
    if (!loaded || tabAutoSet) return;
    if (!setupDone) setTab('uebersicht');
    setTabAutoSet(true);
  }, [loaded, tabAutoSet, setupDone]);

  const tabs = useMemo(() => {
    const offene = data.klassifizierungen.filter(k => k.status === 'vorgeschlagen').length;
    return [
      { id: 'klassifizierung' as const, label: 'Klassifizierung', badge: offene || undefined },
      { id: 'zuweisung' as const, label: 'Zuweisung' },
      { id: 'uebersicht' as const, label: 'Übersicht' },
    ];
  }, [data.klassifizierungen]);

  // Empty-States
  if (!activeProgrammId) {
    return (
      <div className="p-6">
        <h1 className="text-[22px] font-medium text-[var(--tf-text)] mb-2">Auslastung</h1>
        <p className="text-[13.5px] text-[var(--tf-text-secondary)]">
          Kein Förderprogramm aktiv — bitte zuerst ein Programm einrichten oder auswählen.
        </p>
      </div>
    );
  }

  if (!loaded) {
    return (
      <div className="p-6">
        <h1 className="text-[22px] font-medium text-[var(--tf-text)] mb-2">Auslastung</h1>
        <p className="text-[12.5px] text-[var(--tf-text-tertiary)]">Lade Auslastungsdaten…</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-baseline gap-3 mb-4">
        <h1 className="text-[22px] font-medium text-[var(--tf-text)]">Auslastung</h1>
        <p className="text-[12.5px] text-[var(--tf-text-secondary)]">
          {Object.keys(data.mitarbeiter).length} MAs · {data.config.ueberKategorien.length} Kategorien · {data.config.aktuellesQuartal}
        </p>
      </div>

      <Tabs tabs={tabs} activeTab={tab} onChange={(id) => switchTab(id as TabId)} />

      {/* v2.10: prominenter Loading-Banner mit Spinner + Countdown,
          waehrend der initialen Mount-Phase. Verschwindet sobald
          useAuslastungReady() ready=true meldet. */}
      <div className="mt-5">
        <ModulLoadingBanner />
      </div>

      {/* v2.9: Eager Mount aller Tabs + gemeinsamer Index-Provider. Alle
          drei Tabs sind dauerhaft im DOM; nicht-aktive werden per
          `display: none` ausgeblendet. Tab-Wechsel ist von Anfang an
          ein reiner CSS-Toggle (<100 ms). Das hilft besonders, weil
          `computeQuartalsAuslastung` jetzt 1x pro Render-Cycle via
          Provider statt 3x in den Konsumenten laeuft. */}
      <AuslastungIndexProvider>
        <div className="mt-1">
          {ALL_TABS.has('klassifizierung') && (
            <div style={{ display: tab === 'klassifizierung' ? 'block' : 'none' }}>
              <KlassifizierungsReview />
            </div>
          )}
          {ALL_TABS.has('zuweisung') && (
            <div style={{ display: tab === 'zuweisung' ? 'block' : 'none' }}>
              <ZuweisungsCockpit />
            </div>
          )}
          {ALL_TABS.has('uebersicht') && (
            <div style={{ display: tab === 'uebersicht' ? 'block' : 'none' }}>
              <UebersichtView />
            </div>
          )}
        </div>
      </AuslastungIndexProvider>
    </div>
  );
}
