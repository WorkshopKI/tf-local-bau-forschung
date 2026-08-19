/**
 * Gruppe „Programme" im Panel „Förderprogramme" — bis v4.35 die eigene Seite
 * `/kuration/programme`.
 *
 * Der Bestand kommt von aussen (`useProgrammBestand`), weil ihn die
 * Unterprogramm-Gruppe und die Nebenspalte derselben Seite ebenfalls lesen.
 * Hier bleiben nur die Aktionen und ihre drei Dialoge.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog } from '@/components/ui/dialog';
import { useStorage } from '@/core/hooks/useStorage';
import { useKuratorSession } from '@/core/hooks/useKuratorSession';
import { useProfile } from '@/core/hooks/useProfile';
import { useActiveProgramm } from '@/core/hooks/useActiveProgramm';
import { createProgramm, deleteProgramm, renameProgramm } from '@/core/services/csv';
import { logAudit } from '@/core/services/infrastructure/audit-log';
import type { Programm } from '@/core/services/csv/types';
import {
  SettingsGruppe,
  SettingsGruppenAktion,
  SettingsLeer,
} from '@/components/settings';
import type { ProgrammBestand } from '../useProgrammBestand';

export function ProgrammeGruppe({ bestand }: { bestand: ProgrammBestand }): React.ReactElement {
  const storage = useStorage();
  const session = useKuratorSession();
  const { profile, updateProfile } = useProfile();
  const setActive = useActiveProgramm(s => s.setActive);
  const { programme, antragCounts, activeProgrammId, refresh } = bestand;
  const [renameOpen, setRenameOpen] = useState<Programm | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Programm | null>(null);
  const [newName, setNewName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
    <SettingsGruppe
      id="sec-programme"
      titel="Programme"
      unterzeile="Jedes Programm hat eigene Aktenzeichen, CSV-Schemas und Anträge."
      hint="Die Programm-Id bindet das ganze Datenmodell: Aktenzeichen, CSV-Schemas, Anträge, Unterprogramme und Filter hängen an ihr. Mit dem Umschalter in der Sidebar wechselt man zwischen den Programmen; alles auf dieser Seite gilt für das aktive."
      aktion={
        <SettingsGruppenAktion
          onClick={() => { setCreateOpen(true); setNewName(''); }}
          disabled={!session.isActive}
        >
          Neues Programm
        </SettingsGruppenAktion>
      }
    >
      {programme.length === 0 ? (
        <SettingsLeer>
          Noch kein Programm registriert. Erst Programm-Ordner im Dev-Panel (SMB) auswählen.
        </SettingsLeer>
      ) : (
        <div>
          {programme.map(p => {
            const isActive = p.id === activeProgrammId;
            const count = antragCounts.get(p.id) ?? 0;
            const canDelete = count === 0 && programme.length > 1;
            return (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 py-2.5 border-t first:border-t-0"
                style={{ borderTopColor: 'var(--tf-border)', borderTopWidth: '0.5px' }}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13.5px] text-[var(--tf-text)]">{p.name}</span>
                    {isActive && (
                      <span className="inline-flex items-center rounded-full bg-[var(--tf-success-bg)] px-2 py-[1px] text-[10.5px] font-medium text-[var(--tf-success-text)]">
                        aktiv
                      </span>
                    )}
                  </div>
                  <div className="text-[11.5px] text-[var(--tf-text-tertiary)] mt-0.5">
                    <span className="font-mono">{p.id}</span> · {count.toLocaleString('de-DE')} Anträge ·
                    {' '}angelegt {new Date(p.created_at).toLocaleDateString('de-DE')}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {!isActive && (
                    <Button size="sm" variant="outline" onClick={() => { void onSwitchActive(p.id); }}>
                      Aktivieren
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { setRenameOpen(p); setNewName(p.name); }}
                    disabled={!session.isActive}
                  >
                    Umbenennen
                  </Button>
                  {canDelete && (
                    <Button
                      size="sm"
                      variant="ghost"
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

      <Dialog
        open={!!renameOpen}
        onClose={() => setRenameOpen(null)}
        title="Programm umbenennen"
        footer={
          <>
            <Button size="sm" variant="ghost" onClick={() => setRenameOpen(null)}>Abbrechen</Button>
            {/* Gesperrt wie „Anlegen" im Dialog daneben: `onRename` kehrt bei
                leerem Feld wortlos zurueck — der Klick sah bis v4.119 aus wie
                ein Speichern, das nichts tat. */}
            <Button size="sm" variant="default" onClick={onRename} disabled={!newName.trim()}>Speichern</Button>
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
            <p className="text-[12px] text-[var(--tf-danger-text)]">{errorMsg}</p>
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
            Name des Förderprogramms (z.B. ZIM 2026, EXIST, GO-Bio). Wird nach dem Anlegen
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
    </SettingsGruppe>
  );
}
