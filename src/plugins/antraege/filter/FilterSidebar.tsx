import { useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw, BookmarkPlus, PanelLeftClose } from 'lucide-react';
import { useStorage } from '@/core/hooks/useStorage';
import { Input } from '@/components/ui/input';
import type { AntragListItem } from '@/core/services/csv/types';
import { useBearbeiterSicht } from '@/core/hooks/useBearbeiterSicht';
import { isAuslastungFreigeschaltet } from '@/core/modul-freischaltung';
import { useShowInaktiveMasStore } from '../useShowInaktiveMasStore';
import { useFilterState } from './useFilterState';
import { FilterSidebarItem } from './FilterSidebarItem';
import { SavePresetDialog } from './SavePresetDialog';
import { QuickViewChips } from './QuickViewChips';
import { FrequentFiltersSection } from './FrequentFiltersSection';
import {
  getTopFrequent,
  recordFilterApply,
  getEntryCount,
  isHintDismissed,
  dismissHint,
  signatureOf,
  PRESET_HINT_THRESHOLD,
  type FrequentEntryView,
} from './frequentFilters';
import { PresetSuggestionBanner } from './PresetSuggestionBanner';

interface Props {
  antraege: AntragListItem[];
  search: string;
  onSearchChange: (s: string) => void;
  /** Wenn true: Quicksearch-Input ausblenden (Drawer-Modus, wenn Search im Header schon vorhanden ist). */
  hideSearch?: boolean;
  /** Einklappen aus der Leiste heraus. Ohne die Prop zeigt der Kopf kein
   *  Einklapp-Icon — im Drawer schließt die Überlagerung selbst, ein zweiter
   *  Weg dorthin wäre eine Attrappe. */
  onCollapse?: () => void;
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

export function FilterSidebar({ antraege, search, onSearchChange, hideSearch = false, onCollapse }: Props): React.ReactElement {
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
  // „Anträge inaktiver Bearbeiter" ist ein Mengen-Schalter wie jeder andere hier
  // und stand bis v4.64 als Häkchen „inaktive MAs" in der Suchzeile — neben dem
  // Suchfeld, wo er nichts zu suchen hatte. Der Zustand selbst bleibt geteilt
  // (`useShowInaktiveMasStore`, zweite Oberfläche in den Einstellungen).
  const { mode: bearbeiterMode } = useBearbeiterSicht();
  const showInaktive = useShowInaktiveMasStore(s => s.showInaktive);
  const setShowInaktive = useShowInaktiveMasStore(s => s.setShowInaktive);
  // Mit aktivem Kürzel-Filter wirkt er nicht (die Sicht ist dann ohnehin auf
  // eine Person geschnitten) — ein Häkchen ohne Wirkung wäre irreführend.
  const zeigeInaktivSchalter = isAuslastungFreigeschaltet() && !bearbeiterMode.active;
  const [presetDialogOpen, setPresetDialogOpen] = useState(false);
  const [frequent, setFrequent] = useState<FrequentEntryView[]>(() => getTopFrequent(3, [], {}));
  /** Tick zum Re-Render nach dismissHint (localStorage-Lookup happens in render). */
  const [hintTick, setHintTick] = useState(0);

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
      setFrequent(getTopFrequent(3, definitions, valueLabels));
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [active, definitions, valueLabels]);

  const applyFrequent = (entry: FrequentEntryView): void => {
    // Bei Anwenden zuerst alles leeren, dann die gespeicherten Werte setzen.
    clearAll();
    for (const af of entry.appliedFilters) {
      setActiveValue(af.filterId, af.value);
    }
  };

  const hasActive = active.length > 0;
  const activePreset = presets.find(p => p.id === activePresetId) ?? null;

  // Auto-Preset-Vorschlag: aktuelle Kombi wurde >= PRESET_HINT_THRESHOLD-mal
  // angewendet, ist noch nicht als Preset aktiv, und wurde noch nicht
  // weggeklickt. `hintTick` triggert nach Dismiss-Klick einen Re-Render.
  const presetHint = useMemo(() => {
    if (!hasActive || activePreset) return null;
    const sig = signatureOf(active);
    const count = getEntryCount(active);
    if (count < PRESET_HINT_THRESHOLD) return null;
    if (isHintDismissed(sig)) return null;
    return { signature: sig, count };
    // hintTick als Dep, damit Dismiss-Klick einen Re-Render auslöst.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, hasActive, activePreset, hintTick]);

  return (
    <div
      // FLÄCHE STATT STRICH (v4.64): die Leiste steht auf derselben leichten
      // Grundfläche wie der Tabellenkopf rechts von ihr. Beide zusammen bilden
      // ein graues L um die weiße Datenfläche — das trennt schon von sich aus,
      // und die Trennlinie an der rechten Kante ist deshalb entfallen.
      // Achtung bei Ergänzungen hier drin: `--tf-bg-secondary` ist DECKEND und
      // damit auf dieser Fläche unsichtbar. Hover/aktiv gehen über das
      // durchscheinende `--tf-hover`, abgesetzte Pillen über `--tf-bg`.
      className="flex flex-col h-full bg-[var(--tf-bg-secondary)]"
    >
      {/* Header */}
      <div
        className="shrink-0 flex items-center justify-between gap-2"
        style={{ padding: '12px 12px 10px 16px', borderBottom: '0.5px solid var(--tf-border)' }}
      >
        <span className="text-[13.5px] font-medium text-[var(--tf-text)]">Filter</span>
        <div className="flex items-center gap-2">
          <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">
            {active.length} aktiv
          </span>
          {onCollapse ? (
            <button
              type="button"
              onClick={onCollapse}
              aria-label="Filterleiste einklappen"
              title="Filterleiste einklappen"
              className="shrink-0 p-1 rounded-[6px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] hover:bg-[var(--tf-hover)] transition-colors cursor-pointer"
            >
              <PanelLeftClose size={15} />
            </button>
          ) : null}
        </div>
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
          <span className="px-2 py-0.5 rounded-full bg-[var(--tf-bg)] truncate">
            Preset: {activePreset.name}
          </span>
        </div>
      ) : null}

      {/* Auto-Preset-Vorschlag */}
      {presetHint ? (
        <PresetSuggestionBanner
          count={presetHint.count}
          onSave={() => {
            dismissHint(presetHint.signature);
            setHintTick(t => t + 1);
            setPresetDialogOpen(true);
          }}
          onDismiss={() => {
            dismissHint(presetHint.signature);
            setHintTick(t => t + 1);
          }}
        />
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
                  hideHeader
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

        {zeigeInaktivSchalter ? (
          <>
            <Hairline />
            <SectionHeader title="Bestand" />
            <label className="flex cursor-pointer select-none items-center gap-2 px-1.5 py-1 text-[12px] text-[var(--tf-text-secondary)]">
              <input
                type="checkbox"
                checked={showInaktive}
                onChange={e => setShowInaktive(e.target.checked)}
                className="accent-[var(--tf-primary)] cursor-pointer"
              />
              Anträge inaktiver Bearbeiter einblenden
            </label>
          </>
        ) : null}
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
                  className="px-2 h-7 rounded border-[0.5px] border-[var(--tf-border)] text-[11px] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)]"
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
