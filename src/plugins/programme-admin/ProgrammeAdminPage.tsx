import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog } from '@/components/ui/dialog';
import { useStorage } from '@/core/hooks/useStorage';
import { useKuratorSession } from '@/core/hooks/useKuratorSession';
import { useProfile } from '@/core/hooks/useProfile';
import { useActiveProgramm } from '@/core/hooks/useActiveProgramm';
import { createProgramm, ensureDefaultProgramm, renameProgramm } from '@/core/services/csv';
import { listProgramme } from '@/core/services/csv/idb-csv';
import { logAudit } from '@/core/services/infrastructure/audit-log';
import type { Programm } from '@/core/services/csv/types';
import { SectionHeader } from '@/ui/SectionHeader';

export function ProgrammeAdminPage(): React.ReactElement {
  const storage = useStorage();
  const session = useKuratorSession();
  const { profile, updateProfile } = useProfile();
  const setActive = useActiveProgramm(s => s.setActive);
  const activeProgrammId = useActiveProgramm(s => s.activeProgrammId);
  const refreshActive = useActiveProgramm(s => s.refresh);
  const [programme, setProgramme] = useState<Programm[]>([]);
  const [renameOpen, setRenameOpen] = useState<Programm | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');

  const refresh = useCallback(async () => {
    await ensureDefaultProgramm(storage.idb).catch(() => undefined);
    setProgramme(await listProgramme(storage.idb));
    await refreshActive(storage.idb);
  }, [storage.idb, refreshActive]);

  useEffect(() => { void refresh(); }, [refresh]);

  const onRename = async (): Promise<void> => {
    if (!renameOpen || !newName.trim()) return;
    await renameProgramm(storage.idb, renameOpen.id, newName.trim());
    await logAudit(storage.idb, {
      action: 'programm_renamed',
      user: session.kuratorName ?? undefined,
      details: { id: renameOpen.id, newName: newName.trim() },
    });
    setRenameOpen(null);
    setNewName('');
    await refresh();
  };

  const onCreate = async (): Promise<void> => {
    if (!newName.trim()) return;
    const created = await createProgramm(storage.idb, newName.trim());
    await logAudit(storage.idb, {
      action: 'programm_created',
      user: session.kuratorName ?? undefined,
      details: { id: created.id, name: created.name },
    });
    setCreateOpen(false);
    setNewName('');
    await refresh();
    // Frisch erstelltes Programm direkt aktiv setzen — bequemer Flow.
    if (profile) {
      await setActive(storage.idb, created.id, updateProfile);
    }
  };

  const onSwitchActive = async (id: string): Promise<void> => {
    if (!profile) return;
    await setActive(storage.idb, id, updateProfile);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[22px] font-medium text-[var(--tf-text)]">Programme</h1>
        <Button
          size="sm"
          variant="default"
          onClick={() => { setCreateOpen(true); setNewName(''); }}
          disabled={!session.isActive}
        >
          Neues Programm anlegen
        </Button>
      </div>

      <p className="text-[12.5px] text-[var(--tf-text-secondary)] mb-4">
        Datenmodell-Scope (Aktenzeichen, CSV-Schemas, Anträge) ist an die Programm-ID gebunden.
        Mit dem Sidebar-Switcher wechselt der User zwischen seinen Programmen.
      </p>

      <SectionHeader label="Registrierte Programme" />

      {programme.length === 0 ? (
        <div className="py-10 text-center text-[13px] text-[var(--tf-text-tertiary)]">
          Noch kein Programm registriert. Erst Programm-Ordner im Dev-Panel (SMB) auswählen.
        </div>
      ) : (
        <div>
          {programme.map((p, i) => {
            const isActive = p.id === activeProgrammId;
            return (
              <div
                key={p.id}
                className="flex items-center justify-between py-3"
                style={i === programme.length - 1 ? undefined : { borderBottom: '0.5px solid var(--tf-border)' }}
              >
                <div className="flex items-center gap-2">
                  <div>
                    <div className="text-[14px] text-[var(--tf-text)]">{p.name}</div>
                    <div className="text-[11.5px] font-mono text-[var(--tf-text-tertiary)]">{p.id}</div>
                  </div>
                  {isActive && (
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-medium text-emerald-800">
                      aktiv
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">
                    angelegt {new Date(p.created_at).toLocaleDateString('de-DE')}
                  </span>
                  {!isActive && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { void onSwitchActive(p.id); }}
                    >
                      Aktivieren
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setRenameOpen(p); setNewName(p.name); }}
                    disabled={!session.isActive}
                  >
                    Umbenennen
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog
        open={!!renameOpen}
        onClose={() => setRenameOpen(null)}
        title="Programm umbenennen"
        footer={
          <>
            <Button size="sm" variant="ghost" onClick={() => setRenameOpen(null)}>Abbrechen</Button>
            <Button size="sm" variant="default" onClick={onRename}>Speichern</Button>
          </>
        }
      >
        <Input value={newName} onChange={e => setNewName(e.target.value)} autoFocus />
      </Dialog>

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Neues Programm anlegen"
        footer={
          <>
            <Button size="sm" variant="ghost" onClick={() => setCreateOpen(false)}>Abbrechen</Button>
            <Button size="sm" variant="default" onClick={onCreate} disabled={!newName.trim()}>Anlegen</Button>
          </>
        }
      >
        <div className="space-y-2">
          <p className="text-[12px] text-[var(--tf-text-secondary)]">
            Name des Förderprogramms (z.B. „ZIM 2026", „EXIST", „GO-Bio"). Wird nach dem Anlegen
            sofort als aktiv gesetzt — du kannst dann CSV-Quellen, Filter etc. dafür einrichten.
          </p>
          <Input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Programm-Name"
            autoFocus
          />
        </div>
      </Dialog>
    </div>
  );
}
