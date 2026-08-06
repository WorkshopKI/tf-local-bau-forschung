/**
 * Quickfilter-Toolbar für die Förderanträge-Liste — **Akkordeon** in EINER
 * Zeile (Journey-Paket 2 Phase 2).
 *
 * Segmente (`CollapsibleSeg`, controlled): Status · Antragstyp · Projektart ·
 * PreCheck · (nur List-/Karten-Ansicht) Sortiert-nach. Es ist immer höchstens **eine**
 * Pille offen — der Zustand ist ein einzelner `QuickfilterSegId | null`, pro
 * View persistiert (`quickfilterExpanded.ts`). Öffnen einer Pille schließt die
 * jeweils andere implizit.
 *
 * Filter-Backend:
 * - Status  → `useFilterState` (`system-status`, `phaseQuickfilter.ts`)
 * - Antragstyp → `useFilterState` (`system-vb-phase`, `kategorieQuickfilter.ts`)
 * - Projektart → eigener Store-Slot `projektart` (abgeleitet aus Antragstyp +
 *   TV-Zahl des Verbunds, kein Filter-Chip, siehe `projektartQuickfilter.ts`)
 * - PreCheck → eigener Store-Slot `precheckBucket` (abgeleitete Klassifikation,
 *   kein Filter-Chip, siehe `precheckQuickfilter.ts`)
 * - Sort → `useAntraegeStore` (per-View)
 *
 * Die **Gruppieren**-Steuerung ist seit Phase 2 kein Segment mehr, sondern ein
 * Dropdown rechts in `AntraegeMain` (`GruppierenDropdown`).
 */
import { useEffect, useMemo, useState } from 'react';
import { useAntraegeStore, getEffectiveSortKey, getEffectiveViewMode } from '../store';
import { useFilteredAntraege } from '../useFilteredAntraege';
import { useFilterState } from './useFilterState';
import { sortSegModell, sortKeyFuerLabel } from './sortSeg';
import { CollapsibleSeg } from './CollapsibleSeg';
import {
  getPhaseFromActive,
  getPhaseItems,
  applyPhase,
  type PhaseLabel,
} from './phaseQuickfilter';
import {
  getKategorieFromActive,
  getKategorieItems,
  applyKategorie,
  type KategorieLabel,
} from './kategorieQuickfilter';
import { getPrecheckItems, asPrecheckBucket } from './precheckQuickfilter';
import {
  PROJEKTART_LABELS,
  getProjektartItems,
  projektartVonLabel,
} from './projektartQuickfilter';
import {
  loadExpandedSeg,
  saveExpandedSeg,
  toggleExpandedSeg,
  type QuickfilterSegId,
} from './quickfilterExpanded';

