import { useMemo, useState } from 'react';
import { Check, Zap, X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CANONICAL_FIELDS, getCanonicalLabel } from '@/core/services/csv/constants';
import type { LabelSuggestion } from '@/core/services/csv';
import type { PerColumnDecision } from './useCsvWizardState';
import { StandardFieldPicker } from './StandardFieldPicker';

interface Props {
  /** Alle CSV-Spalten (Preview). */
  allColumns: string[];
  /** Aktuelle Mapping-Entscheidungen. */
  decisions: Record<string, PerColumnDecision>;
  /** Suggestions aus XLS (kann leer sein, wenn kein XLS geladen wurde). */
  suggestions: LabelSuggestion[];
  /** Optionale Labels pro CSV-Spalte (aus XLS). */
  labelByColumn: Map<string, string>;
  /** Setzt eine Spalte auf canonical=<key>. */
  onAssign: (csvColumn: string, canonical: string, type: 'string' | 'date' | 'number' | 'boolean') => void;
  /** Setzt eine Spalte zurück auf custom (entfernt Canonical-Mapping). */
  onUnassign: (csvColumn: string) => void;
  /** Bulk: alle hochkonfidenten Vorschläge anwenden. */
  onApplyAllConfident: () => void;
  /** Anzahl noch nicht übernommener hochkonfidenten Vorschläge (für Button-Label). */
  pendingConfidentCount: number;
  /** Springt zur Tabellenzeile und triggert Pulse-Highlight. */
  onJumpToColumn: (csvColumn: string) => void;
}

/** Reihenfolge der Standardfeld-Pills (nach Domänen-Wichtigkeit). */
const SLOT_ORDER: string[] = [
  'aktenzeichen',
  'akronym',
  'verbund_id',
  'titel',
  'verbund_titel',
  'status',
  'verbund_status',
  'antragsdatum',
  'bewilligung_datum',
  'frist_datum',
  'foerdersumme',
  'antragsteller',
  'unterprogramm_id',
];

interface SlotInfo {
  canonical: string;
  label: string;
  /** CSV-Spalten, die aktuell auf dieses Standardfeld mappen. */
  assignedColumns: string[];
  /** Beste Vorschlags-Konfidenz (≥0.6) für unbelegte Slots, sonst undefined. */
  bestSuggestionConfidence?: number;
}

