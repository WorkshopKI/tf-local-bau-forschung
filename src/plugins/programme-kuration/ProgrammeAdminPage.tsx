import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog } from '@/components/ui/dialog';
import { useStorage } from '@/core/hooks/useStorage';
import { useKuratorSession } from '@/core/hooks/useKuratorSession';
import { useProfile } from '@/core/hooks/useProfile';
import { useActiveProgramm } from '@/core/hooks/useActiveProgramm';
import { createProgramm, deleteProgramm, ensureDefaultProgramm, renameProgramm } from '@/core/services/csv';
import { listAntraegeByProgramm, listProgramme } from '@/core/services/csv/idb-csv';
import { logAudit } from '@/core/services/infrastructure/audit-log';
import type { Programm } from '@/core/services/csv/types';
import { SectionHeader } from '@/ui/SectionHeader';
import { UnterprogrammeSection } from './unterprogramme/UnterprogrammeSection';

export function ProgrammeAdminPage(): React.ReactElement {
  const storage = useStorage();
  const session = useKuratorSession();
  const { profile, updateProfile } = useProfile();
  const setActive = useActiveProgramm(s => s.setActive);
  const activeProgrammId = useActiveProgramm(s => s.activeProgrammId);
  const refreshActive = useActiveProgramm(s => s.refresh);
  const [programme, setProgramme] = useState<Programm[]>([]);
  const [antragCounts, setAntragCounts] = useState<Map<string, number>>(new Map());
  const [renameOpen, setRenameOpen] = useState<Programm | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Programm | null>(null);
  const [newName, setNewName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    await ensureDefaultProgramm(storage.idb).catch(() => undefined);
    const list = await listProgramme(storage.idb);
    setProgramme(list);
    // Antragszahlen pro Programm — entscheidet ob "Löschen" möglich ist.
    const counts = new Map<string, number>();
    for (const p of list) {
      const a = await listAntraegeByProgramm(storage.idb, p.id);
      counts.set(p.id, a.length);
    }
    setAntragCounts(counts);
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

  const onDelete = async (): Promise<void> => {
    if (!deleteConfirm) return;
    const target = deleteConfirm;
    setErrorMsg(null);
    const r = await deleteProgramm(storage.idb, target.id);
    if (!r.ok) {
      // Sollte nicht passieren — UI zeigt den Knopf nur bei 0 Anträgen + > 1 Programm.
      // Defensiv trotzdem behandeln (Race Condition: jemand importiert während Dialog offen).
      if (r.reason === 'has_antraege') {
        setErrorMsg(`Programm hat ${r.antragCount} Anträge — nicht löschbar.`);
      } else if (r.reason === 'last_programm') {
        setErrorMsg('Letztes Programm — kann nicht gelöscht werden.');
      } else {
        setErrorMsg('Programm nicht gefunden.');
      }
      return;
    }
    await logAudit(storage.idb, {
      action: 'programm_deleted',
      user: session.kuratorName ?? undefined,
      details: { id: target.id, name: target.name, cleaned: r.cleaned },
    });
    setDeleteConfirm(null);
    // Falls das gelöschte Programm das aktive war: refresh setzt activeProgrammId
    // im Store automatisch auf das erste verbleibende Programm. Profile-Persistenz
    // dazu hier explizit, damit die alte ID nicht im Profile zurückbleibt.
    const wasActive = activeProgrammId === target.id;
    await refresh();
    if (wasActive && profile) {
      const newActive = useActiveProgramm.getState().activeProgrammId;
      if (newActive) {
        await updateProfile({ activeProgrammId: newActive });
      }
    }
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
            const count = antragCounts.get(p.id) ?? 0;
            const canDelete = count === 0 && programme.length > 1;
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
                    {count} Anträge · angelegt {new Date(p.created_at).toLocaleDateString('de-DE')}
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
                  {canDelete && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => { setDeleteConfirm(p); setErrorMsg(null); }}
                      disabled={!session.isActive}
                      title="Programm löschen (nur möglich bei 0 Anträgen)"
                    >
                      Löschen
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeProgrammId ? (
        <UnterprogrammeSection
          key={activeProgrammId}
          programmId={activeProgrammId}
          programmName={programme.find(p => p.id === activeProgrammId)?.name}
        />
      ) : null}

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
        open={!!deleteConfirm}
        onClose={() => { setDeleteConfirm(null); setErrorMsg(null); }}
        title="Programm löschen"
        footer={
          <>
            <Button size="sm" variant="ghost" onClick={() => { setDeleteConfirm(null); setErrorMsg(null); }}>Abbrechen</Button>
            <Button size="sm" variant="destructive" onClick={onDelete}>Endgültig löschen</Button>
          </>
        }
      >
        <div className="space-y-2">
          <p className="text-[13px] text-[var(--tf-text)]">
            Programm <strong>{deleteConfirm?.name}</strong> wirklich löschen?
          </p>
          <p className="text-[12px] text-[var(--tf-text-secondary)]">
            Es hat 0 Anträge — der Programm-Eintrag wird aus IDB entfernt. Zugehörige
            CSV-Schemas, Row-Hashes, Unterprogramme, Verbünde und Filter werden ebenfalls
            gelöscht (Cascade-Cleanup).
          </p>
          {errorMsg && (
            <p className="text-[12px] text-red-600">{errorMsg}</p>
          )}
        </div>
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
