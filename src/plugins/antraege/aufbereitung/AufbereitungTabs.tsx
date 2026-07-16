/**
 * Tab-Leiste der Aufbereitungs-Seite. Kleine, handgebaute Section-Tab-Strip
 * (KEIN `ScopeTabs` — das sind Zähler-/Listen-Sichten). Aktiv = `--tf-text` +
 * 2px-`--tf-text`-Unterstrich (DESIGN_GUIDE „Tabs": Unterstrich schwarz, NICHT
 * primary). `inaktiv`-Tabs (nicht klickbar, tertiär, kein Hover, KEINE Opacity)
 * werden seit Paket 5 dynamisch aus dem Baustein-Status abgeleitet (Tab-Gating,
 * `deriveTabZustaende`): während eines Laufs bleibt ein baustein-gebundener Tab
 * gesperrt, bis sein Baustein fertig ist. Ohne `zustaende`-Prop ist alles klickbar.
 */
import { cn } from '@/lib/utils';
import type { TabZustandInfo } from './tab-gating';

export type AufbereitungTabId =
  | 'uebersicht' | 'steckbrief' | 'abdeckung' | 'zeitplan' | 'zahlen' | 'verwertung' | 'glossar' | 'fragen' | 'recherche' | 'lesemodus';

interface TabDef {
  id: AufbereitungTabId;
  label: string;
}

export const AUFBEREITUNG_TABS: TabDef[] = [
  { id: 'uebersicht', label: 'Übersicht' },
  { id: 'steckbrief', label: 'Steckbrief' },
  { id: 'abdeckung', label: 'Abdeckung' },
  { id: 'zeitplan', label: 'Zeitplan' },
  { id: 'zahlen', label: 'Zahlen' },
  { id: 'verwertung', label: 'Verwertung/Markt' },
  { id: 'glossar', label: 'Glossar' },
  { id: 'fragen', label: 'Fragen' },
  { id: 'recherche', label: 'Recherche' },
  { id: 'lesemodus', label: 'Lesemodus' },
];

export function AufbereitungTabs({
  active, onChange, zustaende,
}: {
  active: AufbereitungTabId;
  onChange: (id: AufbereitungTabId) => void;
  /** Klick-Zustand je Tab (aus `deriveTabZustaende`); fehlt er, ist der Tab klickbar. */
  zustaende?: Record<AufbereitungTabId, TabZustandInfo>;
}): React.ReactElement {
  return (
    <div className="flex items-end gap-6 overflow-x-auto" style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
      {AUFBEREITUNG_TABS.map(t => {
        const info = zustaende?.[t.id];
        if (info?.zustand === 'inaktiv') {
          return (
            <span key={t.id} className="pb-2.5 text-[13.5px] whitespace-nowrap text-[var(--tf-text-tertiary)] cursor-default select-none"
              title={info.title ?? 'noch nicht aufbereitet'}>
              {t.label}
            </span>
          );
        }
        const istAktiv = t.id === active;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={cn(
              'pb-2.5 text-[13.5px] whitespace-nowrap -mb-px border-b-2 transition-colors',
              istAktiv
                ? 'text-[var(--tf-text)] font-medium border-[var(--tf-text)]'
                : 'text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] border-transparent',
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
