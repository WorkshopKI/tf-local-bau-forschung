/**
 * Rechte/obere Aufnahme: eine Outlook-`.msg`-Kurzanfrage per Drag&Drop oder
 * Datei-Picker aufnehmen. Eine `.msg` = eine `Anfrage`. Wiederverwendet das
 * generische `FileDropZone`-Primitive (kein Fork der VB-gekoppelten
 * `DokumentAufnahme`).
 */
import { useCallback } from 'react';
import { Mail } from 'lucide-react';
import { useStorage } from '@/core/hooks/useStorage';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { FileDropZone } from '@/components/ui/FileDropZone';
import { useAnfragenStore } from './store';
import { createAnfrage } from './persistence';
import { aufnahmeAusDatei } from './aufnahme';

export function AnfrageAufnahme(): React.ReactElement {
  const storage = useStorage();
  const upsert = useAnfragenStore(s => s.upsert);
  const select = useAnfragenStore(s => s.select);

  const create = useAsyncAction(async (file: File) => {
    const init = await aufnahmeAusDatei(file);
    const anfrage = createAnfrage(init);
    await upsert(anfrage, storage);
    select(anfrage.id);
  });

  const handleFiles = useCallback((files: File[]) => {
    const msg = files.find(f => f.name.toLowerCase().endsWith('.msg')) ?? files[0];
    if (msg) void create.run(msg);
  }, [create]);

  return (
    <div className="mb-4">
      <FileDropZone accept=".msg" onFiles={handleFiles}>
        <Mail size={20} className="text-[var(--tf-text-tertiary)]" />
        <p className="text-[13px] text-[var(--tf-text-secondary)]">
          {create.busy ? 'Lese .msg…' : 'Outlook-.msg-Kurzanfrage hierher ziehen oder klicken'}
        </p>
        <p className="text-[11.5px] text-[var(--tf-text-tertiary)]">
          Nur der Mailtext wird verarbeitet — Anhänge bleiben unberührt.
        </p>
      </FileDropZone>
      {create.error && (
        <div className="mt-2 text-[12px] text-[var(--tf-danger-text)]">Fehler: {create.error}</div>
      )}
    </div>
  );
}
