import type { Antrag } from '@/core/services/csv/types';

interface Props {
  antrag: Antrag;
}

function strField(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

export function AntragstellerCard({ antrag }: Props): React.ReactElement | null {
  const name = strField(antrag.antragsteller);
  const branche = strField(antrag.branche);
  const foerdergeber = strField(antrag.foerdergeber);

  if (!name && !branche && !foerdergeber) return null;

  return (
    <div
      className="rounded-[var(--tf-radius)] p-4"
      style={{ background: 'var(--tf-bg-secondary)' }}
    >
      {name ? (
        <div className="text-[14px] font-medium text-[var(--tf-text)]">{name}</div>
      ) : null}
      {(branche || foerdergeber) ? (
        <div className="mt-1 text-[12px] text-[var(--tf-text-secondary)] flex flex-wrap gap-x-3 gap-y-0.5">
          {branche ? <span>{branche}</span> : null}
          {foerdergeber ? <span>· {foerdergeber}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