export function QuickfilterToolbar(): React.ReactElement {
  // Counts auf der "Kürzel-gefilterten" Basis berechnen, nicht auf der
  // Roh-Liste — sonst zeigen die Pillen Counts der gesamten Kohorte
  // obwohl die Tabs oben (Offen / Alle …) bereits den Kürzel-Filter
  // anwenden. countBase = View + Irrläufer-Pre-Filter + Bearbeiter-Filter,
  // ohne die Sidebar-Active-Filter (Stabilität).
  const { countBase, tvCountOf } = useFilteredAntraege();
  const activeView = useAntraegeStore(s => s.activeView);
  const sortByView = useAntraegeStore(s => s.sortByView);
  const setSortForView = useAntraegeStore(s => s.setSortForView);

  const sortKey = getEffectiveSortKey(activeView, sortByView);
  // Tabellen-Ansicht ("compact") ist flach → jeder Spaltenkopf sortiert selbst,
  // daher das "Sortiert nach"-Segment dort ausblenden.
  const viewMode = useAntraegeStore(s => getEffectiveViewMode(s.activeView, s.viewModeByTab));

  const active = useFilterState(s => s.active);
  const setActiveValue = useFilterState(s => s.setActiveValue);
  const clearFilter = useFilterState(s => s.clearFilter);

  const precheckBucket = useAntraegeStore(s => s.precheckBucket);
  const setPrecheckBucket = useAntraegeStore(s => s.setPrecheckBucket);
  const projektart = useAntraegeStore(s => s.projektart);
  const setProjektart = useAntraegeStore(s => s.setProjektart);

  // Akkordeon-Zustand: höchstens ein offenes Segment, pro View persistiert.
  const [expandedSeg, setExpandedSeg] = useState<QuickfilterSegId | null>(() => loadExpandedSeg(activeView));
  useEffect(() => {
    setExpandedSeg(loadExpandedSeg(activeView));
  }, [activeView]);
  const handleToggle = (seg: QuickfilterSegId): void => {
    setExpandedSeg(prev => {
      const next = toggleExpandedSeg(prev, seg);
      saveExpandedSeg(activeView, next);
      return next;
    });
  };

  // Phase
  const phaseItems = useMemo(() => getPhaseItems(countBase), [countBase]);
  const phase = getPhaseFromActive(active);
  const onPhaseChange = (label: string): void => {
    applyPhase(label as PhaseLabel, (id, v) => setActiveValue(id, v), clearFilter);
  };

  // Antragstyp (Kategorie)
  const kategorieItems = useMemo(() => getKategorieItems(countBase), [countBase]);
  const kategorie = getKategorieFromActive(active);
  const onKategorieChange = (label: string): void => {
    applyKategorie(label as KategorieLabel, (id, v) => setActiveValue(id, v), clearFilter);
  };

  // Projektart (abgeleitet aus Antragstyp + TV-Zahl, eigener Store-Slot). Die
  // Zähler laufen über dieselbe `tvCountOf` wie der Filter — siehe
  // `projektartQuickfilter.ts`.
  const projektartItems = useMemo(
    () => getProjektartItems(countBase, tvCountOf), [countBase, tvCountOf],
  );
  const onProjektartChange = (label: string): void => {
    setProjektart(projektartVonLabel(label));
  };

  // PreCheck (abgeleiteter Bucket, eigener Store-Slot)
  const precheckItems = useMemo(() => getPrecheckItems(countBase), [countBase]);
  const onPrecheckChange = (label: string): void => {
    setPrecheckBucket(asPrecheckBucket(label));
  };

  // Sortiert nach (nur List-/Karten-Ansicht) — Einträge, aktuelles Label und
  // Kollaps-Wert kommen aus `sortSeg.ts`, damit die Pille nicht wieder eine
  // eigene, von `sort.ts` abweichende Options-Liste führen kann.
  const sortSeg = useMemo(() => sortSegModell(activeView, sortKey), [activeView, sortKey]);
  const onSortChange = (label: string): void => {
    const key = sortKeyFuerLabel(activeView, label);
    if (key === null) return;
    setSortForView(activeView, key);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* „Status in dieser Sicht", nicht bloß „Status": die Zähler beziehen sich
          auf `countBase`, also auf die oben gewählte Sicht. Ohne den Zusatz
          standen „Offen 909" (Sicht-Reiter) und „Offen 852" (Chip) zwei Zeilen
          auseinander und widersprachen sich scheinbar (v2.372.2). */}
      <CollapsibleSeg
        label="Status in dieser Sicht"
        value={phase}
        items={phaseItems}
        onChange={onPhaseChange}
        expanded={expandedSeg === 'status'}
        onExpandToggle={() => handleToggle('status')}
      />
      <CollapsibleSeg
        label="Antragstyp"
        value={kategorie}
        items={kategorieItems}
        onChange={onKategorieChange}
        expanded={expandedSeg === 'antragstyp'}
        onExpandToggle={() => handleToggle('antragstyp')}
      />
      {/* Einzel-/Kooperationsprojekt. Die beiden Netzwerkbezug-Stufen liegen
          INNERHALB von „Einzelprojekt" — ihre Zähler summieren sich deshalb
          nicht auf dessen Zahl (ein DS-Einzelprojekt trägt weder 16KN noch
          16EP). Die Tooltips am Knopf nennen die Regel im Klartext. */}
      <CollapsibleSeg
        label="Projektart"
        value={PROJEKTART_LABELS[projektart]}
        items={projektartItems}
        onChange={onProjektartChange}
        expanded={expandedSeg === 'projektart'}
        onExpandToggle={() => handleToggle('projektart')}
      />
      <CollapsibleSeg
        label="PreCheck"
        value={precheckBucket}
        items={precheckItems}
        onChange={onPrecheckChange}
        expanded={expandedSeg === 'precheck'}
        onExpandToggle={() => handleToggle('precheck')}
      />
      {viewMode === 'compact' ? null : (
        <CollapsibleSeg
          label="Sortiert nach"
          value={sortSeg.aktuellesLabel}
          defaultValue={sortSeg.defaultLabel}
          items={sortSeg.items}
          onChange={onSortChange}
          expanded={expandedSeg === 'sort'}
          onExpandToggle={() => handleToggle('sort')}
        />
      )}
    </div>
  );
}
