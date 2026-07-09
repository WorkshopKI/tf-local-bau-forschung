// Kopf-Glocke (Redesign v2.208): erscheint nur bei ungelesenen Team-Antworten
// auf eigene Feedbacks; rote Zähler-Badge; Klick springt in die Sicht „Von mir".

import { Bell } from 'lucide-react';

interface Props {
  count: number;
  onClick: () => void;
}

export function NotificationBell({ count, onClick }: Props): React.ReactElement | null {
  if (count <= 0) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${count} neue ${count > 1 ? 'Antworten' : 'Antwort'} vom Team — zu „Von mir"`}
      aria-label={`${count} neue ${count > 1 ? 'Antworten' : 'Antwort'} vom Team`}
      className="relative w-[34px] h-[34px] grid place-items-center rounded-[var(--tf-radius)] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] hover:bg-[var(--tf-hover)] cursor-pointer"
      style={{ border: '0.5px solid var(--tf-border-hover)' }}
    >
      <Bell size={16} strokeWidth={1.6} />
      <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 grid place-items-center rounded-full bg-[var(--tf-fb-problem)] text-white text-[10px] font-medium tabular-nums">
        {count}
      </span>
    </button>
  );
}
