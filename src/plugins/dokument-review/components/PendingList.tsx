/**
 * Pending-Antrag-Bucket. Eintraege landen hier wenn die Triage einen
 * Akronym-Hinweis fand, der Antrag aber noch nicht im CSV-Import
 * angekommen ist. Manuelle Zuordnung schreibt das Manifest und entfernt
 * den Pending-Eintrag.
 */
import { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import {
  deletePending,
  putManifestEntry,
  CLASSIFIER_VERSION,
  type ManifestEntry,
  type PendingAntragEntry,
} from '@/phase2';
import { Button } from '@/components/ui/button';
import type { Antrag } from '@/core/services/csv/types';
import { useStorage } from '@/core/hooks/useStorage';
import { useDokumentReviewStore } from '../store';
import { relativeZeitKompakt } from '@/core/utils/relativeZeit';
import { AntragAutocomplete } from './AntragAutocomplete';

interface Props {
  pending: PendingAntragEntry[];
  entries: ManifestEntry[];
  antraege: Antrag[];
  onRefresh: () => Promise<void>;
  onReloadEntry: (filename: string) => Promise<void>;
}

export function PendingList({ pending, entries, antraege, onRefresh, onReloadEntry }: Props): React.ReactElement {
  const storage = useStorage();
  const showToast = useDokumentReviewStore(s => s.showToast);
  const [openAssign, setOpenAssign] = useState<string | null>(null);

  const sortedPending = useMemo(
    () => pending.slice().sort((a, b) => b.enqueued_at.localeCompare(a.enqueued_at)),
    [pending],
  );

  const manifestByFilename = useMemo(() => {
    const m = new Map<string, ManifestEntry>();
    for (const e of entries) m.set(e.filename, e);
    return m;
  }, [entries]);

  const handleManualAssign = async (item: PendingAntragEntry, aktenzeichen: string): Promise<void> => {
    const manifest = manifestByFilename.get(item.filename);
    if (!manifest) {
      showToast(`Kein Manifest-Eintrag fuer ${item.filename}.`, 'error');
      return;
    }
    const updated: ManifestEntry = {
      ...manifest,
      classifier_version: CLASSIFIER_VERSION,
      classified_at: new Date().toISOString(),
      triage_source: 'manual',
      triage_state: 'relevant',
      triage_reason: 'manual_pending_assigned',
      matched_antrag_id: aktenzeichen,
      match_method: 'manual',
      match_confidence: 'high',
      candidate_antrag_ids: [],
      requires_review: false,
    };
    await putManifestEntry(storage.idb, updated);
    await deletePending(storage.idb, item.id);
    await onReloadEntry(item.filename);
    await onRefresh();
    showToast(`Pending zugeordnet: ${item.filename} → ${aktenzeichen}`);
    setOpenAssign(null);
  };

  const handleDelete = async (item: PendingAntragEntry): Promise<void> => {
    await deletePending(storage.idb, item.id);
    await onRefresh();
    showToast(`Pending-Eintrag entfernt: ${item.filename}`, 'info');
  };

  return (
    <div
      className="flex flex-col rounded-[12px] border-[0.5px] bg-[var(--tf-bg)] overflow-hidden col-span-2"
      style={{ borderColor: 'var(--tf-border)' }}
    >
      <div className="px-3 py-2 border-b-[0.5px]" style={{ borderColor: 'var(--tf-border)' }}>
        <div className="text-[11px] text-[var(--tf-text-tertiary)]">
          {sortedPending.length.toLocaleString('de-DE')} Pending-Eintraege
        </div>
      </div>

      {sortedPending.length === 0 ? (
        <div className="p-10 text-center text-[12px] text-[var(--tf-text-secondary)]">
          Keine Pending-Eintraege — alle Projektbeschreibungen sind zugeordnet.
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto divide-y-[0.5px]" style={{ borderColor: 'var(--tf-border)' }}>
          {sortedPending.map(item => (
            <div key={item.id} className="px-3 py-3 flex flex-col gap-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="font-mono text-[12px] text-[var(--tf-text)] truncate">{item.filename}</span>
                  <span className="text-[11px] text-[var(--tf-text-tertiary)] truncate">{item.filepath}</span>
                  <div className="flex flex-wrap gap-3 mt-1 text-[11px]">
                    {item.akronym && <span className="text-[var(--tf-text-secondary)]">Akronym: <span className="font-mono">{item.akronym}</span></span>}
                    {item.fkz_candidate && <span className="text-[var(--tf-text-secondary)]">FKZ: <span className="font-mono">{item.fkz_candidate}</span></span>}
                    <span className="text-[var(--tf-text-tertiary)]">in Bucket seit {relativeZeitKompakt(item.enqueued_at)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setOpenAssign(openAssign === item.id ? null : item.id)}
                  >
                    {openAssign === item.id ? 'Abbrechen' : 'Manuell zuordnen'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Trash2}
                    onClick={() => handleDelete(item)}
                    aria-label="Pending entfernen"
                  >
                    {''}
                  </Button>
                </div>
              </div>
              {openAssign === item.id && (
                <div className="pt-1">
                  <AntragAutocomplete
                    antraege={antraege}
                    onSelect={(aktenzeichen) => { void handleManualAssign(item, aktenzeichen); }}
                    placeholder={`Antrag fuer ${item.akronym ?? item.filename} suchen…`}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