export function StandardFieldSlots({
  allColumns,
  decisions,
  suggestions,
  labelByColumn,
  onAssign,
  onUnassign,
  onApplyAllConfident,
  pendingConfidentCount,
  onJumpToColumn,
}: Props): React.ReactElement {
  const [openPicker, setOpenPicker] = useState<string | null>(null);

  const slots: SlotInfo[] = useMemo(() => {
    const assignedByCanonical = new Map<string, string[]>();
    for (const [col, d] of Object.entries(decisions)) {
      if (d.mode !== 'canonical' || !d.canonical) continue;
      const arr = assignedByCanonical.get(d.canonical) ?? [];
      arr.push(col);
      assignedByCanonical.set(d.canonical, arr);
    }

    const bestSuggByCanonical = new Map<string, number>();
    for (const s of suggestions) {
      if (!s.canonical || s.confidence < 0.6) continue;
      const prev = bestSuggByCanonical.get(s.canonical) ?? 0;
      if (s.confidence > prev) bestSuggByCanonical.set(s.canonical, s.confidence);
    }

    return SLOT_ORDER.map(key => {
      const assignedColumns = assignedByCanonical.get(key) ?? [];
      const info: SlotInfo = {
        canonical: key,
        label: getCanonicalLabel(key),
        assignedColumns,
      };
      if (assignedColumns.length === 0) {
        const conf = bestSuggByCanonical.get(key);
        if (conf !== undefined) info.bestSuggestionConfidence = conf;
      }
      return info;
    });
  }, [decisions, suggestions]);

  const stats = useMemo(() => {
    const assigned = slots.filter(s => s.assignedColumns.length > 0).length;
    const conflicts = slots.filter(s => s.assignedColumns.length > 1).length;
    const pendingSugg = slots.filter(s => s.bestSuggestionConfidence !== undefined).length;
    return { assigned, conflicts, pendingSugg };
  }, [slots]);

  const handlePillClick = (slot: SlotInfo): void => {
    const first = slot.assignedColumns[0];
    if (first !== undefined) {
      // Belegt → zur Zeile springen (erste Spalte bei Konflikten)
      onJumpToColumn(first);
    } else {
      setOpenPicker(slot.canonical);
    }
  };

  const handleSelect = (canonical: string, csvColumn: string): void => {
    const field = CANONICAL_FIELDS.find(f => f.key === canonical);
    onAssign(csvColumn, canonical, field?.type ?? 'string');
    setOpenPicker(null);
    onJumpToColumn(csvColumn);
  };

  return (
    <div
      className="sticky top-0 z-10 mb-3 px-3 py-2.5 rounded-md"
      style={{
        background: 'var(--tf-bg)',
        border: '0.5px solid var(--tf-border)',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      }}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="text-[11.5px] text-[var(--tf-text-secondary)]">
          <span className="font-medium text-[var(--tf-text)]">
            {stats.assigned} von {SLOT_ORDER.length}
          </span>{' '}
          Standardfeldern belegt
          {stats.pendingSugg > 0 ? (
            <span className="ml-1 text-blue-700">· {stats.pendingSugg} Vorschläge offen</span>
          ) : null}
          {stats.conflicts > 0 ? (
            <span className="ml-1 text-amber-700">· {stats.conflicts} Konflikt{stats.conflicts === 1 ? '' : 'e'}</span>
          ) : null}
        </div>
        {pendingConfidentCount > 0 ? (
          <Button size="xs" variant="outline" onClick={onApplyAllConfident}>
            Alle hochkonfidenten übernehmen ({pendingConfidentCount})
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {slots.map(slot => (
          <SlotPill
            key={slot.canonical}
            slot={slot}
            isPickerOpen={openPicker === slot.canonical}
            onClick={() => handlePillClick(slot)}
            onUnassign={col => onUnassign(col)}
            renderPicker={() =>
              openPicker === slot.canonical ? (
                <StandardFieldPicker
                  canonical={slot.canonical}
                  canonicalLabel={slot.label}
                  allColumns={allColumns}
                  decisions={decisions}
                  labelByColumn={labelByColumn}
                  suggestions={suggestions}
                  onSelect={col => handleSelect(slot.canonical, col)}
                  onClose={() => setOpenPicker(null)}
                />
              ) : null
            }
          />
        ))}
      </div>
    </div>
  );
}

interface SlotPillProps {
  slot: SlotInfo;
  isPickerOpen: boolean;
  onClick: () => void;
  onUnassign: (csvColumn: string) => void;
  renderPicker: () => React.ReactNode;
}

function SlotPill({ slot, isPickerOpen, onClick, onUnassign, renderPicker }: SlotPillProps): React.ReactElement {
  const [hover, setHover] = useState(false);
  const assigned = slot.assignedColumns.length > 0;
  const conflict = slot.assignedColumns.length > 1;
  const hasSugg = !assigned && slot.bestSuggestionConfidence !== undefined;

  // Farbpalette (alle aus var(--...) wenn möglich; sonst tailwind classes mit gedämpften Tönen)
  let pillStyle: React.CSSProperties;
  let icon: React.ReactNode;
  let title: string;

  if (conflict) {
    pillStyle = {
      background: 'rgb(254 243 199)', // amber-100
      border: '0.5px solid rgb(217 119 6)', // amber-600
      color: 'rgb(120 53 15)', // amber-900
    };
    icon = <AlertTriangle size={11} className="shrink-0" />;
    title = `Konflikt — ${slot.assignedColumns.length} Spalten mappen auf ${slot.label}: ${slot.assignedColumns.join(', ')}`;
  } else if (assigned) {
    pillStyle = {
      background: 'rgb(220 252 231)', // emerald-100
      border: '0.5px solid rgb(5 150 105)', // emerald-600
      color: 'rgb(6 78 59)', // emerald-900
    };
    icon = <Check size={11} className="shrink-0" />;
    title = `${slot.label} → ${slot.assignedColumns[0]}. Klick: zur Zeile springen.`;
  } else if (hasSugg) {
    pillStyle = {
      background: 'rgb(219 234 254)', // blue-100
      border: '0.5px solid rgb(37 99 235)', // blue-600
      color: 'rgb(30 58 138)', // blue-900
    };
    icon = <Zap size={11} className="shrink-0" />;
    title = `Vorschlag verfügbar (${Math.round((slot.bestSuggestionConfidence ?? 0) * 100)}%). Klick: Picker öffnen.`;
  } else {
    pillStyle = {
      background: 'var(--tf-bg-secondary)',
      border: '0.5px dashed var(--tf-border-hover)',
      color: 'var(--tf-text-tertiary)',
    };
    icon = <span className="w-[11px] h-[11px] inline-block rounded-full border-[0.5px] border-current shrink-0" />;
    title = `${slot.label} — nicht zugewiesen. Klick: Picker öffnen.`;
  }

  const showRemove = assigned && !conflict && hover;
  const targetCol = assigned ? slot.assignedColumns[0] : null;

  return (
    <div className="relative" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <button
        type="button"
        onClick={onClick}
        title={title}
        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11.5px] transition ${
          isPickerOpen ? 'ring-2 ring-offset-1 ring-blue-400' : ''
        }`}
        style={pillStyle}
      >
        {icon}
        <span className="font-medium">{slot.label}</span>
        {conflict ? (
          <span className="text-[10.5px] opacity-80">{slot.assignedColumns.length}× </span>
        ) : assigned && targetCol ? (
          <span className="font-mono text-[10.5px] opacity-80">→ {truncate(targetCol, 14)}</span>
        ) : hasSugg && slot.bestSuggestionConfidence !== undefined ? (
          <span className="text-[10.5px] opacity-80 tabular-nums">
            {Math.round(slot.bestSuggestionConfidence * 100)}%
          </span>
        ) : null}
        {showRemove && targetCol ? (
          <span
            role="button"
            tabIndex={0}
            aria-label={`${slot.label} entfernen`}
            title={`${slot.label} entfernen`}
            onClick={e => {
              e.stopPropagation();
              onUnassign(targetCol);
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation();
                e.preventDefault();
                onUnassign(targetCol);
              }
            }}
            className="ml-0.5 inline-flex items-center justify-center w-3.5 h-3.5 rounded-full hover:bg-black/10 cursor-pointer"
          >
            <X size={9} />
          </span>
        ) : null}
      </button>
      {renderPicker()}
    </div>
  );
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + '…';
}
