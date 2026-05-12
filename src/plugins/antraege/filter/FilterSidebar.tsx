import { useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw, BookmarkPlus } from 'lucide-react';
import { useStorage } from '@/core/hooks/useStorage';
import { Input } from '@/components/ui/input';
import type { AntragListItem } from '@/core/services/csv/types';
import { useFilterState } from './useFilterState';
import { FilterSidebarItem } from './FilterSidebarItem';
import { SavePresetDialog } from './SavePresetDialog';
import { QuickViewChips } from './QuickViewChips';
import { FrequentFiltersSection } from './FrequentFiltersSection';
import { getTopFrequent, recordFilterApply, type FrequentEntry } from './frequentFilters';

interface Props {
  antraege: AntragListItem[];
  search: string;
  onSearchChange: (s: string) => void;
  /** Wenn true: Quicksearch-Input ausblenden (Drawer-Modus, wenn Search im Header schon vorhanden ist). */
  hideSearch?: boolean;
}

function SectionHeader({
  title,
  trailing,
}: {
  title: string;
  trailing?: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="flex items-center px-1.5 pt-1 pb-1.5">
      <span
        className="text-[10.5px] font-medium uppercase text-[var(--tf-text-tertiary)]"
        style={{ letterSpacing: '0.08em' }}
      >
        {title}
      </span>
      {trailing ? <span className="ml-auto">{trailing}</span> : null}
    </div>
  );
}

function Hairline(): React.ReactElement {
  return <div className="my-2 h-px bg-[var(--tf-border)]" />;
}

export function FilterSidebar({ antraege, search, onSearchChange, hideSearch = false }: Props): React.ReactElement {
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
  const [frequent, setFrequent] = useState<FrequentEntry[]>(() => getTopFrequent(3));

  const visibleDefs = useMemo(
    () => definitions.filter(d => !d.versteckt).sort((a, b) => a.anzeige_reihenfolge - b.anzeige_reihenfolge),
    [definitions],
  );

  // Status-Definition heraussplitten — der Rest wird unten als One-Liner gerendert.
  const { statusDef, otherDefs } = useMemo(() => {
    let st: typeof visibleDefs[number] | undefined;
    const others: typeof visibleDefs = [];
    for (const d of visibleDefs) {
      if (d.feld === 'status' && !st) st = d;
      else others.push(d);
    }
    return { statusDef: st, otherDefs: others };
  }, [visibleDefs]);

  const statusActiveCount = useMemo(() => {
    if (!statusDef) return 0;
    const af = active.find(a => a.filterId === statusDef.id);
    if (!af) return 0;
    if (Array.isArray(af.value)) return af.value.length;
    return af.value ? 1 : 0;
  }, [statusDef, active]);

  // Häufig-Tracking: bei jedem aktiven Set mit Debounce in localStorage schreiben
  // und Top-3 frisch laden. Leeres Set wird nicht getrackt (siehe recordFilterApply).
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (active.length > 0) recordFilterApply(active, definitions);
      setFrequent(getTopFrequent(3));
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [active, definitions]);

  const applyFrequent = (entry: FrequentEntry): void => {
    // Bei Anwenden zuerst alles leeren, dann die gespeicherten Werte setzen.
    clearAll();
    for (const af of entry.appliedFilters) {
      setActiveValue(af.filterId, af.value);
    }
  };

  const hasActive = active.length > 0;
  const activePreset = presets.find(p => p.id === activePresetId) ?? null;

  return (
    <div
      className="flex flex-col h-full bg-[var(--tf-bg)]"
      style={{ borderLeft: '0.5px solid var(--tf-border)' }}
    >
      {/* Header */}
      <div
        className="shrink-0 flex items-baseline justify-between"
        style={{ padding: '14px 16px 10px', borderBottom: '0.5px solid var(--tf-border)' }}
      >
        <span className="text-[13.5px] font-medium text-[var(--tf-text)]">Filter</span>
        <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">
          {active.length} aktiv
        </span>
      </div>

      {/* Optional Quicksearch (Antraege-Volltext) — nur im non-Drawer-Modus. */}
      {!hideSearch && (
        <div className="shrink-0 p-3" style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
          <Input
            placeholder="Anträge suchen …"
            value={search}
            onChange={e => onSearchChange(e.target.value)}
          />
        </div>
      )}

      {/* Preset-Indicator */}
      {activePreset ? (
        <div className="mx-3 mt-3 flex items-center gap-2 text-[11.5px] text-[var(--tf-text-secondary)]">
          <span className="px-2 py-0.5 rounded-full bg-[var(--tf-bg-secondary)] truncate">
            Preset: {activePreset.name}
          </span>
        </div>
      ) : null}

      {/* Scrollbarer Body */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '10px 12px 8px' }}>
        {/* Schnellauswahl */}
        <SectionHeader title="Schnellauswahl" />
        <div className="px-1 pb-3">
          <QuickViewChips />
        </div>

        {/* Häufig benutzt — nur wenn Daten vorhanden */}
        {frequent.length > 0 ? (
          <>
            <SectionHeader title="Häufig benutzt" />
            <div className="pb-2">
              <FrequentFiltersSection entries={frequent} onApply={applyFrequent} />
            </div>
          </>
        ) : null}

        {visibleDefs.length === 0 ? (
          <div className="py-6 text-center text-[12px] text-[var(--tf-text-tertiary)]">
            Keine Filter vorhanden.
          </div>
        ) : (
          <>
            {/* Status (Phasen-Akkordeon) */}
            {statusDef ? (
              <>
                <Hairline />
                <SectionHeader
                  title="Status"
                  trailing={
                    statusActiveCount > 0 ? (
                      <span
                        className="text-[10.5px] font-medium normal-case"
                        style={{ color: 'var(--tf-primary)', letterSpacing: 0 }}
                      >
                        {statusActiveCount} aktiv
                      </span>
                    ) : null
                  }
                />
                <FilterSidebarItem
                  def={statusDef}
                  antraege={antraege}
                  activeFilters={active}
                  definitions={definitions}
                  valueLabels={valueLabels[statusDef.feld]}
                  onChange={v => setActiveValue(statusDef.id, v)}
                />
              </>
            ) : null}

            {/* Restliche Filter-Gruppen (One-Liner) */}
            {otherDefs.length > 0 ? (
              <>
                <Hairline />
                {otherDefs.map(def => (
                  <FilterSidebarItem
                    key={def.id}
                    def={def}
                    antraege={antraege}
                    activeFilters={active}
                    definitions={definitions}
                    valueLabels={valueLabels[def.feld]}
                    onChange={v => setActiveValue(def.id, v)}
                  />
                ))}
              </>
            ) : null}
          </>
        )}
      </div>

      {/* Footer */}
      <div
        className="shrink-0 flex flex-col gap-1.5"
        style={{ padding: '10px 16px', borderTop: '0.5px solid var(--tf-border)' }}
      >
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
