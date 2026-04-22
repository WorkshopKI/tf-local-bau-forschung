import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog } from '@/components/ui/dialog';
import { useStorage } from '@/core/hooks/useStorage';
import {
  acquireBuildLock,
  forceLock,
  heartbeat,
  releaseLock,
  readBuildLock,
  setHeartbeatAge,
  isStale,
} from '@/core/services/infrastructure/build-lock';
import type { BuildLock } from '@/core/services/infrastructure/types';
import { DevRow, StatusPill } from './shared';

export function LockPanel(): React.ReactElement {
  const storage = useStorage();
  const [stufe, setStufe] = useState('embedding');
  const [current, setCurrent] = useState<BuildLock | null>(null);
  const [lastMsg, setLastMsg] = useState<string>('');
  const [conflictDialog, setConflictDialog] = useState<{
    existing: BuildLock;
    ageMinutes: number;
  } | null>(null);

  const refresh = useCallback(async () => {
    setCurrent(await readBuildLock(storage.idb));
  }, [storage.idb]);

  useEffect(() => { void refresh(); }, [refresh]);

  const onAcquire = async (): Promise<void> => {
    try {
      const r = await acquireBuildLock(storage.idb, stufe);
      if (r.acquired) {
        setLastMsg(`Lock erworben (${stufe})`);
      } else {
        setConflictDialog({ existing: r.existing, ageMinutes: r.ageMinutes });
        setLastMsg('');
      }
    } catch (err) {
      setLastMsg(`Fehler: ${(err as Error).message}`);
    }
    await refresh();
  };

  const onForce = async (): Promise<void> => {
    if (!conflictDialog) return;
    try {
      await forceLock(storage.idb, stufe);
      setLastMsg('Lock zwangsweise übernommen');
    } catch (err) {
      setLastMsg(`Fehler: ${(err as Error).message}`);
    }
    setConflictDialog(null);
    await refresh();
  };

  const onForceDirect = async (): Promise<void> => {
    try {
      await forceLock(storage.idb, stufe);
      setLastMsg('Lock geforct');
    } catch (err) {
      setLastMsg(`Fehler: ${(err as Error).message}`);
    }
    await refresh();
  };

  const onHeartbeat = async (): Promise<void> => {
    await heartbeat(storage.idb);
    setLastMsg('Heartbeat aktualisiert');
    await refresh();
  };

  const onRelease = async (): Promise<void> => {
    await releaseLock(storage.idb);
    setLastMsg('Lock freigegeben');
    await refresh();
  };

  const onStale = async (): Promise<void> => {
    await setHeartbeatAge(storage.idb, 180);
    setLastMsg('Heartbeat künstlich auf 3h zurückgesetzt');
    await refresh();
  };

  const ageLabel = current ? `${Math.round((Date.now() - Date.parse(current.heartbeat)) / 60_000)}min alt` : '-';
  const stale = current ? isStale(current) : false;

  return (
    <div>
      <DevRow label="Aktueller Lock">
        {current ? (
          <>
            <StatusPill label={current.stufe} tone="neutral" />
            <StatusPill label={current.kurator_name} tone="neutral" />
            <StatusPill label={`Heartbeat ${ageLabel}`} tone={stale ? 'bad' : 'ok'} />
          </>
        ) : (
          <StatusPill label="frei" tone="ok" />
        )}
      </DevRow>
      <DevRow label="Stufe">
        <Input value={stufe} onChange={e => setStufe(e.target.value)} className="max-w-[220px]" />
      </DevRow>
      <DevRow label="Aktionen">
        <Button size="sm" variant="default" onClick={onAcquire}>Acquire</Button>
        <Button size="sm" variant="outline" onClick={onHeartbeat} disabled={!current}>Heartbeat</Button>
        <Button size="sm" variant="outline" onClick={onRelease} disabled={!current}>Release</Button>
      </DevRow>
      <DevRow label="Tests">
        <Button size="sm" variant="outline" onClick={onStale} disabled={!current}>Heartbeat künstlich vor 3h</Button>
        <Button size="sm" variant="ghost" onClick={onForceDirect}>Force ohne Dialog</Button>
      </DevRow>

      {lastMsg ? (
        <div className="mt-2 rounded-md bg-[var(--tf-bg-secondary)] px-3 py-1.5 text-[11.5px] text-[var(--tf-text-secondary)]">{lastMsg}</div>
      ) : null}

      <Dialog
        open={!!conflictDialog}
        onClose={() => setConflictDialog(null)}
        title="Build-Lock aktiv"
        description={conflictDialog
          ? `Kurator ${conflictDialog.existing.kurator_name} baut seit ${Math.round(conflictDialog.ageMinutes)} min (Stufe ${conflictDialog.existing.stufe}). Trotzdem übernehmen?`
          : undefined}
        footer={<>
          <Button size="sm" variant="ghost" onClick={() => setConflictDialog(null)}>Abbrechen</Button>
          <Button size="sm" variant="default" onClick={onForce}>Trotzdem übernehmen</Button>
        </>}
      />
    </div>
  );
}
