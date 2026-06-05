import { useState, useEffect } from 'react';
import { Trash2, FileText, Database, Pencil, Check, FlaskConical, FolderHeart, FolderOpen, RefreshCw, FolderInput } from 'lucide-react';
import { Button, Badge, SectionHeader, ListItem } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
import { useProfile } from '@/core/hooks/useProfile';
import type { DirectoryEntry } from '@/core/types/config';
import { shouldShowOpfsOption } from '@/core/utils/environment';
import { isKuratorMenusEnabled, isCsvAutoRefreshEnabled, canWriteDatenShare } from '@/config/feature-flags';
import {
  clearDatenShareHandle,
  clearPersoenlichHandle,
  getDatenShareHandle,
  getPersoenlichHandle,
  pickAndStoreDatenShareHandle,
  pickAndStorePersoenlichHandle,
  refreshAllPermissions,
} from '@/core/services/infrastructure/smb-handle';
import { useConnectionState } from '@/core/services/connection-status';
import {
  getCsvSourceDirHandle,
  queryCsvSourceDirPermission,
  clearCsvSourceDirHandle,
  pickAndLinkCsvFolder,
} from '@/plugins/csv-sources-kuration/csv-source-handle';
import { listProgramme, listSchemas } from '@/core/services/csv';
import { bumpCsvSourcesSignal } from '@/core/services/csv/csv-sources-signal';
import type { CsvSchema } from '@/core/services/csv/types';

