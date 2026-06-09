/**
 * AntragstypOverrideCell (v2.2, extrahiert in v2.6):
 *
 * Zeigt den effektiven Antragstyp-Filter eines MAs (Override > Bevorzugt >
 * 'Alle') und erlaubt PL inline ein Override zu setzen oder zurueckzusetzen.
 *
 * War vorher lokal in `admin/MitarbeiterSection.tsx`. Bei der Konsolidierung
 * (v2.6) zur eigenen Datei extrahiert, weil sowohl `MaRow` als auch
 * potentielle Folge-Views sie nutzen.
 */
import { useState } from 'react';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { ALL_ANTRAGSTYP_BUCKETS, type AnonymerMitarbeiter, type AntragstypBucket } from '../types';
import { getAntragstypHerkunft, getEffectiveAntragstypen, hasPlOverride } from '../services/antragstyp-praeferenz';

interface Props {
  ma: AnonymerMitarbeiter;
  onSave: (next: AntragstypBucket[] | undefined) => Promise<void>;
}

export function AntragstypOverrideCell({ ma, onSave }: Props): React.ReactElement {
  const [open, setOpen] = useState(false);
  const effective = getEffectiveAntragstypen(ma);
  const overrideAktiv = hasPlOverride(ma);
  const bevorzugt = ma.antragstypBevorzugt ?? [];

  const label = effective === null
    ? 'Alle'
    : effective.join(', ') + (getAntragstypHerkunft(ma) === 'abgeleitet' ? ' (aus Kontingent)' : '');
  const [draft, setDraft] = useState<AntragstypBucket[]>(() => ma.antragstypUeberschreibung ?? []);

  const saveAction = useAsyncAction(async () => {
    await onSave(draft.length > 0 ? draft : undefined);
    setOpen(false);
  });

  const removeAction = useAsyncAction(async () => {
    await onSave(undefined);
    setOpen(false);
  });

  if (!open) {
    return (
      <div className="flex items-center gap-1.5">
        <span className={`text-[11.5px] ${effective === null ? 'text-[var(--tf-text-tertiary)]' : 'text-[var(--tf-text-secondary)]'}`}>
          {label}
        </span>
        {overrideAktiv && (
          <span
            className="text-[9.5px] font-medium px-1 py-0.5 rounded"
            style={{ background: 'var(--tf-warning-soft, #fef3c7)', color: 'var(--tf-text)' }}
            title={`PL-Override aktiv. MA-Präferenz: ${bevorzugt.length > 0 ? bevorzugt.join(', ') : 'keine'}`}
          >
            PL
          </span>
        )}
        <button
          type="button"
          onClick={() => {
            setDraft(ma.antragstypUeberschreibung ?? []);
            setOpen(true);
          }}
          className="text-[10.5px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer ml-1"
        >
          ändern
        </button>
      </div>
    );
  }

  const toggle = (bucket: AntragstypBucket): void => {
    setDraft(prev => prev.includes(bucket) ? prev.filter(b => b !== bucket) : [...prev, bucket]);
  };

  const busy = saveAction.busy || removeAction.busy;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-1">
        {ALL_ANTRAGSTYP_BUCKETS.map(bucket => {
          const isActive = draft.includes(bucket);
          return (
            <button
              key={bucket}
              type="button"
              onClick={() => toggle(bucket)}
              className="text-[10.5px] px-1.5 py-0.5 rounded cursor-pointer"
              style={
                isActive
                  ? { background: 'var(--tf-primary-light)', color: 'var(--tf-primary)', border: '0.5px solid var(--tf-primary)' }
                  : { background: 'transparent', color: 'var(--tf-text-tertiary)', border: '0.5px solid var(--tf-border)' }
              }
            >
              {isActive ? '✓ ' : ''}{bucket}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => saveAction.run()}
          className="text-[10.5px] px-2 py-0.5 rounded cursor-pointer disabled:opacity-50"
          style={{ background: 'var(--tf-text)', color: 'var(--tf-bg)' }}
        >
          {busy ? '…' : 'Speichern'}
        </button>
        {(ma.antragstypUeberschreibung?.length ?? 0) > 0 && (
          <button
            type="button"
            disabled={busy}
            onClick={() => removeAction.run()}
            className="text-[10.5px] px-2 py-0.5 rounded cursor-pointer disabled:opacity-50 text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)]"
            style={{ border: '0.5px solid var(--tf-border)' }}
            title="Override entfernen → MA-Präferenz greift wieder"
          >
            Override entfernen
          </button>
        )}
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[10.5px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer"
        >
          Abbrechen
        </button>
      </div>
      {bevorzugt.length > 0 && (
        <p className="text-[10px] text-[var(--tf-text-tertiary)]">
          MA-Präferenz: {bevorzugt.join(', ')}
        </p>
      )}
    </div>
  );
}
