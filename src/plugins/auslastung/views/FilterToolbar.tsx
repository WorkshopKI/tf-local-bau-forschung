/**
 * Filter-/Sortier-Chips des Zuweisungs-Cockpits (Screen 1b) — Kategorie,
 * Antragstyp, Status und Sortierung im Stil der Förderanträge-Quickfilter
 * (CollapsibleSeg). Aus ZuweisungsCockpit.tsx ausgelagert (Kohäsion vor
 * Zeilenzahl), Verhalten unverändert — rein prop-getrieben.
 */
import { CollapsibleSeg, type CollapsibleSegItem } from '@/plugins/antraege/filter/CollapsibleSeg';
import { ALL_ANTRAGSTYP_BUCKETS, type AntragstypBucket, type UeberKategorie } from '../types';
import {
  buildSortChips,
  sortChipValue,
  nextSortKeyForClick,
  SORT_CHIP_DISPLAY,
  DEFAULT_ZUWEISUNG_SORT,
  type ZuweisungSortKey,
} from '../services/matching';
import { STATUS_FILTER_LABELS, type StatusFilter } from './cockpit-helpers';

/**
 * Counts je Filter-Option. Facetten-Semantik: jeder Wert ist die Zeilenzahl,
 * die die Liste nach einem Klick auf ihn zeigt — die ANDEREN aktiven Filter
 * sind eingerechnet, der eigene nicht. `*Total` ist entsprechend die
 * „Alle"-Zahl **dieses** Segments, nicht die des gesamten Pools.
 */
export interface FilterCounts {
  kategorie: Record<string, number>;
  kategorieTotal: number;
  antragstyp: Record<AntragstypBucket, number>;
  antragstypTotal: number;
  offen: number;
  selbst: number;
  zugewiesen: number;
  statusTotal: number;
}

export function FilterToolbar({
  filterCounts, ueberKategorien, kategorieFilter, antragstypFilter, statusFilter, sortKey,
  onKategorieChange, onAntragstypChange, onStatusChange, onSortChange,
}: {
  filterCounts: FilterCounts;
  ueberKategorien: UeberKategorie[];
  kategorieFilter: string;
  antragstypFilter: AntragstypBucket | '';
  statusFilter: StatusFilter;
  sortKey: ZuweisungSortKey;
  onKategorieChange: (filter: string) => void;
  onAntragstypChange: (filter: AntragstypBucket | '') => void;
  onStatusChange: (filter: StatusFilter) => void;
  onSortChange: (key: ZuweisungSortKey) => void;
}): React.ReactElement {
  const kategorieItems: CollapsibleSegItem[] = [
    { label: 'Alle', count: filterCounts.kategorieTotal },
    ...ueberKategorien.map(k => ({ label: k.id, count: filterCounts.kategorie[k.id] ?? 0 })),
  ];

  const antragstypItems: CollapsibleSegItem[] = [
    { label: 'Alle', count: filterCounts.antragstypTotal },
    ...ALL_ANTRAGSTYP_BUCKETS.map(b => ({ label: b, count: filterCounts.antragstyp[b] })),
  ];

  const statusKeys: StatusFilter[] = ['offen', 'selbst', 'zugewiesen', 'alle'];
  const statusCountByKey: Record<StatusFilter, number> = {
    offen: filterCounts.offen,
    selbst: filterCounts.selbst,
    zugewiesen: filterCounts.zugewiesen,
    alle: filterCounts.statusTotal,
  };
  // „offen" = niemandem zugewiesen; Anträge mit Übernahme-Wunsch zählen bewusst
  // mit (der Wunsch ist eine Bewerbung, keine Zuweisung) → die Counts von
  // „offen" und „Übernahme-Wunsch" überlappen.
  const statusTitleByKey: Partial<Record<StatusFilter, string>> = {
    offen: 'Noch niemandem zugewiesen — inkl. Anträge mit Übernahme-Wunsch',
    selbst: 'Anträge, die sich mindestens ein MA gewünscht hat (noch nicht zugewiesen) — inkl. noch nicht eingesammelter Vormerkungen',
  };
  const statusItems: CollapsibleSegItem[] = statusKeys.map(s => ({
    label: STATUS_FILTER_LABELS[s],
    count: statusCountByKey[s],
    title: statusTitleByKey[s],
  }));

  // Sortier-Chips — kompakt; „Antragsdatum"/„Sicherheit" je EIN Pfeil-Toggle
  // (Klick auf den aktiven Chip dreht die Richtung). Bewusst ohne Counts
  // (Sortierung partitioniert nicht). Tooltip erklärt die Richtung.
  const sortItems: CollapsibleSegItem[] = buildSortChips(sortKey).map(c => ({ label: c.label, title: c.title }));

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <CollapsibleSeg
        label="Kategorie"
        value={kategorieFilter || 'Alle'}
        items={kategorieItems}
        onChange={(label) => onKategorieChange(label === 'Alle' ? '' : label)}
      />
      <CollapsibleSeg
        label="Antragstyp"
        value={antragstypFilter || 'Alle'}
        items={antragstypItems}
        onChange={(label) => onAntragstypChange(label === 'Alle' ? '' : (label as AntragstypBucket))}
      />
      <CollapsibleSeg
        label="Status"
        value={STATUS_FILTER_LABELS[statusFilter]}
        items={statusItems}
        onChange={(label) => {
          const key = statusKeys.find(s => STATUS_FILTER_LABELS[s] === label);
          if (key) onStatusChange(key);
        }}
        defaultValue={STATUS_FILTER_LABELS.offen}
      />
      <CollapsibleSeg
        label="Sortiert nach"
        value={sortChipValue(sortKey)}
        items={sortItems}
        onChange={(label) => onSortChange(nextSortKeyForClick(label, sortKey))}
        defaultValue={SORT_CHIP_DISPLAY[DEFAULT_ZUWEISUNG_SORT]}
        startCollapsed
      />
    </div>
  );
}
