/**
 * Spalten-Definitionen für die Skills-Tabellen-Ansicht (Tabellen-Modus).
 * Baut auf der generischen `SortableColumn`/`SortableTable` auf — dieselbe
 * Optik wie die Förderanträge-Tabelle.
 */
import type { ReactNode } from 'react';
import { Play, Copy, Trash2 } from 'lucide-react';
import type { SortableColumn } from '@/components/data-table';
import type { SkillRecord } from '@/core/services/skills';
import { Badge } from '@/components/ui/badge';
import { formatDate } from './registryFormat';

export interface SkillColumnActions {
  canEdit: boolean;
  onTestlauf: (s: SkillRecord) => void;
  onDuplicate: (s: SkillRecord) => void;
  onDelete: (s: SkillRecord) => void;
}

/** Aktions-Icon in der Tabellen-Zeile. `stopPropagation`, damit der Zeilen-Klick
 *  (= Bearbeiten) nicht zusätzlich feuert. */
function RowActionButton({
  title, onClick, danger, children,
}: { title: string; onClick: () => void; danger?: boolean; children: ReactNode }): React.ReactElement {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={e => { e.stopPropagation(); onClick(); }}
      className={`p-1 rounded hover:bg-[var(--tf-hover)] ${
        danger
          ? 'text-[var(--tf-text-tertiary)] hover:text-[var(--tf-danger-text)]'
          : 'text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)]'
      }`}
    >
      {children}
    </button>
  );
}

export function buildSkillColumns(actions: SkillColumnActions): SortableColumn<SkillRecord>[] {
  return [
    {
      key: 'name', label: 'Name', defaultVisible: true, locked: true, sortable: true, width: 220, wrap: false,
      accessor: s => s.name.toLowerCase(),
      render: s => <span className="font-medium text-[var(--tf-text)]">{s.name}</span>,
    },
    {
      key: 'beschreibung', label: 'Beschreibung', defaultVisible: true, sortable: false, width: 360, wrap: true,
      accessor: s => s.beschreibung,
      render: s => s.beschreibung
        ? <span className="text-[var(--tf-text-secondary)]">{s.beschreibung}</span>
        : <span className="text-[var(--tf-text-tertiary)]">—</span>,
    },
    {
      key: 'version', label: 'Version', defaultVisible: true, sortable: true, width: 80, wrap: false,
      accessor: s => s.version,
      render: s => <span className="font-mono text-[var(--tf-text-secondary)]">v{s.version}</span>,
    },
    {
      key: 'geaendert', label: 'Geändert', defaultVisible: true, sortable: true, width: 110, wrap: false,
      accessor: s => s.geaendert_am,
      render: s => <span className="text-[var(--tf-text-secondary)]">{formatDate(s.geaendert_am)}</span>,
    },
    {
      key: 'regeln', label: 'Regeln', defaultVisible: true, sortable: true, width: 110, wrap: false,
      accessor: s => s.regelIds.length,
      render: s => <Badge variant="default">{s.regelIds.length} {s.regelIds.length === 1 ? 'Regel' : 'Regeln'}</Badge>,
    },
    {
      key: 'aktionen', label: '', defaultVisible: true, locked: true, sortable: false, width: 124, wrap: false,
      accessor: () => '',
      render: s => (
        <div className="flex items-center gap-0.5">
          <RowActionButton title="Testlauf" onClick={() => actions.onTestlauf(s)}><Play size={14} /></RowActionButton>
          {actions.canEdit && (
            <RowActionButton title="Duplizieren" onClick={() => actions.onDuplicate(s)}><Copy size={14} /></RowActionButton>
          )}
          {actions.canEdit && (
            <RowActionButton title="Löschen" danger onClick={() => actions.onDelete(s)}><Trash2 size={14} /></RowActionButton>
          )}
        </div>
      ),
    },
  ];
}