export function SpeicherTab(): React.ReactElement {
  const storage = useStorage();
  const { profile } = useProfile();
  const setPersoenlichAvailable = useConnectionState(s => s.setPersoenlichAvailable);
  const applyRefreshResult = useConnectionState(s => s.applyRefreshResult);
  const dsConnected = useConnectionState(s => s.datenShareAvailable);
  const persoenlichAvailable = useConnectionState(s => s.persoenlichAvailable);
  const [directories, setDirectories] = useState<DirectoryEntry[]>(storage.getDirectories());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [error, setError] = useState('');

  // v2.0: Persoenlicher Ordner — separate Slot, nicht Teil der DirectoryEntry-Liste.
  const [persConnected, setPersConnected] = useState(false);
  const [persFolderName, setPersFolderName] = useState<string | null>(null);
  const [persBusy, setPersBusy] = useState(false);

  // Datenordner-Slot (separate vom DirectoryEntry-Storage)
  const [dsHandleExists, setDsHandleExists] = useState(false);
  const [dsFolderName, setDsFolderName] = useState<string | null>(null);
  const [dsBusy, setDsBusy] = useState(false);

  // v2.27: CSV-Quellen-Ordner — EIN Handle für alle CSV-Quelldateien (pl + kurator).
  const showCsvFolder = isCsvAutoRefreshEnabled() || isKuratorMenusEnabled();
  const [csvDirExists, setCsvDirExists] = useState(false);
  const [csvDirName, setCsvDirName] = useState<string | null>(null);
  const [csvDirOnline, setCsvDirOnline] = useState(false);
  const [csvSchemas, setCsvSchemas] = useState<CsvSchema[]>([]);
  const [csvBusy, setCsvBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [pers, ds] = await Promise.all([
        getPersoenlichHandle(storage.idb).catch(() => null),
        getDatenShareHandle(storage.idb).catch(() => null),
      ]);
      if (cancelled) return;
      setPersConnected(!!pers);
      setPersFolderName(pers?.name ?? null);
      setDsHandleExists(!!ds);
      setDsFolderName(ds?.name ?? null);
    })();
    return () => { cancelled = true; };
  }, [storage]);

  // v2.27: CSV-Ordner-Handle + Status + alle CSV-Schemas vorab laden, damit der
  // Picker im Klick-Gesture OHNE await-davor läuft (file://-User-Activation).
  useEffect(() => {
    if (!showCsvFolder) return;
    let cancelled = false;
    (async () => {
      const handle = await getCsvSourceDirHandle(storage.idb).catch(() => null);
      let online = false;
      if (handle) {
        try { online = (await queryCsvSourceDirPermission(handle)) === 'granted'; } catch { online = false; }
      }
      const schemas: CsvSchema[] = [];
      try {
        for (const p of await listProgramme(storage.idb)) {
          schemas.push(...await listSchemas(storage.idb, p.id));
        }
      } catch { /* leer lassen */ }
      if (cancelled) return;
      setCsvDirExists(!!handle);
      setCsvDirName(handle?.name ?? null);
      setCsvDirOnline(online);
      setCsvSchemas(schemas);
    })();
    return () => { cancelled = true; };
  }, [storage, showCsvFolder]);

  const handleConnectPers = async (): Promise<void> => {
    setError('');
    setPersBusy(true);
    try {
      const res = await pickAndStorePersoenlichHandle(storage.idb);
      if (!res.ok) {
        if (res.reason !== 'aborted') {
          setError(res.message ?? 'Persönlicher Ordner konnte nicht verbunden werden.');
        }
        return;
      }
      setPersConnected(true);
      setPersFolderName(res.handle.name);
      setPersoenlichAvailable(true);
    } finally {
      setPersBusy(false);
    }
  };

  const handleDisconnectPers = async (): Promise<void> => {
    await clearPersoenlichHandle(storage.idb);
    setPersConnected(false);
    setPersFolderName(null);
    setPersoenlichAvailable(false);
  };

  // CSV-Ordner: Picker DIREKT (csvSchemas sind vorab geladen — kein await davor,
  // sonst verbrennt Chrome unter file:// die User-Activation, vgl. Datenordner).
  const handlePickCsvFolder = async (): Promise<void> => {
    setError('');
    try {
      const res = await pickAndLinkCsvFolder(storage.idb, csvSchemas);
      setCsvBusy(true);
      if (!res.linked) return;
      const handle = await getCsvSourceDirHandle(storage.idb);
      setCsvDirExists(!!handle);
      setCsvDirName(handle?.name ?? null);
      setCsvDirOnline(handle ? (await queryCsvSourceDirPermission(handle)) === 'granted' : false);
      // Auto-Refresh-Banner re-prüfen lassen, sonst wirkt das Verknüpfen erst
      // nach einem Browser-Reload (der Check läuft sonst nur 1x beim Mount).
      bumpCsvSourcesSignal();
      if (res.unmatched.length > 0) {
        setError(`Ordner verknüpft. Für diese Quellen wurde keine passende Datei im Ordner gefunden: ${res.unmatched.join(', ')}.`);
      }
    } catch (err) {
      setError((err as Error).message ?? 'CSV-Ordner konnte nicht verknüpft werden.');
    } finally {
      setCsvBusy(false);
    }
  };

  const handleDisconnectCsv = async (): Promise<void> => {
    await clearCsvSourceDirHandle(storage.idb);
    setCsvDirExists(false);
    setCsvDirName(null);
    setCsvDirOnline(false);
  };

  // Datenordner: Picker DIREKT (kein await davor — siehe OfflineBanner User-Gesture-Pattern).
  const handlePickDatenShare = async (): Promise<void> => {
    setError('');
    const isKurator = profile?.is_kurator === true || profile?.is_admin === true;
    const mode = canWriteDatenShare(isKurator) ? 'readwrite' : 'read';
    const res = await pickAndStoreDatenShareHandle(storage.idb, { mode });
    setDsBusy(true);
    try {
      if (!res.ok) {
        if (res.reason !== 'aborted') {
          setError(res.message ?? 'Datenordner konnte nicht verbunden werden.');
        }
        return;
      }
      setDsHandleExists(true);
      setDsFolderName(res.handle.name);
      const refreshed = await refreshAllPermissions(storage.idb, { isKurator });
      applyRefreshResult(refreshed);
    } finally {
      setDsBusy(false);
    }
  };

  const handleReconnectDatenShare = async (): Promise<void> => {
    setError('');
    setDsBusy(true);
    try {
      const isKurator = profile?.is_kurator === true || profile?.is_admin === true;
      const result = await refreshAllPermissions(storage.idb, { isKurator });
      applyRefreshResult(result);
    } finally {
      setDsBusy(false);
    }
  };

  const handleDisconnectDatenShare = async (): Promise<void> => {
    if (!window.confirm('Datenordner trennen? Ohne verbundenen Datenordner laufen Anträge, Suche und Synchronisierung nicht. Die Auswahl muss anschließend neu getroffen werden.')) {
      return;
    }
    await clearDatenShareHandle(storage.idb);
    setDsHandleExists(false);
    setDsFolderName(null);
    const prev = useConnectionState.getState();
    applyRefreshResult({
      datenShare: 'missing',
      persoenlich: prev.persoenlichAvailable ? 'granted' : 'missing',
      userFoldersRoot: 'missing',
      dmsSources: {},
    });
  };

  const refresh = (): void => setDirectories(storage.getDirectories());

  const handleAdd = async (type: 'documents' | 'data'): Promise<void> => {
    setError('');
    const result = await storage.addDirectory(type);
    if (result) {
      refresh();
    } else {
      setError('Verzeichnis konnte nicht verbunden werden. Bitte erneut versuchen.');
    }
  };

  const handleAddOpfs = async (type: 'documents' | 'data' | 'models'): Promise<void> => {
    setError('');
    const result = await storage.addOPFSDirectory(type);
    if (result) {
      refresh();
    } else {
      setError('OPFS-Verzeichnis konnte nicht erstellt werden.');
    }
  };

  const showOpfs = shouldShowOpfsOption();

  const handleRemove = async (id: string): Promise<void> => {
    await storage.removeDirectory(id);
    refresh();
  };

  const startEdit = (dir: DirectoryEntry): void => {
    setEditingId(dir.id);
    setEditLabel(dir.label);
  };

  const saveEdit = async (): Promise<void> => {
    if (!editingId || !editLabel.trim()) return;
    await storage.updateDirectoryLabel(editingId, editLabel.trim());
    setEditingId(null);
    setEditLabel('');
    refresh();
  };

  return (
    <div className="space-y-6">
      <SectionHeader label="Datenordner" />
      <p className="text-[12px] text-[var(--tf-text-secondary)] leading-snug">
        Geteilter Ordner auf dem Netzlaufwerk mit Anträgen, Suchindex und Sync-Stand.
        {dsHandleExists && !dsConnected && ' Aktuell offline — Verbindung kann neu hergestellt werden.'}
      </p>
      <div className="flex items-center justify-between gap-3 mt-1">
        <div className="flex items-center gap-2.5 min-w-0">
          <Database size={16} className="text-[var(--tf-primary)] shrink-0" />
          <div className="min-w-0">
            <p className="text-[13px] text-[var(--tf-text)] truncate">
              {dsHandleExists ? (dsFolderName ?? 'Verbunden') : 'Noch nicht verbunden'}
            </p>
            {dsHandleExists && (
              <p className="text-[11px] text-[var(--tf-text-tertiary)]">
                {dsConnected ? 'Online' : 'Offline'}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {dsHandleExists ? (
            <Button
              variant="secondary"
              icon={RefreshCw}
              onClick={handleReconnectDatenShare}
              disabled={dsBusy}
            >
              {dsBusy ? 'Aktualisiere...' : 'Aktualisieren'}
            </Button>
          ) : (
            <Button
              variant="secondary"
              icon={FolderOpen}
              onClick={handlePickDatenShare}
              disabled={dsBusy}
            >
              Verbinden
            </Button>
          )}
          {dsHandleExists && (
            <button
              onClick={handleDisconnectDatenShare}
              className="p-1 text-[var(--tf-danger-text)] cursor-pointer"
              title="Trennen"
              disabled={dsBusy}
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>

      <SectionHeader label="Persönlicher Ordner" />
      <p className="text-[12px] text-[var(--tf-text-secondary)] leading-snug">
        Speichert Profil, Filter-Presets und Feedback-Outbox dort. Bleibt über
        Browser-Wechsel und Citrix-Sessions hinweg erhalten.
      </p>
      <div className="flex items-center justify-between gap-3 mt-1">
        <div className="flex items-center gap-2.5 min-w-0">
          <FolderHeart size={16} className="text-[var(--tf-primary)] shrink-0" />
          <div className="min-w-0">
            <p className="text-[13px] text-[var(--tf-text)] truncate">
              {persConnected ? (persFolderName ?? 'Verbunden') : 'Noch nicht verbunden'}
            </p>
            {persConnected && (
              <p className="text-[11px] text-[var(--tf-text-tertiary)]">
                {persoenlichAvailable ? 'Online' : 'Offline'}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="secondary"
            icon={FolderOpen}
            onClick={handleConnectPers}
            disabled={persBusy}
          >
            {persConnected ? 'Ändern' : 'Verbinden'}
          </Button>
          {persConnected && (
            <button
              onClick={handleDisconnectPers}
              className="p-1 text-[var(--tf-danger-text)] cursor-pointer"
              title="Trennen"
              disabled={persBusy}
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>

      {showCsvFolder && (
        <>
          <SectionHeader label="CSV-Quellen-Ordner" />
          <p className="text-[12px] text-[var(--tf-text-secondary)] leading-snug">
            Ordner mit den CSV-Quelldateien für die automatische Aktualisierung. Eine
            Freigabe deckt alle Dateien darin ab — nach einem Neustart genügt ein
            „Zulassen", kein erneutes Verknüpfen je Datei.
          </p>
          <div className="flex items-center justify-between gap-3 mt-1">
            <div className="flex items-center gap-2.5 min-w-0">
              <FolderInput size={16} className="text-[var(--tf-primary)] shrink-0" />
              <div className="min-w-0">
                <p className="text-[13px] text-[var(--tf-text)] truncate">
                  {csvDirExists ? (csvDirName ?? 'Verknüpft') : 'Noch nicht verknüpft'}
                </p>
                {csvDirExists && (
                  <p className="text-[11px] text-[var(--tf-text-tertiary)]">
                    {csvDirOnline ? 'Online' : 'Offline'}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="secondary"
                icon={FolderOpen}
                onClick={handlePickCsvFolder}
                disabled={csvBusy}
              >
                {csvBusy ? 'Wähle...' : (csvDirExists ? 'Ändern' : 'Verknüpfen')}
              </Button>
              {csvDirExists && (
                <button
                  onClick={handleDisconnectCsv}
                  className="p-1 text-[var(--tf-danger-text)] cursor-pointer"
                  title="Trennen"
                  disabled={csvBusy}
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {(directories.length > 0 || isKuratorMenusEnabled()) && (
        <SectionHeader label="Verbundene Verzeichnisse" />
      )}

      {directories.length === 0 ? (
        isKuratorMenusEnabled() ? (
          <p className="text-[13px] text-[var(--tf-text-secondary)]">Keine Verzeichnisse verbunden</p>
        ) : null
      ) : (
        directories.map((dir, i) => (
          <ListItem key={dir.id}
            icon={dir.type === 'documents' ? <FileText size={14} className="text-[var(--tf-text-tertiary)]" /> : <Database size={14} className="text-[var(--tf-text-tertiary)]" />}
            title={editingId === dir.id ? (
              <div className="flex items-center gap-1.5">
                <input value={editLabel} onChange={e => setEditLabel(e.target.value)}
                  className="px-2 py-0.5 text-[13px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none"
                  style={{ border: '0.5px solid var(--tf-border)', minWidth: '120px' }}
                  onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null); }}
                  onBlur={saveEdit}
                  autoFocus />
                <button onClick={saveEdit} className="p-0.5 text-[var(--tf-text-secondary)] cursor-pointer hover:text-[var(--tf-text)]" title="Speichern">
                  <Check size={12} />
                </button>
              </div>
            ) : dir.label}
            subtitle={dir.folderName ?? ''}
            meta={
              <div className="flex items-center gap-2">
                <Badge variant={dir.type === 'documents' ? 'info' : 'success'}>{dir.type === 'documents' ? 'Dokumente' : 'Daten'}</Badge>
                {dir.kind === 'opfs' && (
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                    title="OPFS — lokaler Browser-Storage, kein Sharing zwischen Browsern oder Geräten"
                  >
                    <FlaskConical size={10} /> Sandbox
                  </span>
                )}
                {editingId !== dir.id && (
                  <button onClick={() => startEdit(dir)} className="p-1 text-[var(--tf-text-tertiary)] cursor-pointer hover:text-[var(--tf-text)]" title="Umbenennen">
                    <Pencil size={12} />
                  </button>
                )}
                <button onClick={() => handleRemove(dir.id)} className="p-1 text-[var(--tf-danger-text)] cursor-pointer" title="Trennen"><Trash2 size={12} /></button>
              </div>
            }
            last={i === directories.length - 1}
          />
        ))
      )}

      {/* Verzeichnis-Add-Section nur in Setup-fähigen Varianten (dev + kurator);
          in demo/prod/pl ist der Daten-Share fix und persönliche Ordner werden
          beim App-Start oder bei Kürzeleingabe automatisch gesetzt. Gate via
          isKuratorMenusEnabled() — matched präzise dev + kurator. */}
      {isKuratorMenusEnabled() && (
        <>
          <SectionHeader label="Verzeichnis hinzufügen" />

          <div className="flex gap-3 flex-wrap">
            <Button variant="secondary" icon={FileText} onClick={() => handleAdd('documents')}>
              Dokumentverzeichnis (Lesen)
            </Button>
            <Button variant="secondary" icon={Database} onClick={() => handleAdd('data')}>
              Datenverzeichnis (Lesen+Schreiben)
            </Button>
          </div>

          {showOpfs && (
            <div className="mt-2 p-3 rounded-[var(--tf-radius)] bg-amber-50/40 dark:bg-amber-950/20" style={{ border: '0.5px solid var(--tf-border)' }}>
              <p className="text-[12px] font-medium text-[var(--tf-text)] mb-1 flex items-center gap-1.5">
                <FlaskConical size={12} className="text-amber-700 dark:text-amber-400" /> OPFS-Sandbox (Dev/Preview)
              </p>
              <p className="text-[11px] text-[var(--tf-text-tertiary)] mb-2.5">
                Browser-interner Speicher — funktioniert in iframes (Preview), aber kein echtes Sharing zwischen Usern oder Geräten.
              </p>
              <div className="flex gap-2 flex-wrap">
                <Button variant="ghost" icon={FileText} onClick={() => handleAddOpfs('documents')}>OPFS-Dokumente</Button>
                <Button variant="ghost" icon={Database} onClick={() => handleAddOpfs('data')}>OPFS-Daten</Button>
                <Button variant="ghost" icon={FlaskConical} onClick={() => handleAddOpfs('models')}>OPFS-Modelle</Button>
              </div>
            </div>
          )}
        </>
      )}

      {error && <p className="text-[12px] text-[var(--tf-danger-text)]">{error}</p>}
    </div>
  );
}
