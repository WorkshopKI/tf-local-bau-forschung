/**
 * Dev-only Schema-Recovery-Sektion der CSV-Sources-Seite: stellt CSV-Schemas aus
 * einer guten `csv_schemas.jsonl` wieder her, nachdem ein leer publizierter
 * Snapshot sie gewischt hat ([[csv-schema-wipe-empty-guard-v2312]]). Zwei Schritte:
 *
 *  1) Datei wählen → Schemas in die lokale IDB schreiben (heilt DIESEN Rechner).
 *  2) Snapshot neu schreiben → nicht-leeres `csv_schemas` + frisches Manifest auf
 *     den Share (heilt alle Consumer beim nächsten Sync).
 *
 * Nur im Dev-Build sichtbar — ein Reparatur-Werkzeug, kein End-User-Feature. Nutzt
 * den echten Publish-Pfad statt Manifest-Handchirurgie (Logik in services/schemaRecovery.ts).
 */
import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStorage } from '@/core/hooks/useStorage';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { isDatenShareWritable, isDevContext } from '@/config/feature-flags';
import { pickSchemaSnapshotFile } from './csv-file-picker';
import {
  parseSchemaJsonl,
  restoreSchemasToIdb,
  republishSnapshot,
  type ParsedSchemaFile,
  type RepublishResult,
} from './services/schemaRecovery';

interface Props {
  programmId: string | null;
  /** Nach dem Zurückschreiben aufrufen, damit die Seite die Schema-Liste neu lädt. */
  onRestored: () => void;
}

type Preview = ParsedSchemaFile & { fileName: string };

