/**
 * MaListFilterBar — Filter-Leiste über der MA-Liste.
 *
 * Layout:
 *   [KATEGORIE]  [Alle 31][IT 1][DT 0][EU 0][LG 0][NM 0]   [Tabelle|Karten]  [☐ Inaktive]  [+ MA hinzufügen]
 *
 * Kategorie-Pills sitzen in einem outline-Pill-Container; aktive Pille ist
 * gefüllt (dark bg + light text), inaktive transparent mit Swatch-Punkt links.
 *
 * View-Switch + Inaktive-Checkbox + "+MA hinzufügen" am rechten Rand.
 */
import { LayoutGrid, Menu, Plus } from 'lucide-react';
import { SegmentedToggle } from '@/ui/SegmentedToggle';
import type { UeberKategorie } from '../../types';
import { dotColor } from './kategorie-colors';

export type ViewMode = 'table' | 'cards';

interface Props {
  kategorien: UeberKategorie[];
  kategorieFilter: string;
  onKategorieFilter: (id: string) => void;
  counts: { all: number; perKategorie: Record<string, number> };
  view: ViewMode;
  onView: (v: ViewMode) => void;
  showInactive: boolean;
  onShowInactive: (v: boolean) => void;
  onAddMa: () => void;
  addBusy?: boolean;
}

export function MaListFilterBar({
  kategorien, kategorieFilter, onKategorieFilter,
  counts, view, onView, showInactive, onShowInactive,
  onAddMa, addBusy,
}: Props): React.ReactElement {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Kategorie-Caps-Label */}
      <span
        className="uppercase text-[var(--tf-text-tertiary)]"
        style={{
          fontSize: 10.5,
          fontWeight: 500,
          letterSpacing: 'var(--tf-tracking-caps)',
        }}
      >
        Kategorie
      </span>

      {/* Pill-Container */}
      <div
        className="inline-flex items-center"
        style={{
          border: '0.5px solid var(--tf-border)',
          borderRadius: 'var(--tf-radius-pill)',
          padding: 3,
          gap: 0,
        }}
      >
        <KategoriePill
          label="Alle"
          count={counts.all}
          active={kategorieFilter === ''}
          onClick={() => onKategorieFilter('')}
        />
        {kategorien.map(k => (
          <KategoriePill
            key={k.id}
            label={k.id}
            count={counts.perKategorie[k.id] ?? 0}
            swatch={dotColor(k.farbe)}
            active={kategorieFilter === k.id}
            onClick={() => onKategorieFilter(k.id === kategorieFilter ? '' : k.id)}
          />
        ))}
      </div>

      {/* Right side */}
      <div className="ml-auto flex items-center gap-3 flex-wrap">
        <SegmentedToggle<ViewMode>
          value={view}
          onChange={onView}
          ariaLabel="MA-Liste Ansicht"
          options={[
            { id: 'table', label: 'Tabelle', icon: <Menu size={13} /> },
            { id: 'cards', label: 'Karten', icon: <LayoutGrid size={13} /> },
          ]}
        />
        <label className="inline-flex items-center gap-1.5 cursor-pointer text-[12px] text-[var(--tf-text-secondary)]">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={e => onShowInactive(e.target.checked)}
          />
          <span>Inaktive anzeigen</span>
        </label>
        <button
          type="button"
          onClick={onAddMa}
          disabled={addBusy}
          className="inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
          style={{
            height: 30,
            padding: '0 12px',
            background: 'var(--tf-text)',
            color: 'var(--tf-bg)',
            borderRadius: 8,
            fontSize: 12.5,
            fontWeight: 500,
          }}
        >
          <Plus size={13} />
          MA hinzufügen
        </button>
      </div>
    </div>
  );
}

function KategoriePill({
  label, count, swatch, active, onClick,
}: {
  label: string;
  count: number;
  swatch?: string;
  active: boolean;
  onClick: () => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 cursor-pointer transition-colors"
      style={{
        padding: '6px 11px',
        fontSize: 12,
        borderRadius: 'var(--tf-radius-pill)',
        background: active ? 'var(--tf-text)' : 'transparent',
        color: active ? 'var(--tf-bg)' : 'var(--tf-text-secondary)',
        whiteSpace: 'nowrap',
      }}
    >
      {swatch && (
        <span
          aria-hidden
          style={{ width: 7, height: 7, borderRadius: '50%', background: swatch, display: 'inline-block' }}
        />
      )}
      <span>{label}</span>
      <span
        className="font-mono"
        style={{ fontSize: 11.5, opacity: 0.7 }}
      >
        {count}
      </span>
    </button>
  );
}
