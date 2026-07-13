import { useState, useEffect } from 'react';
import { Trash2, FileText, Database, Pencil, Check, FlaskConical, FolderHeart, FolderOpen, RefreshCw, FolderInput, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ListItem } from '@/components/ui/ListItem';
import { SettingsSectionHeader, SettingsFileRow } from './_shared/settings-primitives';
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
import { runDataUpdate } from '@/plugins/csv-sources-kuration/services/data-update';
import type { CsvSchema } from '@/core/services/csv/types';
import {
  listeArbeitskontext,
  clearArbeitskontextLog,
  type ArbeitskontextEintrag,
  type ArbeitskontextTyp,
} from '@/core/services/personal-storage/arbeitskontext-log';

const VERLAUF_TYP_LABEL: Record<ArbeitskontextTyp, string> = {
  gutachten: 'Gutachten',
  nachforderung: 'Nachforderungen',
  kurzfassung: 'Kurzfassung',
};

function formatVerlaufZeit(ts: string): string {
  try { return new Date(ts).toLocaleString('de-DE'); } catch { return ts; }
}

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

  // Manuelle Datenaktualisierung (Orchestrator: Snapshot → CSV-Auto-Import).
  const [updateBusy, setUpdateBusy] = useState(false);
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);

  // Arbeitsverlauf (rein lokales IDB-Log, Quelle der Home-„Weitermachen"-Karte).
  const [verlauf, setVerlauf] = useState<ArbeitskontextEintrag[]>([]);
  const [verlaufBusy, setVerlaufBusy] = useState(false);

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

  useEffect(() => {
    let cancelled = false;
    void listeArbeitskontext(storage.idb)
      .then(list => { if (!cancelled) setVerlauf(list); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [storage]);

  const handleClearVerlauf = async (): Promise<void> => {
    if (!window.confirm(
      'Arbeitsverlauf löschen? Die „Weitermachen"-Karte auf der Startseite wird geleert. '
      + 'Nur lokal auf diesem Gerät — Anträge, Gutachten und Nachforderungen bleiben unberührt.',
    )) return;
    setVerlaufBusy(true);
    try {
      await clearArbeitskontextLog(storage.idb);
      setVerlauf([]);
    } finally {
      setVerlaufBusy(false);
    }
  };

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

  // Manueller Aufruf DESSELBEN Orchestrator-Pfads wie beim Start: Datenbestand
  // (Snapshot) prüfen+laden, dann verknüpfte Export-CSVs prüfen+importieren.
  const handleRunDataUpdate = async (): Promise<void> => {
    setError('');
    setUpdateMsg(null);
    setUpdateBusy(true);
    try {
      const handle = await getDatenShareHandle(storage.idb);
      if (!handle) {
        setError('Datenordner nicht verbunden.');
        return;
      }
      const r = await runDataUpdate(storage.idb, handle, {});
      bumpCsvSourcesSignal();
      const parts: string[] = [];
      if (r.snapshotSynced) parts.push('Datenbestand aktualisiert');
      const imported = r.csvReport?.processed.filter(p => !p.skipped).length ?? 0;
      if (imported > 0) parts.push(`${imported} CSV-Quelle(n) importiert`);
      if (r.lockBusy) parts.push(`CSV-Import übersprungen — ${r.lockBusy.blockingKurator} aktualisiert gerade`);
      setUpdateMsg(parts.length > 0 ? parts.join(' · ') : 'Bereits aktuell.');
      // „Letzter CSV-Import" sofort frisch zeigen — last_imported_at neu einlesen,
      // statt auf einen Browser-Reload zu warten (csvSchemas wurde nur beim Mount geladen).
      try {
        const schemas: CsvSchema[] = [];
        for (const p of await listProgramme(storage.idb)) schemas.push(...(await listSchemas(storage.idb, p.id)));
        setCsvSchemas(schemas);
      } catch { /* Anzeige best-effort */ }
    } finally {
      setUpdateBusy(false);
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

  // „Letzter CSV-Import" — jüngstes last_imported_at über alle CSV-Schemas (ISO-
  // Strings sortieren chronologisch). Zeigt dem User sofort, von wann seine CSV-
  // Daten stammen. Leer in prod (dort werden keine CSV-Schemas geladen).
  const importIsos = csvSchemas
    .map(s => s.last_imported_at)
    .filter((x): x is string => !!x)
    .sort();
  const lastCsvImport = importIsos.length > 0
    ? new Date(importIsos[importIsos.length - 1]!).toLocaleString('de-DE')
    : null;

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
    <div className="space-y-8">
      {/* Speicherorte — Datenordner (inkl. gefalteter Datenaktualisierung),
          Persönlicher Ordner, CSV-Quellen als frow-Datei-Zeilen. */}
      <section id="sec-speicher" className="scroll-mt-20">
        <SettingsSectionHeader label="Speicherorte" />

        <SettingsFileRow
          first
          spacious
          icon={<Database size={15} strokeWidth={1.5} />}
          name="Datenordner"
          value={dsHandleExists ? (dsFolderName ?? 'Verbunden') : undefined}
          connected={dsHandleExists && dsConnected}
          hint="Geteilter Ordner auf dem Netzlaufwerk mit Anträgen, Suchindex und Sync-Stand."
          meta={dsHandleExists ? (
            <>
              {lastCsvImport
                ? <>Letzter CSV-Import: <span className="font-medium text-[var(--tf-text-secondary)]">{lastCsvImport}</span> · prüft beim Start automatisch auf neuere Exporte</>
                : <>Prüft beim Start automatisch auf neuere Exporte</>}
              {!dsConnected && ' · offline'}
              {updateMsg && <> · {updateMsg}</>}
            </>
          ) : 'Noch nicht verbunden — Ordner auf dem Netzlaufwerk wählen'}
          actions={
            <>
              {dsHandleExists ? (
                dsConnected ? (
                  <Button variant="secondary" size="sm" icon={RefreshCw} onClick={handleRunDataUpdate} disabled={updateBusy}>
                    {updateBusy ? 'Aktualisiere…' : 'Jetzt aktualisieren'}
                  </Button>
                ) : (
                  <Button variant="secondary" size="sm" icon={RefreshCw} onClick={handleReconnectDatenShare} disabled={dsBusy}>
                    {dsBusy ? 'Aktualisiere...' : 'Erneut verbinden'}
                  </Button>
                )
              ) : (
                <Button variant="secondary" size="sm" icon={FolderOpen} onClick={handlePickDatenShare} disabled={dsBusy}>
                  Verbinden
                </Button>
              )}
              {dsHandleExists && (
                <button onClick={handleDisconnectDatenShare} className="p-1 text-[var(--tf-text-tertiary)] hover:text-[var(--tf-danger-text)] cursor-pointer" title="Trennen" disabled={dsBusy}>
                  <Trash2 size={13} />
                </button>
              )}
            </>
          }
        />


        <SettingsFileRow
          spacious
          icon={<FolderHeart size={15} strokeWidth={1.5} />}
          name="Persönlicher Ordner"
          value={persConnected ? (persFolderName ?? 'Verbunden') : undefined}
          connected={persConnected && persoenlichAvailable}
          hint="Speichert Profil, Filter-Presets und Feedback-Outbox. Bleibt über Browser-Wechsel und Citrix-Sessions hinweg erhalten."
          meta={!persConnected ? 'Noch nicht verbunden' : (!persoenlichAvailable ? 'Offline' : undefined)}
          actions={
            <>
              <Button variant="secondary" size="sm" icon={FolderOpen} onClick={handleConnectPers} disabled={persBusy}>
                {persConnected ? 'Ändern' : 'Verbinden'}
              </Button>
              {persConnected && (
                <button onClick={handleDisconnectPers} className="p-1 text-[var(--tf-text-tertiary)] hover:text-[var(--tf-danger-text)] cursor-pointer" title="Trennen" disabled={persBusy}>
                  <Trash2 size={13} />
                </button>
              )}
            </>
          }
        />

        {showCsvFolder && (
          <SettingsFileRow
            spacious
            icon={<FolderInput size={15} strokeWidth={1.5} />}
            name="CSV-Quellen"
            value={csvDirExists ? (csvDirName ?? 'Verknüpft') : undefined}
            connected={csvDirExists && csvDirOnline}
            hint={'Ordner mit den CSV-Quelldateien für die automatische Aktualisierung. Eine Freigabe deckt alle Dateien darin ab — nach einem Neustart genügt ein „Zulassen".'}
            meta={!csvDirExists ? 'Noch nicht verknüpft' : (!csvDirOnline ? 'Offline' : undefined)}
            actions={
              <>
                <Button variant="secondary" size="sm" icon={FolderOpen} onClick={handlePickCsvFolder} disabled={csvBusy}>
                  {csvBusy ? 'Wähle...' : (csvDirExists ? 'Ändern' : 'Verknüpfen')}
                </Button>
                {csvDirExists && (
                  <button onClick={handleDisconnectCsv} className="p-1 text-[var(--tf-text-tertiary)] hover:text-[var(--tf-danger-text)] cursor-pointer" title="Trennen" disabled={csvBusy}>
                    <Trash2 size={13} />
                  </button>
                )}
              </>
            }
          />
        )}
      </section>

      {verlauf.length > 0 && (
        <section className="scroll-mt-20 space-y-3">
          <SettingsSectionHeader label="Arbeitsverlauf" />
          <p className="text-[12px] text-[var(--tf-text-secondary)] leading-snug">
            Zuletzt bearbeitete Gutachten, Nachforderungen und Kurzfassungen — Quelle der
            „Weitermachen"-Karte auf der Startseite.{' '}
            <span className="text-[var(--tf-text-tertiary)]">Nur lokal auf diesem Gerät; wird nicht synchronisiert oder exportiert.</span>
          </p>
          <div className="rounded-[var(--tf-radius)] overflow-hidden" style={{ border: '0.5px solid var(--tf-border)' }}>
            {verlauf.map((e, i) => (
              <ListItem
                key={`${e.typ}:${e.verbundKey}`}
                icon={<History size={14} className="text-[var(--tf-text-tertiary)]" />}
                title={VERLAUF_TYP_LABEL[e.typ]}
                subtitle={e.verbundKey}
                meta={<span className="text-[11px] text-[var(--tf-text-tertiary)] tabular-nums">{formatVerlaufZeit(e.ts)}</span>}
                last={i === verlauf.length - 1}
              />
            ))}
          </div>
          <div>
            <Button variant="secondary" icon={Trash2} onClick={handleClearVerlauf} disabled={verlaufBusy}>
              {verlaufBusy ? 'Lösche…' : 'Verlauf löschen'}
            </Button>
          </div>
        </section>
      )}


      <section className="scroll-mt-20 space-y-4">
      {(directories.length > 0 || isKuratorMenusEnabled()) && (
        <SettingsSectionHeader label="Verbundene Verzeichnisse" />
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
          <SettingsSectionHeader label="Verzeichnis hinzufügen" />

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

      </section>

      {error && <p className="text-[12px] text-[var(--tf-danger-text)]">{error}</p>}
    </div>
  );
}
