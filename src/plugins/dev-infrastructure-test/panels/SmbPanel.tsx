import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useStorage } from '@/core/hooks/useStorage';
import { useSmbStatus } from '@/core/hooks/useSmbStatus';
import {
  pickAndStoreParentHandle,
  pickAndStoreDokumentenquelleHandle,
  getSmbHandle,
  getDokumentenquelleHandle,
  clearDokumentenquelleHandle,
  ensureFolderStructure,
  refreshPermission,
  queryPermission,
  clearSmbHandle,
} from '@/core/services/infrastructure/smb-handle';
import { logAudit } from '@/core/services/infrastructure/audit-log';
import { DevRow, StatusPill } from './shared';

type PermState = 'granted' | 'denied' | 'prompt' | 'unknown';

export function SmbPanel(): React.ReactElement {
  const storage = useStorage();
  const smbStatus = useSmbStatus();
  const [handleName, setHandleName] = useState<string | null>(null);
  const [permission, setPermission] = useState<PermState>('unknown');
  const [dokuHandleName, setDokuHandleName] = useState<string | null>(null);
  const [lastMsg, setLastMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const h = await getSmbHandle(storage.idb);
    setHandleName(h?.name ?? null);
    if (h) {
      try {
        setPermission(await queryPermission(h));
      } catch {
        setPermission('unknown');
      }
    } else {
      setPermission('unknown');
    }
    const doku = await getDokumentenquelleHandle(storage.idb);
    setDokuHandleName(doku?.name ?? null);
  }, [storage.idb]);

  useEffect(() => { void refresh(); }, [refresh]);

  const onPick = async (): Promise<void> => {
    setLastMsg(null);
    const r = await pickAndStoreParentHandle(storage.idb);
    if (r.ok) {
      await logAudit(storage.idb, { action: 'smb_handle_pick', details: { folderName: r.handle.name } });
      setLastMsg(`Ordner verbunden: ${r.handle.name}`);
    } else if (r.reason === 'aborted') {
      setLastMsg('Auswahl abgebrochen.');
    } else if (r.reason === 'unsupported') {
      setLastMsg(r.message ?? 'File System Access API nicht verfügbar.');
    } else {
      setLastMsg(`Picker-Fehler: ${r.message ?? 'unbekannt'}`);
    }
    await refresh();
    void smbStatus.check(storage.idb);
  };

  const onRefreshPermission = async (): Promise<void> => {
    setLastMsg(null);
    const h = await getSmbHandle(storage.idb);
    if (!h) { setLastMsg('Kein Handle gespeichert.'); return; }
    try {
      const p = await refreshPermission(h);
      setLastMsg(`Permission: ${p}`);
    } catch (err) {
      setLastMsg(`Permission-Fehler: ${(err as Error).message}`);
    }
    await refresh();
    void smbStatus.check(storage.idb);
  };

  const onInitStructure = async (): Promise<void> => {
    setLastMsg(null);
    const h = await getSmbHandle(storage.idb);
    if (!h) { setLastMsg('Kein Handle gespeichert.'); return; }
    try {
      await ensureFolderStructure(h);
      await logAudit(storage.idb, { action: 'smb_folder_init' });
      setLastMsg('Ordnerstruktur angelegt (programm/ + backups/ + _intern/ + README.txt).');
    } catch (err) {
      setLastMsg(`Init-Fehler: ${(err as Error).message}`);
    }
    void smbStatus.check(storage.idb);
  };

  const onSimDisconnect = (): void => {
    smbStatus.simulateDisconnect(30_000);
  };

  const onCheck = (): void => {
    void smbStatus.check(storage.idb);
  };

  const onClearHandle = async (): Promise<void> => {
    await clearSmbHandle(storage.idb);
    await logAudit(storage.idb, { action: 'smb_handle_clear' });
    await refresh();
    void smbStatus.check(storage.idb);
  };

  const onPickDoku = async (): Promise<void> => {
    setLastMsg(null);
    const r = await pickAndStoreDokumentenquelleHandle(storage.idb);
    if (r.ok) {
      await logAudit(storage.idb, { action: 'dokumentenquelle_handle_set', details: { folderName: r.handle.name } });
      setLastMsg(`Dokumentenquelle verbunden: ${r.handle.name}`);
    } else if (r.reason === 'aborted') {
      setLastMsg('Dokumentenquelle-Auswahl abgebrochen.');
    } else {
      setLastMsg(`Picker-Fehler: ${r.message ?? 'unbekannt'}`);
    }
    await refresh();
  };

  const onClearDoku = async (): Promise<void> => {
    await clearDokumentenquelleHandle(storage.idb);
    await refresh();
    setLastMsg('Dokumentenquelle-Handle entfernt.');
  };

  const handleTone = handleName ? (permission === 'granted' ? 'ok' : 'warn') : 'neutral';
  const statusTone = smbStatus.status === 'online' ? 'ok'
    : smbStatus.status === 'offline' ? 'warn'
    : smbStatus.status === 'permission_denied' ? 'bad' : 'neutral';

  return (
    <div>
      <div className="mb-3 text-[12px] text-[var(--tf-text-secondary)]">
        Wähle den <b>Daten-Share-Root</b>, in dem <code className="text-[11px]">programm/</code>, <code className="text-[11px]">backups/</code> und <code className="text-[11px]">_intern/</code> als Geschwister liegen.
      </div>
      <DevRow label="Daten-Share">
        <StatusPill label={handleName ? `✓ ${handleName}` : 'nicht gesetzt'} tone={handleTone} />
        <StatusPill label={`Permission: ${permission}`} tone={permission === 'granted' ? 'ok' : permission === 'denied' ? 'bad' : 'warn'} />
      </DevRow>
      <DevRow label="Dokumentenquelle">
        <StatusPill label={dokuHandleName ? `✓ ${dokuHandleName}` : 'nicht gesetzt'} tone={dokuHandleName ? 'ok' : 'neutral'} />
        <Button size="xs" variant="outline" onClick={onPickDoku}>Dokumentenquelle-Handle setzen</Button>
        {dokuHandleName ? <Button size="xs" variant="ghost" onClick={onClearDoku}>Vergessen</Button> : null}
      </DevRow>
      <DevRow label="Status">
        <StatusPill label={smbStatus.status} tone={statusTone} />
      </DevRow>
      <DevRow label="Aktionen">
        <Button size="sm" variant="default" onClick={onPick}>Daten-Share-Root auswählen</Button>
        <Button size="sm" variant="outline" onClick={onRefreshPermission} disabled={!handleName}>Permission anfordern</Button>
        <Button size="sm" variant="outline" onClick={onInitStructure} disabled={!handleName}>Ordnerstruktur initialisieren</Button>
      </DevRow>
      <DevRow label="Tests">
        <Button size="sm" variant="outline" onClick={onCheck}>Verbindung prüfen</Button>
        <Button size="sm" variant="outline" onClick={onSimDisconnect}>Disconnect simulieren (30s)</Button>
        <Button size="sm" variant="ghost" onClick={onClearHandle} disabled={!handleName}>Handle vergessen</Button>
      </DevRow>
      {lastMsg ? (
        <div className="mt-2 rounded-md bg-[var(--tf-bg-secondary)] px-3 py-1.5 text-[11.5px] text-[var(--tf-text-secondary)] break-words">{lastMsg}</div>
      ) : null}
    </div>
  );
}
