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

  // WICHTIG: Tab-Default ist immer 'selbst'. Sonst wuerde der useState-
  // Initial-Computation mit dem in-memory-Default `setupAbgeschlossen=false`
  // sofort 'admin' setzen und den Setup-Wizard kurz aufblitzen lassen, bevor
  // `load(storage)` den echten Stand aus `auslastung.json` nachzieht.
  // Auto-Sprung zu 'admin' passiert weiter unten via useEffect, sobald
  // `loaded === true` und Setup wirklich nicht abgeschlossen ist.
  const [tab, setTab] = useState<TabId>('selbst');
  const [tabAutoSet, setTabAutoSet] = useState(false);

  useEffect(() => {
    void load(storage);
  }, [load, storage]);

  // Einmalig nach erstem erfolgreichen Load: Kurator + Setup nicht
  // abgeschlossen → Admin-Tab automatisch oeffnen (Setup-Wizard sichtbar).
  // In allen anderen Faellen bleibt 'selbst' der Default.
  useEffect(() => {
    if (!loaded || tabAutoSet) return;
    if (isKurator && !setupDone) setTab('admin');
    setTabAutoSet(true);
  }, [loaded, tabAutoSet, isKurator, setupDone]);

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

  // Solange die echten Daten noch nicht geladen sind: nichts vom Tab-Inhalt
  // rendern. Verhindert, dass der Setup-Wizard mit den 5 Default-Kategorien
  // kurz aufblitzt, bevor `loaded=true` und `setupAbgeschlossen` korrekt sind.
  if (!loaded) {
    return (
      <div className="p-6">
        <h1 className="text-[22px] font-medium text-[var(--tf-text)] mb-2">Auslastung</h1>
        <p className="text-[12.5px] text-[var(--tf-text-tertiary)]">Lade Auslastungsdaten…</p>
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
