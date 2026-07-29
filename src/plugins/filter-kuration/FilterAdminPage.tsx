import { useCallback, useEffect, useMemo, useState } from 'react';
import { Tabs } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useStorage } from '@/core/hooks/useStorage';
import { useKuratorSession } from '@/core/hooks/useKuratorSession';
import { useActiveProgramm } from '@/core/hooks/useActiveProgramm';
import {
  ensureDefaultProgramm,
  listFilters,
  listUserPresets,
  seedSystemFilters,
  hydrateAdminFiltersFromSmb,
} from '@/core/services/csv';
import type { FilterDefinition, UserPreset } from '@/core/services/csv';
import { SystemFilterList } from './sections/SystemFilterList';
import { AdminCustomFilterList } from './sections/AdminCustomFilterList';
import { UserPresetOverview } from './sections/UserPresetOverview';
import { FilterEditDialog } from './dialogs/FilterEditDialog';
import { SeitenHilfeButton } from '@/components/help/SeitenHilfeButton';

type TabId = 'system' | 'admin' | 'user';

export function FilterAdminPage(): React.ReactElement {
  const storage = useStorage();
  const session = useKuratorSession();
  const [tab, setTab] = useState<TabId>('system');
  const activeProgrammId = useActiveProgramm(s => s.activeProgrammId);
  const [programmId, setProgrammId] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterDefinition[]>([]);
  const [presets, setPresets] = useState<UserPreset[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<FilterDefinition | null>(null);

  const refresh = useCallback(async () => {
    const id = activeProgrammId ?? (await ensureDefaultProgramm(storage.idb)).id;
    setProgrammId(id);
    await seedSystemFilters(storage.idb, id);
    await hydrateAdminFiltersFromSmb(storage.idb, id);
    const [defs, userPresets] = await Promise.all([
      listFilters(storage.idb, id),
      listUserPresets(storage.idb, id),
    ]);
    setFilters(defs);
    setPresets(userPresets);
  }, [storage.idb, activeProgrammId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const systemFilters = useMemo(() => filters.filter(f => f.scope === 'system').sort(byOrder), [filters]);
  const adminFilters = useMemo(() => filters.filter(f => f.scope === 'admin').sort(byOrder), [filters]);

  const tabs = useMemo(() => [
    { id: 'system', label: 'System', badge: systemFilters.length },
    { id: 'admin', label: 'Kurator-Custom', badge: adminFilters.length },
    { id: 'user', label: 'User-Presets', badge: presets.length },
  ], [systemFilters.length, adminFilters.length, presets.length]);

  const openNew = (): void => {
    setEditing(null);
    setEditOpen(true);
  };

  const openEdit = (f: FilterDefinition): void => {
    setEditing(f);
    setEditOpen(true);
  };

  const handleClose = (): void => {
    setEditOpen(false);
    setEditing(null);
  };

  const handleSaved = async (): Promise<void> => {
    await refresh();
    handleClose();
  };

  return (
    <div className="px-8 py-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[22px] font-medium text-[var(--tf-text)]">Filter verwalten</h1>
          <p className="mt-1 text-[12.5px] text-[var(--tf-text-secondary)]">
            System-Filter sind eingebaut. Kurator-Custom-Filter gelten für alle User des Programms.
            User-Presets sind private Filter-Kombinationen.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {tab === 'admin' ? (
            <Button variant="default" size="sm" onClick={openNew} disabled={!session.isActive}>
              Neuer Filter
            </Button>
          ) : null}
          <SeitenHilfeButton pluginId="filter-kuration" />
        </div>
      </div>

      {!session.isActive ? (
        <div className="mb-4 text-[12.5px] text-[var(--tf-text-secondary)]">
          Kurator-Modus nicht aktiv. Filter sind nur lesbar. Aktivierung in Einstellungen → Profil → Kurator-Bereich.
        </div>
      ) : null}

      <Tabs tabs={tabs} activeTab={tab} onChange={id => setTab(id as TabId)} />

      <div className="mt-5">
        {tab === 'system' && (
          <SystemFilterList
            filters={systemFilters}
            canEdit={session.isActive}
            onChanged={refresh}
          />
        )}
        {tab === 'admin' && (
          <AdminCustomFilterList
            filters={adminFilters}
            canEdit={session.isActive}
            onEdit={openEdit}
            onChanged={refresh}
          />
        )}
        {tab === 'user' && (
          <UserPresetOverview presets={presets} />
        )}
      </div>

      {programmId ? (
        <FilterEditDialog
          open={editOpen}
          onClose={handleClose}
          onSaved={handleSaved}
          programmId={programmId}
          existing={editing}
        />
      ) : null}
    </div>
  );
}

function byOrder(a: FilterDefinition, b: FilterDefinition): number {
  return a.anzeige_reihenfolge - b.anzeige_reihenfolge;
}
