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
import { ActionRow, Archive, Danger, Field, SectionCaption, StatusPill } from './shared';

type PermState = 'granted' | 'denied' | 'prompt' | 'unknown';

interface FolderStructureProbe {
  programm: boolean;
  backups: boolean;
  intern: boolean;
}

async function probeFolderStructure(
  parent: FileSystemDirectoryHandle,
): Promise<FolderStructureProbe> {
  const out: FolderStructureProbe = { programm: false, backups: false, intern: false };
  try {
    await parent.getDirectoryHandle('programm');
    out.programm = true;
  } catch { /* missing */ }
  try {
    await parent.getDirectoryHandle('backups');
    out.backups = true;
  } catch { /* missing */ }
  try {
    await parent.getDirectoryHandle('_intern');
    out.intern = true;
  } catch { /* missing */ }
  return out;
}

export function SmbPanel(): React.ReactElement {
  const storage = useStorage();
  const smbStatus = useSmbStatus();
  const [handleName, setHandleName] = useState<string | null>(null);
  const [permission, setPermission] = useState<PermState>('unknown');
  const [dokuHandleName, setDokuHandleName] = useState<string | null>(null);
  const [structure, setStructure] = useState<FolderStructureProbe | null>(null);
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
      try {
        setStructure(await probeFolderStructure(h));
      } catch {
        setStructure(null);
      }
    } else {
      setPermission('unknown');
      setStructure(null);
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

  const onCheck = async (): Promise<void> => {
    setLastMsg('Prüfe Verbindung…');
    await smbStatus.check(storage.idb);
    await refresh();
    const next = useSmbStatus.getState().status;
    const labelMap: Record<typeof next, string> = {
      online: 'Verbindung OK — Share erreichbar.',
      offline: 'Share aktuell nicht erreichbar.',
      permission_denied: 'Berechtigung verweigert — Permission neu anfordern.',
      unknown: 'Status unbekannt — Handle ggf. nicht gesetzt.',
    } as const;
    setLastMsg(labelMap[next] ?? `Status: ${next}`);
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

  const permTone = permission === 'granted' ? 'ok' : permission === 'denied' ? 'bad' : 'warn';
  const statusTone = smbStatus.status === 'online' ? 'ok'
    : smbStatus.status === 'offline' ? 'warn'
    : smbStatus.status === 'permission_denied' ? 'bad' : 'neutral';

  return (
    <div className="px-8 py-6 max-w-[760px]">
      <h2 className="text-[18px] font-medium text-[var(--tf-text)]">Verbindung zum Daten-Share-Root</h2>
      <p className="text-[13px] text-[var(--tf-text-secondary)] leading-relaxed mt-1.5 mb-5 max-w-[620px]">
        Wähle den Daten-Share-Root, in dem <code className="text-[11.5px]">programm/</code>,{' '}
        <code className="text-[11.5px]">backups/</code> und <code className="text-[11.5px]">_intern/</code> als
        Geschwister liegen.
      </p>

      <Field
        label="Aktiver Share"
        hint={
          handleName
            ? 'Auf neuem Rechner oder neuem Browser-Profil? "Anderen Ordner wählen" öffnet den Picker.'
            : 'Noch kein Daten-Share verbunden — über "Auswählen" einen Ordner wählen.'
        }
      >
        <div className="flex items-center flex-wrap gap-2">
          <StatusPill label={handleName ? `✓ ${handleName}` : 'nicht gesetzt'} tone={handleName ? 'ok' : 'neutral'} />
          <StatusPill label={`Permission: ${permission}`} tone={permTone} />
          <StatusPill label={smbStatus.status} tone={statusTone} />
          <Button size="xs" variant="outline" onClick={() => void onPick()}>
            {handleName ? 'Anderen Ordner wählen' : 'Auswählen'}
          </Button>
          {permission === 'prompt' || permission === 'denied' ? (
            <Button
              size="xs"
              variant="outline"
              onClick={() => void onRefreshPermission()}
              disabled={!handleName}
            >
              Permission neu anfordern
            </Button>
          ) : null}
        </div>
      </Field>

      <Field label="Dokumentenquelle (Legacy)">
        <div className="flex items-center flex-wrap gap-2">
          <StatusPill label={dokuHandleName ? `✓ ${dokuHandleName}` : 'nicht gesetzt'} tone={dokuHandleName ? 'ok' : 'neutral'} />
          {dokuHandleName ? (
            <button
              type="button"
              onClick={() => void onClearDoku()}
              className="text-[11px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-danger-text)] cursor-pointer"
            >
              vergessen
            </button>
          ) : null}
        </div>
        <p className="mt-1 text-[11px] text-[var(--tf-text-tertiary)]">
          Single-Source-Slot vor v1.15. Multi-Source-Verwaltung läuft jetzt im
          Plugin „Dokumentenquellen". Beim ersten Start wird der Legacy-Slot
          automatisch in eine Default-Source migriert; dieser Picker bleibt nur
          für Triage-Einzeltests im Tab „Phase-2 Triage" hier.
        </p>
      </Field>

      <SectionCaption>Häufig</SectionCaption>
      <ActionRow
        title="Verbindung prüfen"
        hint="Pingt den Share, validiert das Handle. Tu das, wenn Schreibvorgänge plötzlich fehlschlagen."
        btn={<Button size="sm" onClick={onCheck}>Prüfen</Button>}
      />
      <ActionRow
        title="Disconnect simulieren (30 s)"
        hint="Trennt für 30 s, um Reconnect-Logik im UI zu testen."
        btn={<Button size="sm" variant="outline" onClick={onSimDisconnect}>Simulieren</Button>}
      />

      <Archive title="Setup (1× pro Maschine)" defaultOpen>
        <ActionRow
          title="Daten-Share-Root auswählen"
          hint="Beim ersten Aufsetzen einer Maschine."
          status={
            handleName ? (
              <StatusPill label={`✓ ${handleName}`} tone="ok" />
            ) : (
              <StatusPill label="noch nicht gesetzt" tone="warn" />
            )
          }
          btn={<Button size="sm" variant="outline" onClick={() => void onPick()}>Auswählen</Button>}
        />
        <ActionRow
          title="Permission anfordern"
          hint="Wenn das Share-Handle nach Browser-Restart verloren ging."
          status={
            !handleName ? (
              <StatusPill label="kein Handle" tone="neutral" />
            ) : (
              <StatusPill
                label={`Permission: ${permission}`}
                tone={permission === 'granted' ? 'ok' : permission === 'denied' ? 'bad' : 'warn'}
              />
            )
          }
          btn={
            <Button size="sm" variant="outline" onClick={() => void onRefreshPermission()} disabled={!handleName}>
              Anfordern
            </Button>
          }
        />
        <ActionRow
          title="Ordnerstruktur initialisieren"
          hint="Legt programm/, backups/, _intern/ an. Idempotent."
          status={
            !handleName ? (
              <StatusPill label="kein Handle" tone="neutral" />
            ) : structure === null ? (
              <StatusPill label="prüfe…" tone="neutral" />
            ) : structure.programm && structure.backups && structure.intern ? (
              <StatusPill label="✓ programm/ + backups/ + _intern/" tone="ok" />
            ) : (
              <>
                <StatusPill label={structure.programm ? '✓ programm/' : '✗ programm/'} tone={structure.programm ? 'ok' : 'warn'} />
                <StatusPill label={structure.backups ? '✓ backups/' : '✗ backups/'} tone={structure.backups ? 'ok' : 'warn'} />
                <StatusPill label={structure.intern ? '✓ _intern/' : '✗ _intern/'} tone={structure.intern ? 'ok' : 'warn'} />
              </>
            )
          }
          btn={
            <Button size="sm" variant="outline" onClick={() => void onInitStructure()} disabled={!handleName}>
              Initialisieren
            </Button>
          }
        />
        <ActionRow
          title="Dokumentenquelle-Handle setzen (Legacy)"
          hint='Wählt den Unter-Ordner mit den Phase-2-Dokumenten. Seit v1.15 nur noch für Triage-Einzeltests in Tab „Phase-2“; produktive DMS-Quellen verwaltet das Plugin „Dokumentenquellen“.'
          status={
            dokuHandleName ? (
              <StatusPill label={`✓ ${dokuHandleName}`} tone="ok" />
            ) : (
              <StatusPill label="nicht gesetzt" tone="neutral" />
            )
          }
          btn={<Button size="sm" variant="outline" onClick={() => void onPickDoku()}>Setzen</Button>}
        />
      </Archive>

      <Danger>
        <ActionRow
          title="Handle vergessen"
          hint="Löscht das gespeicherte File-System-Handle. Nur zum Re-Test der Permission-Flow."
          btn={
            <Button size="sm" variant="destructive" onClick={() => void onClearHandle()} disabled={!handleName}>
              Vergessen
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
