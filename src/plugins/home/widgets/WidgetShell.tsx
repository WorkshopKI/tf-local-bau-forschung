/**
 * Präsentations-Rahmen eines Home-Widgets (Phase 1).
 *
 * Kopfzeile: Chevron (Collapse-Toggle) + Titel + optionaler Meta-Text +
 * Aktions-Slot + Zähler-Slot + `⋯`-Menüknopf.
 *
 * LAZY-ZUSAGE (hart): Eingeklappt wird NUR die Kopfzeile inkl. Zähler-Slot
 * gerendert — der Body wird nicht gemountet (kein verstecktes Grid-Rows-
 * Animations-DOM; file://+IDB-Performance). Der Collapse-Zustand kommt aus
 * der Widget-Config (einzige Quelle), nicht aus useCollapsedSection.
 */
import { ChevronRight } from 'lucide-react';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { KartenMenueKnopf } from '../anpassen/KartenMenueKnopf';
import type { WidgetInstanz } from './types';

export interface WidgetShellProps {
  titel: string;
  /** Grauer Meta-Text neben dem Titel (nur ausgeklappt sichtbar). */
  meta?: string;
  /** Aktions-Slot (z.B. „Alle →") — nur ausgeklappt sichtbar. */
  aktion?: React.ReactNode;
  /**
   * Aktions-Slot GANZ rechts, nach dem Stift — und wie der Stift auch
   * EINGEKLAPPT sichtbar. Der Unterschied zu `aktion` ist kein Versehen: was
   * links steht, führt in den Body (der eingeklappt gar nicht da ist), was hier
   * steht, öffnet etwas außerhalb (Kanban-Vollbild) und gilt darum immer.
   */
  aktionRechts?: React.ReactNode;
  /** Zähler-Slot rechts — wird IMMER gerendert (gerade eingeklappt wichtig). */
  zaehler?: React.ReactNode;
  /** haupt = großer Karten-Kopf (Hauptspalte), seite = kompakte Caption-Karte. */
  variante: 'haupt' | 'seite';
  eingeklappt: boolean;
  onToggleEingeklappt: () => Promise<void>;
  /** Widget-Instanz für das `⋯`-Menü und die Abgrenzung gegen den Rechtsklick der
   *  Seite (`data-widget-id`). Ohne Instanz bleibt der Kopf knopflos — die Karte
   *  ist dann kein konfigurierbares Widget. */
  instanz?: WidgetInstanz;
  children: React.ReactNode;
}

export function WidgetShell({
  titel,
  meta,
  aktion,
  aktionRechts,
  zaehler,
  variante,
  eingeklappt,
  onToggleEingeklappt,
  instanz,
  children,
}: WidgetShellProps): React.ReactElement {
  const toggle = useAsyncAction(onToggleEingeklappt);
  const haupt = variante === 'haupt';

  // Handoff „Home optimiert": Karten-Titel 14px/500 (kein 600 — DESIGN_GUIDE),
  // rechte Leiste als kompakte 10.5px-Uppercase-Caption (`.rc-title`).
  const titelKlasse = haupt
    ? 'text-[14px] font-medium text-[var(--tf-text)]'
    : 'text-[10.5px] uppercase tracking-[0.08em] text-[var(--tf-text-secondary)]';

  return (
    <section
      // `data-widget-id`: daran erkennt der Rechtsklick der Startseite, dass er
      // NICHT auf freier Fläche gelandet ist (`darfMenueOeffnen`) — auf einer
      // Karte zeigt er seit v4.41 gar nichts mehr, die Aktionen des Widgets
      // führt das `⋯` im Kopf.
      data-widget-id={instanz?.id}
      className="group/widget rounded-[var(--tf-radius-lg)] bg-[var(--tf-card-surface)]"
      style={{ border: '0.5px solid var(--tf-border)' }}
    >
      {/* `py-1.5` statt `py-2.5` (v6.5.0): 48px → 40px Kopfhoehe. Bewusst HIER
          und damit fuer ALLE Haupt-Karten — eine einzelne flachere Karte neben
          dreizehn hoeheren liest sich als Fehler, nicht als Absicht. Unter
          ~32px kaeme ohnehin nichts mehr an: der `⋯`-Knopf misst 28px. */}
      <div className={`flex items-center gap-2 min-w-0 ${haupt ? 'px-4 py-1.5' : 'px-4 pt-3 pb-0'}`}>
        <button
          type="button"
          onClick={() => toggle.run()}
          aria-expanded={!eingeklappt}
          aria-label={eingeklappt ? `${titel} ausklappen` : `${titel} einklappen`}
          className="flex items-center gap-1.5 cursor-pointer select-none text-left min-w-0"
        >
          <ChevronRight
            size={haupt ? 14 : 12}
            className="text-[var(--tf-text-tertiary)] shrink-0"
            style={{
              transform: eingeklappt ? 'rotate(0deg)' : 'rotate(90deg)',
              transition: 'transform var(--tf-duration-med) var(--tf-ease)',
            }}
          />
          {/* truncate + min-w-0: bei schmalen Karten (260px Seitenspalte) darf
              der Titel kürzen, statt Zähler/Stift über den Kartenrand zu
              drücken (Flex-Overflow). */}
          <span className={`${titelKlasse} truncate min-w-0`}>{titel}</span>
        </button>
        {/* Eingeklappt: nur Titel + Zähler (Handoff `.w-sum`) — kein
            Platzhaltertext. Ausgeklappt: grauer Meta-Text neben dem Titel. */}
        {!eingeklappt && meta ? (
          <span className="text-[12.5px] text-[var(--tf-text-tertiary)] truncate min-w-0">
            {meta}
          </span>
        ) : null}
        <div className="flex-1 min-w-0" />
        {!eingeklappt && aktion ? <div className="shrink-0">{aktion}</div> : null}
        {zaehler ? <div className="shrink-0 flex items-center gap-1.5">{zaehler}</div> : null}
        {/* `⋯` an jedem Widget (v4.6, löst den Stift ab): Ausblenden, Sortieren
            und — wo es welche gibt — die Widget-Einstellungen stehen darin. */}
        {instanz ? (
          <KartenMenueKnopf ziel={{ art: 'widget', instanzId: instanz.id }} titel={titel} />
        ) : null}
        {aktionRechts ? <div className="shrink-0">{aktionRechts}</div> : null}
      </div>
      {/* Lazy: Body existiert im DOM NUR ausgeklappt. */}
      {!eingeklappt ? (
        <div className={haupt ? 'px-4 pb-2' : 'px-4 pt-2.5 pb-3'}>{children}</div>
      ) : (
        <div className={haupt ? 'pb-1' : 'pb-2.5'} />
      )}
    </section>
  );
}
