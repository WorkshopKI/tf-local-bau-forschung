import { List, Rows3, LayoutGrid } from 'lucide-react';
import { useAntraegeStore, getEffectiveViewMode } from './store';
import type { ViewMode } from './viewModes';

const OPTIONS: ReadonlyArray<{ mode: ViewMode; label: string; Icon: typeof List }> = [
  { mode: 'list',    label: 'Listenansicht',    Icon: List },
  { mode: 'compact', label: 'Kompaktansicht',   Icon: Rows3 },
  { mode: 'cards',   label: 'Kartenansicht',    Icon: LayoutGrid },
];

/**
 * 3-Button-Toggle für den View-Modus der Antrags-Liste. Wird im Header rechts
 * neben dem Filter-Icon eingehängt. Persistiert pro aktivem Tab im Store.
 */
export function ViewModeToggle(): React.ReactElement {
  const activeView = useAntraegeStore(s => s.activeView);
  const viewMode = useAntraegeStore(s => getEffectiveViewMode(s.activeView, s.viewModeByTab));
  const setViewModeForTab = useAntraegeStore(s => s.setViewModeForTab);

  return (
    <div
      role="group"
      aria-label="Ansicht wechseln"
      className="inline-flex items-center rounded-[var(--tf-radius)] overflow-hidden"
      style={{ border: '0.5px solid var(--tf-border)' }}
    >
      {OPTIONS.map(({ mode, label, Icon }, idx) => {
        const isActive = mode === viewMode;
        return (
          <button
            key={mode}
            type="button"
            aria-label={label}
            aria-pressed={isActive}
            title={label}
            onClick={() => setViewModeForTab(activeView, mode)}
            className={`h-8 w-8 inline-flex items-center justify-center transition-colors ${
              isActive
                ? 'text-[var(--tf-primary)]'
                : 'text-[var(--tf-text-secondary)] hover:bg-[var(--tf-bg-secondary)]'
            }`}
            style={{
              background: isActive ? 'var(--tf-primary-soft)' : 'transparent',
              borderLeft: idx === 0 ? 'none' : '0.5px solid var(--tf-border)',
            }}
          >
            <Icon size={14} />
          </button>
        );
      })}
    </div>
  );
}
