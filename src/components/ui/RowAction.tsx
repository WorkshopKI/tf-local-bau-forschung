import type { ReactNode } from 'react';

interface RowActionProps {
  title: string;
  onClick: () => void;
  /** Rot-Hover für destruktive Aktionen (Löschen). */
  danger?: boolean;
  children: ReactNode;
}

/**
 * Kleiner Icon-Button für die rechtsbündige Aktions-Gruppe einer Listenzeile
 * (Testlauf, Duplizieren, Löschen …). `stopPropagation` ist eingebaut, damit
 * der Aktions-Klick nicht zusätzlich die Zeilen-`onClick` (= Öffnen/Bearbeiten)
 * auslöst — selbst-enthalten, kein Wrapper am Aufrufer nötig. Kanonische
 * Heimat für die zuvor in SkillsTab/skillTableColumns duplizierte Variante.
 */
export function RowAction({
  title, onClick, danger, children,
}: RowActionProps): React.ReactElement {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={e => { e.stopPropagation(); onClick(); }}
      className={`p-1 rounded hover:bg-[var(--tf-hover)] ${
        danger
          ? 'text-[var(--tf-text-tertiary)] hover:text-[var(--tf-danger-text)]'
          : 'text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)]'
      }`}
    >
      {children}
    </button>
  );
}
