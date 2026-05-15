/**
 * AuslastungView — Top-Level-Layout des Auslastungs-Plugins.
 *
 * Drei Sichtbarkeits-Modi:
 *  1. Setup nicht abgeschlossen + Kurator -> zwingender Setup-Wizard im
 *     Admin-Tab (alle anderen Tabs disabled/erklärt).
 *  2. Setup nicht abgeschlossen + Nicht-Kurator -> Empty-State.
 *  3. Setup abgeschlossen -> alle Tabs sichtbar, MA sieht nur Selbsteintragung.
 *
 * Tab-Sichtbarkeit:
 *  - Selbsteintragung: alle User
 *  - Klassifizierung / Zuweisung / Kapazität / Admin: nur is_kurator
 */
import { useEffect, useMemo, useState } from 'react';
import { Tabs } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
import { useProfile } from '@/core/hooks/useProfile';
import { useActiveProgramm } from '@/core/hooks/useActiveProgramm';
import { useAuslastungData } from '../hooks/useAuslastungData';
import { KlassifizierungsReview } from './KlassifizierungsReview';
import { ZuweisungsCockpit } from './ZuweisungsCockpit';
import { SelbsteintragungView } from './SelbsteintragungView';
import { KapazitaetsDashboard } from './KapazitaetsDashboard';
import { AuslastungAdmin } from './AuslastungAdmin';

type TabId = 'selbst' | 'klassifizierung' | 'zuweisung' | 'kapazitaet' | 'admin';

export function AuslastungView(): React.ReactElement {
  const storage = useStorage();
  const { profile } = useProfile();
  const activeProgrammId = useActiveProgramm(s => s.activeProgrammId);
  const data = useAuslastungData(s => s.data);
  const load = useAuslastungData(s => s.load);
  const loaded = useAuslastungData(s => s.loaded);

  const isKurator = profile?.is_kurator === true || profile?.is_admin === true;
  const setupDone = data.config.setupAbgeschlossen;

  const [tab, setTab] = useState<TabId>(isKurator && !setupDone ? 'admin' : 'selbst');

  useEffect(() => {
    void load(storage);
  }, [load, storage]);

  // Sichtbare Tabs ableiten
  const tabs = useMemo(() => {
    const list: Array<{ id: TabId; label: string; badge?: number }> = [
      { id: 'selbst', label: 'Selbsteintragung' },
    ];
    if (isKurator) {
      const offene = data.klassifizierungen.filter(k => k.status === 'vorgeschlagen').length;
      list.push({ id: 'klassifizierung', label: 'Klassifizierung', badge: offene || undefined });
      list.push({ id: 'zuweisung', label: 'Zuweisung' });
      list.push({ id: 'kapazitaet', label: 'Kapazität' });
      list.push({ id: 'admin', label: 'Admin' });
    }
    return list;
  }, [isKurator, data.klassifizierungen]);

  // Wenn Tab nicht mehr sichtbar (z.B. Profile-Wechsel): zurueck auf selbst.
  useEffect(() => {
    if (!tabs.some(t => t.id === tab)) setTab('selbst');
  }, [tabs, tab]);

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

  if (!setupDone && !isKurator) {
    return (
      <div className="p-6">
        <h1 className="text-[22px] font-medium text-[var(--tf-text)] mb-2">Auslastung</h1>
        <p className="text-[13.5px] text-[var(--tf-text-secondary)]">
          Das Auslastungs-Modul wird gerade von der Projektleitung eingerichtet. Bitte schau später noch einmal vorbei.
        </p>
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
        {!loaded && (
          <span className="text-[11px] text-[var(--tf-text-tertiary)]">Lade…</span>
        )}
      </div>

      <Tabs tabs={tabs} activeTab={tab} onChange={(id) => setTab(id as TabId)} />

      <div className="mt-5">
        {tab === 'selbst' && <SelbsteintragungView />}
        {tab === 'klassifizierung' && isKurator && <KlassifizierungsReview />}
        {tab === 'zuweisung' && isKurator && <ZuweisungsCockpit />}
        {tab === 'kapazitaet' && isKurator && <KapazitaetsDashboard />}
        {tab === 'admin' && isKurator && <AuslastungAdmin />}
      </div>
    </div>
  );
}
