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
import { ActionRow, Archive, Danger, Field, SectionCaption, StatusPill } from './shared';

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
    <div className="px-8 py-6 max-w-[760px]">
      <h2 className="text-[18px] font-medium text-[var(--tf-text)]">Build-Lock</h2>
      <p className="text-[13px] text-[var(--tf-text-secondary)] leading-relaxed mt-1.5 mb-5 max-w-[620px]">
        Stage-Locking + Heartbeat, damit zwei Instanzen nicht parallel ein Embedding bauen.
      </p>

      <Field label="Aktueller Lock">
        <div className="flex items-center flex-wrap gap-2">
          {current ? (
            <>
              <StatusPill label={current.stufe} tone="neutral" />
              <StatusPill label={current.kurator_name} tone="neutral" />
              <StatusPill label={`Heartbeat ${ageLabel}`} tone={stale ? 'bad' : 'ok'} />
            </>
          ) : (
            <StatusPill label="frei" tone="ok" />
          )}
        </div>
      </Field>

      <Field label="Stufe">
        <Input value={stufe} onChange={e => setStufe(e.target.value)} className="max-w-[220px]" />
      </Field>

      <SectionCaption>Häufig</SectionCaption>
      <ActionRow
        title="Acquire"
        hint="Lock setzen. Schlägt fehl, wenn jemand anderes ihn hält — Dialog erscheint mit Übernahme-Option."
        btn={<Button size="sm" onClick={() => void onAcquire()}>Acquire</Button>}
      />
      <ActionRow
        title="Heartbeat"
        hint="Verlängert den Lock. Im Normalbetrieb läuft das automatisch."
        btn={
          <Button size="sm" variant="outline" onClick={() => void onHeartbeat()} disabled={!current}>
            Heartbeat
          </Button>
        }
      />
      <ActionRow
        title="Release"
        hint="Lock freigeben."
        btn={
          <Button size="sm" variant="outline" onClick={() => void onRelease()} disabled={!current}>
            Release
          </Button>
        }
      />

      <Archive title="Tests">
        <ActionRow
          title="Heartbeat künstlich vor 3 h"
          hint="Simuliert einen toten Prozess für Stale-Lock-Tests."
          btn={
            <Button size="sm" variant="outline" onClick={() => void onStale()} disabled={!current}>
              Vorspulen
            </Button>
          }
        />
      </Archive>

      <Danger>
        <ActionRow
          title="Force ohne Dialog"
          hint="Bricht einen fremden Lock ohne Bestätigung. Nur in Tests."
          btn={
            <Button size="sm" variant="destructive" onClick={() => void onForceDirect()}>
              Force
            </Button>
          }
        />
      </Danger>

      {lastMsg ? (
        <div className="mt-5 rounded-[var(--tf-radius)] bg-[var(--tf-bg-secondary)] px-3 py-2 text-[12px] text-[var(--tf-text-secondary)] break-words">
          {lastMsg}
        </div>
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
