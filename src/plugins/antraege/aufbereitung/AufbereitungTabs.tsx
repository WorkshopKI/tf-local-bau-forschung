/**
 * Tab-Leiste der Aufbereitungs-Seite. Kleine, handgebaute Section-Tab-Strip
 * (KEIN `ScopeTabs` — das sind Zähler-/Listen-Sichten). Aktiv = `--tf-text` +
 * 2px-`--tf-text`-Unterstrich (DESIGN_GUIDE „Tabs": Unterstrich schwarz, NICHT
 * primary). In Paket 1 ist nur Zeitplan aktiv; Steckbrief/Abdeckung zeigen einen
 * Platzhalter, die übrigen fünf sind nicht klickbar (tertiär, kein Hover, KEINE
 * Opacity).
 */
import { cn } from '@/lib/utils';

export type AufbereitungTabId =
  | 'steckbrief' | 'abdeckung' | 'zeitplan' | 'zahlen' | 'glossar' | 'fragen' | 'recherche' | 'lesemodus';

interface TabDef {
  id: AufbereitungTabId;
  label: string;
  /** aktiv = voll funktional · platzhalter = klickbar, „In Vorbereitung" · inaktiv = nicht klickbar. */
  zustand: 'aktiv' | 'platzhalter' | 'inaktiv';
}

export const AUFBEREITUNG_TABS: TabDef[] = [
  { id: 'steckbrief', label: 'Steckbrief', zustand: 'aktiv' },
  { id: 'abdeckung', label: 'Abdeckung', zustand: 'aktiv' },
  { id: 'zeitplan', label: 'Zeitplan', zustand: 'aktiv' },
  { id: 'zahlen', label: 'Zahlen', zustand: 'aktiv' },
  { id: 'glossar', label: 'Glossar', zustand: 'aktiv' },
  { id: 'fragen', label: 'Fragen', zustand: 'aktiv' },
  { id: 'recherche', label: 'Recherche', zustand: 'inaktiv' },
  { id: 'lesemodus', label: 'Lesemodus', zustand: 'aktiv' },
];

export function AufbereitungTabs({
  active, onChange,
}: {
  active: AufbereitungTabId;
  onChange: (id: AufbereitungTabId) => void;
}): React.ReactElement {
  return (
    <div className="flex items-end gap-6 overflow-x-auto" style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
      {AUFBEREITUNG_TABS.map(t => {
        if (t.zustand === 'inaktiv') {
          return (
            <span key={t.id} className="pb-2.5 text-[13.5px] whitespace-nowrap text-[var(--tf-text-tertiary)] cursor-default select-none"
              title="In Vorbereitung">
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
