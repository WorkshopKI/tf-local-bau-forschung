import { useState } from 'react';
import { Dialog } from '@/ui/Dialog';
import { useTourContext } from '@/core/hooks/useTour';

interface FooterShowcaseButtonProps {
  /** Aktive Plugin-ID (Home vs. andere Seite entscheidet über Label + Verhalten). */
  activeId: string;
  /** Anzeigename des aktiven Bereichs — für die Info-Dialog-Ansprache. */
  pageName: string;
}

/**
 * Kontextueller Fußzeilen-Button (obere Statuszeile, links):
 *
 * - **Home** → „Neu hier?" startet die bestehende Onboarding-Tour. Der Puls-Punkt
 *   signalisiert, dass die Tour noch nicht durchlaufen wurde.
 * - **jede andere Seite** → „Zeig es mir" öffnet einen kleinen Info-Dialog, der
 *   ankündigt, dass hier bald ein seitenspezifischer Anwendungsfall gezeigt wird.
 *   Die eigentlichen Use-Case-Touren sind bewusste Folgearbeit.
 *
 * Bewusst **ohne** Icon (Design-Entscheidung: die Fußzeile soll aufgeräumter sein).
 */
export function FooterShowcaseButton({ activeId, pageName }: FooterShowcaseButtonProps): React.ReactElement {
  const tour = useTourContext();
  const [infoOpen, setInfoOpen] = useState(false);
  const isHome = activeId === 'home';

  const buttonClass =
    'relative flex items-center gap-1.5 py-1.5 px-2 rounded-[var(--tf-radius)] text-[11px] ' +
    'text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] hover:text-[var(--tf-text)] ' +
    'transition-colors cursor-pointer shrink-0';

  if (isHome) {
    return (
      <button onClick={() => tour.start()} className={buttonClass} title="Onboarding-Tour starten">
        <span>Neu hier?</span>
        {!tour.hasCompleted && (
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--tf-primary)] animate-pulse" />
        )}
      </button>
    );
  }

  const bereich = pageName ? `„${pageName}"` : 'diesen Bereich';

  return (
    <>
      <button
        onClick={() => setInfoOpen(true)}
        className={buttonClass}
        title="Konkrete Anwendungsfälle für diese Seite"
      >
        <span>Zeig es mir</span>
      </button>

      <Dialog open={infoOpen} onClose={() => setInfoOpen(false)} title="Zeig es mir">
        <div className="space-y-4">
          <p className="text-[13px] text-[var(--tf-text)] leading-snug">
            Für {bereich} zeigen wir dir hier bald einen konkreten Anwendungsfall — Schritt für
            Schritt, so wie die Einführungs-Tour auf der Startseite.
          </p>

          <ul className="space-y-2 text-[12px] text-[var(--tf-text-secondary)] leading-snug">
            <li>
              <span className="text-[var(--tf-text)]">Suche:</span> eine echte Suche samt Filterung
              der Treffer — inklusive KI-Suche.
            </li>
            <li>
              <span className="text-[var(--tf-text)]">Auslastung:</span> der komplette Weg, um
              Anträge zuzuweisen — über alle Tabs des Moduls.
            </li>
          </ul>

          <p className="text-[11.5px] text-[var(--tf-text-tertiary)]">In Vorbereitung.</p>
        </div>
      </Dialog>
    </>
  );
}
