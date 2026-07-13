/**
 * Kollabierte Daten-Sektion der Verbund-Detailseite (Journey-Paket 2 Phase 7):
 * eine Zeile mit Chevron + Titel + Kontext-Vorschau (rechts), aufklappbar. Der
 * Body wird nur bei geöffneter Sektion gerendert (unmount beim Einklappen —
 * anders als die GA/NF-Werkstätten, die ihren Buffer via CSS-`hidden` halten;
 * Daten-Sektionen haben keinen Editor-Zustand).
 *
 * Default eingeklappt (`defaultCollapsed` → `useCollapsedSection` mit
 * `defaultOpen: false`); ein bereits persistierter Zustand gewinnt.
 */
import { ChevronRight } from 'lucide-react';
import { useCollapsedSection } from '@/core/hooks/useCollapsedSection';

interface Props {
  title: string;
  /** localStorage-Key für den Auf-/Zu-Zustand. */
  storageKey: string;
  /** Beim ersten Anzeigen eingeklappt (Default true). */
  defaultCollapsed?: boolean;
  /** Kontext-Vorschau rechts (z. B. „Symate GmbH · 2 weitere"). */
  preview?: React.ReactNode;
  /** Optionale Aktion ganz rechts im Sektionskopf (z. B. Kopier-Icon). Rendert
   *  als Geschwister des Toggle-Buttons (kein verschachteltes `<button>`), damit
   *  ein Klick die Aktion auslöst statt auf-/zuzuklappen. */
  headerAction?: React.ReactNode;
  /** Sprung-Anker-ID (optional). */
  id?: string;
  children: React.ReactNode;
}

export function CollapsibleDataSection({
  title, storageKey, defaultCollapsed = true, preview, headerAction, id, children,
}: Props): React.ReactElement {
  const [open, toggle] = useCollapsedSection(storageKey, { defaultOpen: !defaultCollapsed });

  return (
    <div id={id} className="scroll-mt-[80px] border-t-[0.5px] border-[var(--tf-border)]">
      <div className="flex items-center">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="flex items-center gap-2 flex-1 min-w-0 text-left py-3 cursor-pointer"
        >
          <ChevronRight
            size={15}
            className="text-[var(--tf-text-tertiary)] transition-transform duration-200 shrink-0"
            style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
          />
          <span className="text-[13.5px] font-medium text-[var(--tf-text)]">{title}</span>
          {preview != null && preview !== '' ? (
            <span className="ml-auto text-[12px] text-[var(--tf-text-tertiary)] truncate pl-3 tabular-nums">
              {preview}
            </span>
          ) : null}
        </button>
        {headerAction != null ? <div className="shrink-0 pl-2">{headerAction}</div> : null}
      </div>
      {open ? <div className="pb-4">{children}</div> : null}
    </div>
  );
}