export function SchemaRecoverySection({ programmId, onRestored }: Props): React.ReactElement | null {
  const storage = useStorage();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const [restoredCount, setRestoredCount] = useState<number | null>(null);
  const [publishResult, setPublishResult] = useState<RepublishResult | null>(null);

  const restore = useAsyncAction(async () => {
    if (!preview || preview.schemas.length === 0) return;
    const n = await restoreSchemasToIdb(storage.idb, preview.schemas);
    setRestoredCount(n);
    onRestored();
  });

  const publish = useAsyncAction(async () => {
    if (!programmId) throw new Error('Kein aktives Programm — Snapshot kann nicht geschrieben werden.');
    const r = await republishSnapshot(storage.idb, programmId);
    setPublishResult(r);
  });

  // Dev-only Reparatur-Werkzeug — nach allen Hooks prüfen (Rules-of-Hooks).
  // WICHTIG: isDevContext() (variant==='development'/'custom'), NICHT import.meta.env.DEV
  // — Letzteres ist in JEDEM `vite build` (auch build:dev) false → Panel würde nie rendern.
  if (!isDevContext()) return null;

  // FS-API-Geste (Bug-Klasse 2): der Picker ist der erste `await` in handlePick —
  // KEIN await davor. Block-Body-Handler unten (`() => { void handlePick(); }`) statt
  // Pfeil direkt auf `void` — der Pitfall-#15-Guard matcht nur die Inline-void-Form.
  async function handlePick(): Promise<void> {
    setPickError(null);
    setRestoredCount(null);
    setPublishResult(null);
    try {
      const picked = await pickSchemaSnapshotFile();
      if (!picked) return;
      const parsed = parseSchemaJsonl(picked.text, programmId);
      setPreview({ ...parsed, fileName: picked.file.name });
    } catch (err) {
      setPreview(null);
      setPickError((err as Error).message);
    }
  }

  return (
    <section
      className="mt-6 rounded-[12px] p-[18px]"
      style={{ border: '0.5px solid var(--tf-border)' }}
    >
      <div className="flex items-center gap-2 mb-1">
        <h3 className="text-[13px] font-medium text-[var(--tf-text)]">CSV-Schemas wiederherstellen</h3>
        <span className="text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded bg-[var(--tf-bg-secondary)] text-[var(--tf-text-tertiary)]">
          dev
        </span>
      </div>
      <p className="text-[12px] text-[var(--tf-text-tertiary)] mb-3">
        Wenn die CSV-Quellen verschwunden sind (Anträge da, aber „0 Schemas" / ● CSV grau),
        wurde der lokale Bestand vermutlich von einem leer publizierten Snapshot gewischt.
        Wähle hier eine gute <code className="font-mono">csv_schemas.jsonl</code> (z.B. aus einem Backup)
        → <strong>Schritt&nbsp;1</strong> schreibt sie in die lokale Datenbank (heilt diesen Rechner),
        <strong> Schritt&nbsp;2</strong> publiziert einen frischen Snapshot (heilt alle über den Share).
      </p>

      {pickError ? (
        <div className="mb-3 text-[12px] text-[var(--tf-danger-text)]">Fehler: {pickError}</div>
      ) : null}

      {/* Schritt 1: Datei wählen */}
      <div className="flex items-center gap-2 mb-2">
        <Button variant="outline" size="sm" onClick={() => { void handlePick(); }}>
          csv_schemas.jsonl wählen…
        </Button>
        {preview ? (
          <span className="text-[12px] text-[var(--tf-text-secondary)] font-mono truncate">{preview.fileName}</span>
        ) : null}
      </div>

      {preview ? (
        <div className="flex flex-col gap-2 p-3 rounded-[8px] bg-[var(--tf-bg-secondary)] mb-3">
          {preview.schemas.length > 0 ? (
            <p className="text-[12px] text-[var(--tf-text)]">
              <strong>{preview.schemas.length}</strong> gültige Schema{preview.schemas.length === 1 ? '' : 's'} gefunden:{' '}
              <span className="font-mono text-[11px]">{preview.schemas.map(s => s.id).join(' · ')}</span>
            </p>
          ) : (
            <p className="text-[12px] text-[var(--tf-danger-text)] flex items-start gap-1.5">
              <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
              Keine verwendbaren Schemas in der Datei (für dieses Programm). Nichts zu schreiben.
            </p>
          )}
          {(preview.parseErrors > 0 || preview.skippedFixtures > 0 || preview.skippedOtherProgramm > 0) ? (
            <p className="text-[11px] text-[var(--tf-text-tertiary)]">
              Ausgesondert:{' '}
              {preview.skippedFixtures > 0 ? `${preview.skippedFixtures} Demo/Fixture · ` : ''}
              {preview.skippedOtherProgramm > 0 ? `${preview.skippedOtherProgramm} anderes Programm · ` : ''}
              {preview.parseErrors > 0 ? `${preview.parseErrors} ungültige Zeile(n)` : ''}
            </p>
          ) : null}

          {restoredCount === null ? (
            <div className="flex items-center gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={() => restore.run()}
                disabled={preview.schemas.length === 0 || restore.busy}
              >
                {restore.busy ? 'Schreibe…' : `Schritt 1: ${preview.schemas.length} Schema(s) in lokale Datenbank schreiben`}
              </Button>
              {restore.error ? (
                <span className="text-[11.5px] text-[var(--tf-danger-text)]">Fehler: {restore.error}</span>
              ) : null}
            </div>
          ) : (
            <p className="text-[12px] text-emerald-700">
              {restoredCount} Schema(s) in die lokale Datenbank geschrieben — die CSV-Quellen sollten oben wieder erscheinen.
            </p>
          )}
        </div>
      ) : null}

      {/* Schritt 2: Snapshot publizieren (Share heilen) */}
      {restoredCount !== null && restoredCount > 0 ? (
        <div className="flex flex-col gap-2 p-3 rounded-[8px] bg-[var(--tf-bg-secondary)]">
          <p className="text-[12px] text-[var(--tf-text)]">
            <strong>Schritt 2:</strong> Jetzt einen frischen Snapshot auf den Share schreiben, damit
            alle anderen Rechner die Schemas beim nächsten Sync zurückbekommen.
            {!isDatenShareWritable() ? (
              <span className="block mt-1 text-[11.5px] text-[var(--tf-text-tertiary)]">
                Hinweis: Dieser Build hat kein Schreibrecht auf den Daten-Share — Schritt 2 entfällt,
                der lokale Bestand ist aber wiederhergestellt.
              </span>
            ) : null}
          </p>
          {publishResult === null ? (
            <div className="flex items-center gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={() => publish.run()}
                disabled={publish.busy || !isDatenShareWritable()}
              >
                {publish.busy ? 'Schreibe Snapshot…' : 'Schritt 2: Snapshot neu schreiben (Share heilen)'}
              </Button>
              {publish.error ? (
                <span className="text-[11.5px] text-[var(--tf-danger-text)]">Fehler: {publish.error}</span>
              ) : null}
            </div>
          ) : publishResult.status === 'written' ? (
            <p className="text-[12px] text-emerald-700">
              Snapshot geschrieben ({publishResult.mode}) — Version {publishResult.snapshotVersion}.
              Andere Rechner heilen beim nächsten „Datenbestand aktualisieren".
            </p>
          ) : (
            <p className="text-[12px] text-[var(--tf-danger-text)]">
              Kein Daten-Share verbunden — Snapshot nicht geschrieben. Share verbinden und erneut versuchen.
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}
