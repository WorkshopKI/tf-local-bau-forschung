/**
 * Gruppe „Filter" im Panel „Verzeichnisse" — bis v4.35 die eigene Seite
 * `/kuration/filter`.
 *
 * Aus den drei Reitern (System / Kurator-Custom / User-Presets) sind drei
 * Klappen MIT ZAEHLER geworden: die Bestandsgroessen stehen damit alle drei
 * gleichzeitig da, statt dass zwei davon hinter einem Reiter verschwinden.
 * Offen ist standardmaessig die einzige, in der der Kurator etwas anlegt.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { SettingsGruppe, SettingsGruppenAktion, SettingsKlappe } from '@/components/settings';
import { SystemFilterList } from './sections/SystemFilterList';
import { AdminCustomFilterList } from './sections/AdminCustomFilterList';
import { UserPresetOverview } from './sections/UserPresetOverview';
import { FilterEditDialog } from './dialogs/FilterEditDialog';

export function FilterGruppe({ programmName }: { programmName?: string }): React.ReactElement {
  const storage = useStorage();
  const session = useKuratorSession();
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
    <SettingsGruppe
      id="sec-filter"
      titel="Filter"
      unterzeile={
        programmName
          ? `Was in der Antragsliste links zur Auswahl steht — für „${programmName}".`
          : 'Was in der Antragsliste links zur Auswahl steht.'
      }
      hint="Drei Bestände, die nebeneinander gelten: System-Filter sind eingebaut und können nur aus- und wieder eingeblendet werden. Kurator-Filter legst du hier an, sie gelten für alle im aktiven Programm. Nutzer-Vorlagen sind private Filter-Kombinationen und liegen auf dem jeweiligen Gerät — sie stehen hier nur zur Kenntnis."
      aktion={
        <SettingsGruppenAktion onClick={openNew} disabled={!session.isActive}>
          Neuer Filter
        </SettingsGruppenAktion>
      }
    >
      <SettingsKlappe
        id="sec-filter-kurator"
        label="Kurator-Filter — gelten für alle"
        zaehler={adminFilters.length}
        storageKey="teamflow_kuration_filter_kurator"
        defaultOpen
      >
        <AdminCustomFilterList
          filters={adminFilters}
          canEdit={session.isActive}
          onEdit={openEdit}
          onChanged={refresh}
        />
      </SettingsKlappe>

      <SettingsKlappe
        id="sec-filter-system"
        label="System-Filter — eingebaut"
        zaehler={systemFilters.length}
        storageKey="teamflow_kuration_filter_system"
      >
        <SystemFilterList
          filters={systemFilters}
          canEdit={session.isActive}
          onChanged={refresh}
        />
      </SettingsKlappe>

      <SettingsKlappe
        id="sec-filter-nutzer"
        label="Nutzer-Vorlagen — privat, nur zur Kenntnis"
        zaehler={presets.length}
        storageKey="teamflow_kuration_filter_nutzer"
      >
        <UserPresetOverview presets={presets} />
      </SettingsKlappe>

      {programmId ? (
        <FilterEditDialog
          open={editOpen}
          onClose={handleClose}
          onSaved={handleSaved}
          programmId={programmId}
          existing={editing}
        />
      ) : null}
    </SettingsGruppe>
  );
}

function byOrder(a: FilterDefinition, b: FilterDefinition): number {
  return a.anzeige_reihenfolge - b.anzeige_reihenfolge;
}
