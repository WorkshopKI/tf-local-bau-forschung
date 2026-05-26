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
import { KlassifizierungsReview } from './KlassifizierungsReview';
import { ZuweisungsCockpit } from './ZuweisungsCockpit';
import { UebersichtView } from './UebersichtView';

type TabId = 'klassifizierung' | 'zuweisung' | 'uebersicht';

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
  // v2.8: Lazy + Sticky — sobald ein Tab einmal aktiv war, bleibt er
  // gemountet (display:none wenn nicht aktiv). Initial: der Default-Tab.
  const [visitedTabs, setVisitedTabs] = useState<Set<TabId>>(() => new Set(['klassifizierung']));

  const switchTab = useCallback((next: TabId): void => {
    setVisitedTabs(prev => (prev.has(next) ? prev : new Set([...prev, next])));
    setTab(next);
  }, []);

  useEffect(() => {
    void load(storage);
  }, [load, storage]);

  // Einmalig nach erstem Load: Setup nicht abgeschlossen → Uebersicht-Tab.
  useEffect(() => {
    if (!loaded || tabAutoSet) return;
    if (!setupDone) {
      // Auch hier durch switchTab leiten, damit visitedTabs den Auto-Switch
      // korrekt vermerkt.
      setVisitedTabs(prev => (prev.has('uebersicht') ? prev : new Set([...prev, 'uebersicht'])));
      setTab('uebersicht');
    }
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

      {/* v2.8: Lazy + Sticky Tab-Mounts. Nicht-aktive besuchte Tabs werden
          per `display:none` ausgeblendet — State, Scroll-Position und
          Memos bleiben erhalten. Tab-Wechsel ist nach erstem Besuch
          jedes Tabs ein reiner CSS-Toggle (<100 ms). */}
      <div className="mt-5">
        {visitedTabs.has('klassifizierung') && (
          <div style={{ display: tab === 'klassifizierung' ? 'block' : 'none' }}>
            <KlassifizierungsReview />
          </div>
        )}
        {visitedTabs.has('zuweisung') && (
          <div style={{ display: tab === 'zuweisung' ? 'block' : 'none' }}>
            <ZuweisungsCockpit />
          </div>
        )}
        {visitedTabs.has('uebersicht') && (
          <div style={{ display: tab === 'uebersicht' ? 'block' : 'none' }}>
            <UebersichtView />
          </div>
        )}
      </div>
    </div>
  );
}
