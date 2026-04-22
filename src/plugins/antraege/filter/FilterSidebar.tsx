import { useMemo, useState } from 'react';
import { RotateCcw, BookmarkPlus } from 'lucide-react';
import { useStorage } from '@/core/hooks/useStorage';
import { Input } from '@/components/ui/input';
import type { Antrag } from '@/core/services/csv/types';
import { useFilterState } from './useFilterState';
import { FilterSidebarItem } from './FilterSidebarItem';
import { SavePresetDialog } from './SavePresetDialog';

interface Props {
  antraege: Antrag[];
  search: string;
  onSearchChange: (s: string) => void;
}

export function FilterSidebar({ antraege, search, onSearchChange }: Props): React.ReactElement {
  const storage = useStorage();
  const {
    definitions,
    active,
    presets,
    activePresetId,
    valueLabels,
    setActiveValue,
    clearAll,
    savePreset,
    loadPreset,
    deletePreset,
  } = useFilterState();
  const [presetDialogOpen, setPresetDialogOpen] = useState(false);

  const visibleDefs = useMemo(
    () => definitions.filter(d => !d.versteckt).sort((a, b) => a.anzeige_reihenfolge - b.anzeige_reihenfolge),
    [definitions],
  );

  const hasActive = active.length > 0;

  const activePreset = presets.find(p => p.id === activePresetId) ?? null;

  return (
    <div className="flex flex-col h-full">
      {/* Header: Quicksearch */}
      <div className="p-3 shrink-0" style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
        <Input
          placeholder="Schnellsuche …"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
        />
      </div>

      {/* Preset-Indicator */}
      {activePreset ? (
        <div className="mx-3 mt-3 flex items-center gap-2 text-[11.5px] text-[var(--tf-text-secondary)]">
          <span className="px-2 py-0.5 rounded-full bg-[var(--tf-bg-secondary)] truncate">
            Preset: {activePreset.name}
          </span>
        </div>
      ) : null}

      {/* Filter-Liste */}
      <div className="flex-1 overflow-y-auto px-3">
        {visibleDefs.length === 0 ? (
          <div className="py-6 text-center text-[12px] text-[var(--tf-text-tertiary)]">
            Keine Filter vorhanden.
          </div>
        ) : (
          visibleDefs.map(def => (
            <FilterSidebarItem
              key={def.id}
              def={def}
              antraege={antraege}
              activeFilters={active}
              definitions={definitions}
              valueLabels={valueLabels[def.feld]}
              onChange={v => setActiveValue(def.id, v)}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 p-3 flex flex-col gap-2" style={{ borderTop: '0.5px solid var(--tf-border)' }}>
        <button
          type="button"
          onClick={clearAll}
          disabled={!hasActive}
          className="flex items-center gap-1.5 text-[12px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <RotateCcw size={12} />
          Alle Filter zurücksetzen
        </button>
        <button
          type="button"
          onClick={() => setPresetDialogOpen(true)}
          disabled={!hasActive}
          className="flex items-center gap-1.5 text-[12px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <BookmarkPlus size={12} />
          Als Preset speichern
        </button>

        {presets.length > 0 ? (
          <div className="mt-1">
            <label className="block text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)] mb-1">Preset laden</label>
            <div className="flex gap-1">
              <select
                value={activePresetId ?? ''}
                onChange={e => {
                  const val = e.target.value;
                  if (!val) {
                    clearAll();
                  } else {
                    loadPreset(val);
                  }
                }}
                className="flex-1 min-w-0 h-7 rounded border-[0.5px] border-[var(--tf-border)] bg-transparent px-2 text-[12px]"
              >
                <option value="">– keines –</option>
                {presets.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              {activePresetId ? (
                <button
                  type="button"
                  title="Preset löschen"
                  onClick={() => void deletePreset(storage.idb, activePresetId)}
                  className="px-2 h-7 rounded border-[0.5px] border-[var(--tf-border)] text-[11px] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-bg-secondary)]"
                >
                  ×
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <SavePresetDialog
        open={presetDialogOpen}
        onClose={() => setPresetDialogOpen(false)}
        onSave={async (name, desc) => {
          await savePreset(storage.idb, name, desc);
        }}
      />
    </div>
  );
}
