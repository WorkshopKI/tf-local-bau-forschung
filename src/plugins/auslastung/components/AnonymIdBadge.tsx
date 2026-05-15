/** Anzeige fuer anonyme MA-IDs (MA01..MA30). Monospace, dezent. */
interface Props {
  anonId: string;
  size?: 'sm' | 'md' | 'lg';
}

export function AnonymIdBadge({ anonId, size = 'md' }: Props): React.ReactElement {
  const fontSize =
    size === 'lg' ? 'text-[18px]'
    : size === 'sm' ? 'text-[11px]'
    : 'text-[13px]';
  const padding =
    size === 'lg' ? 'px-3 py-1'
    : size === 'sm' ? 'px-1.5 py-0.5'
    : 'px-2 py-0.5';
  return (
    <span
      className={`inline-flex items-center font-mono font-medium tracking-wide ${fontSize} ${padding} rounded-md`}
      style={{
        background: 'var(--tf-bg-secondary)',
        color: 'var(--tf-text)',
      }}
    >
      {anonId}
    </span>
  );
}
