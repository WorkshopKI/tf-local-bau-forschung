import { useCallback, useEffect, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useKuratorSession } from '@/core/hooks/useKuratorSession';
import {
  ensureDefaultProgramm,
  listUnterprogrammeByProgramm,
  saveUnterprogramm,
  logUnterprogrammChange,
} from '@/core/services/csv';
import type { Unterprogramm } from '@/core/services/csv/types';
import { UnterprogrammRow } from './UnterprogrammRow';
import { AktivConfirmDialog } from './AktivConfirmDialog';

export function UnterprogrammeAdminPage(): React.ReactElement {
  const storage = useStorage();
  const session = useKuratorSession();
  const [ups, setUps] = useState<Unterprogramm[]>([]);
  const [pending, setPending] = useState<{ up: Unterprogramm; nextAktiv: boolean } | null>(null);

  const refresh = useCallback(async () => {
    const p = await ensureDefaultProgramm(storage.idb);
    const list = await listUnterprogrammeByProgramm(storage.idb, p.id);
    setUps(list.sort((a, b) => a.code.localeCompare(b.code)));
  }, [storage.idb]);

  useEffect(() => { void refresh(); }, [refresh]);

  const handleInlineEdit = async (up: Unterprogramm, patch: Partial<Unterprogramm>): Promise<void> => {
    const next = { ...up, ...patch };
    await saveUnterprogramm(storage.idb, {
      id: next.id,
      programm_id: next.programm_id,
      code: next.code,
      aktiv: next.aktiv,
      name: next.name,
      zeitraum_von: next.zeitraum_von,
      zeitraum_bis: next.zeitraum_bis,
      antrag_count_cached: next.antrag_count_cached,
    });
    await logUnterprogrammChange(
      storage.idb,
      'unterprogramm_edited',
      { code: up.code, patch },
      session.kuratorName ?? undefined,
    );
    await refresh();
  };

  const requestToggle = (up: Unterprogramm, nextAktiv: boolean): void => {
    setPending({ up, nextAktiv });
  };

  const confirmToggle = async (): Promise<void> => {
    if (!pending) return;
    const { up, nextAktiv } = pending;
    await saveUnterprogramm(storage.idb, {
      id: up.id,
      programm_id: up.programm_id,
      code: up.code,
      aktiv: nextAktiv,
      name: up.name,
      zeitraum_von: up.zeitraum_von,
      zeitraum_bis: up.zeitraum_bis,
      antrag_count_cached: up.antrag_count_cached,
    });
    await logUnterprogrammChange(
      storage.idb,
      nextAktiv ? 'unterprogramm_activated' : 'unterprogramm_deactivated',
      { code: up.code, name: up.name, previous_count: up.antrag_count_cached ?? 0 },
      session.kuratorName ?? undefined,
    );
    setPending(null);
    await refresh();
  };

  const totalActive = ups.filter(u => u.aktiv).length;
  const totalAntraege = ups.reduce((s, u) => s + (u.antrag_count_cached ?? 0), 0);

  return (
    <div className="px-8 py-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[22px] font-medium text-[var(--tf-text)]">Unterprogramme</h1>
          <p className="mt-1 text-[12.5px] text-[var(--tf-text-secondary)]">
            {ups.length} Unterprogramme · {totalActive} aktiv · {totalAntraege.toLocaleString('de-DE')} Anträge insgesamt
          </p>
        </div>
      </div>

      {!session.isActive ? (
        <div className="mb-4 text-[12.5px] text-[var(--tf-text-secondary)]">
          Kurator-Modus nicht aktiv. Inline-Bearbeitung deaktiviert.
        </div>
      ) : null}

      {ups.length === 0 ? (
        <div className="py-10 text-center text-[13px] text-[var(--tf-text-tertiary)]">
          Noch keine Unterprogramme. Importiere eine Master-CSV mit Mapping auf <span className="font-mono">unterprogramm_id</span> —
          beim Import werden die gefundenen Unterprogramme automatisch registriert.
        </div>
      ) : (
        <div className="overflow-x-auto" style={{ border: '0.5px solid var(--tf-border)', borderRadius: 12 }}>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-[var(--tf-text-tertiary)]">
                <th className="p-3">Code</th>
                <th className="p-3">Label</th>
                <th className="p-3">Zeitraum</th>
                <th className="p-3">Aktiv</th>
                <th className="p-3 text-right">Anträge</th>
              </tr>
            </thead>
            <tbody>
              {ups.map(up => (
                <UnterprogrammRow
                  key={up.id}
                  up={up}
                  canEdit={session.isActive}
                  onEdit={patch => void handleInlineEdit(up, patch)}
                  onRequestToggle={next => requestToggle(up, next)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AktivConfirmDialog
        pending={pending}
        onCancel={() => setPending(null)}
        onConfirm={() => void confirmToggle()}
      />
    </div>
  );
}
