/**
 * Rechte/obere Aufnahme: eine Outlook-`.msg`-Kurzanfrage per Drag&Drop oder
 * Datei-Picker aufnehmen. Eine `.msg` = eine `Anfrage`. Wiederverwendet das
 * generische `FileDropZone`-Primitive (kein Fork der VB-gekoppelten
 * `DokumentAufnahme`).
 */
import { useCallback } from 'react';
import { Mail } from 'lucide-react';
import { useStorage } from '@/core/hooks/useStorage';
import { useAIBridge } from '@/core/hooks/useAIBridge';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { FileDropZone } from '@/components/ui/FileDropZone';
import { loadSkillRegistry, getSkillById } from '@/core/services/skills';
import {
  ANFRAGE_METADATEN_SKILL,
  ANFRAGE_METADATEN_SKILL_ID,
} from '@/core/services/skills/registry/anfrage-metadaten.seed';
import { useAnfragenStore } from './store';
import { createAnfrage } from './persistence';
import { aufnahmeAusDatei } from './aufnahme';
import { runMetadatenExtraktion } from './services/metadaten';
import type { AnfrageMetadaten } from './types';

export function AnfrageAufnahme(): React.ReactElement {
  const storage = useStorage();
  const bridge = useAIBridge();
  const upsert = useAnfragenStore(s => s.upsert);
  const select = useAnfragenStore(s => s.select);

  const create = useAsyncAction(async (file: File) => {
    const init = await aufnahmeAusDatei(file);
    const anfrage = createAnfrage(init);
    await upsert(anfrage, storage);
    select(anfrage.id);
    // „Anfragen zuerst taggen": interner KI-Lauf direkt nach der Aufnahme. Fail-safe
    // — schlägt die KI fehl (nicht erreichbar / externer Provider), bleibt die schon
    // persistierte Anfrage erhalten und wird als 'fehlgeschlagen' markiert (Re-Tag im
    // Detail). Die Aufnahme blockiert NIE auf der KI.
    let metadaten: AnfrageMetadaten;
    try {
      const loaded = await loadSkillRegistry(storage);
      const skill = getSkillById(loaded.file, ANFRAGE_METADATEN_SKILL_ID) ?? ANFRAGE_METADATEN_SKILL;
      const m = await runMetadatenExtraktion(bridge, skill, anfrage.originalMd);
      metadaten = { ...m, status: 'getaggt', getaggtAm: new Date().toISOString() };
    } catch (err) {
      metadaten = {
        antragsart: '', name: '', firma: '', themengruppe: '',
        status: 'fehlgeschlagen',
        fehler: err instanceof Error ? err.message : String(err),
      };
    }
    await upsert({ ...anfrage, metadaten }, storage);
  });

  const handleFiles = useCallback((files: File[]) => {
    const msg = files.find(f => f.name.toLowerCase().endsWith('.msg')) ?? files[0];
    if (msg) void create.run(msg);
  }, [create]);

  return (
    <div className="mb-4">
      <FileDropZone accept=".msg" onFiles={handleFiles} padding="px-6 py-4">
        <Mail size={18} className="text-[var(--tf-text-tertiary)]" />
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
