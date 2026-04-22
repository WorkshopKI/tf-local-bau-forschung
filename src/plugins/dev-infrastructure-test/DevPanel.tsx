import { useEffect } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useSmbStatus } from '@/core/hooks/useSmbStatus';
import { Alert } from '@/components/ui/alert';
import { SmbPanel } from './panels/SmbPanel';
import { AdminPanel } from './panels/AdminPanel';
import { AtomicPanel } from './panels/AtomicPanel';
import { LockPanel } from './panels/LockPanel';
import { FixturesPanel } from './panels/FixturesPanel';
import type { IDBStore } from '@/core/services/storage/idb-store';

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

  useEffect(() => {
    // Stabil: getState() statt Hook-Objekt (würde sonst bei jedem State-Update neu referenziert → Loop).
    void useSmbStatus.getState().check(storage.idb as IDBStore);
  }, [storage.idb]);

  return (
    <div className="h-full overflow-y-auto">
      <div
        className="sticky top-0 z-10 px-8 py-4 bg-[var(--tf-bg)]"
        style={{
          borderBottom: '0.5px solid var(--tf-border)',
          backgroundImage: 'repeating-linear-gradient(45deg, transparent 0 10px, rgba(0,0,0,0.025) 10px 11px)',
        }}
      >
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-800">
            DEV
          </span>
          <h1 className="text-[18px] font-medium text-[var(--tf-text)]">Infrastruktur-Tests</h1>
          <span className="text-[12px] text-[var(--tf-text-tertiary)]">Development &amp; Test — nicht für Produktivnutzung</span>
        </div>
      </div>

      <div className="px-8 py-6">
        <IframeWarning />
        <SmbBanner />
        <div className="grid gap-4 xl:grid-cols-4 lg:grid-cols-2 grid-cols-1">
          <section
            className="rounded-xl p-4 bg-[var(--tf-bg)]"
            style={{ border: '0.5px solid var(--tf-border)' }}
          >
            <div className="mb-3 text-[13px] font-medium text-[var(--tf-text)]">1 · SMB &amp; Handle</div>
            <SmbPanel />
          </section>
          <section
            className="rounded-xl p-4 bg-[var(--tf-bg)]"
            style={{ border: '0.5px solid var(--tf-border)' }}
          >
            <div className="mb-3 text-[13px] font-medium text-[var(--tf-text)]">2 · Kurator-Modus</div>
            <AdminPanel />
          </section>
          <section
            className="rounded-xl p-4 bg-[var(--tf-bg)]"
            style={{ border: '0.5px solid var(--tf-border)' }}
          >
            <div className="mb-3 text-[13px] font-medium text-[var(--tf-text)]">3 · Atomic Writes &amp; Backup</div>
            <AtomicPanel />
          </section>
          <section
            className="rounded-xl p-4 bg-[var(--tf-bg)]"
            style={{ border: '0.5px solid var(--tf-border)' }}
          >
            <div className="mb-3 text-[13px] font-medium text-[var(--tf-text)]">4 · Build-Lock</div>
            <LockPanel />
          </section>
          {__TEAMFLOW_DEV_FIXTURES__ && (
            <section
              className="rounded-xl p-4 bg-[var(--tf-bg)] xl:col-span-4 lg:col-span-2"
              style={{ border: '0.5px solid var(--tf-border)' }}
            >
              <div className="mb-3 text-[13px] font-medium text-[var(--tf-text)]">5 · Fixtures &amp; Aktionen</div>
              <FixturesPanel />
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
