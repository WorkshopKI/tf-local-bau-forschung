import { useAntraegeStore } from '../store';
import { useFilteredAntraege } from '../useFilteredAntraege';
import { VIEWS } from '../views';

const fmt = (n: number): string => n.toLocaleString('de-DE');

/**
 * Schnellauswahl-Chips für die Filter-Sidebar.
 *
 * Spiegelt die Header-Tabs (selber `activeView`-State) — beide UI-Surfaces
 * sind synchron. „Alle" wird ausgeblendet (entspricht dem Default-Zustand);
 * der Wechsel zurück auf „Alle" passiert über die Header-Tabs oder
 * „Filter zurücksetzen".
 *
 * Die Zahlen kommen aus `useFilteredAntraege().counts`, also aus derselben
 * Grundmenge wie die Liste und wie die Tabs. Eigenes Zählen auf der rohen
 * Store-Liste ließ hier den Betrachtungsbereich aus — der Chip nannte 555, wo
 * der Tab 541 sagte (Pitfall #46).
 */
export function QuickViewChips(): React.ReactElement {
  const activeView = useAntraegeStore(s => s.activeView);
  const setActiveView = useAntraegeStore(s => s.setActiveView);
  const { counts } = useFilteredAntraege();

  const chips = VIEWS.filter(v => v.key !== 'alle');

  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map(v => {
        const isActive = v.key === activeView;
        const cnt = counts[v.key];
        return (
          <button
            key={v.key}
            type="button"
            onClick={() => setActiveView(v.key)}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11.5px] cursor-pointer transition-colors ${
              isActive
                ? 'bg-[var(--tf-primary)] text-white'
                : 'text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)]'
            }`}
            style={{
              border: isActive ? 'none' : '0.5px solid var(--tf-border-hover)',
            }}
          >
            <span>{v.label}</span>
            <span
              className={`tabular-nums ${
                isActive ? 'text-white/80' : 'text-[var(--tf-text-tertiary)]'
              }`}
            >
              {fmt(cnt)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
