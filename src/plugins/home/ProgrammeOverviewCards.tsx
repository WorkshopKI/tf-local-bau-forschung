/**
 * Multi-Programm-Übersicht auf der Home-Page.
 *
 * Bei mehr als einem Programm: kleine Karten-Reihe oben mit Antrags-Counts
 * pro Programm. Klick switched das aktive Programm.
 *
 * Counts werden direkt aus `listAntraegeByProgramm` gezogen (kein Store-Reload-
 * Storm), CLOSED-Stati werden ausgefiltert für „offene Vorgänge"-Zahl.
 */

import { useEffect, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useActiveProgramm } from '@/core/hooks/useActiveProgramm';
import { useProfile } from '@/core/hooks/useProfile';
import { listAntraegeByProgramm } from '@/core/services/csv';
import type { Programm } from '@/core/services/csv/types';

const CLOSED = new Set(['genehmigt', 'abgelehnt', 'archiviert', 'bewilligt', 'abgeschlossen']);

interface Counts {
  total: number;
  offen: number;
}

export function ProgrammeOverviewCards(): React.ReactElement | null {
  const storage = useStorage();
  const { profile, updateProfile } = useProfile();
  const programme = useActiveProgramm(s => s.programme);
  const activeProgrammId = useActiveProgramm(s => s.activeProgrammId);
  const setActive = useActiveProgramm(s => s.setActive);
  const [counts, setCounts] = useState<Map<string, Counts>>(new Map());

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = new Map<string, Counts>();
      for (const p of programme) {
        const list = await listAntraegeByProgramm(storage.idb, p.id);
        const offen = list.filter(a => !CLOSED.has(String(a.status ?? '').toLowerCase())).length;
        next.set(p.id, { total: list.length, offen });
      }
      if (!cancelled) setCounts(next);
    })();
    return () => { cancelled = true; };
  }, [programme, storage.idb]);

  if (programme.length <= 1) return null;

  const onSelect = async (p: Programm): Promise<void> => {
    if (p.id === activeProgrammId) return;
    await setActive(storage.idb, p.id, profile ? updateProfile : undefined);
  };

  return (
    <div className="mb-6">
      <div className="text-[10.5px] uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)] mb-2">
        Meine Programme
      </div>
      <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {programme.map(p => {
          const c = counts.get(p.id);
          const isActive = p.id === activeProgrammId;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => { void onSelect(p); }}
              className={`text-left p-3 rounded-[var(--tf-radius)] transition-colors cursor-pointer ${
                isActive
                  ? 'bg-[var(--tf-primary-light)] text-[var(--tf-text)]'
                  : 'bg-[var(--tf-bg)] hover:bg-[var(--tf-hover)] text-[var(--tf-text)]'
              }`}
              style={{ border: `0.5px solid ${isActive ? 'var(--tf-primary)' : 'var(--tf-border)'}` }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13.5px] font-medium truncate">{p.name}</span>
                {isActive && (
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-800 shrink-0">
                    aktiv
                  </span>
                )}
              </div>
              <div className="mt-1 text-[11.5px] text-[var(--tf-text-tertiary)]">
                {c
                  ? `${c.offen} offen · ${c.total} gesamt`
                  : 'Lade …'}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
