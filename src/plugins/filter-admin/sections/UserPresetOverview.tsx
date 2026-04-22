import type { UserPreset } from '@/core/services/csv';

interface Props {
  presets: UserPreset[];
}

export function UserPresetOverview({ presets }: Props): React.ReactElement {
  if (presets.length === 0) {
    return (
      <div className="py-8 text-center text-[13px] text-[var(--tf-text-tertiary)]">
        Noch keine User-Presets gespeichert. Jeder User kann eigene Presets in der Antragsliste anlegen.
      </div>
    );
  }

  return (
    <div>
      <p className="mb-3 text-[12px] text-[var(--tf-text-secondary)]">
        Übersicht über die auf diesem Gerät gespeicherten User-Presets. Presets sind privat —
        diese Ansicht dient nur der Information.
      </p>
      {presets.map((p, i) => (
        <div
          key={p.id}
          className="py-3"
          style={i === presets.length - 1 ? undefined : { borderBottom: '0.5px solid var(--tf-border)' }}
        >
          <div className="text-[14px] text-[var(--tf-text)]">{p.name}</div>
          <div className="text-[11.5px] text-[var(--tf-text-tertiary)]">
            {p.snapshot.length} Filter-{p.snapshot.length === 1 ? 'Eintrag' : 'Einträge'}
            {' · '}
            angelegt {new Date(p.created_at).toLocaleDateString('de-DE')}
            {p.description ? ` · ${p.description}` : ''}
          </div>
        </div>
      ))}
    </div>
  );
}
