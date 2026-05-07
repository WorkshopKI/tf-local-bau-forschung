import { useEffect, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useSmbStatus } from '@/core/hooks/useSmbStatus';
import { Alert } from '@/components/ui/alert';
import { SmbPanel } from './panels/SmbPanel';
import { AdminPanel } from './panels/AdminPanel';
import { AtomicPanel } from './panels/AtomicPanel';
import { LockPanel } from './panels/LockPanel';
import { TriagePanel } from './panels/TriagePanel';
import { FixturesPanel } from './panels/FixturesPanel';
import { DashboardPanel } from './panels/DashboardPanel';
import type { IDBStore } from '@/core/services/storage/idb-store';

type TabId = 1 | 2 | 3 | 4 | 5 | 6 | 7;

interface TabDef {
  id: TabId;
  label: string;
}

const TABS: TabDef[] = [
  { id: 1, label: 'Übersicht' },
  { id: 2, label: 'SMB & Handle' },
  { id: 3, label: 'Kurator' },
  { id: 4, label: 'Atomic Writes' },
  { id: 5, label: 'Build-Lock' },
  { id: 6, label: 'Phase-2' },
  { id: 7, label: 'Fixtures' },
];

const TAB_KEY = 'teamflow_dev_infra_tab';

function loadTab(): TabId {
  try {
    const v = Number(localStorage.getItem(TAB_KEY));
    if (Number.isInteger(v) && v >= 1 && v <= 7) return v as TabId;
  } catch { /* ignore */ }
  return 1;
}

function SmbBanner(): React.ReactElement | null {
  const { status, lastCheck } = useSmbStatus();
  if (status === 'online' || status === 'unknown') return null;
  const minAgo = lastCheck ? Math.round((Date.now() - lastCheck) / 60_000) : null;
  if (status === 'offline') {
    return (
      <Alert variant="warning" className="mb-4">
        <div className="flex-1">
          <b>Offline-Modus</b> — letzter Sync: {minAgo !== null ? `vor ${minAgo} min` : 'nie'}. Einige Daten könnten veraltet sein.
        </div>
      </Alert>
    );
  }
  return (
    <Alert variant="danger" className="mb-4">
      <div className="flex-1">
        <b>SMB-Zugriff verweigert.</b> Bitte Berechtigung erneuern oder einen neuen Ordner auswählen.
      </div>
    </Alert>
  );
}

function IframeWarning(): React.ReactElement | null {
  const inIframe = typeof window !== 'undefined' && window.self !== window.top;
  if (!inIframe) return null;
  return (
    <Alert variant="danger" className="mb-4">
      <div className="flex-1">
        <b>Eingebettet im iframe.</b> Die File System Access API (Ordner-Picker, Permission-Persistenz) ist in Cross-Origin-iframes ohne explizite Freigabe gesperrt. Öffne die App direkt in einem Browser-Tab unter <code className="text-[11px]">http://localhost:5173/</code>, um die Akzeptanz-Tests durchzuführen.
      </div>
    </Alert>
  );
}

export function DevPanel(): React.ReactElement {
  const storage = useStorage();
  const [activeTab, setActiveTab] = useState<TabId>(loadTab);

  useEffect(() => {
    void useSmbStatus.getState().check(storage.idb as IDBStore);
  }, [storage.idb]);

  const switchTab = (id: number): void => {
    if (id < 1 || id > 7) return;
    const t = id as TabId;
    setActiveTab(t);
    try { localStorage.setItem(TAB_KEY, String(t)); } catch { /* ignore */ }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Page chrome */}
      <div
        className="shrink-0 px-8 pt-4 pb-2 bg-[var(--tf-bg)]"
        style={{
          backgroundImage: 'repeating-linear-gradient(45deg, transparent 0 10px, rgba(0,0,0,0.025) 10px 11px)',
        }}
      >
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-800">
            DEV
          </span>
          <h1 className="text-[18px] font-medium text-[var(--tf-text)]">Infrastruktur-Tests</h1>
          <span className="text-[12px] text-[var(--tf-text-tertiary)]">development · nicht für Produktivnutzung</span>
        </div>
      </div>

      {/* Tab-Bar */}
      <div
        className="shrink-0 flex items-center gap-1 px-8 overflow-x-auto"
        style={{ borderBottom: '0.5px solid var(--tf-border)' }}
      >
        {TABS.map(t => {
          const on = t.id === activeTab;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => switchTab(t.id)}
              className={`shrink-0 px-3.5 py-2.5 text-[13px] cursor-pointer whitespace-nowrap transition-colors ${
                on
                  ? 'text-[var(--tf-text)] font-medium'
                  : 'text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)]'
              }`}
              style={{
                borderBottom: on ? '1.5px solid var(--tf-text)' : '1.5px solid transparent',
                marginBottom: '-0.5px',
              }}
            >
              {t.id} · {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab-Inhalt */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* Globale Banner einmalig oben (für alle Tabs außer Übersicht). */}
        {activeTab !== 1 && (
          <div className="px-8 pt-4">
            <IframeWarning />
            <SmbBanner />
          </div>
        )}

        {activeTab === 1 && <DashboardPanel onSwitchTab={switchTab} />}
        {activeTab === 2 && <SmbPanel />}
        {activeTab === 3 && <AdminPanel />}
        {activeTab === 4 && <AtomicPanel />}
        {activeTab === 5 && <LockPanel />}
        {activeTab === 6 && <TriagePanel />}
        {activeTab === 7 && (
          __TEAMFLOW_DEV_FIXTURES__
            ? <FixturesPanel />
            : (
              <div className="px-8 py-6">
                <Alert variant="info">
                  Fixtures sind in dieser Build-Variante deaktiviert (Feature-Flag <code>devFixtures = false</code>).
                </Alert>
              </div>
            )
        )}
      </div>
    </div>
  );
}
