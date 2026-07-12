/**
 * Präsentations-Rahmen eines Home-Widgets (Phase 1).
 *
 * Kopfzeile: Chevron (Collapse-Toggle) + Titel + optionaler Meta-Text +
 * Aktions-Slot + Zähler-Slot + Stift-Button (Popover folgt in Phase 3).
 *
 * LAZY-ZUSAGE (hart): Eingeklappt wird NUR die Kopfzeile inkl. Zähler-Slot
 * gerendert — der Body wird nicht gemountet (kein verstecktes Grid-Rows-
 * Animations-DOM; file://+IDB-Performance). Der Collapse-Zustand kommt aus
 * der Widget-Config (einzige Quelle), nicht aus useCollapsedSection.
 */
import { ChevronRight, Pencil } from 'lucide-react';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';

export interface WidgetShellProps {
  titel: string;
  /** Grauer Meta-Text neben dem Titel (nur ausgeklappt sichtbar). */
  meta?: string;
  /** Aktions-Slot (z.B. „Alle →") — nur ausgeklappt sichtbar. */
  aktion?: React.ReactNode;
  /** Zähler-Slot rechts — wird IMMER gerendert (gerade eingeklappt wichtig). */
  zaehler?: React.ReactNode;
  /** haupt = großer Karten-Kopf (Hauptspalte), seite = kompakte Caption-Karte. */
  variante: 'haupt' | 'seite';
  eingeklappt: boolean;
  onToggleEingeklappt: () => Promise<void>;
  /** Stift-Klick (Phase 3: Quick-Edit-Popover). Ohne Handler ist der Button
   *  inaktiv sichtbar — der Platz im Kopf ist Teil des Widget-Vertrags. */
  onStift?: () => void;
  children: React.ReactNode;
}

export function WidgetShell({
  titel,
  meta,
  aktion,
  zaehler,
  variante,
  eingeklappt,
  onToggleEingeklappt,
  onStift,
  children,
}: WidgetShellProps): React.ReactElement {
  const toggle = useAsyncAction(onToggleEingeklappt);
  const haupt = variante === 'haupt';

  const titelKlasse = haupt
    ? 'text-[15px] font-semibold text-[var(--tf-text)]'
    : 'text-[12px] uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)]';

  return (
    <section
      className={`rounded-[var(--tf-radius-lg)] ${haupt ? 'bg-[var(--tf-bg)]' : 'bg-[var(--tf-card-surface)]'}`}
      style={{ border: '0.5px solid var(--tf-border)' }}
    >
      <div className={`flex items-center gap-2 min-w-0 ${haupt ? 'px-4 py-3' : 'p-4 pb-0'}`}>
        <button
          type="button"
          onClick={() => toggle.run()}
          aria-expanded={!eingeklappt}
          aria-label={eingeklappt ? `${titel} ausklappen` : `${titel} einklappen`}
          className="flex items-center gap-1.5 cursor-pointer select-none text-left min-w-0 shrink-0"
        >
          <ChevronRight
            size={haupt ? 14 : 12}
            className="text-[var(--tf-text-tertiary)] shrink-0"
            style={{
              transform: eingeklappt ? 'rotate(0deg)' : 'rotate(90deg)',
              transition: 'transform var(--tf-duration-med) var(--tf-ease)',
            }}
          />
          <span className={titelKlasse}>{titel}</span>
        </button>
        {eingeklappt ? (
          haupt ? (
            <span className="text-[12.5px] text-[var(--tf-text-tertiary)] truncate">
              eingeklappt · nur Zähler
            </span>
          ) : null
        ) : (
          <>
            {meta ? (
              <span className="text-[12.5px] text-[var(--tf-text-tertiary)] truncate min-w-0">
                {meta}
              </span>
            ) : null}
          </>
        )}
        <div className="flex-1 min-w-0" />
        {!eingeklappt && aktion ? <div className="shrink-0">{aktion}</div> : null}
        {zaehler ? <div className="shrink-0 flex items-center gap-1.5">{zaehler}</div> : null}
        <button
          type="button"
          onClick={onStift}
          disabled={!onStift}
          aria-label="Widget anpassen"
          title={onStift ? 'Widget anpassen' : 'Anpassen — folgt in einer späteren Version'}
          className={`shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-[var(--tf-radius-sm)] text-[var(--tf-text-tertiary)] ${
            onStift
              ? 'cursor-pointer hover:text-[var(--tf-text)] hover:bg-[var(--tf-bg-secondary)]'
              : 'opacity-40 cursor-default'
          }`}
        >
          <Pencil size={13} />
        </button>
      </div>
      {/* Lazy: Body existiert im DOM NUR ausgeklappt. */}
      {!eingeklappt ? (
        <div className={haupt ? 'px-4 pb-4' : 'p-4 pt-3'}>{children}</div>
      ) : (
        <div className={haupt ? 'pb-1' : 'pb-3'} />
      )}
    </section>
  );
}
