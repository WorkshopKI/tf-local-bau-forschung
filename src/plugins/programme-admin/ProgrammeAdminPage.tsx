import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog } from '@/components/ui/dialog';
import { useStorage } from '@/core/hooks/useStorage';
import { useKuratorSession } from '@/core/hooks/useKuratorSession';
import { ensureDefaultProgramm, renameProgramm } from '@/core/services/csv';
import { listProgramme } from '@/core/services/csv/idb-csv';
import { logAudit } from '@/core/services/infrastructure/audit-log';
import type { Programm } from '@/core/services/csv/types';
import { SectionHeader } from '@/ui/SectionHeader';

export function ProgrammeAdminPage(): React.ReactElement {
  const storage = useStorage();
  const session = useKuratorSession();
  const [programme, setProgramme] = useState<Programm[]>([]);
  const [renameOpen, setRenameOpen] = useState<Programm | null>(null);
  const [newName, setNewName] = useState('');

  const refresh = useCallback(async () => {
    await ensureDefaultProgramm(storage.idb).catch(() => undefined);
    setProgramme(await listProgramme(storage.idb));
  }, [storage.idb]);

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

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[22px] font-medium text-[var(--tf-text)]">Programme</h1>
      </div>

      <p className="text-[12.5px] text-[var(--tf-text-secondary)] mb-4">
        In Phase 1b ist genau ein Programm aktiv. Der Datenmodell-Scope (aktenzeichen, csv-schemas,
        antraege) ist an die Programm-ID gebunden.
      </p>

      <SectionHeader label="Registrierte Programme" />

      {programme.length === 0 ? (
        <div className="py-10 text-center text-[13px] text-[var(--tf-text-tertiary)]">
          Noch kein Programm registriert. Erst Programm-Ordner im Dev-Panel (SMB) auswählen.
        </div>
      ) : (
        <div>
          {programme.map((p, i) => (
            <div
              key={p.id}
              className="flex items-center justify-between py-3"
              style={i === programme.length - 1 ? undefined : { borderBottom: '0.5px solid var(--tf-border)' }}
            >
              <div>
                <div className="text-[14px] text-[var(--tf-text)]">{p.name}</div>
                <div className="text-[11.5px] font-mono text-[var(--tf-text-tertiary)]">{p.id}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">
                  angelegt {new Date(p.created_at).toLocaleDateString('de-DE')}
                </span>
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
          ))}
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
    </div>
  );
}
