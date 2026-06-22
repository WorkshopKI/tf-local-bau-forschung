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

/** Aggregierte Counts je Filter-Option (über ALLE freigegebenen Verbünde). */
export interface FilterCounts {
  kategorie: Record<string, number>;
  antragstyp: Record<AntragstypBucket, number>;
  offen: number;
  selbst: number;
  zugewiesen: number;
  total: number;
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
    { label: 'Alle', count: filterCounts.total },
    ...ueberKategorien.map(k => ({ label: k.id, count: filterCounts.kategorie[k.id] ?? 0 })),
  ];

  const antragstypItems: CollapsibleSegItem[] = [
    { label: 'Alle', count: filterCounts.total },
    ...ALL_ANTRAGSTYP_BUCKETS.map(b => ({ label: b, count: filterCounts.antragstyp[b] })),
  ];

  const statusKeys: StatusFilter[] = ['offen', 'selbst', 'zugewiesen', 'alle'];
  const statusCountByKey: Record<StatusFilter, number> = {
    offen: filterCounts.offen,
    selbst: filterCounts.selbst,
    zugewiesen: filterCounts.zugewiesen,
    alle: filterCounts.total,
  };
  const statusItems: CollapsibleSegItem[] = statusKeys.map(s => ({
    label: STATUS_FILTER_LABELS[s],
    count: statusCountByKey[s],
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
