/**
 * Welcome-Screen: wird angezeigt, wenn Profil existiert aber noch kein
 * Daten-Share-Handle. Führt den Kurator/User durch den SMB-Pfad-Setup:
 * Beispielpfad kopieren, Picker starten, Validierung des gewählten Ordners.
 */

import { useMemo, useState } from 'react';
import { ArrowRight, Check, ClipboardCopy, FolderOpen } from 'lucide-react';
import { Button } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
import {
  ensureFolderStructure,
  ensureReadme,
  pickAndStoreDatenShareHandle,
} from '@/core/services/infrastructure/smb-handle';
import { validateSelectedFolder, migrateLegacyStructure } from '@/core/services/infrastructure/migration';
import type { FolderValidationResult } from '@/core/services/infrastructure/types';
import { dataConfig } from '@/config/feature-flags';

interface WelcomeScreenProps {
  onComplete: () => void;
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
  | { kind: 'subfolder'; detected: FolderValidationResult['kind'] };

export function WelcomeScreen({ onComplete }: WelcomeScreenProps): React.ReactElement {
  const storage = useStorage();
  // Priorität: Build-Time-Config (fester Pfad) > Hash-URL-Override > Default-Beispiel.
  const examplePath = useMemo(
    () => dataConfig.fixedDataSharePath ?? parsePathFromHash() ?? '\\\\server\\teamflow-forschungsfoerderung\\',
    [],
  );
  const pathIsLocked = dataConfig.fixedDataSharePath !== null && !dataConfig.allowUserToChangePath;
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>({ kind: 'none' });
  const [migrationProgress, setMigrationProgress] = useState<string | null>(null);

  const copyPath = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(examplePath);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError('Kopieren fehlgeschlagen. Bitte manuell markieren und kopieren.');
    }
  };

  const handleSelect = async (): Promise<void> => {
    setError(null);
    setBusy(true);
    try {
      const res = await pickAndStoreDatenShareHandle(storage.idb);
      if (!res.ok) {
        if (res.reason === 'aborted') { setBusy(false); return; }
        setError(res.message ?? 'Ordner-Auswahl fehlgeschlagen.');
        setBusy(false);
        return;
      }
      const validation = await validateSelectedFolder(res.handle);
      await handleValidation(res.handle, validation);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleValidation = async (
    handle: FileSystemDirectoryHandle,
    validation: FolderValidationResult,
  ): Promise<void> => {
    if (validation.kind === 'current') {
      await ensureReadme(handle);
      onComplete();
      return;
    }
    if (validation.kind === 'subfolder') {
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
            onComplete();
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
          setTimeout(() => { onComplete(); }, 1500);
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
    <div className="fixed inset-0 flex items-center justify-center bg-[var(--tf-bg)] z-50 overflow-y-auto">
      <div className="w-full max-w-[560px] mx-4 my-8 bg-[var(--tf-bg)] rounded-[16px] p-8" style={{ border: '0.5px solid var(--tf-border)' }}>
        <h1 className="text-[22px] font-medium text-[var(--tf-text)] mb-3">Willkommen bei TeamFlow</h1>
        <p className="text-[13px] text-[var(--tf-text-secondary)] mb-6 leading-relaxed">
          {pathIsLocked
            ? 'Dieser Build ist auf einen festen Daten-Share konfiguriert. Verbinden Sie die App einmalig mit dem folgenden Ordner:'
            : 'Bevor es losgeht, verbinden Sie die App einmalig mit dem Datenspeicher. Der Datenspeicher liegt auf dem SMB-Share. Den Pfad haben Sie vom Kurator erhalten, z.B.:'}
        </p>

        <div className="flex items-stretch gap-2 mb-4">
          <code className="flex-1 px-3 py-2 rounded-[var(--tf-radius)] text-[12.5px] font-mono bg-[var(--tf-bg-secondary)] text-[var(--tf-text)] overflow-x-auto">
            {examplePath}
          </code>
          <button
            type="button"
            onClick={copyPath}
            className="px-3 py-2 rounded-[var(--tf-radius)] text-[12px] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] cursor-pointer inline-flex items-center gap-1.5"
            style={{ border: '0.5px solid var(--tf-border)' }}
            title="Pfad in Zwischenablage kopieren"
          >
            {copied ? <Check size={13} /> : <ClipboardCopy size={13} />}
            {copied ? 'Kopiert' : 'Pfad kopieren'}
          </button>
        </div>

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
            Dieser Ordner ist leer oder enthält keine TeamFlow-Struktur. Möchten Sie hier einen
            neuen TeamFlow-Datenspeicher einrichten? Die Struktur (<code>programm/</code>,{' '}
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
          title="Alte TeamFlow-Struktur erkannt"
          body={<div className="text-[13px] text-[var(--tf-text-secondary)] leading-relaxed space-y-3">
            <p>Dieser Ordner scheint eine alte TeamFlow-Struktur (<code>programm-test/</code>) zu enthalten.
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
            Sie haben einen Unterordner einer TeamFlow-Struktur gewählt. Bitte wählen Sie den
            übergeordneten Ordner (derjenige der <code>programm/</code>, <code>backups/</code> und{' '}
            <code>_intern/</code> enthält).
          </p>}
          confirmLabel="Anderen Ordner wählen"
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
    <div className="fixed inset-0 flex items-center justify-center bg-black/30 z-[60]">
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
