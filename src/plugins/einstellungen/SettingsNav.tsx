import { useState } from 'react';
import { Search } from 'lucide-react';
import {
  GROUP_LABEL,
  searchSettings,
  type SettingsGroup,
  type SettingsPanel,
  type SettingsSearchEntry,
} from './settingsPanels';

const GROUP_ORDER: SettingsGroup[] = ['persoenlich', 'system'];

interface SettingsNavProps {
  panels: SettingsPanel[];
  activePanel: string;
  onSelectPanel: (id: string) => void;
  searchIndex: SettingsSearchEntry[];
  onGoToSection: (panelId: string, sectionId: string) => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
}

/**
 * Settings-Sidebar (Design-Handoff „Variante B"): Suchfeld (Strg+,) + zwei
 * Gruppen (Persönlich / System) mit Nav-Items. Reine Präsentation — Auswahl und
 * Sprung-zu-Abschnitt kommen als Callbacks aus der EinstellungenPage.
 */
export function SettingsNav({
  panels,
  activePanel,
  onSelectPanel,
  searchIndex,
  onGoToSection,
  searchInputRef,
}: SettingsNavProps): React.ReactElement {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [selIdx, setSelIdx] = useState(0);

  const results = searchSettings(searchIndex, query);
  const open = focused && results.length > 0;

  const go = (entry: SettingsSearchEntry): void => {
    onGoToSection(entry.panelId, entry.id);
    setQuery('');
    setSelIdx(0);
    searchInputRef.current?.blur();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelIdx(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results.length) {
      e.preventDefault();
      const entry = results[Math.min(selIdx, results.length - 1)];
      if (entry) go(entry);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setQuery('');
      setSelIdx(0);
      searchInputRef.current?.blur();
    }
  };

  return (
    <div className="sticky top-4 self-start pr-5 border-r border-[var(--tf-border)]">
      {/* Suche */}
      <div className="relative">
        <div
          className={`flex items-center gap-2 h-8 px-2.5 rounded-[var(--tf-radius)] bg-[var(--tf-bg)] text-[var(--tf-text-tertiary)] ${
            focused ? 'ring-1 ring-[var(--tf-primary)]' : ''
          }`}
          style={{ border: focused ? '0.5px solid var(--tf-primary)' : '0.5px solid var(--tf-border-hover)' }}
        >
          <Search size={14} className="shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setSelIdx(0); }}
            onFocus={() => setFocused(true)}
            onBlur={() => window.setTimeout(() => setFocused(false), 150)}
            onKeyDown={onKeyDown}
            placeholder="Suchen"
            autoComplete="off"
            aria-label="Einstellungen durchsuchen"
            title="Strg + Komma öffnet die Suche"
            className="flex-1 min-w-0 bg-transparent outline-none text-[13px] text-[var(--tf-text)] placeholder:text-[var(--tf-text-tertiary)]"
          />
        </div>

        {open && (
          <div
            className="absolute left-0 top-[calc(100%+6px)] w-[300px] z-40 rounded-[var(--tf-radius-lg)] bg-[var(--tf-bg)] p-1.5"
            style={{ border: '0.5px solid var(--tf-border)', boxShadow: 'var(--tf-shadow-dialog)' }}
          >
            {results.map((r, i) => (
              <button
                key={`${r.panelId}:${r.id}`}
                type="button"
                onMouseDown={e => { e.preventDefault(); go(r); }}
                onMouseEnter={() => setSelIdx(i)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[var(--tf-radius)] text-left ${
                  i === selIdx ? 'bg-[var(--tf-hover)]' : ''
                }`}
              >
                <span className="text-[13px] font-medium text-[var(--tf-text)] truncate">
                  <Highlight text={r.label} query={query} />
                </span>
                <span className="ml-auto text-[11.5px] text-[var(--tf-text-tertiary)] whitespace-nowrap shrink-0">
                  {r.panelLabel}
                </span>
              </button>
            ))}
            <p className="px-2.5 pt-2 pb-1 text-[11.5px] text-[var(--tf-text-tertiary)] border-t border-[var(--tf-border)] mt-1">
              ↑↓ wählen · Enter öffnet den Abschnitt
            </p>
          </div>
        )}
      </div>

      {/* Gruppen */}
      {GROUP_ORDER.map(group => {
        const groupPanels = panels.filter(p => p.group === group);
        if (groupPanels.length === 0) return null;
        return (
          <div key={group}>
            <p className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)] mt-[22px] mb-2 ml-2.5">
              {GROUP_LABEL[group]}
            </p>
            {groupPanels.map(panel => {
              const Icon = panel.icon;
              const active = panel.id === activePanel;
              return (
                <button
                  key={panel.id}
                  type="button"
                  onClick={() => onSelectPanel(panel.id)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-[var(--tf-radius)] text-[13px] text-left transition-colors ${
                    active
                      ? 'bg-[var(--tf-primary-light)] text-[var(--tf-primary)] font-medium'
                      : 'text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)]'
                  }`}
                >
                  <Icon size={14} strokeWidth={1.5} className={`shrink-0 ${active ? '' : 'opacity-75'}`} />
                  <span className="truncate">{panel.label}</span>
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

/** Hebt den ersten Treffer der Query im Label hervor. */
function Highlight({ text, query }: { text: string; query: string }): React.ReactElement {
  const q = query.trim().toLowerCase();
  const i = q ? text.toLowerCase().indexOf(q) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="bg-[var(--tf-primary-light)] text-[var(--tf-primary)] rounded-[3px] px-0.5">
        {text.slice(i, i + q.length)}
      </mark>
      {text.slice(i + q.length)}
    </>
  );
}
