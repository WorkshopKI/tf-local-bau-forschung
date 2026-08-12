/**
 * Welcome-Screen: wird angezeigt, wenn Profil existiert aber noch kein
 * Daten-Share-Handle. Führt den Kurator/User durch den SMB-Pfad-Setup:
 * Beispielpfad kopieren, Picker starten, Validierung des gewählten Ordners.
 */

import { useMemo, useState } from 'react';
import { ArrowRight, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PfadKopierZeile } from '@/components/ui/PfadKopierZeile';
import { useStorage } from '@/core/hooks/useStorage';
import {
  ensureFolderStructure,
  ensureReadme,
  pickAndStoreDatenShareHandle,
  setDatenShareHandle,
} from '@/core/services/infrastructure/smb-handle';
import { validateSelectedFolder, migrateLegacyStructure } from '@/core/services/infrastructure/migration';
import { SHARE_GENERATION_IDB_KEY, type FolderValidationResult } from '@/core/services/infrastructure/types';
import { dataConfig, canWriteDatenShare } from '@/config/feature-flags';

interface WelcomeScreenProps {
  onComplete: () => void;
  /** v2.0: Steuert Picker-Mode. Kurator pickt `readwrite`, alle anderen `read`. */
  isKurator?: boolean;
}

function parsePathFromHash(): string | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash;
  const match = hash.match(/[#?&]path=([^&]+)/);
  if (!match || !match[1]) return null;
  try { return decodeURIComponent(match[1]); } catch { return match[1]; }
}

type Dialog =
  | { kind: 'none' }
  | { kind: 'empty'; onConfirm: () => void; onCancel: () => void }
  | {
      kind: 'legacy';
      legacyFilesCount: number;
      dokumenteFileCount: number;
      onConfirm: () => void;
      onCancel: () => void;
    }
  | { kind: 'subfolder'; detected: FolderValidationResult['kind'] }
  | { kind: 'name-mismatch'; pickedName: string; expectedName: string };

export function WelcomeScreen({ onComplete, isKurator = false }: WelcomeScreenProps): React.ReactElement {
  const storage = useStorage();
  // Priorität: Build-Time-Config (fester Pfad) > Hash-URL-Override > neutraler
  // Platzhalter. Der Platzhalter greift nur in Builds OHNE festen Pfad (dev,
  // local) — er darf deshalb keinen echt aussehenden Ordnernamen nennen, sonst
  // liest er sich wie eine Vorgabe (Pitfall „Platzhalter liest sich als Wert").
  const examplePath = useMemo(
    () => dataConfig.fixedDataSharePath ?? parsePathFromHash() ?? '\\\\<server>\\<datenordner>\\',
    [],
  );
  const pathIsLocked = dataConfig.fixedDataSharePath !== null && !dataConfig.allowUserToChangePath;
  const expectedFolderName = dataConfig.expectedFolderName ?? null;
  const pickerMode: 'read' | 'readwrite' = canWriteDatenShare(isKurator) ? 'readwrite' : 'read';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>({ kind: 'none' });
  const [migrationProgress, setMigrationProgress] = useState<string | null>(null);

  // v4.0: Die Verbindung steht — Generation des Ablageorts stempeln, sonst
  // liefe die frisch verknuepfte Installation beim naechsten Start ins
  // Umzugs-Gate (siehe `SHARE_GENERATION_IDB_KEY`). Der Gegenpart fuer alle
  // anderen Einstiege sitzt in `connectDataShare`.
  const abschliessen = async (): Promise<void> => {
    await storage.idb.set(SHARE_GENERATION_IDB_KEY, dataConfig.shareGeneration);
    onComplete();
  };

  const handleSelect = async (): Promise<void> => {
    setError(null);
    setBusy(true);
    try {
      const res = await pickAndStoreDatenShareHandle(storage.idb, { mode: pickerMode });
      if (!res.ok) {
        if (res.reason === 'aborted') { setBusy(false); return; }
        setError(res.message ?? 'Ordner-Auswahl fehlgeschlagen.');
        setBusy(false);
        return;
      }
      // v2.0: Erwarteter Ordner-Name-Check (z.B. 'teamflow-forschungsfoerderung').
      if (expectedFolderName && res.handle.name !== expectedFolderName) {
        // v4.0: Der Picker hat sein Ergebnis schon persistiert — zurueckrollen,
        // damit ein Fehlgriff nicht die bisherige Verbindung ersetzt.
        await setDatenShareHandle(storage.idb, res.vorher);
        setDialog({
          kind: 'name-mismatch',
          pickedName: res.handle.name,
          expectedName: expectedFolderName,
        });
        setBusy(false);
        return;
      }
      const validation = await validateSelectedFolder(res.handle);
      await handleValidation(res.handle, validation, res.vorher);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleValidation = async (
    handle: FileSystemDirectoryHandle,
    validation: FolderValidationResult,
    vorher: FileSystemDirectoryHandle | null = null,
  ): Promise<void> => {
    if (validation.kind === 'current') {
      await ensureReadme(handle);
      await abschliessen();
      return;
    }
    if (validation.kind === 'subfolder') {
      await setDatenShareHandle(storage.idb, vorher);
      setDialog({ kind: 'subfolder', detected: validation.kind });
      return;
    }
    if (validation.kind === 'empty') {
      setDialog({
        kind: 'empty',
        onConfirm: async () => {
          setDialog({ kind: 'none' });
          setBusy(true);
          try {
            await ensureFolderStructure(handle);
            await abschliessen();
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        },
        onCancel: () => setDialog({ kind: 'none' }),
      });
      return;
    }
    // Legacy-Migration
    setDialog({
      kind: 'legacy',
      legacyFilesCount: validation.legacyFilesCount,
      dokumenteFileCount: validation.dokumenteFileCount,
      onConfirm: async () => {
        setDialog({ kind: 'none' });
        setBusy(true);
        setMigrationProgress('Migration läuft…');
        try {
          const result = await migrateLegacyStructure(storage.idb, handle);
          if (result.errors.length > 0) {
            setError(`Migration teilweise fehlgeschlagen: ${result.errors.length} Fehler. Siehe Audit-Log.`);
          }
          setMigrationProgress(
            `Migration abgeschlossen: ${result.filesMoved} verschoben, ${result.filesDeleted} gelöscht, ${result.foldersRemoved.length} Ordner entfernt.`,
          );
          setTimeout(() => { void abschliessen(); }, 1500);
        } catch (err) {
          setError((err as Error).message);
          setBusy(false);
          setMigrationProgress(null);
        }
      },
      onCancel: () => setDialog({ kind: 'none' }),
    });
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[var(--tf-bg)] z-50 overflow-y-auto" // allow-raw-modal: Vollbild-Zustand, kein Modal
    >
      <div className="w-full max-w-[560px] mx-4 my-8 bg-[var(--tf-bg)] rounded-[16px] p-8" style={{ border: '0.5px solid var(--tf-border)' }}>
        <h1 className="text-[22px] font-medium text-[var(--tf-text)] mb-3">Willkommen bei ZAH</h1>
        <p className="text-[13px] text-[var(--tf-text-secondary)] mb-6 leading-relaxed">
          {pathIsLocked
            ? 'Dieser Build ist auf einen festen Daten-Share konfiguriert. Verbinden Sie die App einmalig mit dem folgenden Ordner:'
            : 'Bevor es losgeht, verbinden Sie die App einmalig mit dem Datenspeicher. Der Datenspeicher liegt auf dem SMB-Share. Den Pfad haben Sie vom Kurator erhalten, z.B.:'}
        </p>

        <PfadKopierZeile pfad={examplePath} knopfText="Pfad kopieren" className="mb-4" />

        <ol className="text-[12.5px] text-[var(--tf-text-secondary)] space-y-1.5 mb-6 pl-5 list-decimal leading-relaxed">
          <li>Pfad oben kopieren (oder aus E-Mail des Kurators)</li>
          <li>Unten „Ordner auswählen" klicken</li>
          <li>Im Datei-Dialog den Pfad in die Adresszeile einfügen und Enter drücken</li>
          <li>Ordner auswählen und bestätigen</li>
        </ol>

        <Button icon={FolderOpen} onClick={handleSelect} disabled={busy} className="w-full">
          Ordner auswählen
        </Button>

        {error && (
          <p className="mt-4 text-[12.5px] text-[var(--tf-danger-text)]">{error}</p>
        )}
        {migrationProgress && (
          <p className="mt-4 text-[12.5px] text-[var(--tf-text-secondary)]">{migrationProgress}</p>
        )}
      </div>

      {dialog.kind === 'empty' && (
        <Dialog
          title="Datenspeicher einrichten"
          body={<p className="text-[13px] text-[var(--tf-text-secondary)] leading-relaxed">
            Dieser Ordner ist leer oder enthält keine ZAH-Struktur. Möchten Sie hier einen
            neuen ZAH-Datenspeicher einrichten? Die Struktur (<code>programm/</code>,{' '}
            <code>backups/</code>, <code>_intern/</code>, <code>README.txt</code>) wird angelegt.
          </p>}
          confirmLabel="Einrichten"
          cancelLabel="Anderen Ordner wählen"
          onConfirm={dialog.onConfirm}
          onCancel={dialog.onCancel}
        />
      )}
      {dialog.kind === 'legacy' && (
        <Dialog
          title="Alte ZAH-Struktur erkannt"
          body={<div className="text-[13px] text-[var(--tf-text-secondary)] leading-relaxed space-y-3">
            <p>Dieser Ordner scheint eine alte ZAH-Struktur (<code>programm-test/</code>) zu enthalten.
            Möchten Sie die Daten automatisch in die neue Struktur migrieren?</p>
            <div className="p-3 rounded-[var(--tf-radius)] bg-[var(--tf-warning-bg)] text-[var(--tf-warning-text)] border border-[var(--tf-warning-border)]">
              <p className="font-medium mb-1">⚠️ Achtung: Dokumente werden gelöscht</p>
              <p>Der Ordner <code>programm-test/dokumente/</code> enthält <b>{dialog.dokumenteFileCount}</b> Dateien.
              Diese werden beim Migrieren <b>gelöscht</b> (sie werden nicht in den neuen Datenspeicher übernommen).
              Produktive Dokumente werden später separat als Dokumentenquelle-Handle eingebunden.</p>
            </div>
            <p>Zu verschieben: ca. <b>{dialog.legacyFilesCount}</b> Dateien aus{' '}
            <code>programm-test/</code>, <code>feedback/</code>, <code>backups/</code>.</p>
          </div>}
          confirmLabel="Migration durchführen"
          cancelLabel="Abbrechen"
          onConfirm={dialog.onConfirm}
          onCancel={dialog.onCancel}
        />
      )}
      {dialog.kind === 'subfolder' && (
        <Dialog
          title="Falscher Ordner"
          body={<p className="text-[13px] text-[var(--tf-text-secondary)] leading-relaxed">
            Sie haben einen Unterordner einer ZAH-Struktur gewählt. Bitte wählen Sie den
            übergeordneten Ordner (derjenige der <code>programm/</code>, <code>backups/</code> und{' '}
            <code>_intern/</code> enthält).
          </p>}
          confirmLabel="Anderen Ordner wählen"
          cancelLabel=""
          onConfirm={() => setDialog({ kind: 'none' })}
          onCancel={() => setDialog({ kind: 'none' })}
        />
      )}
      {dialog.kind === 'name-mismatch' && (
        <Dialog
          title="Falscher Ordner-Name"
          body={<p className="text-[13px] text-[var(--tf-text-secondary)] leading-relaxed">
            Bitte wählen Sie den Ordner <code>{dialog.expectedName}</code>. Sie haben{' '}
            <code>{dialog.pickedName}</code> gewählt.
          </p>}
          confirmLabel="Erneut wählen"
          cancelLabel=""
          onConfirm={() => setDialog({ kind: 'none' })}
          onCancel={() => setDialog({ kind: 'none' })}
        />
      )}
    </div>
  );
}

interface DialogProps {
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function Dialog(props: DialogProps): React.ReactElement {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/30 z-[60]" // allow-raw-modal: legacy — bei nächster Anfassung auf Dialog migrieren
    >
      <div className="w-full max-w-[480px] mx-4 bg-[var(--tf-bg)] rounded-[16px] p-6" style={{ border: '0.5px solid var(--tf-border)' }}>
        <h2 className="text-[16px] font-medium text-[var(--tf-text)] mb-3">{props.title}</h2>
        <div className="mb-5">{props.body}</div>
        <div className="flex justify-end gap-2">
          {props.cancelLabel && (
            <button
              type="button"
              onClick={props.onCancel}
              className="px-3 py-1.5 rounded-[var(--tf-radius)] text-[12.5px] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] cursor-pointer"
            >
              {props.cancelLabel}
            </button>
          )}
          <Button icon={ArrowRight} onClick={props.onConfirm}>{props.confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}
