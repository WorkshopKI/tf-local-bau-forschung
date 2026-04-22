import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useStorage } from '@/core/hooks/useStorage';
import { useKuratorSession } from '@/core/hooks/useKuratorSession';
import { useSmbStatus } from '@/core/hooks/useSmbStatus';
import type { IDBStore } from '@/core/services/storage/idb-store';
import { CSV_STORES, FILTER_STORE_NAME } from '@/core/services/storage/idb-store';
import { getDatenShareHandle, queryPermission } from '@/core/services/infrastructure/smb-handle';
import { features } from '@/config/feature-flags';
import { runtimeConfig, buildTime, gitHash } from '@/config/runtime-config';

interface StoreStat {
  name: string;
  count: number;
}

async function getCount(idb: IDBStore, storeName: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const db = idb.getDb();
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getSample(idb: IDBStore, storeName: string, limit: number): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const db = idb.getDb();
    const tx = db.transaction(storeName, 'readonly');
    const items: unknown[] = [];
    const req = tx.objectStore(storeName).openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor || items.length >= limit) { resolve(items); return; }
      items.push(cursor.value);
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
  });
}

export function StateInspectorPanel(): React.ReactElement {
  const storage = useStorage();
  const session = useKuratorSession();
  const smb = useSmbStatus();
  const [stores, setStores] = useState<StoreStat[]>([]);
  const [kvKeys, setKvKeys] = useState<string[]>([]);
  const [handlePerm, setHandlePerm] = useState<string>('–');
  const [handlePresent, setHandlePresent] = useState<boolean>(false);
  const [openStore, setOpenStore] = useState<string | null>(null);
  const [sample, setSample] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const idb = storage.idb as IDBStore;
      const names = [...Object.values(CSV_STORES), FILTER_STORE_NAME] as string[];
      const statsArr: StoreStat[] = [];
      for (const name of names) {
        const count = await getCount(idb, name);
        statsArr.push({ name, count });
      }
      setStores(statsArr);

      const keys = await idb.keys();
      setKvKeys(keys);

      const handle = await getDatenShareHandle(idb);
      setHandlePresent(!!handle);
      if (handle) {
        try {
          const perm = await queryPermission(handle);
          setHandlePerm(perm);
        } catch {
          setHandlePerm('unbekannt');
        }
      } else {
        setHandlePerm('–');
      }
    } finally {
      setLoading(false);
    }
  }, [storage.idb]);

  useEffect(() => { void refresh(); }, [refresh]);

  const openSample = async (name: string): Promise<void> => {
    setOpenStore(name);
    const items = await getSample(storage.idb as IDBStore, name, 20);
    setSample(items);
  };

  const formatExpiry = (ms: number | null): string => {
    if (ms === null) return '–';
    const diff = ms - Date.now();
    if (diff <= 0) return 'abgelaufen';
    const days = Math.floor(diff / (24 * 3600_000));
    const hours = Math.floor((diff % (24 * 3600_000)) / 3600_000);
    if (days > 0) return `${days}d ${hours}h`;
    const min = Math.floor((diff % 3600_000) / 60_000);
    return `${hours}h ${min}m`;
  };

  const cellStyle: React.CSSProperties = { border: '0.5px solid var(--tf-border)' };

  return (
    <div className="h-full overflow-y-auto">
      <div
        className="sticky top-0 z-10 px-8 py-4 bg-[var(--tf-bg)]"
        style={{ borderBottom: '0.5px solid var(--tf-border)' }}
      >
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-800">DEV</span>
          <h1 className="text-[18px] font-medium text-[var(--tf-text)]">State-Inspector</h1>
          <Button variant="secondary" size="sm" disabled={loading} onClick={() => void refresh()}>
            {loading ? 'Lädt …' : 'Neu laden'}
          </Button>
        </div>
      </div>

      <div className="px-8 py-6 grid gap-4 xl:grid-cols-2 grid-cols-1">
        <section className="rounded-xl p-4 bg-[var(--tf-bg)]" style={cellStyle}>
          <div className="mb-3 text-[13px] font-medium">IndexedDB-Stores</div>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-[var(--tf-text-tertiary)]">
                <th className="pb-2">Store</th>
                <th className="pb-2 w-20 text-right">Items</th>
                <th className="pb-2 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {stores.map(s => (
                <tr key={s.name}>
                  <td className="py-1 font-mono text-[11.5px]">{s.name}</td>
                  <td className="py-1 text-right tabular-nums">{s.count}</td>
                  <td className="py-1 text-right">
                    <button
                      className="text-[11px] text-[var(--tf-primary)] hover:underline"
                      onClick={() => void openSample(s.name)}
                    >
                      Sample
                    </button>
                  </td>
                </tr>
              ))}
              <tr>
                <td className="py-1 font-mono text-[11.5px] text-[var(--tf-text-tertiary)]">kv (KV-Store)</td>
                <td className="py-1 text-right tabular-nums">{kvKeys.length}</td>
                <td className="py-1"></td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="rounded-xl p-4 bg-[var(--tf-bg)]" style={cellStyle}>
          <div className="mb-3 text-[13px] font-medium">SMB &amp; Session</div>
          <dl className="grid grid-cols-[140px_1fr] gap-y-1.5 text-[12px]">
            <dt className="text-[var(--tf-text-tertiary)]">Daten-Share</dt>
            <dd>{handlePresent ? 'vorhanden' : 'fehlt'}</dd>
            <dt className="text-[var(--tf-text-tertiary)]">Permission</dt>
            <dd className="font-mono text-[11.5px]">{handlePerm}</dd>
            <dt className="text-[var(--tf-text-tertiary)]">Status</dt>
            <dd className="font-mono text-[11.5px]">{smb.status}</dd>
            <dt className="text-[var(--tf-text-tertiary)]">Kurator-Session</dt>
            <dd>{session.isActive ? `aktiv (${session.kuratorName})` : 'inaktiv'}</dd>
            <dt className="text-[var(--tf-text-tertiary)]">Session-TTL</dt>
            <dd>{Math.round(session.ttlMs / 3600_000)} h</dd>
            <dt className="text-[var(--tf-text-tertiary)]">Läuft ab in</dt>
            <dd>{formatExpiry(session.expiresAt)}</dd>
          </dl>
        </section>

        <section className="rounded-xl p-4 bg-[var(--tf-bg)]" style={cellStyle}>
          <div className="mb-3 text-[13px] font-medium">Feature-Flags</div>
          <table className="w-full text-[12px]">
            <tbody>
              {Object.entries(features).map(([k, v]) => (
                <tr key={k}>
                  <td className="py-0.5 font-mono text-[11.5px]">{k}</td>
                  <td className="py-0.5 text-right">{v ? '✓' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="rounded-xl p-4 bg-[var(--tf-bg)]" style={cellStyle}>
          <div className="mb-3 text-[13px] font-medium">Build-Info</div>
          <dl className="grid grid-cols-[140px_1fr] gap-y-1.5 text-[12px]">
            <dt className="text-[var(--tf-text-tertiary)]">Variant</dt>
            <dd className="font-mono text-[11.5px]">{runtimeConfig.variant}</dd>
            <dt className="text-[var(--tf-text-tertiary)]">Label</dt>
            <dd className="font-mono text-[11.5px]">{runtimeConfig.build.label}</dd>
            <dt className="text-[var(--tf-text-tertiary)]">Git-Hash</dt>
            <dd className="font-mono text-[11.5px]">{gitHash}</dd>
            <dt className="text-[var(--tf-text-tertiary)]">Build-Zeit</dt>
            <dd className="font-mono text-[11.5px]">{buildTime}</dd>
            <dt className="text-[var(--tf-text-tertiary)]">Config-Version</dt>
            <dd className="font-mono text-[11.5px]">{runtimeConfig.configVersion}</dd>
          </dl>
        </section>
      </div>

      {openStore && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-8 bg-black/40"
          onClick={() => setOpenStore(null)}
        >
          <div
            className="max-h-[80vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-[var(--tf-bg)] p-6"
            style={{ border: '0.5px solid var(--tf-border)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="font-mono text-[13px]">{openStore}</div>
              <Button variant="secondary" size="sm" onClick={() => setOpenStore(null)}>Schließen</Button>
            </div>
            <pre className="max-h-[65vh] overflow-auto rounded-md bg-[var(--tf-bg-secondary)] p-3 text-[10.5px] leading-tight">
{JSON.stringify(sample, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
