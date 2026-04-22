import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { useStorage } from '@/core/hooks/useStorage';
import { getHistoryByAz, loadSchema } from '@/core/services/csv';
import type { AntragHistorieEntry } from '@/core/services/csv/types';

interface Props {
  aktenzeichen: string;
  feld: string | null;
  onClose: () => void;
}

export function FieldHistoryModal({ aktenzeichen, feld, onClose }: Props): React.ReactElement {
  const storage = useStorage();
  const [entries, setEntries] = useState<AntragHistorieEntry[]>([]);
  const [sourceNames, setSourceNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!feld) return;
    let cancelled = false;
    (async () => {
      const hist = await getHistoryByAz(storage.idb, aktenzeichen);
      const forField = hist
        .filter(h => h.feld === feld)
        .sort((a, b) => b.geaendert_am.localeCompare(a.geaendert_am));
      if (!cancelled) setEntries(forField);
      const ids = [...new Set(forField.map(e => e.csv_schema_id))];
      const names: Record<string, string> = {};
      for (const id of ids) {
        const s = await loadSchema(storage.idb, id);
        if (s) names[id] = s.csv_source_name;
      }
      if (!cancelled) setSourceNames(names);
    })();
    return () => { cancelled = true; };
  }, [aktenzeichen, feld, storage.idb]);

  return (
    <Dialog
      open={!!feld}
      onClose={onClose}
      title={`Historie: ${feld}`}
      description={aktenzeichen}
      className="max-w-[600px]"
      footer={<Button size="sm" variant="default" onClick={onClose}>Schließen</Button>}
    >
      {entries.length === 0 ? (
        <div className="text-[13px] text-[var(--tf-text-tertiary)]">Keine Historie-Einträge.</div>
      ) : (
        <div className="flex flex-col gap-2 max-h-[360px] overflow-y-auto">
          {entries.map(e => (
            <div key={e.id} className="p-3 rounded-lg bg-[var(--tf-bg-secondary)] text-[12.5px]">
              <div className="text-[11.5px] text-[var(--tf-text-tertiary)]">
                {new Date(e.geaendert_am).toLocaleString('de-DE')} · {sourceNames[e.csv_schema_id] ?? e.csv_schema_id}
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="line-through text-[var(--tf-text-tertiary)]">{String(e.alt_wert ?? '')}</span>
                <span className="text-[var(--tf-text)]">→ {String(e.neu_wert ?? '')}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Dialog>
  );
}
