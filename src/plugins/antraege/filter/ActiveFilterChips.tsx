import { X } from 'lucide-react';
import type { ActiveFilter, FilterDefinition } from '@/core/services/csv';

interface Props {
  active: ActiveFilter[];
  definitions: FilterDefinition[];
  onRemove: (filterId: string) => void;
}

export function ActiveFilterChips({ active, definitions, onRemove }: Props): React.ReactElement | null {
  if (active.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mb-3">
      {active.map(af => {
        const def = definitions.find(d => d.id === af.filterId);
        if (!def) return null;
        const summary = summarize(af, def);
        return (
          <button
            key={af.filterId}
            type="button"
            onClick={() => onRemove(af.filterId)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] bg-[var(--tf-bg-secondary)] text-[var(--tf-text)] hover:bg-[var(--tf-hover)] transition-colors"
            style={{ border: '0.5px solid var(--tf-border)' }}
          >
            <span className="text-[var(--tf-text-secondary)]">{def.name}:</span>
            <span className="truncate max-w-[180px]">{summary}</span>
            <X size={12} className="text-[var(--tf-text-tertiary)]" />
          </button>
        );
      })}
    </div>
  );
}

function summarize(af: ActiveFilter, def: FilterDefinition): string {
  switch (def.typ) {
    case 'single_select':
      return typeof af.value === 'string' ? af.value : '—';
    case 'multi_select': {
      const arr = Array.isArray(af.value) ? af.value as string[] : [];
      if (arr.length === 1) return arr[0] ?? '—';
      return `${arr.length} Werte`;
    }
    case 'boolean_ja_nein':
      return af.value === 'ja' ? 'Ja' : af.value === 'nein' ? 'Nein' : 'Beide';
    case 'date_range': {
      const r = af.value as { from?: string; to?: string };
      if (r.from && r.to) return `${r.from} – ${r.to}`;
      if (r.from) return `ab ${r.from}`;
      if (r.to) return `bis ${r.to}`;
      return '—';
    }
    case 'number_range': {
      const r = af.value as { min?: number; max?: number };
      if (r.min !== undefined && r.max !== undefined) return `${r.min} – ${r.max}`;
      if (r.min !== undefined) return `ab ${r.min}`;
      if (r.max !== undefined) return `bis ${r.max}`;
      return '—';
    }
    case 'text_contains':
      return typeof af.value === 'string' ? `"${af.value}"` : '—';
    default:
      return '—';
  }
}
