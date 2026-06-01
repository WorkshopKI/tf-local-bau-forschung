/**
 * KompetenzMatrixView (v2.15) — Tab „Kompetenzen" des Auslastungs-Moduls.
 *
 * Einstieg für die PL-Kompetenz-Vorbelegung:
 *  - XLSX-Upload (KompetenzImportDialog) — legt/überschreibt die Kompetenz-Matrix
 *    + Antragstyp-Kontingent + Abschlag pro MA und setzt das Spalten-Schema.
 *  - Editierbare Matrix (KompetenzMatrixTable) — nachträgliches Feintuning in
 *    xlsx-ähnlicher Optik.
 *
 * Solange noch kein Schema hochgeladen wurde, zeigt der Tab einen Empty-State.
 */
import { useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useAuslastungData } from '../hooks/useAuslastungData';
import { useAntraegeCache } from '../hooks/useAntraegeCache';
import { KompetenzImportDialog } from '../components/KompetenzImportDialog';
import { KompetenzMatrixTable } from '../components/KompetenzMatrixTable';

export function KompetenzMatrixView(): React.ReactElement {
  const storage = useStorage();
  const cache = useAntraegeCache();
  const schema = useAuslastungData(s => s.data.config.kompetenzSchema);
  const [uploadOpen, setUploadOpen] = useState(false);

  const hasSchema = Array.isArray(schema) && schema.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[15px] font-medium text-[var(--tf-text)] mb-1">Kompetenz-Vorbelegung</h2>
          <p className="text-[12.5px] text-[var(--tf-text-secondary)] leading-snug max-w-[640px]">
            Die PL lädt eine XLSX mit Kompetenz-Leveln (1–3) je Unterkategorie, Antragstyp-Kontingent
            und Abschlag pro Kürzel hoch. Daraus werden Haupt-/Nebenkategorie abgeleitet, damit Anträge
            zugewiesen werden können — auch ohne MA-Selbsteingabe. Werte lassen sich danach direkt in der
            Tabelle anpassen.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setUploadOpen(true)}
          className="px-3 py-1.5 rounded-md text-[12.5px] cursor-pointer shrink-0"
          style={{ background: 'var(--tf-text)', color: 'var(--tf-bg)' }}
        >
          XLSX hochladen
        </button>
      </div>

      {hasSchema ? (
        <KompetenzMatrixTable schema={schema} storage={storage} anonymMap={cache.anonymMap} />
      ) : (
        <div
          className="rounded-[12px] p-8 text-center"
          style={{ border: '0.5px dashed var(--tf-border)' }}
        >
          <p className="text-[13px] text-[var(--tf-text-secondary)] mb-1">Noch keine Kompetenz-Matrix vorhanden.</p>
          <p className="text-[12px] text-[var(--tf-text-tertiary)]">
            Lade die PL-Kompetenz-XLSX hoch — danach erscheint hier die editierbare Tabelle.
          </p>
        </div>
      )}

      <KompetenzImportDialog open={uploadOpen} anonymMap={cache.anonymMap} onClose={() => setUploadOpen(false)} />
    </div>
  );
}
