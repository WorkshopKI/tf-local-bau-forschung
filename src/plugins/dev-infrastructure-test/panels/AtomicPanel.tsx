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
import { ActionRow, Archive, Danger, DevLog, Field, SectionCaption, StatusPill } from './shared';

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

  const lastBackup = backups[backups.length - 1];

  return (
    <div className="px-8 py-6 max-w-[760px]">
      <h2 className="text-[18px] font-medium text-[var(--tf-text)]">Atomic Writes &amp; wöchentliche Backups</h2>
      <p className="text-[13px] text-[var(--tf-text-secondary)] leading-relaxed mt-1.5 mb-5 max-w-[620px]">
        Eine Schreibspur, mit der man prüft: Schreiben → temporär → fsync → rename. Plus manuelle Snapshot-Erstellung.
      </p>

      <SectionCaption>Snapshots</SectionCaption>
      <ActionRow
        title="Backup erstellen"
        hint="Wöchentlicher Snapshot manuell. Rolling 4 Generationen unter backups/YYYY-MM-DD/."
        lastRun={lastBackup ? `${lastBackup.datum} · ${lastBackup.fileCount} Datei(en)` : 'noch nie'}
        btn={<Button size="sm" onClick={() => void onBackup()}>Backup erstellen</Button>}
      />
      <Field
        label="Aktuelle Snapshots"
        hint={<StatusPill label={`${backups.length} / 4`} tone={backups.length > 4 ? 'warn' : 'neutral'} />}
      >
        <DevLog lines={backups.length === 0 ? [] : backups.map(b => `${b.datum}  ${b.fileCount} Datei(en)`)} />
      </Field>

      <SectionCaption>Test-Schreiben</SectionCaption>
      <Field label="Pfad">
        <Input value={filename} onChange={e => setFilename(e.target.value)} placeholder="admin/notes.txt" />
      </Field>
      <Field label="Inhalt">
        <Textarea value={content} onChange={e => setContent(e.target.value)} rows={3} style={{ resize: 'vertical' }} />
      </Field>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => void onWrite()}>Datei atomic schreiben</Button>
        <Button size="sm" variant="ghost" onClick={() => void refresh()}>Ordner neu laden</Button>
      </div>

      <Archive title="Diagnose (selten)">
        <Field label="Dateien im Ordner" hint="Diagnose, falls atomic-rename fehlschlägt.">
          <DevLog lines={adminFiles.map(f => `${f.hasBackup ? '✓' : ' '} ${f.name}${f.hasBackup ? '  [+ .backup]' : ''}`)} />
        </Field>
      </Archive>

      <Danger>
        <ActionRow
          title="Ältesten Snapshot löschen"
          hint="Macht Platz, wenn die 4-Slot-Rotation klemmt."
          btn={
            <Button size="sm" variant="destructive" onClick={() => void onDeleteOldest()} disabled={backups.length === 0}>
              Löschen
            </Button>
          }
        />
      </Danger>

      {lastMsg ? (
        <div className="mt-5 rounded-[var(--tf-radius)] bg-[var(--tf-bg-secondary)] px-3 py-2 text-[12px] text-[var(--tf-text-secondary)] break-words">
          {lastMsg}
        </div>
      ) : null}
    </div>
  );
}
