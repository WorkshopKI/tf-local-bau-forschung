/**
 * Spalten-Definitionen für die Skills-Tabellen-Ansicht (Tabellen-Modus).
 * Baut auf der generischen `SortableColumn`/`SortableTable` auf — dieselbe
 * Optik wie die Förderanträge-Tabelle.
 *
 * Die Tabelle ist die Standard-Ansicht der Skill-Liste und muss daher dieselben
 * Marker tragen wie Listen-/Karten-Ansicht: Kategorie + Reifegrad/„inaktiv"
 * standardmäßig sichtbar, die DSGVO-Transport-Klasse zuschaltbar.
 */
import { Play, Copy, Trash2 } from 'lucide-react';
import type { SortableColumn } from '@/components/data-table';
import { skillKategorieLabel, skillKategorieRang, type SkillRecord } from '@/core/services/skills';
import { skillEnthaeltDokumentInhalte } from '@/core/services/ai/transport-policy';
import { Badge } from '@/components/ui/badge';
import { RowAction } from '@/components/ui/RowAction';
import { formatDate } from './registryFormat';
import { KategoriePill, SkillStatusBadges, skillStatusRang } from './skillBadges';

export interface SkillColumnActions {
  canEdit: boolean;
  onTestlauf: (s: SkillRecord) => void;
  onDuplicate: (s: SkillRecord) => void;
  onDelete: (s: SkillRecord) => void;
}

export function buildSkillColumns(actions: SkillColumnActions): SortableColumn<SkillRecord>[] {
  return [
    {
      key: 'name', label: 'Name', defaultVisible: true, locked: true, sortable: true, width: 220, wrap: false,
      accessor: s => s.name.toLowerCase(),
      render: s => <span className="font-medium text-[var(--tf-text)]">{s.name}</span>,
    },
    {
      // Sortiert nach der fachlichen SKILL_KATEGORIE_ORDER (Zahl), nicht
      // alphabetisch nach Label — der Export-Wert liefert trotzdem den Klartext.
      key: 'kategorie', label: 'Kategorie', defaultVisible: true, sortable: true, width: 150, wrap: false,
      // Gemessen wird über `exportValue` (der `accessor` ist ein Rang); die Pille
      // bringt ihr eigenes Polster mit.
      messSchrift: 'badge', messZuschlag: 20,
      accessor: s => skillKategorieRang(s),
      exportValue: s => skillKategorieLabel(s),
      filterAccessor: s => skillKategorieLabel(s),
      render: s => <KategoriePill skill={s} />,
    },
    {
      key: 'status', label: 'Status', defaultVisible: true, sortable: true, width: 130, wrap: false,
      // Der `accessor` ist ein Sortier-Rang, die Zelle zeigt mehrere Badges —
      // messbar ist daran nichts. Die gepflegte Breite gilt.
      autoWidth: false,
      accessor: s => skillStatusRang(s),
      render: s => <SkillStatusBadges skill={s} />,
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
      // Der `accessor` ist die blanke Anzahl, die Zelle schreibt „3 Regeln".
      messSchrift: 'badge', messZuschlag: 20,
      messText: s => `${s.regelIds.length} ${s.regelIds.length === 1 ? 'Regel' : 'Regeln'}`,
      accessor: s => s.regelIds.length,
      render: s => <Badge variant="default">{s.regelIds.length} {s.regelIds.length === 1 ? 'Regel' : 'Regeln'}</Badge>,
    },
    {
      // DSGVO-Transport-Klasse (abgeleitet, siehe transport-policy.ts). Default
      // aus: die meisten Skills sind inhalts-tragend, die Spalte ist ein gezielter
      // Prüfblick des Kurators.
      key: 'transport', label: 'Transport', defaultVisible: false, sortable: true, width: 150, wrap: false,
      accessor: s => (skillEnthaeltDokumentInhalte(s) ? 0 : 1),
      exportValue: s => (skillEnthaeltDokumentInhalte(s) ? 'nur intern' : 'extern möglich'),
      render: s => skillEnthaeltDokumentInhalte(s)
        ? <span className="text-[var(--tf-primary)]">nur intern</span>
        : <span className="text-[var(--tf-text-tertiary)]">extern möglich</span>,
    },
    {
      key: 'aktionen', label: '', defaultVisible: true, locked: true, sortable: false, width: 124, wrap: false,
      // Knopfleiste ohne Text und ohne Überschrift: gemessen käme die globale
      // Untergrenze heraus, und die Knöpfe fielen aus der Spalte.
      autoWidth: false,
      accessor: () => '',
      render: s => (
        <div className="flex items-center gap-0.5">
          <RowAction title="Testlauf" onClick={() => actions.onTestlauf(s)}><Play size={14} /></RowAction>
          {actions.canEdit && (
            <RowAction title="Duplizieren" onClick={() => actions.onDuplicate(s)}><Copy size={14} /></RowAction>
          )}
          {actions.canEdit && (
            <RowAction title="Löschen" danger onClick={() => actions.onDelete(s)}><Trash2 size={14} /></RowAction>
          )}
        </div>
      ),
    },
  ];
}
