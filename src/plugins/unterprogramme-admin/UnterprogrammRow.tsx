import { useEffect, useState } from 'react';
import type { Unterprogramm } from '@/core/services/csv/types';

interface Props {
  up: Unterprogramm;
  canEdit: boolean;
  onEdit: (patch: Partial<Unterprogramm>) => void;
  onRequestToggle: (nextAktiv: boolean) => void;
}

export function UnterprogrammRow({ up, canEdit, onEdit, onRequestToggle }: Props): React.ReactElement {
  return (
    <tr style={{ borderTop: '0.5px solid var(--tf-border)' }}>
      <td className="p-3 font-mono text-[12px]">{up.code}</td>
      <td className="p-3">
        <InlineTextEdit
          value={up.name ?? ''}
          placeholder="Label hinzufügen …"
          disabled={!canEdit}
          onCommit={v => onEdit({ name: v.trim() || undefined })}
        />
      </td>
      <td className="p-3">
        <div className="flex items-center gap-1 text-[12px]">
          <InlineTextEdit
            value={up.zeitraum_von ?? ''}
            placeholder="von"
            disabled={!canEdit}
            width={60}
            onCommit={v => onEdit({ zeitraum_von: v.trim() || undefined })}
          />
          <span className="text-[var(--tf-text-tertiary)]">–</span>
          <InlineTextEdit
            value={up.zeitraum_bis ?? ''}
            placeholder="bis"
            disabled={!canEdit}
            width={60}
            onCommit={v => onEdit({ zeitraum_bis: v.trim() || undefined })}
          />
        </div>
      </td>
      <td className="p-3">
        <input
          type="checkbox"
          checked={up.aktiv}
          disabled={!canEdit}
          onChange={e => onRequestToggle(e.target.checked)}
          className="accent-[var(--tf-primary)]"
        />
      </td>
      <td className="p-3 text-right tabular-nums">
        {(up.antrag_count_cached ?? 0).toLocaleString('de-DE')}
      </td>
    </tr>
  );
}

interface InlineProps {
  value: string;
  placeholder?: string;
  disabled?: boolean;
  width?: number;
  onCommit: (v: string) => void;
}

function InlineTextEdit({ value, placeholder, disabled, width, onCommit }: InlineProps): React.ReactElement {
  const [local, setLocal] = useState(value);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setLocal(value);
  }, [value, editing]);

  const commit = (): void => {
    if (local !== value) onCommit(local);
    setEditing(false);
  };

  if (!editing) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setEditing(true)}
        className={`text-left ${disabled ? 'cursor-default' : 'cursor-text hover:bg-[var(--tf-bg-secondary)]'} rounded px-1 -mx-1 text-[12.5px]`}
        style={{ width: width ? `${width}px` : undefined }}
      >
        {value ? value : <span className="text-[var(--tf-text-tertiary)]">{placeholder ?? '—'}</span>}
      </button>
    );
  }

  return (
    <input
      autoFocus
      type="text"
      value={local}
      placeholder={placeholder}
      onChange={e => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === 'Enter') { e.currentTarget.blur(); }
        if (e.key === 'Escape') { setLocal(value); setEditing(false); }
      }}
      style={{ width: width ? `${width}px` : undefined }}
      className="px-1 py-0.5 rounded border-[0.5px] border-[var(--tf-border)] bg-transparent text-[12.5px]"
    />
  );
}
