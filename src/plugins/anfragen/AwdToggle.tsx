/** Pairhead-Schalter-Pille (Hervorheben / Synchron scrollen / Untereinander). */
import type { LucideIcon } from 'lucide-react';

interface Props {
  on: boolean;
  onClick: () => void;
  Icon: LucideIcon;
  label: string;
}

export function AwdToggle({ on, onClick, Icon, label }: Props): React.ReactElement {
  return (
    <button
      type="button"
      className={`awd-toggle${on ? ' on' : ''}`}
      aria-pressed={on}
      title={label}
      onClick={onClick}
    >
      <Icon size={12} />
      {label}
    </button>
  );
}
