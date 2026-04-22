import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useStorage } from '@/core/hooks/useStorage';
import { getSmbHandle, getProgrammHandle } from '@/core/services/infrastructure/smb-handle';
import { atomicWrite, listFilesWithBackupInfo } from '@/core/services/infrastructure/atomic-write';
import {
  createWeeklyBackup,
  listBackups,
  deleteOldestBackup,
} from '@/core/services/infrastructure/backup';
import { logAudit } from '@/core/services/infrastructure/audit-log';
import type { BackupEntry } from '@/core/services/infrastructure/types';
import { DevRow, DevLog, StatusPill } from './shared';

const DEFAULT_FILENAME = 'admin/notes.txt';

export function AtomicPanel(): React.ReactElement {
  const storage = useStorage();
  const [filename, setFilename] = useState(DEFAULT_FILENAME);
  const [content, setContent] = useState('Hallo Welt');
  const [adminFiles, setAdminFiles] = useState<Array<{ name: string; hasBackup: boolean }>>([]);
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [lastMsg, setLastMsg] = useState<string>('');

  const refresh = useCallback(async () => {
    const parent = await getSmbHandle(storage.idb);
    if (!parent) { setAdminFiles([]); setBackups([]); return; }
    const programm = await getProgrammHandle(parent);
    const dirPath = filename.includes('/') ? filename.split('/').slice(0, -1).join('/') : '';
    setAdminFiles(await listFilesWithBackupInfo(programm, dirPath || 'admin'));
    setBackups(await listBackups(storage.idb));
  }, [storage.idb, filename]);

  useEffect(() => { void refresh(); }, [refresh]);

  const onWrite = async (): Promise<void> => {
    const parent = await getSmbHandle(storage.idb);
    if (!parent) { setLastMsg('Kein SMB-Handle'); return; }
    const programm = await getProgrammHandle(parent);
    try {
      await atomicWrite(programm, filename, content);
      await logAudit(storage.idb, { action: 'atomic_write', details: { path: filename, bytes: content.length } });
      setLastMsg(`Geschrieben: ${filename} (${content.length} Bytes)`);
    } catch (err) {
      setLastMsg(`Fehler: ${(err as Error).message}`);
    }
    await refresh();
  };

  const onBackup = async (): Promise<void> => {
    try {
      const r = await createWeeklyBackup(storage.idb);
      setLastMsg(`Snapshot ${r.created} · ${r.copiedFiles} Dateien · ${r.durationMs}ms${r.rotatedOut ? ` · rotiert: ${r.rotatedOut}` : ''}`);
    } catch (err) {
      setLastMsg(`Backup-Fehler: ${(err as Error).message}`);
    }
    await refresh();
  };

  const onDeleteOldest = async (): Promise<void> => {
    const removed = await deleteOldestBackup(storage.idb);
    setLastMsg(removed ? `Ältesten Snapshot gelöscht: ${removed}` : 'Kein Snapshot zum Löschen');
    await refresh();
  };

  return (
    <div>
      <DevRow label="Atomic Write">
        <div className="w-full flex flex-col gap-1.5">
          <Input value={filename} onChange={e => setFilename(e.target.value)} placeholder="admin/notes.txt" />
          <Textarea value={content} onChange={e => setContent(e.target.value)} rows={3} />
          <div className="flex gap-1.5">
            <Button size="sm" variant="default" onClick={onWrite}>Datei atomic schreiben</Button>
            <Button size="xs" variant="ghost" onClick={() => void refresh()}>Neu laden</Button>
          </div>
        </div>
      </DevRow>
      <DevRow label="Dateien im Ordner">
        <div className="w-full">
          <DevLog lines={adminFiles.map(f => `${f.hasBackup ? '✓' : ' '} ${f.name}${f.hasBackup ? '  [+ .backup]' : ''}`)} />
        </div>
      </DevRow>
      <DevRow label="Wöchentliche Backups">
        <Button size="sm" variant="default" onClick={onBackup}>Backup erstellen</Button>
        <Button size="sm" variant="outline" onClick={onDeleteOldest} disabled={backups.length === 0}>Ältesten löschen</Button>
      </DevRow>
      <DevRow label="Aktuelle Snapshots">
        <div className="w-full">
          <DevLog lines={backups.length === 0 ? [] : backups.map(b => `${b.datum}  ${b.fileCount} Datei(en)`)} />
          <div className="mt-1">
            <StatusPill label={`${backups.length} / 4`} tone={backups.length > 4 ? 'warn' : 'neutral'} />
          </div>
        </div>
      </DevRow>
      {lastMsg ? (
        <div className="mt-2 rounded-md bg-[var(--tf-bg-secondary)] px-3 py-1.5 text-[11.5px] text-[var(--tf-text-secondary)]">{lastMsg}</div>
      ) : null}
    </div>
  );
}
